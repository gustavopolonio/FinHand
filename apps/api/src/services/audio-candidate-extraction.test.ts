import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AudioTransactionExtractor } from "../ai/audio-transaction-extractor.js";
import type { Database } from "../db/index.js";
import { transactionCandidates } from "../db/schema/index.js";
import {
  claimNextAudioTranscriptForCandidateExtraction,
  getDateInTimeZone,
  processNextAudioCandidateExtraction,
  type ClaimedAudioTranscript,
} from "./audio-candidate-extraction.js";

const postgresDialect = new PgDialect();
const now = new Date("2026-11-16T02:00:00.000Z");
const upload: ClaimedAudioTranscript = {
  id: "44444444-4444-4444-8444-444444444444",
  userId: "33333333-3333-4333-8333-333333333333",
  transcript: "Yesterday I spent 42.90 at Market and received 100 reais.",
  defaultCurrency: "BRL",
  timeZone: "America/Sao_Paulo",
  processingLeaseId: "55555555-5555-4555-8555-555555555555",
  processingLeaseExpiresAt: new Date("2026-11-16T02:10:00.000Z"),
};
const candidates = [
  {
    type: "expense" as const,
    amountMinor: "4290",
    currencyCode: "BRL",
    occurredOn: "2026-11-14",
    description: "Groceries",
    counterparty: "Market",
    notes: null,
    confidence: {
      type: 0.99,
      amountMinor: 0.98,
      currencyCode: 0.8,
      occurredOn: 0.9,
      description: 0.9,
      counterparty: 0.9,
    },
    warnings: ["Currency was inferred."],
  },
  {
    type: "income" as const,
    amountMinor: "10000",
    currencyCode: "BRL",
    occurredOn: "2026-11-15",
    description: "Refund",
    counterparty: null,
    notes: null,
    confidence: {
      type: 0.9,
      amountMinor: 0.95,
      currencyCode: 0.8,
      occurredOn: 0.8,
      description: 0.7,
      counterparty: null,
    },
    warnings: [],
  },
];

interface DatabaseFixtureOptions {
  claimedUpload?: ClaimedAudioTranscript | null;
  failedUploadExists?: boolean;
  insertError?: Error;
  processedUploadExists?: boolean;
}

function createDatabaseFixture({
  claimedUpload = upload,
  failedUploadExists = true,
  insertError,
  processedUploadExists = true,
}: DatabaseFixtureOptions = {}) {
  const execute = vi.fn().mockResolvedValue({
    rows: claimedUpload ? [claimedUpload] : [],
  });
  const candidateValues = insertError
    ? vi.fn().mockRejectedValue(insertError)
    : vi.fn().mockResolvedValue(undefined);
  const candidateInsert = vi.fn().mockReturnValue({ values: candidateValues });
  const processedReturning = vi
    .fn()
    .mockResolvedValue(processedUploadExists ? [{ id: upload.id }] : []);
  const processedWhere = vi.fn().mockReturnValue({
    returning: processedReturning,
  });
  const processedSet = vi.fn().mockReturnValue({ where: processedWhere });
  const processedUpdate = vi.fn().mockReturnValue({ set: processedSet });
  const transaction = vi.fn(async (operation) =>
    operation({ insert: candidateInsert, update: processedUpdate }),
  );
  const failedReturning = vi
    .fn()
    .mockResolvedValue(failedUploadExists ? [{ id: upload.id }] : []);
  const failedWhere = vi.fn().mockReturnValue({ returning: failedReturning });
  const failedSet = vi.fn().mockReturnValue({ where: failedWhere });
  const failedUpdate = vi.fn().mockReturnValue({ set: failedSet });
  const database = {
    execute,
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
    processedSet,
    processedWhere,
    transaction,
  };
}

function createExtractor(
  options: { candidates?: typeof candidates; error?: unknown } = {},
) {
  const extractTranscript = options.error
    ? vi.fn().mockRejectedValue(options.error)
    : vi.fn().mockResolvedValue(options.candidates ?? candidates);

  return { extractTranscript } satisfies AudioTransactionExtractor;
}

