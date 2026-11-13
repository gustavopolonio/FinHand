import { sql } from "drizzle-orm";

import type { Database } from "../db/index.js";
import { uploads } from "../db/schema/index.js";
import { maximumDocumentProcessingAttempts } from "./document-processing-failures.js";

export const documentProcessingRecoveryBatchSize = 100;

interface RecoveredDocumentUpload extends Record<string, unknown> {
  id: string;
  status: "uploaded" | "failed";
}

export interface DocumentProcessingRecoveryResult {
  failedCount: number;
  requeuedCount: number;
}

export async function recoverExpiredDocumentProcessingLeases(
  database: Database,
  batchSize = documentProcessingRecoveryBatchSize,
): Promise<DocumentProcessingRecoveryResult> {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(
      "Document processing recovery batch size must be a positive integer.",
    );
  }

  const result = await database.execute<RecoveredDocumentUpload>(sql`
    with expired_uploads as (
      select ${uploads.id}
      from ${uploads}
      where ${uploads.kind} = 'document'
        and ${uploads.status} = 'processing'
        and ${uploads.processingLeaseExpiresAt} <= now()
      order by ${uploads.processingLeaseExpiresAt} asc, ${uploads.id} asc
      for update skip locked
      limit ${batchSize}
    )
    update ${uploads} as recovered_upload
    set
      status = case
        when recovered_upload.processing_attempts < ${maximumDocumentProcessingAttempts}
          then 'uploaded'
        else 'failed'
      end,
      failure_code = case
        when recovered_upload.processing_attempts < ${maximumDocumentProcessingAttempts}
          then null
        else 'processing_interrupted'
      end,
      processing_lease_id = null,
      processing_lease_expires_at = null,
      updated_at = now()
    from expired_uploads
    where recovered_upload.id = expired_uploads.id
      and recovered_upload.status = 'processing'
      and recovered_upload.processing_lease_expires_at <= now()
    returning recovered_upload.id, recovered_upload.status
  `);

  return result.rows.reduce<DocumentProcessingRecoveryResult>(
    (counts, upload) => {
      if (upload.status === "uploaded") {
        counts.requeuedCount += 1;
      } else {
        counts.failedCount += 1;
      }

      return counts;
    },
    { failedCount: 0, requeuedCount: 0 },
  );
}
