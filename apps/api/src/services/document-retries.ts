import { and, eq, lt } from "drizzle-orm";

import type { Database } from "../db/index.js";
import { uploads, type UploadStatus } from "../db/schema/index.js";
import {
  ConflictError,
  NotFoundError,
} from "../errors/application-errors.js";
import {
  getDocumentProcessingFailure,
  maximumDocumentProcessingAttempts,
} from "./document-processing-failures.js";
import { lockAndAssertProcessingJobQuotaAvailable } from "./upload-quotas.js";

interface FailedDocumentRecord {
  id: string;
  status: UploadStatus;
  failureCode: string | null;
  processingAttempts: number;
}

export interface RetriedDocumentUpload {
  id: string;
  status: UploadStatus;
  failureCode: string | null;
  processingAttempts: number;
  updatedAt: string;
}

export async function retryFailedDocumentUploadForUser(
  database: Database,
  userId: string,
  uploadId: string,
): Promise<RetriedDocumentUpload> {
  const upload: FailedDocumentRecord | undefined =
    await database.query.uploads.findFirst({
      columns: {
        id: true,
        status: true,
        failureCode: true,
        processingAttempts: true,
      },
      where: (documentUpload, { and, eq }) =>
        and(
          eq(documentUpload.id, uploadId),
          eq(documentUpload.userId, userId),
          eq(documentUpload.kind, "document"),
        ),
    });

  if (!upload) {
    throw new NotFoundError("Document upload not found");
  }

  if (upload.status !== "failed" || upload.failureCode === null) {
    throw new ConflictError("Only failed document uploads can be retried.");
  }

  const failureCode = upload.failureCode;

  const failure = getDocumentProcessingFailure(
    failureCode,
    upload.processingAttempts,
  );

  if (!failure?.canRetry) {
    throw new ConflictError(
      failure?.message ?? "This document failure cannot be retried.",
    );
  }

  const updatedAt = new Date();
  const retriedUpload = await database.transaction(async (transaction) => {
    await lockAndAssertProcessingJobQuotaAvailable(transaction, userId);
    const [updatedUpload] = await transaction
      .update(uploads)
      .set({
        status: "uploaded",
        failureCode: null,
        failureDismissedAt: null,
        updatedAt,
      })
      .where(
        and(
          eq(uploads.id, uploadId),
          eq(uploads.userId, userId),
          eq(uploads.kind, "document"),
          eq(uploads.status, "failed"),
          eq(uploads.failureCode, failureCode),
          lt(uploads.processingAttempts, maximumDocumentProcessingAttempts),
        ),
      )
      .returning({
        id: uploads.id,
        status: uploads.status,
        failureCode: uploads.failureCode,
        processingAttempts: uploads.processingAttempts,
        updatedAt: uploads.updatedAt,
      });

    return updatedUpload;
  });

  if (!retriedUpload) {
    throw new ConflictError(
      "The document upload changed before it could be retried.",
    );
  }

  return {
    ...retriedUpload,
    updatedAt: retriedUpload.updatedAt.toISOString(),
  };
}
