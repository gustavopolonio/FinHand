import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../db/index.js";
import { uploads } from "../db/schema/index.js";
import {
  ConflictError,
  NotFoundError,
} from "../errors/application-errors.js";
import {
  getDocumentProcessingFailure,
  type DocumentProcessingFailure,
} from "./document-processing-failures.js";

export interface DocumentImportIssue {
  uploadId: string;
  originalFileName: string;
  failure: DocumentProcessingFailure;
  createdAt: string;
  failedAt: string;
}

export interface DismissedDocumentImportIssue {
  uploadId: string;
  dismissedAt: string;
  changed: boolean;
}

export async function listDocumentImportIssuesForUser(
  database: Database,
  userId: string,
): Promise<DocumentImportIssue[]> {
  const records = await database.query.uploads.findMany({
    columns: {
      id: true,
      originalFileName: true,
      failureCode: true,
      processingAttempts: true,
      createdAt: true,
      updatedAt: true,
    },
    where: (upload, { and, eq, isNull }) =>
      and(
        eq(upload.userId, userId),
        eq(upload.kind, "document"),
        eq(upload.status, "failed"),
        isNull(upload.failureDismissedAt),
      ),
    orderBy: (upload, { desc }) => [desc(upload.updatedAt), desc(upload.id)],
  });

  return records.map((record) => {
    const failure = getDocumentProcessingFailure(
      record.failureCode,
      record.processingAttempts,
    );

    if (!failure) {
      throw new Error("Failed document upload has no failure policy.");
    }

    return {
      uploadId: record.id,
      originalFileName: record.originalFileName,
      failure,
      createdAt: record.createdAt.toISOString(),
      failedAt: record.updatedAt.toISOString(),
    };
  });
}

export async function dismissDocumentImportIssueForUser(
  database: Database,
  userId: string,
  uploadId: string,
): Promise<DismissedDocumentImportIssue> {
  const dismissedAt = new Date();
  const [dismissedUpload] = await database
    .update(uploads)
    .set({ failureDismissedAt: dismissedAt, updatedAt: dismissedAt })
    .where(
      and(
        eq(uploads.id, uploadId),
        eq(uploads.userId, userId),
        eq(uploads.kind, "document"),
        eq(uploads.status, "failed"),
        isNull(uploads.failureDismissedAt),
      ),
    )
    .returning({
      id: uploads.id,
      failureDismissedAt: uploads.failureDismissedAt,
    });

  if (dismissedUpload?.failureDismissedAt) {
    return {
      uploadId: dismissedUpload.id,
      dismissedAt: dismissedUpload.failureDismissedAt.toISOString(),
      changed: true,
    };
  }

  const existingUpload = await database.query.uploads.findFirst({
    columns: {
      id: true,
      status: true,
      failureDismissedAt: true,
    },
    where: (upload, { and, eq }) =>
      and(
        eq(upload.id, uploadId),
        eq(upload.userId, userId),
        eq(upload.kind, "document"),
      ),
  });

  if (!existingUpload) {
    throw new NotFoundError("Document upload not found");
  }

  if (existingUpload.status !== "failed") {
    throw new ConflictError("Only failed document imports can be dismissed.");
  }

  if (!existingUpload.failureDismissedAt) {
    throw new ConflictError(
      "The document import changed before it could be dismissed.",
    );
  }

  return {
    uploadId: existingUpload.id,
    dismissedAt: existingUpload.failureDismissedAt.toISOString(),
    changed: false,
  };
}
