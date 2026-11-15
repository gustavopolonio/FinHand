import { createHash } from "node:crypto";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AudioTranscriber } from "../ai/audio-transcriber.js";
import type { Database } from "../db/index.js";
import { audioTranscripts, uploads } from "../db/schema/index.js";
import type { DocumentStorage } from "../storage/document-storage.js";
import {
  claimNextAudioUploadForTranscription,
  processNextAudioTranscription,
  type ClaimedAudioUpload,
} from "./audio-transcription.js";

const postgresDialect = new PgDialect();
const now = new Date("2026-11-16T12:00:00.000Z");
const content = Buffer.from("webm-audio-content");
const upload: ClaimedAudioUpload = {
  id: "44444444-4444-4444-8444-444444444444",
  userId: "33333333-3333-4333-8333-333333333333",
  objectKey:
    "33333333-3333-4333-8333-333333333333/audio/44444444-4444-4444-8444-444444444444",
  originalFileName: "voice-recording.webm",
  mimeType: "audio/webm",
  checksumSha256: createHash("sha256").update(content).digest("hex"),
  processingLeaseId: "55555555-5555-4555-8555-555555555555",
  processingLeaseExpiresAt: new Date("2026-11-16T12:10:00.000Z"),
};
const transcription = {
  model: "gpt-transcribe",
  text: "I spent fifty reais at the market.",
  metadata: {
    languageCodes: ["en"],
    usage: { type: "duration", seconds: 4.2 },
  },
};

interface DatabaseFixtureOptions {
  claimedUpload?: ClaimedAudioUpload | null;
  failedUploadExists?: boolean;
  insertError?: Error;
  markFailedError?: Error;
  releasedUploadExists?: boolean;
}

function createDatabaseFixture({
  claimedUpload = upload,
  failedUploadExists = true,
  insertError,
  markFailedError,
  releasedUploadExists = true,
}: DatabaseFixtureOptions = {}) {
  const execute = vi.fn().mockResolvedValue({
    rows: claimedUpload ? [claimedUpload] : [],
  });
  const transcriptValues = insertError
    ? vi.fn().mockRejectedValue(insertError)
    : vi.fn().mockResolvedValue(undefined);
  const transcriptInsert = vi.fn().mockReturnValue({
    values: transcriptValues,
  });
  const releasedReturning = vi
    .fn()
    .mockResolvedValue(releasedUploadExists ? [{ id: upload.id }] : []);
  const releasedWhere = vi.fn().mockReturnValue({
    returning: releasedReturning,
  });
  const releasedSet = vi.fn().mockReturnValue({ where: releasedWhere });
  const releasedUpdate = vi.fn().mockReturnValue({ set: releasedSet });
  const transaction = vi.fn(async (operation) =>
    operation({ insert: transcriptInsert, update: releasedUpdate }),
  );

  const failedReturning = markFailedError
    ? vi.fn().mockRejectedValue(markFailedError)
    : vi.fn().mockResolvedValue(
        failedUploadExists ? [{ id: upload.id }] : [],
      );
  const failedWhere = vi.fn().mockReturnValue({
    returning: failedReturning,
  });
  const failedSet = vi.fn().mockReturnValue({ where: failedWhere });
  const failedUpdate = vi.fn().mockReturnValue({ set: failedSet });
  const database = {
    execute,
    transaction,
    update: failedUpdate,
  } as unknown as Database;

  return {
    database,
    execute,
    failedSet,
    failedUpdate,
    failedWhere,
    releasedSet,
    releasedUpdate,
    releasedWhere,
    transaction,
    transcriptInsert,
    transcriptValues,
  };
}

function createStorage(options: { error?: unknown; value?: Buffer } = {}) {
  const readDocument = options.error
    ? vi.fn().mockRejectedValue(options.error)
    : vi.fn().mockResolvedValue(options.value ?? content);

  return {
    close: vi.fn(),
    createDocumentPreviewUrl: vi.fn(),
    deleteDocument: vi.fn(),
    readDocument,
    storeDocument: vi.fn(),
  } satisfies DocumentStorage;
}

