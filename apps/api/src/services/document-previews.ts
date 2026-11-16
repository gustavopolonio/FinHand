import type { Database } from "../db/index.js";
import type { UploadKind } from "../db/schema/index.js";
import { NotFoundError } from "../errors/application-errors.js";
import type { DocumentStorage } from "../storage/document-storage.js";

export const documentPreviewUrlLifetimeSeconds = 5 * 60; // 5 min

export interface DocumentPreview {
  url: string;
  contentType: string;
  expiresAt: string;
}

interface GetDocumentPreviewInput {
  database: Database;
  documentStorage: DocumentStorage;
  now?: Date;
  uploadId: string;
  userId: string;
}

interface GetUploadPreviewInput extends GetDocumentPreviewInput {
  kind: UploadKind;
}

async function getUploadPreviewForUser({
  database,
  documentStorage,
  kind,
  now = new Date(),
  uploadId,
  userId,
}: GetUploadPreviewInput): Promise<DocumentPreview> {
  const upload = await database.query.uploads.findFirst({
    columns: {
      mimeType: true,
      s3ObjectKey: true,
    },
    where: (candidateUpload, { and, eq }) =>
      and(
        eq(candidateUpload.id, uploadId),
        eq(candidateUpload.userId, userId),
        eq(candidateUpload.kind, kind),
      ),
  });

  if (!upload) {
    throw new NotFoundError(
      kind === "audio" ? "Audio upload not found" : "Document upload not found",
    );
  }

  const url = await documentStorage.createDocumentPreviewUrl(
    upload.s3ObjectKey,
    documentPreviewUrlLifetimeSeconds,
  );

  return {
    url,
    contentType: upload.mimeType,
    expiresAt: new Date(
      now.getTime() + documentPreviewUrlLifetimeSeconds * 1_000,
    ).toISOString(),
  };
}

export async function getDocumentPreviewForUser({
  database,
  documentStorage,
  now = new Date(),
  uploadId,
  userId,
}: GetDocumentPreviewInput): Promise<DocumentPreview> {
  return getUploadPreviewForUser({
    database,
    documentStorage,
    kind: "document",
    now,
    uploadId,
    userId,
  });
}

export async function getAudioPreviewForUser(
  input: GetDocumentPreviewInput,
): Promise<DocumentPreview> {
  return getUploadPreviewForUser({ ...input, kind: "audio" });
}
