import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import { UploadQuotaExceededError } from "../errors/application-errors.js";
import {
  assertNewUploadQuotaAvailable,
  lockAndAssertNewUploadQuotaAvailable,
  lockAndAssertProcessingJobQuotaAvailable,
  uploadQuotaPolicy,
} from "./upload-quotas.js";

const postgresDialect = new PgDialect();
const userId = "11111111-1111-4111-8111-111111111111";

function quotaResult(activeUploadCount: number, recentUploadCount: number) {
  return {
    rows: [
      {
        active_upload_count: activeUploadCount,
        recent_upload_count: recentUploadCount,
      },
    ],
  };
}

function createDatabase(...results: unknown[]) {
  const execute = vi.fn();

  for (const result of results) {
    execute.mockResolvedValueOnce(result);
  }

  return {
    database: { execute } as unknown as Database,
    execute,
  };
}

describe("upload quotas", () => {
  it("accepts a new upload while both quota budgets are available", async () => {
    const fixture = createDatabase(quotaResult(4, 29));

    await expect(
      assertNewUploadQuotaAvailable(fixture.database, userId),
    ).resolves.toBeUndefined();
  });

  it("rejects a new upload when the active processing budget is full", async () => {
    const fixture = createDatabase(
      quotaResult(uploadQuotaPolicy.maximumActiveUploadsPerUser, 10),
    );

    await expect(
      assertNewUploadQuotaAvailable(fixture.database, userId),
    ).rejects.toEqual(
      new UploadQuotaExceededError(
        "Too many uploads are waiting to be processed. Try again after processing finishes.",
        "ACTIVE_UPLOAD_LIMIT_EXCEEDED",
      ),
    );
  });

  it("rejects a new upload when the rolling hourly budget is full", async () => {
    const fixture = createDatabase(
      quotaResult(0, uploadQuotaPolicy.maximumUploadsPerUserPerWindow),
    );

    await expect(
      assertNewUploadQuotaAvailable(fixture.database, userId),
    ).rejects.toEqual(
      new UploadQuotaExceededError(
        "Hourly upload limit reached. Try again later.",
        "HOURLY_UPLOAD_LIMIT_EXCEEDED",
      ),
    );
  });

  it("locks the per-user quota before the authoritative usage check", async () => {
    const fixture = createDatabase({ rows: [{}] }, quotaResult(4, 29));

    await expect(
      lockAndAssertNewUploadQuotaAvailable(fixture.database, userId),
    ).resolves.toBeUndefined();

    expect(fixture.execute).toHaveBeenCalledTimes(2);
    expect(
      postgresDialect.sqlToQuery(fixture.execute.mock.calls[0]?.[0] as SQL)
        .params,
    ).toContain(`finhand:upload-quota:${userId}`);
  });

  it("allows a retry past the hourly upload limit when an active slot exists", async () => {
    const fixture = createDatabase(
      { rows: [{}] },
      quotaResult(4, uploadQuotaPolicy.maximumUploadsPerUserPerWindow),
    );

    await expect(
      lockAndAssertProcessingJobQuotaAvailable(fixture.database, userId),
    ).resolves.toBeUndefined();
  });
});
