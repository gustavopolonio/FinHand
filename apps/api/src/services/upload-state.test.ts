import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import {
  uploads,
  type UploadStatus,
} from "../db/schema/index.js";
import {
  ConflictError,
  InputError,
  NotFoundError,
} from "../errors/application-errors.js";
import {
  claimUploadForProcessing,
  markUploadAsFailed,
  markUploadAsProcessed,
  markUploadAsUploaded,
} from "./upload-state.js";

const postgresDialect = new PgDialect();
const userId = "33333333-3333-4333-8333-333333333333";
const uploadId = "44444444-4444-4444-8444-444444444444";
const now = new Date("2026-11-07T12:00:00.000Z");

interface UploadStateRecord {
  id: string;
  status: UploadStatus;
  failureCode: string | null;
  updatedAt: Date;
}

interface DatabaseFixtureOptions {
  existingUpload?: UploadStateRecord;
  updateError?: Error;
  updatedUpload?: UploadStateRecord;
}

function createDatabaseFixture({
  existingUpload,
  updateError,
  updatedUpload,
}: DatabaseFixtureOptions = {}) {
  const returning = updateError
    ? vi.fn().mockRejectedValue(updateError)
    : vi.fn().mockResolvedValue(updatedUpload ? [updatedUpload] : []);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  const findFirst = vi.fn().mockResolvedValue(existingUpload);
  const database = {
    query: { uploads: { findFirst } },
    update,
  } as unknown as Database;

  return { database, findFirst, returning, set, update, where };
}

