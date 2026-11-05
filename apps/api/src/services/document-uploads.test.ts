import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

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
  maximumDocumentUploadBytes,
  uploadDocumentForUser,
} from "./document-uploads.js";

const userId = "33333333-3333-4333-8333-333333333333";
const createdAt = new Date("2026-11-05T12:00:00.000Z");
const updatedAt = new Date("2026-11-05T12:00:01.000Z");

interface DatabaseFixtureOptions {
  error?: Error;
}

function createDatabaseFixture({ error }: DatabaseFixtureOptions = {}) {
  let insertedValues: Record<string, unknown> | undefined;
  const returning = vi.fn(async () => {
    if (error) {
      throw error;
    }

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
    returning,
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

    if (options.storeError) {
      throw options.storeError;
    }
  });
  const deleteDocument = options.cleanupError
    ? vi.fn().mockRejectedValue(options.cleanupError)
    : vi.fn().mockResolvedValue(undefined);
  const storage = {
    close: vi.fn(),
    deleteDocument,
    storeDocument,
  } satisfies DocumentStorage;

  return { deleteDocument, storage, storeDocument, storedContent };
}

async function upload(options: {
  content: Buffer;
  database?: Database;
  fileName?: string;
  mimeType?: string;
  storage?: DocumentStorage;
  wasTruncated?: () => boolean;
}) {
  const databaseFixture = options.database
    ? undefined
    : createDatabaseFixture();
  const storageFixture = options.storage
    ? undefined
    : createStorageFixture();

  return uploadDocumentForUser({
    database: options.database ?? databaseFixture!.database,
    documentStorage: options.storage ?? storageFixture!.storage,
    fileName: options.fileName ?? "receipt.pdf",
    mimeType: options.mimeType ?? "application/pdf",
    source: Readable.from([options.content]),
    wasTruncated: options.wasTruncated,
    userId,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("uploadDocumentForUser", () => {
  it.each([
    {
      mimeType: "application/pdf",
      fileName: "receipt.pdf",
      content: Buffer.from("%PDF-1.7\nreceipt"),
    },
    {
      mimeType: "image/jpeg",
      fileName: "receipt.jpg",
      content: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    },
    {
      mimeType: "image/png",
      fileName: "receipt.png",
      content: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01,
      ]),
    },
  ])("stores a validated $mimeType document", async (fixture) => {
    const databaseFixture = createDatabaseFixture();
    const storageFixture = createStorageFixture();
    const checksum = createHash("sha256")
      .update(fixture.content)
      .digest("hex");

    const result = await uploadDocumentForUser({
      database: databaseFixture.database,
      documentStorage: storageFixture.storage,
      fileName: fixture.fileName,
      mimeType: fixture.mimeType,
      source: Readable.from([
        fixture.content.subarray(0, 2),
        fixture.content.subarray(2),
      ]),
      userId,
    });

    expect(result).toMatchObject({
      originalFileName: fixture.fileName,
      mimeType: fixture.mimeType,
      byteSize: fixture.content.length.toString(),
      checksumSha256: checksum,
      status: "uploaded",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(Buffer.concat(storageFixture.storedContent)).toEqual(
      fixture.content,
    );
    expect(storageFixture.storeDocument).toHaveBeenCalledWith({
      body: expect.any(Readable),
      contentType: fixture.mimeType,
      objectKey: `${userId}/documents/${result.id}`,
    });
    expect(databaseFixture.insert).toHaveBeenCalledWith(uploads);
    expect(databaseFixture.values).toHaveBeenCalledWith({
      id: result.id,
      userId,
      kind: "document",
      source: "direct",
      s3ObjectKey: `${userId}/documents/${result.id}`,
      originalFileName: fixture.fileName,
      mimeType: fixture.mimeType,
      byteSize: BigInt(fixture.content.length),
      checksumSha256: checksum,
      status: "uploaded",
    });
    expect(storageFixture.deleteDocument).not.toHaveBeenCalled();
  });

  it("normalizes an untrusted browser file path and media type", async () => {
    const databaseFixture = createDatabaseFixture();
    const storageFixture = createStorageFixture();

    const result = await uploadDocumentForUser({
      database: databaseFixture.database,
      documentStorage: storageFixture.storage,
      fileName: "C:\\fakepath\\ receipt.pdf\u0000",
      mimeType: "APPLICATION/PDF; charset=binary",
      source: Readable.from([Buffer.from("%PDF-1.7")]),
      userId,
    });

    expect(result.originalFileName).toBe("receipt.pdf");
    expect(result.mimeType).toBe("application/pdf");
  });

  it.each([
    ["text/plain", "Document must be a JPEG image, PNG image, or PDF file."],
    ["", "Document must be a JPEG image, PNG image, or PDF file."],
  ])("rejects unsupported media type %j", async (mimeType, message) => {
    const databaseFixture = createDatabaseFixture();
    const storageFixture = createStorageFixture();

    await expect(
      uploadDocumentForUser({
        database: databaseFixture.database,
        documentStorage: storageFixture.storage,
        fileName: "receipt.txt",
        mimeType,
        source: Readable.from([Buffer.from("receipt")]),
        userId,
      }),
    ).rejects.toThrow(new InputError(message));
    expect(storageFixture.storeDocument).not.toHaveBeenCalled();
    expect(storageFixture.deleteDocument).not.toHaveBeenCalled();
    expect(databaseFixture.insert).not.toHaveBeenCalled();
  });

  it("rejects content that does not match the declared media type", async () => {
    const databaseFixture = createDatabaseFixture();
    const storageFixture = createStorageFixture();

    await expect(
      upload({
        content: Buffer.from("not a PDF"),
        database: databaseFixture.database,
        storage: storageFixture.storage,
      }),
    ).rejects.toThrow(
      new InputError(
        "Document content does not match its declared file type.",
      ),
    );
    expect(databaseFixture.insert).not.toHaveBeenCalled();
    expect(storageFixture.deleteDocument).toHaveBeenCalledOnce();
  });

  it("rejects an empty document", async () => {
    const databaseFixture = createDatabaseFixture();
    const storageFixture = createStorageFixture();

    await expect(
      upload({
        content: Buffer.alloc(0),
        database: databaseFixture.database,
        storage: storageFixture.storage,
      }),
    ).rejects.toThrow(new InputError("Document cannot be empty."));
    expect(databaseFixture.insert).not.toHaveBeenCalled();
    expect(storageFixture.deleteDocument).toHaveBeenCalledOnce();
  });

  it("rejects a document larger than 10 MB", async () => {
    const databaseFixture = createDatabaseFixture();
    const storageFixture = createStorageFixture();
    const content = Buffer.alloc(maximumDocumentUploadBytes + 1, 0);
    Buffer.from("%PDF-").copy(content);

    await expect(
      upload({
        content,
        database: databaseFixture.database,
        storage: storageFixture.storage,
      }),
    ).rejects.toThrow(
      new PayloadTooLargeError("Document must be at most 10 MB."),
    );
    expect(databaseFixture.insert).not.toHaveBeenCalled();
    expect(storageFixture.deleteDocument).toHaveBeenCalledOnce();
  });

  it("rejects a stream truncated by the multipart parser", async () => {
    const databaseFixture = createDatabaseFixture();
    const storageFixture = createStorageFixture();

    await expect(
      upload({
        content: Buffer.from("%PDF-1.7"),
        database: databaseFixture.database,
        storage: storageFixture.storage,
        wasTruncated: () => true,
      }),
    ).rejects.toThrow(
      new PayloadTooLargeError("Document must be at most 10 MB."),
    );
    expect(databaseFixture.insert).not.toHaveBeenCalled();
    expect(storageFixture.deleteDocument).toHaveBeenCalledOnce();
  });

  it.each([
    ["", "Document file name is required."],
    ["a".repeat(256), "Document file name must contain at most 255 characters."],
  ])("rejects invalid file name %j", async (fileName, message) => {
    const databaseFixture = createDatabaseFixture();
    const storageFixture = createStorageFixture();

    await expect(
      upload({
        content: Buffer.from("%PDF-1.7"),
        database: databaseFixture.database,
        fileName,
        storage: storageFixture.storage,
      }),
    ).rejects.toThrow(new InputError(message));
    expect(storageFixture.storeDocument).not.toHaveBeenCalled();
    expect(databaseFixture.insert).not.toHaveBeenCalled();
  });

  it("removes the object when database persistence fails", async () => {
    const databaseFixture = createDatabaseFixture({
      error: new Error("database unavailable"),
    });
    const storageFixture = createStorageFixture();

    await expect(
      upload({
        content: Buffer.from("%PDF-1.7"),
        database: databaseFixture.database,
        storage: storageFixture.storage,
      }),
    ).rejects.toThrow("database unavailable");
    expect(storageFixture.deleteDocument).toHaveBeenCalledOnce();
  });

  it("attempts cleanup when storage fails", async () => {
    const databaseFixture = createDatabaseFixture();
    const storageFixture = createStorageFixture({
      storeError: new Error("S3 unavailable"),
    });

    await expect(
      upload({
        content: Buffer.from("%PDF-1.7"),
        database: databaseFixture.database,
        storage: storageFixture.storage,
      }),
    ).rejects.toThrow("S3 unavailable");
    expect(storageFixture.deleteDocument).toHaveBeenCalledOnce();
    expect(databaseFixture.insert).not.toHaveBeenCalled();
  });

  it("reports when the upload and its cleanup both fail", async () => {
    const databaseFixture = createDatabaseFixture();
    const storageFixture = createStorageFixture({
      cleanupError: new Error("cleanup unavailable"),
      storeError: new Error("S3 unavailable"),
    });

    await expect(
      upload({
        content: Buffer.from("%PDF-1.7"),
        database: databaseFixture.database,
        storage: storageFixture.storage,
      }),
    ).rejects.toThrow(
      "Document upload failed and its storage cleanup was unsuccessful.",
    );
  });
});
