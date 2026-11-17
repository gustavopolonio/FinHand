import { createHash, randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import type { AudioTranscriber } from "../ai/audio-transcriber.js";
import type { Database } from "../db/index.js";
import { audioTranscripts, uploads } from "../db/schema/index.js";
import type { DocumentStorage } from "../storage/document-storage.js";
import type { SupportedAudioMimeType } from "./audio-uploads.js";
import {
  classifyAudioDownloadFailure,
  classifyAudioTranscriptionFailure,
  classifyTranscriptPersistenceFailure,
  maximumAudioTranscriptionAttempts,
  type AudioTranscriptionFailureCode,
} from "./audio-transcription-failures.js";

export const audioTranscriptionLeaseDurationMilliseconds = 10 * 60 * 1_000;

const supportedAudioMimeTypes = new Set<SupportedAudioMimeType>([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
]);

export interface ClaimedAudioUpload extends Record<string, unknown> {
  id: string;
  userId: string;
  objectKey: string;
  originalFileName: string;
  mimeType: string;
  checksumSha256: string | null;
  processingLeaseId: string;
  processingLeaseExpiresAt: Date;
}

export interface AudioTranscriptionResult {
  uploadId: string;
  status: "transcribed" | "failed";
  failureCode?: AudioTranscriptionFailureCode;
}

interface ProcessNextAudioTranscriptionOptions {
  database: Database;
  documentStorage: DocumentStorage;
  leaseDurationMilliseconds?: number;
  transcriber: AudioTranscriber;
}

export async function claimNextAudioUploadForTranscription(
  database: Database,
  leaseDurationMilliseconds = audioTranscriptionLeaseDurationMilliseconds,
): Promise<ClaimedAudioUpload | null> {
  if (
    !Number.isInteger(leaseDurationMilliseconds) ||
    leaseDurationMilliseconds < 1
  ) {
    throw new Error(
      "Audio transcription lease duration must be a positive integer.",
    );
  }

  const processingLeaseId = randomUUID();
  const result = await database.execute<ClaimedAudioUpload>(sql`
    with next_upload as (
      select ${uploads.id}
      from ${uploads}
      where ${uploads.kind} = 'audio'
        and ${uploads.status} = 'uploaded'
        and ${uploads.processingAttempts} < ${maximumAudioTranscriptionAttempts}
        and not exists (
          select 1
          from ${audioTranscripts}
          where ${audioTranscripts.uploadId} = ${uploads.id}
        )
      order by ${uploads.createdAt} asc, ${uploads.id} asc
      for update skip locked
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
    from next_upload
    where claimed_upload.id = next_upload.id
    returning
      claimed_upload.id,
      claimed_upload.user_id as "userId",
      claimed_upload.s3_object_key as "objectKey",
      claimed_upload.original_file_name as "originalFileName",
      claimed_upload.mime_type as "mimeType",
      claimed_upload.checksum_sha256 as "checksumSha256",
      claimed_upload.processing_lease_id as "processingLeaseId",
      claimed_upload.processing_lease_expires_at as "processingLeaseExpiresAt"
  `);

  return result.rows[0] ?? null;
}

async function persistAudioTranscript(
  database: Database,
  upload: ClaimedAudioUpload,
  transcription: Awaited<ReturnType<AudioTranscriber["transcribeAudio"]>>,
): Promise<void> {
  await database.transaction(async (transaction) => {
    await transaction.insert(audioTranscripts).values({
      uploadId: upload.id,
      userId: upload.userId,
      text: transcription.text,
      model: transcription.model,
      metadata: transcription.metadata,
    });

    const [releasedUpload] = await transaction
      .update(uploads)
      .set({
        status: "uploaded",
        failureCode: null,
        failureDismissedAt: null,
        processingAttempts: 0,
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

    if (!releasedUpload) {
      throw new Error("Claimed audio transcription lease is no longer current.");
    }
  });
}

function isSupportedAudioMimeType(
  mimeType: string,
): mimeType is SupportedAudioMimeType {
  return supportedAudioMimeTypes.has(mimeType as SupportedAudioMimeType);
}

function hasExpectedChecksum(content: Buffer, expectedChecksum: string | null) {
  return (
    expectedChecksum === null ||
    createHash("sha256").update(content).digest("hex") === expectedChecksum
  );
}

async function failClaimedAudioUpload(
  database: Database,
  upload: ClaimedAudioUpload,
  failureCode: AudioTranscriptionFailureCode,
  processingError: unknown,
): Promise<AudioTranscriptionResult> {
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
      throw new Error("Claimed audio transcription lease is no longer current.");
    }
  } catch (failureTransitionError) {
    throw new AggregateError(
      [processingError, failureTransitionError],
      "Audio transcription failed and the upload could not be marked as failed.",
      { cause: failureTransitionError },
    );
  }

  return { uploadId: upload.id, status: "failed", failureCode };
}

export async function processNextAudioTranscription({
  database,
  documentStorage,
  leaseDurationMilliseconds,
  transcriber,
}: ProcessNextAudioTranscriptionOptions): Promise<AudioTranscriptionResult | null> {
  const upload = await claimNextAudioUploadForTranscription(
    database,
    leaseDurationMilliseconds,
  );

  if (!upload) return null;

  let content: Buffer;

  try {
    content = await documentStorage.readDocument(upload.objectKey);
  } catch (error) {
    return failClaimedAudioUpload(
      database,
      upload,
      classifyAudioDownloadFailure(error),
      error,
    );
  }

  if (!hasExpectedChecksum(content, upload.checksumSha256)) {
    return failClaimedAudioUpload(
      database,
      upload,
      "audio_checksum_mismatch",
      new Error("Stored audio checksum does not match upload metadata."),
    );
  }

  if (!isSupportedAudioMimeType(upload.mimeType)) {
    return failClaimedAudioUpload(
      database,
      upload,
      "unsupported_audio_type",
      new Error("Stored audio has an unsupported media type."),
    );
  }

  let transcription: Awaited<
    ReturnType<AudioTranscriber["transcribeAudio"]>
  >;

  try {
    transcription = await transcriber.transcribeAudio({
      content,
      fileName: upload.originalFileName,
      mimeType: upload.mimeType,
    });
  } catch (error) {
    return failClaimedAudioUpload(
      database,
      upload,
      classifyAudioTranscriptionFailure(error),
      error,
    );
  }

  if (!transcription.text.trim()) {
    return failClaimedAudioUpload(
      database,
      upload,
      "empty_audio_transcript",
      new Error("Audio transcription returned no text."),
    );
  }

  try {
    await persistAudioTranscript(database, upload, transcription);
  } catch (error) {
    return failClaimedAudioUpload(
      database,
      upload,
      classifyTranscriptPersistenceFailure(error),
      error,
    );
  }

  return { uploadId: upload.id, status: "transcribed" };
}
