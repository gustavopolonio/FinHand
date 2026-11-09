import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import { documentCaptureSessions } from "../db/schema/index.js";
import { expirePendingDocumentCaptureSessions } from "./document-capture-session-cleanup.js";

const postgresDialect = new PgDialect();
const now = new Date("2026-11-09T15:00:00.000Z");
const sessionId = "11111111-1111-4111-8111-111111111111";

function createDatabaseFixture(
  results: Array<Array<{ id: string }>> = [[{ id: sessionId }]],
) {
  const returning = vi.fn();

  for (const result of results) {
    returning.mockResolvedValueOnce(result);
  }

  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  const database = { update } as unknown as Database;

  return { database, returning, set, update, where };
}

function getSqlParameters(expression: unknown) {
  return postgresDialect.sqlToQuery(expression as SQL).params;
}

describe("document capture session cleanup", () => {
  it("atomically expires only pending sessions whose expiration has passed", async () => {
    const fixture = createDatabaseFixture();

    await expect(
      expirePendingDocumentCaptureSessions(fixture.database, now),
    ).resolves.toBe(1);

    expect(fixture.update).toHaveBeenCalledWith(documentCaptureSessions);
    expect(fixture.set).toHaveBeenCalledWith({
      status: "expired",
      updatedAt: now,
    });
    expect(getSqlParameters(fixture.where.mock.calls[0]?.[0])).toEqual([
      "pending",
      now.toISOString(),
    ]);
  });

  it("returns zero when no session is eligible", async () => {
    const fixture = createDatabaseFixture([[]]);

    await expect(
      expirePendingDocumentCaptureSessions(fixture.database, now),
    ).resolves.toBe(0);
  });

  it("is safe when concurrent cleanup executions target the same session", async () => {
    const fixture = createDatabaseFixture([[{ id: sessionId }], []]);

    await expect(
      Promise.all([
        expirePendingDocumentCaptureSessions(fixture.database, now),
        expirePendingDocumentCaptureSessions(fixture.database, now),
      ]),
    ).resolves.toEqual([1, 0]);
  });

  it("propagates database failures", async () => {
    const fixture = createDatabaseFixture([]);
    fixture.returning.mockRejectedValueOnce(new Error("database unavailable"));

    await expect(
      expirePendingDocumentCaptureSessions(fixture.database, now),
    ).rejects.toThrow("database unavailable");
  });
});