function createTranscriber(options: { error?: unknown; text?: string } = {}) {
  const transcribeAudio = options.error
    ? vi.fn().mockRejectedValue(options.error)
    : vi.fn().mockResolvedValue({
        ...transcription,
        text: options.text ?? transcription.text,
      });

  return { transcribeAudio } satisfies AudioTranscriber;
}

function compileSql(expression: unknown) {
  return postgresDialect.sqlToQuery(expression as SQL);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("audio transcription service", () => {
  it("atomically claims only an untranscribed audio upload", async () => {
    const fixture = createDatabaseFixture();

    await expect(
      claimNextAudioUploadForTranscription(fixture.database),
    ).resolves.toEqual(upload);

    const query = compileSql(fixture.execute.mock.calls[0]?.[0]);
    const normalizedSql = query.sql.toLowerCase();
    expect(normalizedSql).toContain("for update skip locked");
    expect(normalizedSql).toContain('"uploads"."kind" = \'audio\'');
    expect(normalizedSql).toContain('"uploads"."status" = \'uploaded\'');
    expect(normalizedSql).toContain("not exists");
    expect(normalizedSql).toContain('from "audio_transcripts"');
    expect(normalizedSql).toContain('status = \'processing\'');
    expect(normalizedSql).toContain(
      "processing_attempts = claimed_upload.processing_attempts + 1",
    );
    expect(normalizedSql).toContain("processing_lease_expires_at = now()");
    expect(query.params).toContain(3);
  });

  it("returns null when no untranscribed audio is available", async () => {
    const fixture = createDatabaseFixture({ claimedUpload: null });

    await expect(
      processNextAudioTranscription({
        database: fixture.database,
        documentStorage: createStorage(),
        transcriber: createTranscriber(),
      }),
    ).resolves.toBeNull();

    expect(fixture.transaction).not.toHaveBeenCalled();
  });

  it("downloads, transcribes, and persists one ownership-safe transcript", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const fixture = createDatabaseFixture();
    const storage = createStorage();
    const transcriber = createTranscriber();

    await expect(
      processNextAudioTranscription({
        database: fixture.database,
        documentStorage: storage,
        transcriber,
      }),
    ).resolves.toEqual({ uploadId: upload.id, status: "transcribed" });

    expect(storage.readDocument).toHaveBeenCalledWith(upload.objectKey);
    expect(transcriber.transcribeAudio).toHaveBeenCalledWith({
      content,
      fileName: upload.originalFileName,
      mimeType: upload.mimeType,
    });
    expect(fixture.transcriptInsert).toHaveBeenCalledWith(audioTranscripts);
    expect(fixture.transcriptValues).toHaveBeenCalledWith({
      uploadId: upload.id,
      userId: upload.userId,
      text: transcription.text,
      model: transcription.model,
      metadata: transcription.metadata,
    });
    expect(fixture.releasedUpdate).toHaveBeenCalledWith(uploads);
    expect(fixture.releasedSet).toHaveBeenCalledWith({
      status: "uploaded",
      failureCode: null,
      failureDismissedAt: null,
      processingAttempts: 0,
      processingLeaseId: null,
      processingLeaseExpiresAt: null,
      updatedAt: now,
    });
    expect(compileSql(fixture.releasedWhere.mock.calls[0]?.[0]).params).toEqual([
      upload.id,
      upload.userId,
      "processing",
      upload.processingLeaseId,
    ]);
    expect(fixture.failedUpdate).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "storage timeout",
      storage: createStorage({ error: { code: "ETIMEDOUT" } }),
      transcriber: createTranscriber(),
      failureCode: "audio_download_timeout",
    },
    {
      name: "OpenAI rate limit",
      storage: createStorage(),
      transcriber: createTranscriber({ error: { status: 429 } }),
      failureCode: "transcription_rate_limited",
    },
    {
      name: "OpenAI outage",
      storage: createStorage(),
      transcriber: createTranscriber({ error: { status: 503 } }),
      failureCode: "transcription_service_unavailable",
    },
  ])("marks the upload failed after a $name", async (scenario) => {
    const fixture = createDatabaseFixture();

    await expect(
      processNextAudioTranscription({
        database: fixture.database,
        documentStorage: scenario.storage,
        transcriber: scenario.transcriber,
      }),
    ).resolves.toEqual({
      uploadId: upload.id,
      status: "failed",
      failureCode: scenario.failureCode,
    });
    expect(fixture.failedSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failureCode: scenario.failureCode,
        processingLeaseId: null,
        processingLeaseExpiresAt: null,
      }),
    );
    expect(compileSql(fixture.failedWhere.mock.calls[0]?.[0]).params).toEqual([
      upload.id,
      upload.userId,
      "processing",
      upload.processingLeaseId,
    ]);
  });

  it("rejects stored audio whose checksum changed", async () => {
    const fixture = createDatabaseFixture();
    const transcriber = createTranscriber();

    await expect(
      processNextAudioTranscription({
        database: fixture.database,
        documentStorage: createStorage({ value: Buffer.from("changed") }),
        transcriber,
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureCode: "audio_checksum_mismatch",
    });
    expect(transcriber.transcribeAudio).not.toHaveBeenCalled();
  });

  it("rejects an unsupported stored audio media type", async () => {
    const fixture = createDatabaseFixture({
      claimedUpload: {
        ...upload,
        mimeType: "audio/wav",
        checksumSha256: null,
      },
    });
    const transcriber = createTranscriber();

    await expect(
      processNextAudioTranscription({
        database: fixture.database,
        documentStorage: createStorage(),
        transcriber,
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureCode: "unsupported_audio_type",
    });
    expect(transcriber.transcribeAudio).not.toHaveBeenCalled();
  });

  it("marks a silent or empty transcription as failed", async () => {
    const fixture = createDatabaseFixture();

    await expect(
      processNextAudioTranscription({
        database: fixture.database,
        documentStorage: createStorage(),
        transcriber: createTranscriber({ text: "   " }),
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureCode: "empty_audio_transcript",
    });
    expect(fixture.transaction).not.toHaveBeenCalled();
  });

  it("classifies transcript persistence failures", async () => {
    const fixture = createDatabaseFixture({
      insertError: Object.assign(new Error("database unavailable"), {
        code: "40001",
      }),
    });

    await expect(
      processNextAudioTranscription({
        database: fixture.database,
        documentStorage: createStorage(),
        transcriber: createTranscriber(),
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureCode: "transcript_persistence_unavailable",
    });
  });

  it("does not let a stale worker complete or fail a newer lease", async () => {
    const fixture = createDatabaseFixture({
      failedUploadExists: false,
      releasedUploadExists: false,
    });

    await expect(
      processNextAudioTranscription({
        database: fixture.database,
        documentStorage: createStorage(),
        transcriber: createTranscriber(),
      }),
    ).rejects.toThrow(
      "Audio transcription failed and the upload could not be marked as failed.",
    );
  });

  it("surfaces processing and state-transition errors together", async () => {
    const fixture = createDatabaseFixture({
      markFailedError: new Error("database unavailable"),
    });

    await expect(
      processNextAudioTranscription({
        database: fixture.database,
        documentStorage: createStorage({ error: new Error("S3 unavailable") }),
        transcriber: createTranscriber(),
      }),
    ).rejects.toThrow(
      "Audio transcription failed and the upload could not be marked as failed.",
    );
  });

  it("rejects an invalid lease duration", async () => {
    const fixture = createDatabaseFixture();

    await expect(
      claimNextAudioUploadForTranscription(fixture.database, 0),
    ).rejects.toThrow(
      "Audio transcription lease duration must be a positive integer.",
    );
    expect(fixture.execute).not.toHaveBeenCalled();
  });
});
