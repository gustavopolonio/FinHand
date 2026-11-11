import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import {
  transactionCandidates,
  type TransactionCandidateExtractionMetadata,
  type TransactionCandidateStatus,
  type TransactionType,
} from "../db/schema/index.js";
import {
  ConflictError,
  InputError,
  NotFoundError,
} from "../errors/application-errors.js";
import {
  getTransactionCandidateReviewForUser,
  updateTransactionCandidateForUser,
} from "./transaction-candidates.js";

const userId = "11111111-1111-4111-8111-111111111111";
const uploadId = "22222222-2222-4222-8222-222222222222";
const candidateId = "33333333-3333-4333-8333-333333333333";
const accountId = "44444444-4444-4444-8444-444444444444";
const categoryId = "55555555-5555-4555-8555-555555555555";
const createdAt = new Date("2026-11-10T12:00:00.000Z");
const updatedAt = new Date("2026-11-10T13:00:00.000Z");

interface TestCandidateRecord {
  id: string;
  uploadId: string;
  position: number;
  accountId: string | null;
  categoryId: string | null;
  type: TransactionType | null;
  amountMinor: bigint | null;
  currencyCode: string | null;
  occurredOn: string | null;
  description: string | null;
  counterparty: string | null;
  notes: string | null;
  extractionMetadata: TransactionCandidateExtractionMetadata | null;
  status: TransactionCandidateStatus;
  createdAt: Date;
  updatedAt: Date;
}

const candidateRecord: TestCandidateRecord = {
  id: candidateId,
  uploadId,
  position: 0,
  accountId: null,
  categoryId: null,
  type: "expense",
  amountMinor: 4290n,
  currencyCode: "BRL",
  occurredOn: "2026-11-10",
  description: "Groceries",
  counterparty: "Market",
  notes: null,
  extractionMetadata: {
    confidence: { amountMinor: 0.9 },
    warnings: ["The total was slightly blurred."],
  },
  status: "pending",
  createdAt,
  updatedAt,
};

interface FixtureOptions {
  account?:
    | { id: string; currencyCode: string; archivedAt: Date | null }
    | undefined;
  candidate?: TestCandidateRecord | undefined;
  candidates?: TestCandidateRecord[];
  category?:
    | { id: string; type: "income" | "expense"; archivedAt: Date | null }
    | undefined;
  returnedCandidate?: TestCandidateRecord | undefined;
  upload?:
    | {
        id: string;
        originalFileName: string;
        status: "processed" | "processing" | "failed";
        failureCode: string | null;
      }
    | undefined;
}

