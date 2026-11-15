import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import { ConflictError, NotFoundError } from "../errors/application-errors.js";
import {
  dismissDocumentImportIssueForUser,
  listDocumentImportIssuesForUser,
} from "./document-import-issues.js";

const postgresDialect = new PgDialect();
const userId = "11111111-1111-4111-8111-111111111111";
const uploadId = "22222222-2222-4222-8222-222222222222";
const createdAt = new Date("2026-11-14T12:00:00.000Z");
const failedAt = new Date("2026-11-14T12:01:00.000Z");

function createListDatabase(records: unknown[]) {
  const findMany = vi.fn().mockResolvedValue(records);

  return {
    database: {
      query: { uploads: { findMany } },
    } as unknown as Database,
    findMany,
  };
}

function createDismissDatabase(options: {
  existingUpload?: Record<string, unknown>;
  updatedUpload?: Record<string, unknown>;
}) {
  const returning = vi.fn().mockResolvedValue(
    options.updatedUpload ? [options.updatedUpload] : [],
  );
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  const findFirst = vi.fn().mockResolvedValue(options.existingUpload);

  return {
    database: {
      query: { uploads: { findFirst } },
      update,
    } as unknown as Database,
    findFirst,
    set,
    update,
    where,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("listDocumentImportIssuesForUser", () => {
  it("returns retryable and permanent undismissed failures with safe policies", async () => {
    const fixture = createListDatabase([
      {
        id: uploadId,
        originalFileName: "receipt.jpg",
        failureCode: "ai_timeout",
        processingAttempts: 1,
        createdAt,
        updatedAt: failedAt,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        originalFileName: "notes.pdf",
        failureCode: "no_transaction_candidates",
        processingAttempts: 1,
        createdAt,
        updatedAt: failedAt,
      },
    ]);

    await expect(
      listDocumentImportIssuesForUser(fixture.database, userId),
    ).resolves.toEqual([
      expect.objectContaining({
        uploadId,
        failure: expect.objectContaining({ canRetry: true }),
      }),
      expect.objectContaining({
        failure: expect.objectContaining({ canRetry: false }),
      }),
    ]);

    const configuration = fixture.findMany.mock.calls[0]?.[0];
    const conditions = configuration.where(
      {
        userId: "upload.userId",
        kind: "upload.kind",
        status: "upload.status",
        failureDismissedAt: "upload.failureDismissedAt",
      },
      {
        and: (...values: unknown[]) => values,
        eq: (column: unknown, value: unknown) => ({ column, value }),
        isNull: (column: unknown) => ({ isNull: column }),
      },
    );
    expect(conditions).toEqual([
      { column: "upload.userId", value: userId },
      { column: "upload.kind", value: "document" },
      { column: "upload.status", value: "failed" },
      { isNull: "upload.failureDismissedAt" },
    ]);
  });

  it("returns an empty list when no import needs attention", async () => {
    const fixture = createListDatabase([]);

    await expect(
      listDocumentImportIssuesForUser(fixture.database, userId),
    ).resolves.toEqual([]);
  });
});

describe("dismissDocumentImportIssueForUser", () => {
  it("atomically dismisses an owned unresolved failure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(failedAt);
    const fixture = createDismissDatabase({
      updatedUpload: {
        id: uploadId,
        failureDismissedAt: failedAt,
      },
    });

    await expect(
      dismissDocumentImportIssueForUser(fixture.database, userId, uploadId),
    ).resolves.toEqual({
      uploadId,
      dismissedAt: failedAt.toISOString(),
      changed: true,
    });
    expect(fixture.set).toHaveBeenCalledWith({
      failureDismissedAt: failedAt,
      updatedAt: failedAt,
    });
    expect(
      postgresDialect.sqlToQuery(fixture.where.mock.calls[0]?.[0] as SQL)
        .params,
    ).toEqual([uploadId, userId, "document", "failed"]);
  });

  it("returns an already dismissed failure idempotently", async () => {
    const fixture = createDismissDatabase({
      existingUpload: {
        id: uploadId,
        status: "failed",
        failureDismissedAt: failedAt,
      },
    });

    await expect(
      dismissDocumentImportIssueForUser(fixture.database, userId, uploadId),
    ).resolves.toEqual({
      uploadId,
      dismissedAt: failedAt.toISOString(),
      changed: false,
    });
  });

  it("does not expose another user's document", async () => {
    const fixture = createDismissDatabase({});

    await expect(
      dismissDocumentImportIssueForUser(fixture.database, userId, uploadId),
    ).rejects.toEqual(new NotFoundError("Document upload not found"));
  });

  it("does not dismiss a document that is no longer failed", async () => {
    const fixture = createDismissDatabase({
      existingUpload: {
        id: uploadId,
        status: "uploaded",
        failureDismissedAt: null,
      },
    });

    await expect(
      dismissDocumentImportIssueForUser(fixture.database, userId, uploadId),
    ).rejects.toEqual(
      new ConflictError("Only failed document imports can be dismissed."),
    );
  });
});