function getSqlParameters(expression: unknown) {
  return postgresDialect.sqlToQuery(expression as SQL).params;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("upload state transitions", () => {
  it.each([
    {
      name: "pending to uploaded",
      operation: markUploadAsUploaded,
      fromStatus: "pending",
      toStatus: "uploaded",
    },
    {
      name: "uploaded to processing",
      operation: claimUploadForProcessing,
      fromStatus: "uploaded",
      toStatus: "processing",
    },
    {
      name: "processing to processed",
      operation: markUploadAsProcessed,
      fromStatus: "processing",
      toStatus: "processed",
    },
  ] as const)("transitions $name atomically", async (fixture) => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const updatedUpload = {
      id: uploadId,
      status: fixture.toStatus,
      failureCode: null,
      updatedAt: now,
    };
    const databaseFixture = createDatabaseFixture({ updatedUpload });

    const result = await fixture.operation(
      databaseFixture.database,
      userId,
      uploadId,
    );

    expect(result).toEqual({
      id: uploadId,
      status: fixture.toStatus,
      failureCode: null,
      updatedAt: now.toISOString(),
    });
    expect(databaseFixture.update).toHaveBeenCalledWith(uploads);
    expect(databaseFixture.set).toHaveBeenCalledWith({
      status: fixture.toStatus,
      failureCode: null,
      updatedAt: now,
    });
    expect(
      getSqlParameters(databaseFixture.where.mock.calls[0]?.[0]),
    ).toEqual([uploadId, userId, fixture.fromStatus]);
    expect(databaseFixture.findFirst).not.toHaveBeenCalled();
  });

  it("transitions any nonterminal state to failed with a sanitized failure code", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const databaseFixture = createDatabaseFixture({
      updatedUpload: {
        id: uploadId,
        status: "failed",
        failureCode: "extraction_failed",
        updatedAt: now,
      },
    });

    const result = await markUploadAsFailed(
      databaseFixture.database,
      userId,
      uploadId,
      "  extraction_failed  ",
    );

    expect(result).toEqual({
      id: uploadId,
      status: "failed",
      failureCode: "extraction_failed",
      updatedAt: now.toISOString(),
    });
    expect(databaseFixture.set).toHaveBeenCalledWith({
      status: "failed",
      failureCode: "extraction_failed",
      updatedAt: now,
    });
    expect(
      getSqlParameters(databaseFixture.where.mock.calls[0]?.[0]),
    ).toEqual([
      uploadId,
      userId,
      "pending",
      "uploaded",
      "processing",
    ]);
  });

  it.each([
    {
      operation: markUploadAsUploaded,
      currentStatus: "processing",
      targetStatus: "uploaded",
    },
    {
      operation: claimUploadForProcessing,
      currentStatus: "pending",
      targetStatus: "processing",
    },
    {
      operation: markUploadAsProcessed,
      currentStatus: "uploaded",
      targetStatus: "processed",
    },
  ] as const)(
    "rejects an invalid $currentStatus to $targetStatus transition",
    async ({ currentStatus, operation, targetStatus }) => {
      const databaseFixture = createDatabaseFixture({
        existingUpload: {
          id: uploadId,
          status: currentStatus,
          failureCode: null,
          updatedAt: now,
        },
      });

      await expect(
        operation(databaseFixture.database, userId, uploadId),
      ).rejects.toEqual(
        new ConflictError(
          `Upload cannot transition from "${currentStatus}" to "${targetStatus}".`,
        ),
      );
      expect(databaseFixture.findFirst).toHaveBeenCalledOnce();
    },
  );

  it.each(["failed", "processed"] as const)(
    "does not allow the terminal %s state to fail again",
    async (currentStatus) => {
      const databaseFixture = createDatabaseFixture({
        existingUpload: {
          id: uploadId,
          status: currentStatus,
          failureCode:
            currentStatus === "failed" ? "extraction_failed" : null,
          updatedAt: now,
        },
      });

      await expect(
        markUploadAsFailed(
          databaseFixture.database,
          userId,
          uploadId,
          "provider_unavailable",
        ),
      ).rejects.toEqual(
        new ConflictError(
          `Upload cannot transition from "${currentStatus}" to "failed".`,
        ),
      );
    },
  );

  it("allows only one processor to claim an uploaded document", async () => {
    const firstClaim = createDatabaseFixture({
      updatedUpload: {
        id: uploadId,
        status: "processing",
        failureCode: null,
        updatedAt: now,
      },
    });
    const secondClaim = createDatabaseFixture({
      existingUpload: {
        id: uploadId,
        status: "processing",
        failureCode: null,
        updatedAt: now,
      },
    });

    await expect(
      claimUploadForProcessing(firstClaim.database, userId, uploadId),
    ).resolves.toMatchObject({ status: "processing" });
    await expect(
      claimUploadForProcessing(secondClaim.database, userId, uploadId),
    ).rejects.toEqual(
      new ConflictError(
        'Upload cannot transition from "processing" to "processing".',
      ),
    );
  });

  it("returns not found without revealing another user's upload", async () => {
    const databaseFixture = createDatabaseFixture();

    await expect(
      claimUploadForProcessing(
        databaseFixture.database,
        userId,
        uploadId,
      ),
    ).rejects.toEqual(new NotFoundError("Upload not found"));

    const queryConfiguration = databaseFixture.findFirst.mock.calls[0]?.[0] as {
      where: (
        upload: typeof uploads,
        operators: {
          and: (...conditions: unknown[]) => unknown;
          eq: (left: unknown, right: unknown) => unknown;
        },
      ) => unknown;
    };
    const idCondition = Symbol("id condition");
    const userCondition = Symbol("user condition");
    const ownerFilter = Symbol("owner filter");
    const eqOperator = vi
      .fn()
      .mockReturnValueOnce(idCondition)
      .mockReturnValueOnce(userCondition);
    const andOperator = vi.fn().mockReturnValue(ownerFilter);

    expect(
      queryConfiguration.where(uploads, {
        and: andOperator,
        eq: eqOperator,
      }),
    ).toBe(ownerFilter);
    expect(eqOperator.mock.calls).toEqual([
      [uploads.id, uploadId],
      [uploads.userId, userId],
    ]);
    expect(andOperator).toHaveBeenCalledWith(idCondition, userCondition);
  });

  it.each([
    "",
    "UPPERCASE",
    "invalid-code",
    "1starts_with_number",
    `a${"b".repeat(100)}`,
  ])("rejects unsafe failure code %j", async (failureCode) => {
    const databaseFixture = createDatabaseFixture();

    await expect(
      markUploadAsFailed(
        databaseFixture.database,
        userId,
        uploadId,
        failureCode,
      ),
    ).rejects.toEqual(
      new InputError(
        "Failure code must start with a lowercase letter and contain at most 100 lowercase letters, numbers, or underscores.",
      ),
    );
    expect(databaseFixture.update).not.toHaveBeenCalled();
  });

  it("propagates unexpected database failures", async () => {
    const databaseFixture = createDatabaseFixture({
      updateError: new Error("database unavailable"),
    });

    await expect(
      markUploadAsProcessed(databaseFixture.database, userId, uploadId),
    ).rejects.toThrow("database unavailable");
    expect(databaseFixture.findFirst).not.toHaveBeenCalled();
  });
});
