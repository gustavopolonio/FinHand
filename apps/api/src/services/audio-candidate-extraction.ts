import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import type { AudioTransactionExtractor } from "../ai/audio-transaction-extractor.js";
import type { Database } from "../db/index.js";
import {
  audioTranscripts,
  transactionCandidates,
  uploads,
  users,
} from "../db/schema/index.js";
import {
  classifyAudioCandidateExtractionFailure,
  classifyAudioCandidatePersistenceFailure,
  maximumAudioCandidateExtractionAttempts,
  type AudioCandidateExtractionFailureCode,
} from "./audio-candidate-extraction-failures.js";
import { audioTranscriptionLeaseDurationMilliseconds } from "./audio-transcription.js";
import {
  normalizeExtractedTransactionCandidates,
  type NormalizedTransactionCandidate,
} from "./transaction-candidate-normalization.js";

export interface ClaimedAudioTranscript extends Record<string, unknown> {
  id: string;
  userId: string;
  transcript: string;
  defaultCurrency: string;
  timeZone: string;
  processingLeaseId: string;
  processingLeaseExpiresAt: Date;
}

export interface AudioCandidateExtractionResult {
  uploadId: string;
  status: "processed" | "failed";
  candidateCount?: number;
  failureCode?: AudioCandidateExtractionFailureCode;
}

interface ProcessNextAudioCandidateExtractionOptions {
  database: Database;
  extractor: AudioTransactionExtractor;
  leaseDurationMilliseconds?: number;
  now?: Date;
}

export async function claimNextAudioTranscriptForCandidateExtraction(
  database: Database,
  leaseDurationMilliseconds = audioTranscriptionLeaseDurationMilliseconds,
): Promise<ClaimedAudioTranscript | null> {
  if (
    !Number.isInteger(leaseDurationMilliseconds) ||
    leaseDurationMilliseconds < 1
  ) {
    throw new Error(
      "Audio candidate extraction lease duration must be a positive integer.",
    );
  }

  const processingLeaseId = randomUUID();
  const result = await database.execute<ClaimedAudioTranscript>(sql`
    with next_upload as (
      select ${uploads.id}
      from ${uploads}
      inner join ${audioTranscripts}
        on ${audioTranscripts.uploadId} = ${uploads.id}
        and ${audioTranscripts.userId} = ${uploads.userId}
      where ${uploads.kind} = 'audio'
        and ${uploads.status} = 'uploaded'
        and ${uploads.processingAttempts} < ${maximumAudioCandidateExtractionAttempts}
        and not exists (
          select 1
          from ${transactionCandidates}
          where ${transactionCandidates.uploadId} = ${uploads.id}
        )
      order by ${uploads.createdAt} asc, ${uploads.id} asc
      for update of ${uploads} skip locked
      limit 1
    )
    update ${uploads} as claimed_upload
    set
      status = 'processing',
      failure_code = null,
      failure_dismissed_at = null,
      processing_attempts = claimed_upload.processing_attempts + 1,
      processing_lease_id = ${processingLeaseId},
      processing_lease_expires_at = now() + (${leaseDurationMilliseconds} * interval '1 millisecond'),
      updated_at = now()
    from next_upload, ${audioTranscripts} as transcript, ${users} as owner
    where claimed_upload.id = next_upload.id
      and transcript.upload_id = claimed_upload.id
      and transcript.user_id = claimed_upload.user_id
      and owner.id = claimed_upload.user_id
    returning
      claimed_upload.id,
      claimed_upload.user_id as "userId",
      transcript.text as "transcript",
      owner.default_currency as "defaultCurrency",
      owner.time_zone as "timeZone",
      claimed_upload.processing_lease_id as "processingLeaseId",
      claimed_upload.processing_lease_expires_at as "processingLeaseExpiresAt"
  `);

  return result.rows[0] ?? null;
}

export function getDateInTimeZone(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts.map(({ type, value }) => [type, value]),
    );

    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

async function persistAudioCandidates(
  database: Database,
  upload: ClaimedAudioTranscript,
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
        failureDismissedAt: null,
        processingLeaseId: null,
        processingLeaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(uploads.id, upload.id),
          eq(uploads.userId, upload.userId),
          eq(uploads.status, "processing"),
          eq(uploads.processingLeaseId, upload.processingLeaseId),
        ),
      )
      .returning({ id: uploads.id });

    if (!processedUpload) {
      throw new Error(
        "Claimed audio candidate extraction lease is no longer current.",
      );
    }
  });
}

async function failClaimedAudioTranscript(
  database: Database,
  upload: ClaimedAudioTranscript,
  failureCode: AudioCandidateExtractionFailureCode,
  processingError: unknown,
): Promise<AudioCandidateExtractionResult> {
  try {
    const [failedUpload] = await database
      .update(uploads)
      .set({
        status: "failed",
        failureCode,
        failureDismissedAt: null,
        processingLeaseId: null,
        processingLeaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(uploads.id, upload.id),
          eq(uploads.userId, upload.userId),
          eq(uploads.status, "processing"),
          eq(uploads.processingLeaseId, upload.processingLeaseId),
        ),
      )
      .returning({ id: uploads.id });

    if (!failedUpload) {
      throw new Error(
        "Claimed audio candidate extraction lease is no longer current.",
      );
    }
  } catch (failureTransitionError) {
    throw new AggregateError(
      [processingError, failureTransitionError],
      "Audio candidate extraction failed and the upload could not be marked as failed.",
    );
  }

  return { uploadId: upload.id, status: "failed", failureCode };
}

export async function processNextAudioCandidateExtraction({
  database,
  extractor,
  leaseDurationMilliseconds,
  now = new Date(),
}: ProcessNextAudioCandidateExtractionOptions): Promise<AudioCandidateExtractionResult | null> {
  const upload = await claimNextAudioTranscriptForCandidateExtraction(
    database,
    leaseDurationMilliseconds,
  );

  if (!upload) return null;

  let extractedCandidates;

  try {
    extractedCandidates = await extractor.extractTranscript({
      defaultCurrency: upload.defaultCurrency,
      referenceDate: getDateInTimeZone(now, upload.timeZone),
      timeZone: upload.timeZone,
      transcript: upload.transcript,
    });
  } catch (error) {
    return failClaimedAudioTranscript(
      database,
      upload,
      classifyAudioCandidateExtractionFailure(error),
      error,
    );
  }

  if (extractedCandidates.length === 0) {
    return failClaimedAudioTranscript(
      database,
      upload,
      "no_audio_transaction_candidates",
      new Error("Audio transcript contained no transaction candidates."),
    );
  }

  const normalized =
    normalizeExtractedTransactionCandidates(extractedCandidates);

  if (normalized.candidates.length === 0) {
    return failClaimedAudioTranscript(
      database,
      upload,
      "no_usable_audio_transaction_candidates",
      new Error("Audio transcript contained no usable transaction candidates."),
    );
  }

  try {
    await persistAudioCandidates(database, upload, normalized.candidates);
  } catch (error) {
    return failClaimedAudioTranscript(
      database,
      upload,
      classifyAudioCandidatePersistenceFailure(error),
      error,
    );
  }

  return {
    uploadId: upload.id,
    status: "processed",
    candidateCount: normalized.candidates.length,
  };
}
