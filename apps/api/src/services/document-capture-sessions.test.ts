import { createHash } from "node:crypto";
import { Readable } from "node:stream";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import {
  ConflictError,
  GoneError,
  NotFoundError,
  UnauthorizedError,
} from "../errors/application-errors.js";
import type {
  DocumentStorage,
  StoreDocumentInput,
} from "../storage/document-storage.js";
import {
  cancelDocumentCaptureSession,
  captureTokenFromAuthorization,
  createDocumentCaptureSession,
  documentCaptureSessionLifetimeMs,
  getAvailableDocumentCaptureSession,
  getDocumentCaptureSessionProgress,
  uploadDocumentForCaptureSession,
} from "./document-capture-sessions.js";

const postgresDialect = new PgDialect();
const userId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const token = "a".repeat(43);
const tokenHash = createHash("sha256").update(token).digest("hex");
const now = new Date("2026-11-08T12:00:00.000Z");
const expiresAt = new Date(
  now.getTime() + documentCaptureSessionLifetimeMs,
);

function createSelectDatabase(
  record:
    | {
        id: string;
        userId: string;
        status: "pending" | "consumed" | "expired" | "cancelled";
        expiresAt: Date;
      }
    | undefined,
) {
  const limit = vi.fn(async () => (record ? [record] : []));
  const where = vi.fn((_condition: unknown) => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    database: { select } as unknown as Database,
    limit,
    select,
  };
}

function createStorage() {
  const storedContent: Buffer[] = [];
  const storage = {
    close: vi.fn(),
    createDocumentPreviewUrl: vi.fn(),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    readDocument: vi.fn().mockResolvedValue(Buffer.from("document")),
    storeDocument: vi.fn(async ({ body }: StoreDocumentInput) => {
      for await (const chunk of body) {
        storedContent.push(Buffer.from(chunk));
      }
    }),
  } satisfies DocumentStorage;

  return { storage, storedContent };
}

function createProgressDatabase(
  record:
    | {
        id: string;
        status: "pending" | "consumed" | "expired" | "cancelled";
        expiresAt: Date;
        uploadId: string | null;
        uploadStatus:
          | "pending"
          | "uploaded"
          | "processing"
          | "processed"
          | "failed"
          | null;
      }
    | undefined,
) {
  const limit = vi.fn(async () => (record ? [record] : []));
  const where = vi.fn((_condition: unknown) => ({ limit }));
  const leftJoin = vi.fn(() => ({ where }));
  const from = vi.fn(() => ({ leftJoin }));
  const select = vi.fn(() => ({ from }));

  return { database: { select } as unknown as Database, where };
}

