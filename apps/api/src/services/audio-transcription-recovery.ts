import { sql } from "drizzle-orm";

import type { Database } from "../db/index.js";
import { audioTranscripts, uploads } from "../db/schema/index.js";
import { maximumAudioTranscriptionAttempts } from "./audio-transcription-failures.js";

export const audioTranscriptionRecoveryBatchSize = 100;

interface RecoveredAudioUpload extends Record<string, unknown> {
  id: string;
  status: "uploaded" | "failed";
}

export interface AudioTranscriptionRecoveryResult {
  failedCount: number;
  requeuedCount: number;
}

export async function recoverExpiredAudioTranscriptionLeases(
  database: Database,
  batchSize = audioTranscriptionRecoveryBatchSize,
): Promise<AudioTranscriptionRecoveryResult> {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(
      "Audio transcription recovery batch size must be a positive integer.",
    );
  }

  const result = await database.execute<RecoveredAudioUpload>(sql`
    with expired_uploads as (
      select ${uploads.id}
      from ${uploads}
      where ${uploads.kind} = 'audio'
        and ${uploads.status} = 'processing'
        and ${uploads.processingLeaseExpiresAt} <= now()
        and not exists (
          select 1
          from ${audioTranscripts}
          where ${audioTranscripts.uploadId} = ${uploads.id}
        )
      order by ${uploads.processingLeaseExpiresAt} asc, ${uploads.id} asc
      for update skip locked
      limit ${batchSize}
    )
    update ${uploads} as recovered_upload
    set
      status = case
        when recovered_upload.processing_attempts < ${maximumAudioTranscriptionAttempts}
          then 'uploaded'
        else 'failed'
      end,
      failure_code = case
        when recovered_upload.processing_attempts < ${maximumAudioTranscriptionAttempts}
          then null
        else 'audio_transcription_interrupted'
      end,
      failure_dismissed_at = null,
      processing_lease_id = null,
      processing_lease_expires_at = null,
      updated_at = now()
    from expired_uploads
    where recovered_upload.id = expired_uploads.id
      and recovered_upload.status = 'processing'
      and recovered_upload.processing_lease_expires_at <= now()
    returning recovered_upload.id, recovered_upload.status
  `);

  return result.rows.reduce<AudioTranscriptionRecoveryResult>(
    (counts, recoveredUpload) => {
      if (recoveredUpload.status === "uploaded") {
        counts.requeuedCount += 1;
      } else {
        counts.failedCount += 1;
      }

      return counts;
    },
    { failedCount: 0, requeuedCount: 0 },
  );
}
