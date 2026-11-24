import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import { uploads } from "../db/schema/index.js";
import {
  InputError,
  PayloadTooLargeError,
} from "../errors/application-errors.js";
import type {
  DocumentStorage,
  StoreDocumentInput,
} from "../storage/document-storage.js";
import {
  maximumAudioRecordingBytes,
  uploadAudioRecordingForUser,
  type AudioDurationReader,
} from "./audio-uploads.js";

const userId = "11111111-1111-4111-8111-111111111111";
const createdAt = new Date("2026-11-16T12:00:00.000Z");
const updatedAt = new Date("2026-11-16T12:00:01.000Z");

function createDatabaseFixture(error?: Error) {
  let insertedValues: Record<string, unknown> | undefined;
  const returning = vi.fn(async () => {
    if (error) throw error;

    return [
      {
        id: insertedValues?.id,
        originalFileName: insertedValues?.originalFileName,
        mimeType: insertedValues?.mimeType,
        byteSize: insertedValues?.byteSize,
        checksumSha256: insertedValues?.checksumSha256,
        status: insertedValues?.status,
        createdAt,
        updatedAt,
      },
    ];
  });
  const values = vi.fn((value: Record<string, unknown>) => {
    insertedValues = value;
    return { returning };
  });
  const insert = vi.fn().mockReturnValue({ values });

  return {
    database: { insert } as unknown as Database,
    insert,
    values,
  };
}

function createStorageFixture(options: {
  cleanupError?: Error;
  storeError?: Error;
} = {}) {
  const storedContent: Buffer[] = [];
  const storeDocument = vi.fn(async ({ body }: StoreDocumentInput) => {
    for await (const chunk of body) {
      storedContent.push(Buffer.from(chunk));
    }

    if (options.storeError) throw options.storeError;
  });
  const deleteDocument = options.cleanupError
    ? vi.fn().mockRejectedValue(options.cleanupError)
    : vi.fn().mockResolvedValue(undefined);
  const storage = {
    close: vi.fn(),
    createDocumentPreviewUrl: vi.fn(),
    deleteDocument,
    readDocument: vi.fn(),
    storeDocument,
  } satisfies DocumentStorage;

  return { deleteDocument, storage, storedContent, storeDocument };
}

function recordingContent(mimeType: string): Buffer {
  switch (mimeType) {
    case "audio/webm":
      return Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02]);
    case "audio/mp4":
      return Buffer.from([0, 0, 0, 20, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70]);
    case "audio/ogg":
      return Buffer.from("OggS\u0000recording");
    default:
      return Buffer.from("unsupported");
  }
}

async function upload(options: {
  content?: Buffer;
  database?: Database;
  durationReader?: AudioDurationReader;
  fileName?: string;
  mimeType?: string;
  storage?: DocumentStorage;
  useDefaultDurationReader?: boolean;
  wasTruncated?: () => boolean;
} = {}) {
  const mimeType = options.mimeType ?? "audio/webm";
  const databaseFixture = options.database
    ? undefined
    : createDatabaseFixture();
  const storageFixture = options.storage
    ? undefined
    : createStorageFixture();

  return uploadAudioRecordingForUser({
    database: options.database ?? databaseFixture!.database,
    documentStorage: options.storage ?? storageFixture!.storage,
    durationReader: options.useDefaultDurationReader
      ? undefined
      : options.durationReader ?? vi.fn().mockResolvedValue(12.4),
    fileName: options.fileName ?? "voice-recording.webm",
    mimeType,
    source: Readable.from([
      options.content ?? recordingContent(mimeType.split(";", 1)[0]!),
    ]),
    userId,
    wasTruncated: options.wasTruncated,
  });
}