function getSqlParameters(expression: unknown) {
  return postgresDialect.sqlToQuery(expression as SQL).params;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("captureTokenFromAuthorization", () => {
  it("extracts an exact bearer capture token", () => {
    expect(captureTokenFromAuthorization(`Bearer ${token}`)).toBe(token);
  });

  it.each([
    undefined,
    "",
    token,
    `Basic ${token}`,
    "Bearer too-short",
    `Bearer ${"!".repeat(43)}`,
  ])("rejects an invalid authorization value", (authorization) => {
    expect(() => captureTokenFromAuthorization(authorization)).toThrow(
      UnauthorizedError,
    );
  });
});

describe("createDocumentCaptureSession", () => {
  it("creates a hashed session that expires after five minutes", async () => {
    let insertedValues: Record<string, unknown> | undefined;
    const returning = vi.fn(async () => [
      {
        id: sessionId,
        status: "pending",
        expiresAt: insertedValues?.expiresAt,
      },
    ]);
    const values = vi.fn((value: Record<string, unknown>) => {
      insertedValues = value;
      return { returning };
    });
    const database = {
      insert: vi.fn(() => ({ values })),
    } as unknown as Database;

    const result = await createDocumentCaptureSession(database, userId, now);

    expect(result).toEqual({
      id: sessionId,
      status: "pending",
      expiresAt: expiresAt.toISOString(),
      token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    expect(values).toHaveBeenCalledWith({
      userId,
      tokenHash: createHash("sha256")
        .update(result.token)
        .digest("hex"),
      status: "pending",
      expiresAt,
    });
    expect(insertedValues?.tokenHash).not.toBe(result.token);
  });
});

describe("getAvailableDocumentCaptureSession", () => {
  it("returns only the public state of a pending session", async () => {
    const fixture = createSelectDatabase({
      id: sessionId,
      userId,
      status: "pending",
      expiresAt,
    });

    await expect(
      getAvailableDocumentCaptureSession(fixture.database, token, now),
    ).resolves.toEqual({
      id: sessionId,
      status: "pending",
      expiresAt: expiresAt.toISOString(),
    });
  });

  it("rejects unknown tokens without revealing a session", async () => {
    const fixture = createSelectDatabase(undefined);

    await expect(
      getAvailableDocumentCaptureSession(fixture.database, token, now),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("rejects expired sessions based on the timestamp", async () => {
    const fixture = createSelectDatabase({
      id: sessionId,
      userId,
      status: "pending",
      expiresAt: now,
    });

    await expect(
      getAvailableDocumentCaptureSession(fixture.database, token, now),
    ).rejects.toThrow(GoneError);
  });

  it.each(["consumed", "cancelled"] as const)(
    "rejects a %s session",
    async (status) => {
      const fixture = createSelectDatabase({
        id: sessionId,
        userId,
        status,
        expiresAt,
      });

      await expect(
        getAvailableDocumentCaptureSession(fixture.database, token, now),
      ).rejects.toThrow(ConflictError);
    },
  );
});

describe("getDocumentCaptureSessionProgress", () => {
  it("returns the owned pending session without an upload", async () => {
    const fixture = createProgressDatabase({
      id: sessionId,
      status: "pending",
      expiresAt,
      uploadId: null,
      uploadStatus: null,
    });

    await expect(
      getDocumentCaptureSessionProgress(
        fixture.database,
        userId,
        sessionId,
        now,
      ),
    ).resolves.toEqual({
      id: sessionId,
      status: "pending",
      expiresAt: expiresAt.toISOString(),
      upload: null,
    });
    expect(getSqlParameters(fixture.where.mock.calls[0]?.[0])).toEqual([
      sessionId,
      userId,
    ]);
  });

  it("returns the linked upload status after consumption", async () => {
    const uploadId = "55555555-5555-4555-8555-555555555555";
    const fixture = createProgressDatabase({
      id: sessionId,
      status: "consumed",
      expiresAt,
      uploadId,
      uploadStatus: "processing",
    });

    await expect(
      getDocumentCaptureSessionProgress(
        fixture.database,
        userId,
        sessionId,
        now,
      ),
    ).resolves.toMatchObject({
      status: "consumed",
      upload: { id: uploadId, status: "processing" },
    });
  });

  it("reports an effectively expired session before periodic cleanup runs", async () => {
    const fixture = createProgressDatabase({
      id: sessionId,
      status: "pending",
      expiresAt: now,
      uploadId: null,
      uploadStatus: null,
    });

    await expect(
      getDocumentCaptureSessionProgress(
        fixture.database,
        userId,
        sessionId,
        now,
      ),
    ).resolves.toMatchObject({ status: "expired", upload: null });
  });

  it("does not reveal a missing or differently owned session", async () => {
    const fixture = createProgressDatabase(undefined);

    await expect(
      getDocumentCaptureSessionProgress(
        fixture.database,
        userId,
        sessionId,
        now,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("cancelDocumentCaptureSession", () => {
  it("cancels a pending session owned by the authenticated user", async () => {
    const returning = vi.fn(async () => [
      { id: sessionId, status: "cancelled", expiresAt },
    ]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const database = {
      update: vi.fn(() => ({ set })),
    } as unknown as Database;

    await expect(
      cancelDocumentCaptureSession(database, userId, sessionId, now),
    ).resolves.toEqual({
      id: sessionId,
      status: "cancelled",
      expiresAt: expiresAt.toISOString(),
    });
    expect(set).toHaveBeenCalledWith({ status: "cancelled", updatedAt: now });
  });

  it("is idempotent when the owned session is already cancelled", async () => {
    const selectFixture = createSelectDatabase({
      id: sessionId,
      userId,
      status: "cancelled",
      expiresAt,
    });
    const returning = vi.fn(async () => []);
    const database = {
      select: selectFixture.database.select,
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({ returning })),
        })),
      })),
    } as unknown as Database;

    await expect(
      cancelDocumentCaptureSession(database, userId, sessionId, now),
    ).resolves.toMatchObject({ status: "cancelled" });
  });

  it("does not reveal a session owned by another user", async () => {
    const selectFixture = createSelectDatabase(undefined);
    const returning = vi.fn(async () => []);
    const database = {
      select: selectFixture.database.select,
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({ returning })),
        })),
      })),
    } as unknown as Database;

    await expect(
      cancelDocumentCaptureSession(database, userId, sessionId, now),
    ).rejects.toThrow(NotFoundError);
  });
});

