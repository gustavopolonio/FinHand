import { sql } from "drizzle-orm";

import type { Database } from "../db/index.js";
import { uploads } from "../db/schema/index.js";
import { UploadQuotaExceededError } from "../errors/application-errors.js";

export const uploadQuotaPolicy = Object.freeze({
  maximumActiveUploadsPerUser: 5,
  maximumUploadsPerUserPerWindow: 30,
  uploadWindowMilliseconds: 60 * 60 * 1_000,
});

interface UploadQuotaUsageRow extends Record<string, unknown> {
  active_upload_count: number;
  recent_upload_count: number;
}

type UploadQuotaDatabase = Pick<Database, "execute">;
export type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export interface UploadQuotaUsage {
  activeUploadCount: number;
  recentUploadCount: number;
}

async function getUploadQuotaUsage(
  database: UploadQuotaDatabase,
  userId: string,
): Promise<UploadQuotaUsage> {
  const result = await database.execute<UploadQuotaUsageRow>(sql`
    select
      count(*) filter (
        where ${uploads.status} in ('pending', 'uploaded', 'processing')
      )::integer as active_upload_count,
      count(*) filter (
        where ${uploads.createdAt} >= current_timestamp - (
          ${uploadQuotaPolicy.uploadWindowMilliseconds} * interval '1 millisecond'
        )
      )::integer as recent_upload_count
    from ${uploads}
    where ${uploads.userId} = ${userId}
  `);
  const usage = result.rows[0];

  if (!usage) {
    throw new Error("Upload quota query did not return usage.");
  }

  return {
    activeUploadCount: usage.active_upload_count,
    recentUploadCount: usage.recent_upload_count,
  };
}

function assertActiveUploadQuotaAvailable(usage: UploadQuotaUsage): void {
  if (
    usage.activeUploadCount >=
    uploadQuotaPolicy.maximumActiveUploadsPerUser
  ) {
    throw new UploadQuotaExceededError(
      "Too many uploads are waiting to be processed. Try again after processing finishes.",
      "ACTIVE_UPLOAD_LIMIT_EXCEEDED",
    );
  }
}

function assertHourlyUploadQuotaAvailable(usage: UploadQuotaUsage): void {
  if (
    usage.recentUploadCount >=
    uploadQuotaPolicy.maximumUploadsPerUserPerWindow
  ) {
    throw new UploadQuotaExceededError(
      "Hourly upload limit reached. Try again later.",
      "HOURLY_UPLOAD_LIMIT_EXCEEDED",
    );
  }
}

export async function assertNewUploadQuotaAvailable(
  database: UploadQuotaDatabase,
  userId: string,
): Promise<void> {
  const usage = await getUploadQuotaUsage(database, userId);
  assertActiveUploadQuotaAvailable(usage);
  assertHourlyUploadQuotaAvailable(usage);
}

async function lockUploadQuotaForUser(
  transaction: UploadQuotaDatabase,
  userId: string,
): Promise<void> {
  await transaction.execute(sql`
    select pg_advisory_xact_lock(
      hashtextextended(${`finhand:upload-quota:${userId}`}, 0)
    )
  `);
}

export async function lockAndAssertNewUploadQuotaAvailable(
  transaction: UploadQuotaDatabase,
  userId: string,
): Promise<void> {
  await lockUploadQuotaForUser(transaction, userId);
  await assertNewUploadQuotaAvailable(transaction, userId);
}

export async function lockAndAssertProcessingJobQuotaAvailable(
  transaction: UploadQuotaDatabase,
  userId: string,
): Promise<void> {
  await lockUploadQuotaForUser(transaction, userId);
  const usage = await getUploadQuotaUsage(transaction, userId);
  assertActiveUploadQuotaAvailable(usage);
}

export async function runWithinNewUploadQuota<Result>(
  database: Database,
  userId: string,
  operation: (transaction: DatabaseTransaction) => Promise<Result>,
): Promise<Result> {
  return database.transaction(async (transaction) => {
    await lockAndAssertNewUploadQuotaAvailable(transaction, userId);
    return operation(transaction);
  });
}
