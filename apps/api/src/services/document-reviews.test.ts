import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import { listOpenDocumentReviewsForUser } from "./document-reviews.js";

const postgresDialect = new PgDialect();
const userId = "11111111-1111-4111-8111-111111111111";
const uploadId = "22222222-2222-4222-8222-222222222222";

function createDatabaseFixture(records: unknown[]) {
  const limit = vi.fn().mockResolvedValue(records);
  const orderBy = vi.fn().mockReturnValue({ limit });
  const groupBy = vi.fn().mockReturnValue({ orderBy });
  const where = vi.fn().mockReturnValue({ groupBy });
  const leftJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ leftJoin });
  const select = vi.fn().mockReturnValue({ from });
  const database = { select } as unknown as Database;

  return { database, groupBy, leftJoin, limit, orderBy, select, where };
}

function getSqlParameters(expression: unknown) {
  return postgresDialect.sqlToQuery(expression as SQL).params;
}

describe("listOpenDocumentReviewsForUser", () => {
  it("serializes open document reviews and pending candidate counts", async () => {
    const createdAt = new Date("2026-11-10T12:00:00.000Z");
    const updatedAt = new Date("2026-11-10T12:01:00.000Z");
    const fixture = createDatabaseFixture([
      {
        uploadId,
        originalFileName: "receipt.pdf",
        status: "processed",
        failureCode: null,
        pendingCandidateCount: 2,
        createdAt,
        updatedAt,
      },
    ]);

    await expect(
      listOpenDocumentReviewsForUser(fixture.database, userId),
    ).resolves.toEqual([
      {
        uploadId,
        originalFileName: "receipt.pdf",
        status: "processed",
        failureCode: null,
        pendingCandidateCount: 2,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    ]);
    expect(fixture.limit).toHaveBeenCalledWith(50);
  });

  it("scopes active uploads and pending candidates to their owner", async () => {
    const fixture = createDatabaseFixture([]);

    await listOpenDocumentReviewsForUser(fixture.database, userId);

    expect(getSqlParameters(fixture.leftJoin.mock.calls[0]?.[1])).toContain(
      "pending",
    );
    expect(getSqlParameters(fixture.where.mock.calls[0]?.[0])).toEqual(
      expect.arrayContaining([
        userId,
        "pending",
        "uploaded",
        "processing",
        "processed",
      ]),
    );
  });

  it("returns an empty list when the user has no open reviews", async () => {
    const fixture = createDatabaseFixture([]);

    await expect(
      listOpenDocumentReviewsForUser(fixture.database, userId),
    ).resolves.toEqual([]);
  });
});