interface ConcurrentDatabaseFixture {
  database: Database;
  insertValues: ReturnType<typeof vi.fn>;
  lock: ReturnType<typeof vi.fn>;
  updateValues: ReturnType<typeof vi.fn>;
}

function createConcurrentDatabaseFixture(): ConcurrentDatabaseFixture {
  let status: "pending" | "consumed" = "pending";
  let transactionQueue = Promise.resolve();
  const insertValues = vi.fn((value: Record<string, unknown>) => ({
    returning: vi.fn(async () => [
      {
        id: value.id,
        originalFileName: value.originalFileName,
        mimeType: value.mimeType,
        byteSize: value.byteSize,
        checksumSha256: value.checksumSha256,
        status: value.status,
        createdAt: now,
        updatedAt: now,
      },
    ]),
  }));
  const updateValues = vi.fn((value: Record<string, unknown>) => ({
    where: vi.fn(() => ({
      returning: vi.fn(async () => {
        status = "consumed";
        return [{ id: sessionId, ...value }];
      }),
    })),
  }));
  const lock = vi.fn(async () => [
    { id: sessionId, userId, status, expiresAt },
  ]);
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) => {
    const previousTransaction = transactionQueue;
    let release: (() => void) | undefined;
    transactionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previousTransaction;

    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => ({ for: lock })),
          })),
        })),
      })),
      insert: vi.fn(() => ({ values: insertValues })),
      update: vi.fn(() => ({ set: updateValues })),
    };

    try {
      return await callback(tx);
    } finally {
      release?.();
    }
  });
  const preliminarySelect = createSelectDatabase({
    id: sessionId,
    userId,
    status: "pending",
    expiresAt,
  }).database.select;

  return {
    database: {
      select: preliminarySelect,
      transaction,
    } as unknown as Database,
    insertValues,
    lock,
    updateValues,
  };
}

describe("uploadDocumentForCaptureSession", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

  it("stores an upload for the session owner and consumes the session", async () => {
    const databaseFixture = createConcurrentDatabaseFixture();
    const storageFixture = createStorage();

    const upload = await uploadDocumentForCaptureSession({
      database: databaseFixture.database,
      documentStorage: storageFixture.storage,
      fileName: "receipt.jpg",
      mimeType: "image/jpeg",
      now: () => now,
      source: Readable.from([jpeg]),
      token,
    });

    expect(upload.status).toBe("uploaded");
    expect(databaseFixture.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: upload.id,
        userId,
        source: "qr_capture",
      }),
    );
    expect(databaseFixture.updateValues).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "consumed",
        uploadId: upload.id,
        consumedAt: now,
      }),
    );
    expect(databaseFixture.lock).toHaveBeenCalledOnce();
    expect(storageFixture.storage.deleteDocument).not.toHaveBeenCalled();
  });

  it("allows only one of two concurrent requests to consume the session", async () => {
    const databaseFixture = createConcurrentDatabaseFixture();
    const storageFixture = createStorage();
    const upload = () =>
      uploadDocumentForCaptureSession({
        database: databaseFixture.database,
        documentStorage: storageFixture.storage,
        fileName: "receipt.jpg",
        mimeType: "image/jpeg",
        now: () => now,
        source: Readable.from([jpeg]),
        token,
      });

    const results = await Promise.allSettled([upload(), upload()]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      1,
    );
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: expect.any(ConflictError),
    });
    expect(databaseFixture.insertValues).toHaveBeenCalledOnce();
    expect(databaseFixture.updateValues).toHaveBeenCalledOnce();
    expect(storageFixture.storage.deleteDocument).toHaveBeenCalledOnce();
  });

  it("removes the stored object if the session expires during upload", async () => {
    const databaseFixture = createConcurrentDatabaseFixture();
    const storageFixture = createStorage();
    const afterExpiration = new Date(expiresAt.getTime() + 1);
    const times = [now, afterExpiration];

    await expect(
      uploadDocumentForCaptureSession({
        database: databaseFixture.database,
        documentStorage: storageFixture.storage,
        fileName: "receipt.jpg",
        mimeType: "image/jpeg",
        now: () => times.shift() ?? afterExpiration,
        source: Readable.from([jpeg]),
        token,
      }),
    ).rejects.toThrow(GoneError);
    expect(databaseFixture.insertValues).not.toHaveBeenCalled();
    expect(storageFixture.storage.deleteDocument).toHaveBeenCalledOnce();
  });
});
