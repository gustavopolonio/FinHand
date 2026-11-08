import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import { Readable } from "node:stream";

import type { Database } from "../db/index.js";
import {
  uploads,
  type UploadSource,
} from "../db/schema/index.js";
import {
  InputError,
  PayloadTooLargeError,
} from "../errors/application-errors.js";
import type { DocumentStorage } from "../storage/document-storage.js";

export const maximumDocumentUploadBytes = 10 * 1024 * 1024; // 10 MiB

const maximumFileNameLength = 255;
const signatures = {
  "application/pdf": Buffer.from("%PDF-"),
  "image/jpeg": Buffer.from([0xff, 0xd8, 0xff]),
  "image/png": Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]),
} as const;

export type SupportedDocumentMimeType = keyof typeof signatures;

interface UploadDocumentInput {
  database: Database;
  documentStorage: DocumentStorage;
  fileName: string;
  mimeType: string;
  source: Readable;
  wasTruncated?: () => boolean;
  userId: string;
}

export interface UploadRecord {
  id: string;
  originalFileName: string;
  mimeType: string;
  byteSize: bigint;
  checksumSha256: string | null;
  status: "uploaded";
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredDocument {
  id: string;
  userId: string;
  objectKey: string;
  originalFileName: string;
  mimeType: SupportedDocumentMimeType;
  byteSize: bigint;
  checksumSha256: string;
}

export interface UploadedDocument {
  id: string;
  originalFileName: string;
  mimeType: string;
  byteSize: string;
  checksumSha256: string;
  status: "uploaded";
  createdAt: string;
  updatedAt: string;
}

function normalizeMimeType(mimeType: string): SupportedDocumentMimeType {
  const normalizedMimeType = mimeType.split(";", 1)[0]?.trim().toLowerCase();

  if (!normalizedMimeType || !(normalizedMimeType in signatures)) {
    throw new InputError(
      "Document must be a JPEG image, PNG image, or PDF file.",
    );
  }

  return normalizedMimeType as SupportedDocumentMimeType;
}

function normalizeFileName(fileName: string): string {
  const normalizedFileName = basename(fileName.replaceAll("\\", "/"))
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

  if (!normalizedFileName) {
    throw new InputError("Document file name is required.");
  }

  if (normalizedFileName.length > maximumFileNameLength) {
    throw new InputError(
      `Document file name must contain at most ${maximumFileNameLength} characters.`,
    );
  }

  return normalizedFileName;
}

function hasExpectedSignature(
  content: Buffer,
  mimeType: SupportedDocumentMimeType,
) {
  const signature = signatures[mimeType];
  return (
    content.length >= signature.length &&
    content.subarray(0, signature.length).equals(signature)
  );
}

function createValidatedDocumentStream(
  source: Readable,
  mimeType: SupportedDocumentMimeType,
) {
  const signatureLength = signatures[mimeType].length;
  const hash = createHash("sha256");
  let byteSize = 0;
  let checksumSha256: string | null = null;

  function validateAndMeasure(chunk: Buffer) {
    byteSize += chunk.length;

    if (byteSize > maximumDocumentUploadBytes) {
      throw new PayloadTooLargeError("Document must be at most 10 MB.");
    }

    hash.update(chunk);
  }

  async function* chunks() {
    let initialContent = Buffer.alloc(0);

    for await (const sourceChunk of source) {
      const chunk = Buffer.isBuffer(sourceChunk)
        ? sourceChunk
        : Buffer.from(sourceChunk);

      if (initialContent.length < signatureLength) {
        initialContent = Buffer.concat([initialContent, chunk]);

        if (initialContent.length < signatureLength) {
          continue;
        }

        if (!hasExpectedSignature(initialContent, mimeType)) {
          throw new InputError(
            "Document content does not match its declared file type.",
          );
        }

        validateAndMeasure(initialContent);
        yield initialContent;
        continue;
      }

      validateAndMeasure(chunk);
      yield chunk;
    }

    if (initialContent.length === 0) {
      throw new InputError("Document cannot be empty.");
    }

    if (initialContent.length < signatureLength) {
      throw new InputError(
        "Document content does not match its declared file type.",
      );
    }

    checksumSha256 = hash.digest("hex");
  }

  return {
    body: Readable.from(chunks()),
    result() {
      if (!checksumSha256) {
        throw new Error("Document stream was not completely stored.");
      }

      return { byteSize: BigInt(byteSize), checksumSha256 };
    },
  };
}

export function serializeUpload(upload: UploadRecord): UploadedDocument {
  if (!upload.checksumSha256) {
    throw new Error("Uploaded document is missing its checksum.");
  }

  return {
    id: upload.id,
    originalFileName: upload.originalFileName,
    mimeType: upload.mimeType,
    byteSize: upload.byteSize.toString(),
    checksumSha256: upload.checksumSha256,
    status: upload.status,
    createdAt: upload.createdAt.toISOString(),
    updatedAt: upload.updatedAt.toISOString(),
  };
}

async function removeStoredDocumentAfterFailure(
  documentStorage: DocumentStorage,
  objectKey: string,
  error: unknown,
): Promise<never> {
  try {
    await documentStorage.deleteDocument(objectKey);
  } catch (cleanupError) {
    throw new AggregateError(
      [error, cleanupError],
      "Document upload failed and its storage cleanup was unsuccessful.",
    );
  }

  throw error;
}

export async function storeValidatedDocument({
  documentStorage,
  fileName,
  mimeType: declaredMimeType,
  source,
  wasTruncated = () => false,
  userId,
}: Omit<UploadDocumentInput, "database">): Promise<StoredDocument> {
  const mimeType = normalizeMimeType(declaredMimeType);
  const originalFileName = normalizeFileName(fileName);
  const id = randomUUID();
  const objectKey = `${userId}/documents/${id}`;
  const validatedDocument = createValidatedDocumentStream(source, mimeType);

  try {
    await documentStorage.storeDocument({
      body: validatedDocument.body,
      contentType: mimeType,
      objectKey,
    });

    if (wasTruncated()) {
      throw new PayloadTooLargeError("Document must be at most 10 MB.");
    }

    const { byteSize, checksumSha256 } = validatedDocument.result();

    return {
      id,
      userId,
      objectKey,
      originalFileName,
      mimeType,
      byteSize,
      checksumSha256,
    };
  } catch (error) {
    return removeStoredDocumentAfterFailure(
      documentStorage,
      objectKey,
      error,
    );
  }
}

type UploadPersistence = Pick<Database, "insert">;

export async function persistDocumentUpload(
  database: UploadPersistence,
  document: StoredDocument,
  source: UploadSource,
): Promise<UploadedDocument> {
  const [createdUpload] = await database
    .insert(uploads)
    .values({
      id: document.id,
      userId: document.userId,
      kind: "document",
      source,
      s3ObjectKey: document.objectKey,
      originalFileName: document.originalFileName,
      mimeType: document.mimeType,
      byteSize: document.byteSize,
      checksumSha256: document.checksumSha256,
      status: "uploaded",
    })
    .returning({
      id: uploads.id,
      originalFileName: uploads.originalFileName,
      mimeType: uploads.mimeType,
      byteSize: uploads.byteSize,
      checksumSha256: uploads.checksumSha256,
      status: uploads.status,
      createdAt: uploads.createdAt,
      updatedAt: uploads.updatedAt,
    });

  if (!createdUpload || createdUpload.status !== "uploaded") {
    throw new Error("Document upload creation did not return a record.");
  }

  return serializeUpload(createdUpload as UploadRecord);
}

export async function discardStoredDocument(
  documentStorage: DocumentStorage,
  document: StoredDocument,
  error: unknown,
): Promise<never> {
  return removeStoredDocumentAfterFailure(
    documentStorage,
    document.objectKey,
    error,
  );
}

export async function uploadDocumentForUser({
  database,
  documentStorage,
  fileName,
  mimeType,
  source,
  wasTruncated,
  userId,
}: UploadDocumentInput): Promise<UploadedDocument> {
  const storedDocument = await storeValidatedDocument({
    documentStorage,
    fileName,
    mimeType,
    source,
    wasTruncated,
    userId,
  });

  try {
    return await persistDocumentUpload(database, storedDocument, "direct");
  } catch (error) {
    return discardStoredDocument(documentStorage, storedDocument, error);
  }
}
