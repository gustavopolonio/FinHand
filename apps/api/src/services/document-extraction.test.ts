import { createHash } from "node:crypto";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  DocumentTransactionExtractor,
  ExtractedTransactionCandidate,
} from "../ai/document-transaction-extractor.js";
import type { Database } from "../db/index.js";
import { transactionCandidates, uploads } from "../db/schema/index.js";
import type { DocumentStorage } from "../storage/document-storage.js";
import {
  claimNextDocumentUpload,
  processNextDocumentUpload,
  type ClaimedDocumentUpload,
} from "./document-extraction.js";

const postgresDialect = new PgDialect();
const now = new Date("2026-11-10T12:00:00.000Z");
const content = Buffer.from("%PDF-receipt");
const upload: ClaimedDocumentUpload = {
  id: "44444444-4444-4444-8444-444444444444",
  userId: "33333333-3333-4333-8333-333333333333",
  objectKey:
    "33333333-3333-4333-8333-333333333333/documents/44444444-4444-4444-8444-444444444444",
  originalFileName: "receipt.pdf",
  mimeType: "application/pdf",
  checksumSha256: createHash("sha256").update(content).digest("hex"),
  processingLeaseId: "55555555-5555-4555-8555-555555555555",
  processingLeaseExpiresAt: new Date("2026-11-10T12:10:00.000Z"),
};
const candidate = {
  type: "expense" as const,
  amountMinor: "4290",
  currencyCode: "BRL",
  occurredOn: "2026-11-10",
  description: "Groceries",
  counterparty: "Market",
  notes: null,
  confidence: {
    type: 0.99,
    amountMinor: 0.95,
    currencyCode: 0.9,
    occurredOn: null,
    description: 0.8,
    counterparty: 0.9,
  },
  warnings: ["Date was not visible"],
};

interface DatabaseFixtureOptions {
  claimedUpload?: ClaimedDocumentUpload | null;
  failedUploadExists?: boolean;
  insertError?: Error;
  markFailedError?: Error;
  processedUploadExists?: boolean;
}

