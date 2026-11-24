import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import { Readable } from "node:stream";

import { parseBuffer } from "music-metadata";

import type { Database } from "../db/index.js";
import { uploads } from "../db/schema/index.js";
import {
  InputError,
  PayloadTooLargeError,
} from "../errors/application-errors.js";
import type { DocumentStorage } from "../storage/document-storage.js";
import { createUploadObjectKey } from "../storage/upload-object-key.js";

export const maximumAudioRecordingBytes = 5 * 1024 * 1024;
export const maximumAudioRecordingSeconds = 30;

const durationToleranceSeconds = 0.5;
const maximumFileNameLength = 255;
const supportedAudioMimeTypes = [
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
] as const;

export type SupportedAudioMimeType =
  (typeof supportedAudioMimeTypes)[number];

export type AudioDurationReader = (
  content: Buffer,
  mimeType: SupportedAudioMimeType,
) => Promise<number | null>;

interface UploadAudioRecordingInput {
  database: Database;
  documentStorage: DocumentStorage;
  durationReader?: AudioDurationReader;
  fileName: string;
  mimeType: string;
  source: Readable;
  userId: string;
  wasTruncated?: () => boolean;
}

interface StoredAudioRecording {
  byteSize: bigint;
  checksumSha256: string;
  durationSeconds: number;
  id: string;
  mimeType: SupportedAudioMimeType;
  objectKey: string;
  originalFileName: string;
  userId: string;
}

export interface UploadedAudioRecording {
  byteSize: string;
  checksumSha256: string;
  createdAt: string;
  durationSeconds: number;
  id: string;
  mimeType: SupportedAudioMimeType;
  originalFileName: string;
  status: "uploaded";
  updatedAt: string;
}

function normalizeAudioMimeType(mimeType: string): SupportedAudioMimeType {
  const normalizedMimeType = mimeType.split(";", 1)[0]?.trim().toLowerCase();

  if (
    !normalizedMimeType ||
    !supportedAudioMimeTypes.includes(
      normalizedMimeType as SupportedAudioMimeType,
    )
  ) {
    throw new InputError(
      "Audio recording must use WebM, MP4, or Ogg format.",
    );
  }

  return normalizedMimeType as SupportedAudioMimeType;
}

function normalizeFileName(fileName: string): string {
  const normalizedFileName = basename(fileName.replaceAll("\\", "/"))
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

  if (!normalizedFileName) {
    throw new InputError("Audio recording file name is required.");
  }

  if (normalizedFileName.length > maximumFileNameLength) {
    throw new InputError(
      `Audio recording file name must contain at most ${maximumFileNameLength} characters.`,
    );
  }

  return normalizedFileName;
}

function hasExpectedAudioSignature(
  content: Buffer,
  mimeType: SupportedAudioMimeType,
): boolean {
  switch (mimeType) {
    case "audio/webm":
      return (
        content.length >= 4 &&
        content.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
      );
    case "audio/mp4":
      return content.length >= 8 && content.toString("ascii", 4, 8) === "ftyp";
    case "audio/ogg":
      return content.length >= 4 && content.toString("ascii", 0, 4) === "OggS";
  }
}

async function readAudioDuration(
  content: Buffer,
  mimeType: SupportedAudioMimeType,
): Promise<number | null> {
  try {
    const metadata = await parseBuffer(
      content,
      { mimeType, size: content.length },
      { duration: true, skipCovers: true },
    );

    return metadata.format.duration ?? null;
  } catch {
    throw new InputError(
      "Audio recording is corrupted or cannot be read.",
    );
  }
}

async function readAudioContent(
  source: Readable,
  wasTruncated: () => boolean,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let byteSize = 0;

  for await (const sourceChunk of source) {
    const chunk = Buffer.isBuffer(sourceChunk)
      ? sourceChunk
      : Buffer.from(sourceChunk);
    byteSize += chunk.length;

    if (byteSize > maximumAudioRecordingBytes) {
      throw new PayloadTooLargeError(
        "Audio recording must be at most 5 MB.",
        "AUDIO_TOO_LARGE",
      );
    }

    chunks.push(chunk);
  }

  if (wasTruncated()) {
    throw new PayloadTooLargeError(
      "Audio recording must be at most 5 MB.",
      "AUDIO_TOO_LARGE",
    );
  }

  if (byteSize === 0) {
    throw new InputError("Audio recording cannot be empty.");
  }

  return Buffer.concat(chunks, byteSize);
}