function createDatabaseFixture(options: FixtureOptions = {}) {
  const findUpload = vi.fn().mockResolvedValue(
    options.upload === undefined
      ? {
          id: uploadId,
          originalFileName: "receipt.pdf",
          status: "processed",
          failureCode: null,
        }
      : options.upload,
  );
  const findCandidates = vi
    .fn()
    .mockResolvedValue(options.candidates ?? [candidateRecord]);
  const findCandidate = vi
    .fn()
    .mockResolvedValue(options.candidate ?? candidateRecord);
  const findAccount = vi.fn().mockResolvedValue(options.account);
  const findCategory = vi.fn().mockResolvedValue(options.category);
  const returning = vi.fn().mockResolvedValue(
    options.returnedCandidate === undefined
      ? [candidateRecord]
      : options.returnedCandidate
        ? [options.returnedCandidate]
        : [],
  );
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  const database = {
    query: {
      uploads: { findFirst: findUpload },
      transactionCandidates: {
        findFirst: findCandidate,
        findMany: findCandidates,
      },
      accounts: { findFirst: findAccount },
      categories: { findFirst: findCategory },
    },
    update,
  } as unknown as Database;

  return {
    database,
    findAccount,
    findCandidate,
    findCandidates,
    findCategory,
    findUpload,
    returning,
    set,
    update,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("getTransactionCandidateReviewForUser", () => {
  it("returns upload progress and ordered serialized candidates", async () => {
    const fixture = createDatabaseFixture();

    await expect(
      getTransactionCandidateReviewForUser(
        fixture.database,
        userId,
        uploadId,
      ),
    ).resolves.toEqual({
      upload: {
        id: uploadId,
        originalFileName: "receipt.pdf",
        status: "processed",
        failureCode: null,
      },
      candidates: [
        {
          ...candidateRecord,
          amountMinor: "4290",
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      ],
    });
    expect(fixture.findUpload).toHaveBeenCalledOnce();
    expect(fixture.findCandidates).toHaveBeenCalledOnce();
  });

  it("does not expose another user's upload", async () => {
    const fixture = createDatabaseFixture({ upload: undefined });
    fixture.findUpload.mockResolvedValueOnce(undefined);

    await expect(
      getTransactionCandidateReviewForUser(
        fixture.database,
        userId,
        uploadId,
      ),
    ).rejects.toEqual(new NotFoundError("Upload not found"));
    expect(fixture.findCandidates).not.toHaveBeenCalled();
  });
});

describe("updateTransactionCandidateForUser", () => {
  it("normalizes and updates a pending draft without creating a transaction", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-11T10:00:00.000Z"));
    const returnedCandidate = {
      ...candidateRecord,
      accountId,
      categoryId,
      amountMinor: 5500n,
      description: "Corrected groceries",
      counterparty: null,
      updatedAt: new Date(),
    };
    const fixture = createDatabaseFixture({
      account: { id: accountId, currencyCode: "BRL", archivedAt: null },
      category: { id: categoryId, type: "expense", archivedAt: null },
      returnedCandidate,
    });

    const result = await updateTransactionCandidateForUser(
      fixture.database,
      userId,
      candidateId,
      {
        accountId,
        categoryId,
        type: "expense",
        amountMinor: "5500",
        currencyCode: "brl",
        description: "  Corrected   groceries ",
        counterparty: "   ",
      },
    );

    expect(result).toMatchObject({
      id: candidateId,
      amountMinor: "5500",
      description: "Corrected groceries",
      counterparty: null,
      status: "pending",
    });
    expect(fixture.update).toHaveBeenCalledWith(transactionCandidates);
    expect(fixture.set).toHaveBeenCalledWith({
      accountId,
      categoryId,
      type: "expense",
      amountMinor: 5500n,
      currencyCode: "BRL",
      description: "Corrected groceries",
      counterparty: null,
      updatedAt: new Date("2026-11-11T10:00:00.000Z"),
    });
  });

  it("returns not found for a candidate outside the user's ownership", async () => {
    const fixture = createDatabaseFixture();
    fixture.findCandidate.mockResolvedValueOnce(undefined);

    await expect(
      updateTransactionCandidateForUser(
        fixture.database,
        userId,
        candidateId,
        { description: "Updated" },
      ),
    ).rejects.toEqual(
      new NotFoundError("Transaction candidate not found"),
    );
    expect(fixture.update).not.toHaveBeenCalled();
  });

  it.each(["confirmed", "rejected"] as const)(
    "does not edit a %s candidate",
    async (status) => {
      const fixture = createDatabaseFixture({
        candidate: { ...candidateRecord, status },
      });

      await expect(
        updateTransactionCandidateForUser(
          fixture.database,
          userId,
          candidateId,
          { description: "Updated" },
        ),
      ).rejects.toEqual(
        new ConflictError(
          "Only pending transaction candidates can be edited.",
        ),
      );
    },
  );

  it.each([
    ["0", "Transaction candidate amount must be greater than zero."],
    [
      "9223372036854775808",
      "Transaction candidate amount is outside PostgreSQL BIGINT range.",
    ],
  ])("rejects invalid amount %s", async (amountMinor, message) => {
    const fixture = createDatabaseFixture();

    await expect(
      updateTransactionCandidateForUser(
        fixture.database,
        userId,
        candidateId,
        { amountMinor },
      ),
    ).rejects.toEqual(new InputError(message));
  });

  it("rejects an unsupported currency", async () => {
    const fixture = createDatabaseFixture();

    await expect(
      updateTransactionCandidateForUser(
        fixture.database,
        userId,
        candidateId,
        { currencyCode: "ZZZ" },
      ),
    ).rejects.toEqual(
      new InputError("Transaction candidate currency is invalid."),
    );
  });

  it("requires a selected account to belong to the user", async () => {
    const fixture = createDatabaseFixture({ account: undefined });

    await expect(
      updateTransactionCandidateForUser(
        fixture.database,
        userId,
        candidateId,
        { accountId },
      ),
    ).rejects.toEqual(new NotFoundError("Account not found"));
  });

  it("rejects an archived account", async () => {
    const fixture = createDatabaseFixture({
      account: {
        id: accountId,
        currencyCode: "BRL",
        archivedAt: new Date(),
      },
    });

    await expect(
      updateTransactionCandidateForUser(
        fixture.database,
        userId,
        candidateId,
        { accountId },
      ),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects a currency that differs from the selected account", async () => {
    const fixture = createDatabaseFixture({
      account: { id: accountId, currencyCode: "BRL", archivedAt: null },
    });

    await expect(
      updateTransactionCandidateForUser(
        fixture.database,
        userId,
        candidateId,
        { accountId, currencyCode: "USD" },
      ),
    ).rejects.toEqual(
      new InputError(
        "Transaction candidate currency must match the selected account currency.",
      ),
    );
  });

  it("requires a selected category type to match the candidate", async () => {
    const fixture = createDatabaseFixture({
      category: { id: categoryId, type: "income", archivedAt: null },
    });

    await expect(
      updateTransactionCandidateForUser(
        fixture.database,
        userId,
        candidateId,
        { categoryId, type: "expense" },
      ),
    ).rejects.toEqual(
      new InputError(
        "Transaction candidate type must match the selected category type.",
      ),
    );
  });

  it("handles a concurrent status change without overwriting it", async () => {
    const fixture = createDatabaseFixture({ returnedCandidate: undefined });
    fixture.returning.mockResolvedValueOnce([]);

    await expect(
      updateTransactionCandidateForUser(
        fixture.database,
        userId,
        candidateId,
        { description: "Updated" },
      ),
    ).rejects.toEqual(
      new ConflictError(
        "Transaction candidate is no longer available for editing.",
      ),
    );
  });
});
