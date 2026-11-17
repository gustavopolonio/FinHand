import { createHash, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type {
  DocumentTransactionExtractor,
  ExtractedTransactionCandidate,
} from "../../src/ai/document-transaction-extractor.js";
import type { DatabaseConnection } from "../../src/db/index.js";
import {
  transactionCandidates,
  uploads,
  users,
  type UploadStatus,
} from "../../src/db/schema/index.js";
import {
  claimNextDocumentUpload,
  processNextDocumentUpload,
  type ClaimedDocumentUpload,
} from "../../src/services/document-extraction.js";
import { recoverExpiredDocumentProcessingLeases } from "../../src/services/document-processing-recovery.js";
import type { DocumentStorage } from "../../src/storage/document-storage.js";
import {
  createTestDatabase,
  resetTestDatabase,
} from "./database.js";

const content = Buffer.from("%PDF-integration-test-receipt");
const candidate: ExtractedTransactionCandidate = {
  type: "expense",
  amountMinor: "4290",
  currencyCode: "BRL",
  occurredOn: "2026-11-17",
  description: "Integration test groceries",
  counterparty: "Test Market",
  notes: null,
  confidence: {
    type: 0.99,
    amountMinor: 0.99,
    currencyCode: 0.99,
    occurredOn: 0.99,
    description: 0.99,
    counterparty: 0.99,
  },
  warnings: [],
};

interface CreateUploadOptions {
  createdAt?: Date;
  processingAttempts?: number;
  processingLeaseExpiresAt?: Date | null;
  processingLeaseId?: string | null;
  status?: UploadStatus;
  userId: string;
}

interface Deferred<Value> {
  promise: Promise<Value>;
  resolve(value: Value): void;
}

function createDeferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

let connection: DatabaseConnection;

beforeAll(() => {
  connection = createTestDatabase();
});

beforeEach(async () => {
  await resetTestDatabase(connection.database);
});

afterAll(async () => {
  await connection.pool.end();
});

async function createUser(): Promise<string> {
  const id = randomUUID();

  await connection.database.insert(users).values({
    id,
    email: `${id}@integration.finhand.test`,
    defaultCurrency: "BRL",
    timeZone: "America/Sao_Paulo",
  });

  return id;
}

async function createDocumentUpload({
  createdAt = new Date(),
  processingAttempts = 0,
  processingLeaseExpiresAt = null,
  processingLeaseId = null,
  status = "uploaded",
  userId,
}: CreateUploadOptions) {
  const id = randomUUID();

  await connection.database.insert(uploads).values({
    id,
    userId,
    kind: "document",
    source: "direct",
    s3ObjectKey: `integration-tests/documents/${id}`,
    originalFileName: "receipt.pdf",
    mimeType: "application/pdf",
    byteSize: BigInt(content.byteLength),
    checksumSha256: createHash("sha256").update(content).digest("hex"),
    status,
    processingAttempts,
    processingLeaseId,
    processingLeaseExpiresAt,
    createdAt,
    updatedAt: createdAt,
  });

  return { id, userId };
}

async function findUpload(id: string) {
  return connection.database.query.uploads.findFirst({
    where: (upload, { eq }) => eq(upload.id, id),
  });
}

describe("document-processing PostgreSQL concurrency", () => {
  it("skips an older upload locked by another database connection", async () => {
    const userId = await createUser();
    const lockedUpload = await createDocumentUpload({
      userId,
      createdAt: new Date("2026-11-17T10:00:00.000Z"),
    });
    const availableUpload = await createDocumentUpload({
      userId,
      createdAt: new Date("2026-11-17T10:01:00.000Z"),
    });
    const lockingClient = await connection.pool.connect();

    try {
      await lockingClient.query("begin");
      await lockingClient.query(
        "select id from uploads where id = $1 for update",
        [lockedUpload.id],
      );

      const claimedUpload = await claimNextDocumentUpload(
        connection.database,
      );

      expect(claimedUpload?.id).toBe(availableUpload.id);
      await expect(findUpload(lockedUpload.id)).resolves.toMatchObject({
        status: "uploaded",
      });
    } finally {
      await lockingClient.query("rollback");
      lockingClient.release();
    }
  });

  it("allows only one concurrent worker to claim the same upload", async () => {
    const userId = await createUser();
    const upload = await createDocumentUpload({ userId });

    const results = await Promise.all([
      claimNextDocumentUpload(connection.database),
      claimNextDocumentUpload(connection.database),
    ]);
    const claimedUploads = results.filter(
      (result): result is ClaimedDocumentUpload => result !== null,
    );

    expect(claimedUploads).toHaveLength(1);
    expect(claimedUploads[0]?.id).toBe(upload.id);
    expect(results).toContain(null);
    await expect(findUpload(upload.id)).resolves.toMatchObject({
      status: "processing",
      processingAttempts: 1,
    });
  });

  it("requeues a document whose processing lease expired", async () => {
    const userId = await createUser();
    const expiredLeaseId = randomUUID();
    const upload = await createDocumentUpload({
      userId,
      status: "processing",
      processingAttempts: 1,
      processingLeaseId: expiredLeaseId,
      processingLeaseExpiresAt: new Date(Date.now() - 60_000),
    });

    await expect(
      recoverExpiredDocumentProcessingLeases(connection.database),
    ).resolves.toEqual({ failedCount: 0, requeuedCount: 1 });

    await expect(findUpload(upload.id)).resolves.toMatchObject({
      status: "uploaded",
      processingAttempts: 1,
      processingLeaseId: null,
      processingLeaseExpiresAt: null,
    });
  });

  it("rejects completion from a stale worker after another worker obtains a new lease", async () => {
    const userId = await createUser();
    const upload = await createDocumentUpload({ userId });
    const readStarted = createDeferred<void>();
    const releaseRead = createDeferred<Buffer>();
    const storage: DocumentStorage = {
      close() {},
      async createDocumentPreviewUrl() {
        throw new Error("Not used by this integration test.");
      },
      async deleteDocument() {},
      async readDocument() {
        readStarted.resolve();
        return releaseRead.promise;
      },
      async storeDocument() {},
    };
    const extractor: DocumentTransactionExtractor = {
      async extractDocument() {
        return [candidate];
      },
    };

    const staleWorker = processNextDocumentUpload({
      database: connection.database,
      documentStorage: storage,
      extractor,
    });

    await readStarted.promise;
    const firstClaim = await findUpload(upload.id);
    expect(firstClaim?.processingLeaseId).not.toBeNull();

    await connection.database
      .update(uploads)
      .set({ processingLeaseExpiresAt: new Date(Date.now() - 1_000) })
      .where(eq(uploads.id, upload.id));

    await expect(
      recoverExpiredDocumentProcessingLeases(connection.database),
    ).resolves.toEqual({ failedCount: 0, requeuedCount: 1 });

    const secondClaim = await claimNextDocumentUpload(connection.database);
    expect(secondClaim?.id).toBe(upload.id);
    expect(secondClaim?.processingLeaseId).not.toBe(
      firstClaim?.processingLeaseId,
    );

    releaseRead.resolve(content);

    await expect(staleWorker).rejects.toThrow(
      "Document extraction failed and the upload could not be marked as failed.",
    );
    await expect(findUpload(upload.id)).resolves.toMatchObject({
      status: "processing",
      processingAttempts: 2,
      processingLeaseId: secondClaim?.processingLeaseId,
    });

    const persistedCandidates = await connection.database
      .select({ id: transactionCandidates.id })
      .from(transactionCandidates)
      .where(eq(transactionCandidates.uploadId, upload.id));
    expect(persistedCandidates).toHaveLength(0);
  });
});