function compileSql(expression: unknown) {
  return postgresDialect.sqlToQuery(expression as SQL);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("audio candidate extraction service", () => {
  it("atomically claims an audio upload with a transcript and no candidates", async () => {
    const fixture = createDatabaseFixture();

    await expect(
      claimNextAudioTranscriptForCandidateExtraction(fixture.database),
    ).resolves.toEqual(upload);

    const query = compileSql(fixture.execute.mock.calls[0]?.[0]);
    const normalizedSql = query.sql.toLowerCase();
    expect(normalizedSql).toContain("for update of \"uploads\" skip locked");
    expect(normalizedSql).toContain('inner join "audio_transcripts"');
    expect(normalizedSql).toContain('from "transaction_candidates"');
    expect(normalizedSql).toContain("not exists");
    expect(normalizedSql).toContain('"uploads"."kind" = \'audio\'');
    expect(normalizedSql).toContain('"uploads"."status" = \'uploaded\'');
    expect(normalizedSql).toContain("status = 'processing'");
    expect(query.params).toContain(3);
  });

  it("returns null when no transcript is ready", async () => {
    const fixture = createDatabaseFixture({ claimedUpload: null });

    await expect(
      processNextAudioCandidateExtraction({
        database: fixture.database,
        extractor: createExtractor(),
      }),
    ).resolves.toBeNull();
    expect(fixture.transaction).not.toHaveBeenCalled();
  });

  it("extracts ordered candidates, normalizes them, and marks the upload processed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const fixture = createDatabaseFixture();
    const extractor = createExtractor();

    await expect(
      processNextAudioCandidateExtraction({
        database: fixture.database,
        extractor,
        now,
      }),
    ).resolves.toEqual({
      uploadId: upload.id,
      status: "processed",
      candidateCount: 2,
    });

    expect(extractor.extractTranscript).toHaveBeenCalledWith({
      defaultCurrency: "BRL",
      referenceDate: "2026-11-15",
      timeZone: "America/Sao_Paulo",
      transcript: upload.transcript,
    });
    expect(fixture.candidateInsert).toHaveBeenCalledWith(transactionCandidates);
    expect(fixture.candidateValues).toHaveBeenCalledWith([
      expect.objectContaining({
        uploadId: upload.id,
        userId: upload.userId,
        position: 0,
        amountMinor: 4290n,
        description: "Groceries",
        status: "pending",
      }),
      expect.objectContaining({
        uploadId: upload.id,
        userId: upload.userId,
        position: 1,
        amountMinor: 10000n,
        description: "Refund",
        status: "pending",
      }),
    ]);
    expect(fixture.processedSet).toHaveBeenCalledWith({
      status: "processed",
      failureCode: null,
      failureDismissedAt: null,
      processingLeaseId: null,
      processingLeaseExpiresAt: null,
      updatedAt: now,
    });
    expect(
      compileSql(fixture.processedWhere.mock.calls[0]?.[0]).params,
    ).toEqual([
      upload.id,
      upload.userId,
      "processing",
      upload.processingLeaseId,
    ]);
    expect(fixture.failedUpdate).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "no financial events",
      extractor: createExtractor({ candidates: [] }),
      failureCode: "no_audio_transaction_candidates",
    },
    {
      name: "OpenAI rate limit",
      extractor: createExtractor({ error: { status: 429 } }),
      failureCode: "audio_candidate_extraction_rate_limited",
    },
  ])("marks the upload failed for $name", async (scenario) => {
    const fixture = createDatabaseFixture();

    await expect(
      processNextAudioCandidateExtraction({
        database: fixture.database,
        extractor: scenario.extractor,
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
      }),
    );
    expect(compileSql(fixture.failedWhere.mock.calls[0]?.[0]).params).toEqual([
      upload.id,
      upload.userId,
      "processing",
      upload.processingLeaseId,
    ]);
  });

  it("rejects normalized candidates with no meaningful fields", async () => {
    const fixture = createDatabaseFixture();
    const unusableCandidate = {
      ...candidates[0],
      type: null,
      amountMinor: null,
      currencyCode: null,
      occurredOn: null,
      description: null,
      counterparty: null,
      notes: null,
    };

    await expect(
      processNextAudioCandidateExtraction({
        database: fixture.database,
        extractor: createExtractor({
          candidates: [unusableCandidate] as unknown as typeof candidates,
        }),
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureCode: "no_usable_audio_transaction_candidates",
    });
  });

  it("classifies transient candidate persistence errors", async () => {
    const fixture = createDatabaseFixture({
      insertError: Object.assign(new Error("database unavailable"), {
        code: "40001",
      }),
    });

    await expect(
      processNextAudioCandidateExtraction({
        database: fixture.database,
        extractor: createExtractor(),
      }),
    ).resolves.toMatchObject({
      status: "failed",
      failureCode: "audio_candidate_persistence_unavailable",
    });
  });

  it("does not let a stale lease complete or fail another attempt", async () => {
    const fixture = createDatabaseFixture({
      failedUploadExists: false,
      processedUploadExists: false,
    });

    await expect(
      processNextAudioCandidateExtraction({
        database: fixture.database,
        extractor: createExtractor(),
      }),
    ).rejects.toThrow(AggregateError);
  });

  it("uses UTC when a stored time zone is invalid", () => {
    expect(getDateInTimeZone(now, "invalid-zone")).toBe("2026-11-16");
  });

  it.each([0, 1.5])("rejects invalid lease duration %s", async (duration) => {
    const fixture = createDatabaseFixture();

    await expect(
      claimNextAudioTranscriptForCandidateExtraction(
        fixture.database,
        duration,
      ),
    ).rejects.toThrow(
      "Audio candidate extraction lease duration must be a positive integer.",
    );
    expect(fixture.execute).not.toHaveBeenCalled();
  });
});
