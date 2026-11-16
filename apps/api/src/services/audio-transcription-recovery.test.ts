import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import { recoverExpiredAudioProcessingLeases } from "./audio-transcription-recovery.js";

const postgresDialect = new PgDialect();

function createDatabase(rows: Array<Record<string, unknown>>) {
  const execute = vi.fn().mockResolvedValue({ rows });

  return { database: { execute } as unknown as Database, execute };
}

describe("recoverExpiredAudioProcessingLeases", () => {
  it("requeues recoverable attempts and fails exhausted attempts", async () => {
    const fixture = createDatabase([
      { id: "one", status: "uploaded" },
      { id: "two", status: "failed" },
    ]);

    await expect(
      recoverExpiredAudioProcessingLeases(fixture.database),
    ).resolves.toEqual({ failedCount: 1, requeuedCount: 1 });

    const query = postgresDialect.sqlToQuery(
      fixture.execute.mock.calls[0]?.[0] as SQL,
    );
    const normalizedSql = query.sql.toLowerCase();
    expect(normalizedSql).toContain('"uploads"."kind" = \'audio\'');
    expect(normalizedSql).toContain("exists");
    expect(normalizedSql).toContain('from "audio_transcripts"');
    expect(normalizedSql).toContain("for update skip locked");
    expect(normalizedSql).toContain("processing_lease_id = null");
    expect(normalizedSql).toContain("'audio_transcription_interrupted'");
    expect(normalizedSql).toContain(
      "'audio_candidate_extraction_interrupted'",
    );
    expect(query.params).toContain(100);
  });

  it("returns zero counts when no transcription lease expired", async () => {
    const fixture = createDatabase([]);

    await expect(
      recoverExpiredAudioProcessingLeases(fixture.database),
    ).resolves.toEqual({ failedCount: 0, requeuedCount: 0 });
  });

  it.each([0, 1.5])("rejects invalid batch size %s", async (batchSize) => {
    const fixture = createDatabase([]);

    await expect(
      recoverExpiredAudioProcessingLeases(fixture.database, batchSize),
    ).rejects.toThrow(
      "Audio processing recovery batch size must be a positive integer.",
    );
    expect(fixture.execute).not.toHaveBeenCalled();
  });
});
