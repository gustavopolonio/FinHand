import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import { recoverExpiredDocumentProcessingLeases } from "./document-processing-recovery.js";

const postgresDialect = new PgDialect();

function createDatabase(rows: Array<Record<string, unknown>>) {
  const execute = vi.fn().mockResolvedValue({ rows });

  return {
    database: { execute } as unknown as Database,
    execute,
  };
}

describe("recoverExpiredDocumentProcessingLeases", () => {
  it("atomically requeues recoverable attempts and fails exhausted attempts", async () => {
    const fixture = createDatabase([
      { id: "11111111-1111-4111-8111-111111111111", status: "uploaded" },
      { id: "22222222-2222-4222-8222-222222222222", status: "uploaded" },
      { id: "33333333-3333-4333-8333-333333333333", status: "failed" },
    ]);

    await expect(
      recoverExpiredDocumentProcessingLeases(fixture.database),
    ).resolves.toEqual({ failedCount: 1, requeuedCount: 2 });

    const query = postgresDialect.sqlToQuery(
      fixture.execute.mock.calls[0]?.[0] as SQL,
    );
    const normalizedSql = query.sql.toLowerCase();
    expect(normalizedSql).toContain("for update skip locked");
    expect(normalizedSql).toContain("processing_lease_expires_at");
    expect(normalizedSql).toContain("processing_lease_id = null");
    expect(normalizedSql).toContain("processing_attempts <");
    expect(normalizedSql).toContain("'processing_interrupted'");
    expect(query.params).toContain(100);
  });

  it("returns zero counts when no lease has expired", async () => {
    const fixture = createDatabase([]);

    await expect(
      recoverExpiredDocumentProcessingLeases(fixture.database),
    ).resolves.toEqual({ failedCount: 0, requeuedCount: 0 });
  });

  it.each([0, 1.5])("rejects invalid batch size %s", async (batchSize) => {
    const fixture = createDatabase([]);

    await expect(
      recoverExpiredDocumentProcessingLeases(fixture.database, batchSize),
    ).rejects.toThrow(
      "Document processing recovery batch size must be a positive integer.",
    );
    expect(fixture.execute).not.toHaveBeenCalled();
  });
});
