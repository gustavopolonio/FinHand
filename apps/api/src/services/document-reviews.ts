import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  or,
} from "drizzle-orm";

import type { Database } from "../db/index.js";
import {
  transactionCandidates,
  uploads,
  type UploadStatus,
} from "../db/schema/index.js";

const activeUploadStatuses = [
  "pending",
  "uploaded",
  "processing",
] as const;
const maximumOpenDocumentReviews = 50;

export interface DocumentReviewListItem {
  uploadId: string;
  originalFileName: string;
  status: UploadStatus;
  failureCode: string | null;
  pendingCandidateCount: number;
  createdAt: string;
  updatedAt: string;
}

interface DocumentReviewRecord {
  uploadId: string;
  originalFileName: string;
  status: UploadStatus;
  failureCode: string | null;
  pendingCandidateCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function listOpenDocumentReviewsForUser(
  database: Database,
  userId: string,
): Promise<DocumentReviewListItem[]> {
  const records: DocumentReviewRecord[] = await database
    .select({
      uploadId: uploads.id,
      originalFileName: uploads.originalFileName,
      status: uploads.status,
      failureCode: uploads.failureCode,
      pendingCandidateCount: count(transactionCandidates.id),
      createdAt: uploads.createdAt,
      updatedAt: uploads.updatedAt,
    })
    .from(uploads)
    .leftJoin(
      transactionCandidates,
      and(
        eq(transactionCandidates.uploadId, uploads.id),
        eq(transactionCandidates.userId, uploads.userId),
        eq(transactionCandidates.status, "pending"),
      ),
    )
    .where(
      and(
        eq(uploads.userId, userId),
        or(
          inArray(uploads.status, activeUploadStatuses),
          and(
            eq(uploads.status, "processed"),
            isNotNull(transactionCandidates.id),
          ),
        ),
      ),
    )
    .groupBy(
      uploads.id,
      uploads.originalFileName,
      uploads.status,
      uploads.failureCode,
      uploads.createdAt,
      uploads.updatedAt,
    )
    .orderBy(desc(uploads.updatedAt), desc(uploads.id))
    .limit(maximumOpenDocumentReviews);

  return records.map((record) => ({
    ...record,
    pendingCandidateCount: Number(record.pendingCandidateCount),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }));
}