async function removeStoredAudioAfterFailure(
  documentStorage: DocumentStorage,
  objectKey: string,
  error: unknown,
): Promise<never> {
  try {
    await documentStorage.deleteDocument(objectKey);
  } catch (cleanupError) {
    throw new AggregateError(
      [error, cleanupError],
      "Audio upload failed and its storage cleanup was unsuccessful.",
      { cause: cleanupError },
    );
  }

  throw error;
}

async function validateAndStoreAudioRecording({
  documentStorage,
  durationReader = readAudioDuration,
  fileName,
  mimeType: declaredMimeType,
  source,
  userId,
  wasTruncated = () => false,
}: Omit<UploadAudioRecordingInput, "database">): Promise<StoredAudioRecording> {
  const mimeType = normalizeAudioMimeType(declaredMimeType);
  const originalFileName = normalizeFileName(fileName);
  const content = await readAudioContent(source, wasTruncated);

  if (!hasExpectedAudioSignature(content, mimeType)) {
    throw new InputError(
      "Audio recording content does not match its declared format.",
    );
  }

  const durationSeconds = await durationReader(content, mimeType);

  if (
    durationSeconds === null ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    throw new InputError("Audio recording duration could not be determined.");
  }

  if (
    durationSeconds >
    maximumAudioRecordingSeconds + durationToleranceSeconds
  ) {
    throw new InputError(
      `Audio recording must be at most ${maximumAudioRecordingSeconds} seconds.`,
    );
  }

  const id = randomUUID();
  const objectKey = createUploadObjectKey("audio");
  const checksumSha256 = createHash("sha256").update(content).digest("hex");

  try {
    await documentStorage.storeDocument({
      body: Readable.from([content]),
      contentType: mimeType,
      objectKey,
    });
  } catch (error) {
    return removeStoredAudioAfterFailure(documentStorage, objectKey, error);
  }

  return {
    byteSize: BigInt(content.length),
    checksumSha256,
    durationSeconds: Math.min(durationSeconds, maximumAudioRecordingSeconds),
    id,
    mimeType,
    objectKey,
    originalFileName,
    userId,
  };
}

async function persistAudioUpload(
  database: Database,
  recording: StoredAudioRecording,
): Promise<UploadedAudioRecording> {
  const [createdUpload] = await database
    .insert(uploads)
    .values({
      id: recording.id,
      userId: recording.userId,
      kind: "audio",
      source: "direct",
      s3ObjectKey: recording.objectKey,
      originalFileName: recording.originalFileName,
      mimeType: recording.mimeType,
      byteSize: recording.byteSize,
      checksumSha256: recording.checksumSha256,
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

  if (
    !createdUpload ||
    createdUpload.status !== "uploaded" ||
    !createdUpload.checksumSha256
  ) {
    throw new Error("Audio upload creation did not return a record.");
  }

  return {
    id: createdUpload.id,
    originalFileName: createdUpload.originalFileName,
    mimeType: createdUpload.mimeType as SupportedAudioMimeType,
    byteSize: createdUpload.byteSize.toString(),
    checksumSha256: createdUpload.checksumSha256,
    durationSeconds: recording.durationSeconds,
    status: "uploaded",
    createdAt: createdUpload.createdAt.toISOString(),
    updatedAt: createdUpload.updatedAt.toISOString(),
  };
}

export async function uploadAudioRecordingForUser(
  input: UploadAudioRecordingInput,
): Promise<UploadedAudioRecording> {
  const recording = await validateAndStoreAudioRecording(input);

  try {
    return await persistAudioUpload(input.database, recording);
  } catch (error) {
    return removeStoredAudioAfterFailure(
      input.documentStorage,
      recording.objectKey,
      error,
    );
  }
}
