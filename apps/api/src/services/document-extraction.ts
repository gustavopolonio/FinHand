import { createHash } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import type {
  DocumentTransactionExtractor,
  ExtractedTransactionCandidate,
} from "../ai/document-transaction-extractor.js";
import type { Database } from "../db/index.js";
import {
  transactionCandidates,
  uploads,
} from "../db/schema/index.js";
import type { DocumentStorage } from "../storage/document-storage.js";
import type { SupportedDocumentMimeType } from "./document-uploads.js";
import {
  normalizeExtractedTransactionCandidates,
  type NormalizedTransactionCandidate,
} from "./transaction-candidate-normalization.js";
import { markUploadAsFailed } from "./upload-state.js";

const supportedDocumentMimeTypes = new Set<SupportedDocumentMimeType>([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export interface ClaimedDocumentUpload extends Record<string, unknown> {
  id: string;
  userId: string;
  objectKey: string;
  originalFileName: string;
  mimeType: string;
  checksumSha256: string | null;
}

export interface DocumentExtractionResult {
  uploadId: string;
  status: "processed" | "failed";
  candidateCount?: number;
  failureCode?: string;
}

interface ProcessNextDocumentUploadOptions {
  database: Database;
  documentStorage: DocumentStorage;
  extractor: DocumentTransactionExtractor;
}

export async function claimNextDocumentUpload(
  database: Database,
): Promise<ClaimedDocumentUpload | null> {
  const result = await database.execute<ClaimedDocumentUpload>(sql`
    with next_upload as (
      select ${uploads.id}
      from ${uploads}
      where ${uploads.kind} = 'document'
        and ${uploads.status} = 'uploaded'
      order by ${uploads.createdAt} asc, ${uploads.id} asc
      for update skip locked
      limit 1
    )
    update ${uploads} as claimed_upload
    set
      status = 'processing',
      failure_code = null,
      updated_at = now()
    from next_upload
    where claimed_upload.id = next_upload.id
    returning
      claimed_upload.id,
      claimed_upload.user_id as "userId",
      claimed_upload.s3_object_key as "objectKey",
      claimed_upload.original_file_name as "originalFileName",
      claimed_upload.mime_type as "mimeType",
      claimed_upload.checksum_sha256 as "checksumSha256"
  `);

  return result.rows[0] ?? null;
}

async function persistExtractedCandidates(
  database: Database,
  upload: ClaimedDocumentUpload,
  candidates: NormalizedTransactionCandidate[],
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.insert(transactionCandidates).values(
      candidates.map((candidate, position) => ({
        userId: upload.userId,
        uploadId: upload.id,
        position,
        type: candidate.type,
        amountMinor: candidate.amountMinor,
        currencyCode: candidate.currencyCode,
        occurredOn: candidate.occurredOn,
        description: candidate.description,
        counterparty: candidate.counterparty,
        notes: candidate.notes,
        extractionMetadata: candidate.extractionMetadata,
        status: "pending" as const,
      })),
    );

    const [processedUpload] = await transaction
      .update(uploads)
      .set({
        status: "processed",
        failureCode: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(uploads.id, upload.id),
          eq(uploads.userId, upload.userId),
          eq(uploads.status, "processing"),
        ),
      )
      .returning({ id: uploads.id });

    if (!processedUpload) {
      throw new Error("Claimed document is no longer processing.");
    }
  });
}

function isSupportedDocumentMimeType(
  mimeType: string,
): mimeType is SupportedDocumentMimeType {
  return supportedDocumentMimeTypes.has(
    mimeType as SupportedDocumentMimeType,
  );
}

function hasExpectedChecksum(content: Buffer, expectedChecksum: string | null) {
  return (
    expectedChecksum === null ||
    createHash("sha256").update(content).digest("hex") === expectedChecksum
  );
}

async function failClaimedUpload(
  database: Database,
  upload: ClaimedDocumentUpload,
  failureCode: string,
  processingError: unknown,
): Promise<DocumentExtractionResult> {
  try {
    await markUploadAsFailed(
      database,
      upload.userId,
      upload.id,
      failureCode,
    );
  } catch (failureTransitionError) {
    throw new AggregateError(
      [processingError, failureTransitionError],
      "Document extraction failed and the upload could not be marked as failed.",
    );
  }

  return {
    uploadId: upload.id,
    status: "failed",
    failureCode,
  };
}

export async function processNextDocumentUpload({
  database,
  documentStorage,
  extractor,
}: ProcessNextDocumentUploadOptions): Promise<DocumentExtractionResult | null> {
  const upload = await claimNextDocumentUpload(database);

  if (!upload) {
    return null;
  }

  let content: Buffer;

  try {
    content = await documentStorage.readDocument(upload.objectKey);
  } catch (error) {
    return failClaimedUpload(
      database,
      upload,
      "document_download_failed",
      error,
    );
  }

  if (!hasExpectedChecksum(content, upload.checksumSha256)) {
    return failClaimedUpload(
      database,
      upload,
      "document_checksum_mismatch",
      new Error("Stored document checksum does not match upload metadata."),
    );
  }

  if (!isSupportedDocumentMimeType(upload.mimeType)) {
    return failClaimedUpload(
      database,
      upload,
      "unsupported_document_type",
      new Error("Stored document has an unsupported media type."),
    );
  }

  let candidates: ExtractedTransactionCandidate[];

  try {
    candidates = await extractor.extractDocument({
      content,
      fileName: upload.originalFileName,
      mimeType: upload.mimeType,
    });
  } catch (error) {
    return failClaimedUpload(
      database,
      upload,
      "document_extraction_failed",
      error,
    );
  }

  if (candidates.length === 0) {
    return failClaimedUpload(
      database,
      upload,
      "no_transaction_candidates",
      new Error("Document extraction returned no transaction candidates."),
    );
  }

  const normalizationResult = normalizeExtractedTransactionCandidates(
    candidates,
  );

  if (normalizationResult.candidates.length === 0) {
    return failClaimedUpload(
      database,
      upload,
      "no_usable_transaction_candidates",
      new Error(
        "Document extraction returned no candidates with meaningful transaction data.",
      ),
    );
  }

  try {
    await persistExtractedCandidates(
      database,
      upload,
      normalizationResult.candidates,
    );
  } catch (error) {
    return failClaimedUpload(
      database,
      upload,
      "candidate_persistence_failed",
      error,
    );
  }

  return {
    uploadId: upload.id,
    status: "processed",
    candidateCount: normalizationResult.candidates.length,
  };
}