describe("uploadAudioRecordingForUser", () => {
  it.each([
    ["audio/webm;codecs=opus", "audio/webm", "voice-recording.webm"],
    ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "voice-recording.m4a"],
    ["audio/ogg;codecs=opus", "audio/ogg", "voice-recording.ogg"],
  ])(
    "validates and privately stores a %s recording",
    async (declaredMimeType, normalizedMimeType, fileName) => {
      const content = recordingContent(normalizedMimeType);
      const checksumSha256 = createHash("sha256").update(content).digest("hex");
      const databaseFixture = createDatabaseFixture();
      const storageFixture = createStorageFixture();
      const durationReader = vi.fn().mockResolvedValue(12.4);

      const result = await upload({
        content,
        database: databaseFixture.database,
        durationReader,
        fileName,
        mimeType: declaredMimeType,
        storage: storageFixture.storage,
      });

      expect(result).toMatchObject({
        originalFileName: fileName,
        mimeType: normalizedMimeType,
        byteSize: content.length.toString(),
        checksumSha256,
        durationSeconds: 12.4,
        status: "uploaded",
      });
      expect(durationReader).toHaveBeenCalledWith(
        content,
        normalizedMimeType,
      );
      const objectKey =
        storageFixture.storeDocument.mock.calls[0]?.[0].objectKey;
      expect(objectKey).toMatch(
        /^audio\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(objectKey).not.toContain(userId);
      expect(objectKey).not.toContain(result.id);
      expect(storageFixture.storeDocument).toHaveBeenCalledWith({
        body: expect.any(Readable),
        contentType: normalizedMimeType,
        objectKey,
      });
      expect(Buffer.concat(storageFixture.storedContent)).toEqual(content);
      expect(databaseFixture.insert).toHaveBeenCalledWith(uploads);
      expect(databaseFixture.values).toHaveBeenCalledWith({
        id: result.id,
        userId,
        kind: "audio",
        source: "direct",
        s3ObjectKey: objectKey,
        originalFileName: fileName,
        mimeType: normalizedMimeType,
        byteSize: BigInt(content.length),
        checksumSha256,
        status: "uploaded",
      });
      expect(storageFixture.deleteDocument).not.toHaveBeenCalled();
    },
  );

  it("rejects unsupported declared audio formats before storage", async () => {
    const databaseFixture = createDatabaseFixture();
    const storageFixture = createStorageFixture();

    await expect(
      upload({
        content: Buffer.from("RIFF"),
        database: databaseFixture.database,
        mimeType: "audio/wav",
        storage: storageFixture.storage,
      }),
    ).rejects.toEqual(
      new InputError("Audio recording must use WebM, MP4, or Ogg format."),
    );
    expect(storageFixture.storeDocument).not.toHaveBeenCalled();
    expect(databaseFixture.insert).not.toHaveBeenCalled();
  });

  it("rejects content that does not match the declared format", async () => {
    const storageFixture = createStorageFixture();

    await expect(
      upload({
        content: Buffer.from("OggS-not-webm"),
        storage: storageFixture.storage,
      }),
    ).rejects.toEqual(
      new InputError(
        "Audio recording content does not match its declared format.",
      ),
    );
    expect(storageFixture.storeDocument).not.toHaveBeenCalled();
  });

  it("rejects empty, oversized, and truncated recordings", async () => {
    await expect(upload({ content: Buffer.alloc(0) })).rejects.toEqual(
      new InputError("Audio recording cannot be empty."),
    );

    const oversized = Buffer.alloc(maximumAudioRecordingBytes + 1);
    recordingContent("audio/webm").copy(oversized);
    await expect(upload({ content: oversized })).rejects.toEqual(
      new PayloadTooLargeError(
        "Audio recording must be at most 5 MB.",
        "AUDIO_TOO_LARGE",
      ),
    );

    await expect(
      upload({ wasTruncated: () => true }),
    ).rejects.toEqual(
      new PayloadTooLargeError(
        "Audio recording must be at most 5 MB.",
        "AUDIO_TOO_LARGE",
      ),
    );
  });

  it.each([null, 0, Number.NaN])(
    "rejects an unusable parsed duration %s",
    async (duration) => {
      await expect(
        upload({
          durationReader: vi.fn().mockResolvedValue(duration),
        }),
      ).rejects.toEqual(
        new InputError("Audio recording duration could not be determined."),
      );
    },
  );

  it("rejects a recording longer than 30 seconds", async () => {
    await expect(
      upload({ durationReader: vi.fn().mockResolvedValue(30.6) }),
    ).rejects.toEqual(
      new InputError("Audio recording must be at most 30 seconds."),
    );
  });

  it.each([
    [30, 30],
    [30.5, 30],
  ])(
    "accepts the %s-second validation boundary and stores at most 30 seconds",
    async (parsedDuration, storedDuration) => {
      await expect(
        upload({
          durationReader: vi.fn().mockResolvedValue(parsedDuration),
        }),
      ).resolves.toMatchObject({ durationSeconds: storedDuration });
    },
  );

  it.each([
    ["", "Audio recording file name is required."],
    [" ", "Audio recording file name is required."],
    [
      `${"a".repeat(256)}.webm`,
      "Audio recording file name must contain at most 255 characters.",
    ],
  ])("rejects invalid recording file name %#", async (fileName, message) => {
    const databaseFixture = createDatabaseFixture();
    const storageFixture = createStorageFixture();

    await expect(
      upload({
        database: databaseFixture.database,
        fileName,
        storage: storageFixture.storage,
      }),
    ).rejects.toEqual(new InputError(message));
    expect(storageFixture.storeDocument).not.toHaveBeenCalled();
    expect(databaseFixture.insert).not.toHaveBeenCalled();
  });

  it("removes path components from the client-provided file name", async () => {
    await expect(
      upload({ fileName: "../../private/voice-recording.webm" }),
    ).resolves.toMatchObject({ originalFileName: "voice-recording.webm" });
  });

  it("returns a safe error when metadata cannot provide a duration", async () => {
    await expect(
      upload({
        content: recordingContent("audio/webm"),
        useDefaultDurationReader: true,
      }),
    ).rejects.toEqual(
      new InputError("Audio recording duration could not be determined."),
    );
  });

  it("removes the private object when database persistence fails", async () => {
    const databaseFixture = createDatabaseFixture(
      new Error("database unavailable"),
    );
    const storageFixture = createStorageFixture();

    await expect(
      upload({
        database: databaseFixture.database,
        storage: storageFixture.storage,
      }),
    ).rejects.toThrow("database unavailable");
    expect(storageFixture.deleteDocument).toHaveBeenCalledOnce();
  });

  it("attempts cleanup when S3 storage fails", async () => {
    const storageFixture = createStorageFixture({
      storeError: new Error("S3 unavailable"),
    });

    await expect(upload({ storage: storageFixture.storage })).rejects.toThrow(
      "S3 unavailable",
    );
    expect(storageFixture.deleteDocument).toHaveBeenCalledOnce();
  });

  it("surfaces storage and cleanup failures together", async () => {
    const storageFixture = createStorageFixture({
      cleanupError: new Error("cleanup unavailable"),
      storeError: new Error("S3 unavailable"),
    });

    await expect(upload({ storage: storageFixture.storage })).rejects.toEqual(
      expect.objectContaining({
        message:
          "Audio upload failed and its storage cleanup was unsuccessful.",
        errors: [expect.any(Error), expect.any(Error)],
      }),
    );
  });
});