function createDatabaseFixture({
  claimedUpload = upload,
  failedUploadExists = true,
  insertError,
  markFailedError,
  processedUploadExists = true,
}: DatabaseFixtureOptions = {}) {
  const execute = vi.fn().mockResolvedValue({
    rows: claimedUpload ? [claimedUpload] : [],
  });

  const candidateValues = vi.fn((_values: unknown) => {
    if (insertError) {
      throw insertError;
    }

    return undefined;
  });
  const candidateInsert = vi.fn().mockReturnValue({ values: candidateValues });

  const processedReturning = vi
    .fn()
    .mockResolvedValue(processedUploadExists ? [{ id: upload.id }] : []);
  const processedWhere = vi.fn().mockReturnValue({
    returning: processedReturning,
  });
  const processedSet = vi.fn().mockReturnValue({ where: processedWhere });
  const processedUpdate = vi.fn().mockReturnValue({ set: processedSet });
  const transactionDatabase = {
    insert: candidateInsert,
    update: processedUpdate,
  };
  const transaction = vi.fn(async (operation) =>
    operation(transactionDatabase),
  );

  const failedReturning = markFailedError
    ? vi.fn().mockRejectedValue(markFailedError)
    : vi.fn().mockResolvedValue(
        failedUploadExists
          ? [
              {
                id: upload.id,
                status: "failed",
                failureCode: "failure_code_is_set_by_assertion",
                updatedAt: now,
              },
            ]
          : [],
      );
  const failedWhere = vi.fn().mockReturnValue({
    returning: failedReturning,
  });
  const failedSet = vi.fn((values: Record<string, unknown>) => {
    if (!markFailedError && failedUploadExists) {
      failedReturning.mockResolvedValueOnce([
        {
          id: upload.id,
          status: "failed",
          failureCode: values.failureCode,
          updatedAt: values.updatedAt,
        },
      ]);
    }

    return { where: failedWhere };
  });
  const failedUpdate = vi.fn().mockReturnValue({ set: failedSet });

  const database = {
    execute,
    query: { uploads: { findFirst: vi.fn() } },
    transaction,
    update: failedUpdate,
  } as unknown as Database;

  return {
    candidateInsert,
    candidateValues,
    database,
    execute,
    failedSet,
    failedUpdate,
    failedWhere,
    processedWhere,
    processedSet,
    processedUpdate,
    transaction,
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

function createExtractor(
  options: {
    candidates?: ExtractedTransactionCandidate[];
    error?: unknown;
  } = {},
) {
  const extractDocument = options.error
    ? vi.fn().mockRejectedValue(options.error)
    : vi.fn().mockResolvedValue(options.candidates ?? [candidate]);

  return {
    extractDocument,
  } satisfies DocumentTransactionExtractor;
}

function compileSql(expression: unknown) {
  return postgresDialect.sqlToQuery(expression as SQL);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("document extraction service", () => {
  it("atomically claims the oldest uploaded document without waiting on locked rows", async () => {
    const databaseFixture = createDatabaseFixture();

    await expect(
      claimNextDocumentUpload(databaseFixture.database),
    ).resolves.toEqual(upload);

    const query = compileSql(databaseFixture.execute.mock.calls[0]?.[0]);
    expect(query.sql.toLowerCase()).toContain("for update skip locked");
    expect(query.sql.toLowerCase()).toContain(
      '"uploads"."status" = \'uploaded\'',
    );
    expect(query.sql.toLowerCase()).toContain("status = 'processing'");
    expect(query.sql.toLowerCase()).toContain(
      "processing_attempts = claimed_upload.processing_attempts + 1",
    );
    expect(query.sql.toLowerCase()).toContain("processing_lease_id =");
    expect(query.sql.toLowerCase()).toContain(
      "processing_lease_expires_at = now()",
    );
    expect(query.sql.toLowerCase()).toContain(
      'order by "uploads"."created_at" asc, "uploads"."id" asc',
    );
  });

  it("returns null when no uploaded document is available", async () => {
    const databaseFixture = createDatabaseFixture({ claimedUpload: null });

    await expect(
      processNextDocumentUpload({
        database: databaseFixture.database,
        documentStorage: createStorage(),
        extractor: createExtractor(),
      }),
    ).resolves.toBeNull();

    expect(databaseFixture.transaction).not.toHaveBeenCalled();
  });

  it("downloads, extracts, persists candidates, and marks the upload processed atomically", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const databaseFixture = createDatabaseFixture();
    const storage = createStorage();
    const extractor = createExtractor();

    await expect(
      processNextDocumentUpload({
        database: databaseFixture.database,
        documentStorage: storage,
        extractor,
      }),
    ).resolves.toEqual({
      uploadId: upload.id,
      status: "processed",
      candidateCount: 1,
    });

    expect(storage.readDocument).toHaveBeenCalledWith(upload.objectKey);
    expect(extractor.extractDocument).toHaveBeenCalledWith({
      content,
      fileName: upload.originalFileName,
      mimeType: upload.mimeType,
    });
    expect(databaseFixture.candidateInsert).toHaveBeenCalledWith(
      transactionCandidates,
    );
    expect(databaseFixture.candidateValues).toHaveBeenCalledWith([
      {
        userId: upload.userId,
        uploadId: upload.id,
        position: 0,
        type: "expense",
        amountMinor: 4290n,
        currencyCode: "BRL",
        occurredOn: "2026-11-10",
        description: "Groceries",
        counterparty: "Market",
        notes: null,
        extractionMetadata: {
          confidence: {
            type: 0.99,
            amountMinor: 0.95,
            currencyCode: 0.9,
            description: 0.8,
            counterparty: 0.9,
          },
          warnings: ["Date was not visible"],
        },
        status: "pending",
      },
    ]);
    expect(databaseFixture.processedUpdate).toHaveBeenCalledWith(uploads);
    expect(databaseFixture.processedSet).toHaveBeenCalledWith({
      status: "processed",
      failureCode: null,
      processingLeaseId: null,
      processingLeaseExpiresAt: null,
      updatedAt: now,
    });
    expect(
      compileSql(databaseFixture.processedWhere.mock.calls[0]?.[0]).params,
    ).toEqual([
      upload.id,
      upload.userId,
      "processing",
      upload.processingLeaseId,
    ]);
    expect(databaseFixture.failedUpdate).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "download failure",
      storage: createStorage({ error: new Error("S3 unavailable") }),
      extractor: createExtractor(),
      failureCode: "document_download_failed",
    },
    {
      name: "extraction failure",
      storage: createStorage(),
      extractor: createExtractor({ error: new Error("AI unavailable") }),
      failureCode: "document_extraction_failed",
    },
  ])("marks the upload failed after a $name", async (fixture) => {
    const databaseFixture = createDatabaseFixture();

    await expect(
      processNextDocumentUpload({
        database: databaseFixture.database,
        documentStorage: fixture.storage,
        extractor: fixture.extractor,
      }),
    ).resolves.toEqual({
      uploadId: upload.id,
      status: "failed",
      failureCode: fixture.failureCode,
    });

    expect(databaseFixture.failedSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        failureCode: fixture.failureCode,
        processingLeaseId: null,
        processingLeaseExpiresAt: null,
      }),
    );
    expect(
      compileSql(databaseFixture.failedWhere.mock.calls[0]?.[0]).params,
    ).toEqual([
      upload.id,
      upload.userId,
      "processing",
      upload.processingLeaseId,
    ]);
  });

  it.each([
    {
      name: "storage timeout",
      storage: createStorage({ error: { code: "ETIMEDOUT" } }),
      extractor: createExtractor(),
      failureCode: "document_download_timeout",
    },
    {
      name: "OpenAI rate limit",
      storage: createStorage(),
      extractor: createExtractor({ error: { status: 429 } }),
      failureCode: "ai_rate_limited",
    },
    {
      name: "OpenAI outage",
      storage: createStorage(),
      extractor: createExtractor({ error: { status: 503 } }),
      failureCode: "ai_service_unavailable",
    },
  ])("persists the classified code after a $name", async (fixture) => {
    const databaseFixture = createDatabaseFixture();

    await expect(
      processNextDocumentUpload({
        database: databaseFixture.database,
        documentStorage: fixture.storage,
        extractor: fixture.extractor,
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureCode: fixture.failureCode,
    });
  });

  it("rejects a stored document whose checksum changed", async () => {
    const databaseFixture = createDatabaseFixture();
    const extractor = createExtractor();

    await expect(
      processNextDocumentUpload({
        database: databaseFixture.database,
        documentStorage: createStorage({ value: Buffer.from("changed") }),
        extractor,
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureCode: "document_checksum_mismatch",
    });

    expect(extractor.extractDocument).not.toHaveBeenCalled();
  });

  it("marks an upload failed when extraction produces no candidates", async () => {
    const databaseFixture = createDatabaseFixture();

    await expect(
      processNextDocumentUpload({
        database: databaseFixture.database,
        documentStorage: createStorage(),
        extractor: createExtractor({ candidates: [] }),
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureCode: "no_transaction_candidates",
    });

    expect(databaseFixture.transaction).not.toHaveBeenCalled();
  });

  it("marks an upload failed when every extracted candidate is unusable", async () => {
    const databaseFixture = createDatabaseFixture();
    const unusableCandidate: ExtractedTransactionCandidate = {
      type: null,
      amountMinor: null,
      currencyCode: null,
      occurredOn: null,
      description: null,
      counterparty: null,
      notes: null,
      confidence: {
        type: null,
        amountMinor: null,
        currencyCode: null,
        occurredOn: null,
        description: null,
        counterparty: null,
      },
      warnings: ["No transaction data was visible"],
    };

    await expect(
      processNextDocumentUpload({
        database: databaseFixture.database,
        documentStorage: createStorage(),
        extractor: createExtractor({ candidates: [unusableCandidate] }),
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureCode: "no_usable_transaction_candidates",
    });

    expect(databaseFixture.transaction).not.toHaveBeenCalled();
  });

  it("filters unusable candidates and preserves the relative order of useful candidates", async () => {
    const databaseFixture = createDatabaseFixture();
    const unusableCandidate: ExtractedTransactionCandidate = {
      type: null,
      amountMinor: null,
      currencyCode: null,
      occurredOn: null,
      description: null,
      counterparty: null,
      notes: null,
      confidence: {
        type: null,
        amountMinor: null,
        currencyCode: null,
        occurredOn: null,
        description: null,
        counterparty: null,
      },
      warnings: [],
    };
    const secondCandidate: ExtractedTransactionCandidate = {
      ...candidate,
      amountMinor: null,
      description: "Second invoice",
      confidence: {
        type: null,
        amountMinor: null,
        currencyCode: null,
        occurredOn: null,
        description: null,
        counterparty: null,
      },
      warnings: [],
    };

    await expect(
      processNextDocumentUpload({
        database: databaseFixture.database,
        documentStorage: createStorage(),
        extractor: createExtractor({
          candidates: [candidate, unusableCandidate, secondCandidate],
        }),
      }),
    ).resolves.toMatchObject({ candidateCount: 2, status: "processed" });

    const values = databaseFixture.candidateValues.mock.calls[0]?.[0] as
      | Record<string, unknown>[]
      | undefined;
    expect(values).toBeDefined();
    if (!values) {
      throw new Error("Candidate values were not persisted.");
    }

    expect(values).toHaveLength(2);
    expect(values[0]).toMatchObject({ position: 0, amountMinor: 4290n });
    expect(values[1]).toMatchObject({ position: 1, amountMinor: null });
  });

  it("rejects an unsupported media type stored in upload metadata", async () => {
    const databaseFixture = createDatabaseFixture({
      claimedUpload: {
        ...upload,
        mimeType: "text/plain",
        checksumSha256: null,
      },
    });
    const extractor = createExtractor();

    await expect(
      processNextDocumentUpload({
        database: databaseFixture.database,
        documentStorage: createStorage(),
        extractor,
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureCode: "unsupported_document_type",
    });

    expect(extractor.extractDocument).not.toHaveBeenCalled();
  });

  it("marks the upload failed when candidate persistence cannot complete", async () => {
    const databaseFixture = createDatabaseFixture({
      insertError: new Error("insert failed"),
    });

    await expect(
      processNextDocumentUpload({
        database: databaseFixture.database,
        documentStorage: createStorage(),
        extractor: createExtractor(),
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureCode: "candidate_persistence_failed",
    });
  });

  it("does not let a stale worker complete or fail a newer lease", async () => {
    const databaseFixture = createDatabaseFixture({
      failedUploadExists: false,
      processedUploadExists: false,
    });

    await expect(
      processNextDocumentUpload({
        database: databaseFixture.database,
        documentStorage: createStorage(),
        extractor: createExtractor(),
      }),
    ).rejects.toThrow(
      "Document extraction failed and the upload could not be marked as failed.",
    );
    expect(
      compileSql(databaseFixture.processedWhere.mock.calls[0]?.[0]).params,
    ).toContain(upload.processingLeaseId);
    expect(
      compileSql(databaseFixture.failedWhere.mock.calls[0]?.[0]).params,
    ).toContain(upload.processingLeaseId);
  });

  it("surfaces both errors when a failed extraction cannot update the upload state", async () => {
    const databaseFixture = createDatabaseFixture({
      markFailedError: new Error("database unavailable"),
    });

    await expect(
      processNextDocumentUpload({
        database: databaseFixture.database,
        documentStorage: createStorage({ error: new Error("S3 unavailable") }),
        extractor: createExtractor(),
      }),
    ).rejects.toThrow(
      "Document extraction failed and the upload could not be marked as failed.",
    );
  });

  it("rejects an invalid processing lease duration", async () => {
    const databaseFixture = createDatabaseFixture();

    await expect(
      claimNextDocumentUpload(databaseFixture.database, 0),
    ).rejects.toThrow(
      "Document processing lease duration must be a positive integer.",
    );
    expect(databaseFixture.execute).not.toHaveBeenCalled();
  });
});
