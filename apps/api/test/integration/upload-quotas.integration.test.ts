import { createHash, randomUUID } from "node:crypto";

import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { DatabaseConnection } from "../../src/db/index.js";
import { uploads, users } from "../../src/db/schema/index.js";
import { UploadQuotaExceededError } from "../../src/errors/application-errors.js";
import {
  assertNewUploadQuotaAvailable,
  runWithinNewUploadQuota,
  uploadQuotaPolicy,
  type DatabaseTransaction,
} from "../../src/services/upload-quotas.js";
import {
  createTestDatabase,
  resetTestDatabase,
} from "./database.js";

const content = Buffer.from("%PDF-upload-quota-integration-test");
const checksumSha256 = createHash("sha256").update(content).digest("hex");

let connection: DatabaseConnection;

beforeAll(() => {
  connection = createTestDatabase();
});

beforeEach(async () => {
  await resetTestDatabase(connection.database);
});

afterAll(async () => {
  await connection.pool.end();
});

async function createUser(): Promise<string> {
  const id = randomUUID();

  await connection.database.insert(users).values({
    id,
    email: `${id}@upload-quota.integration.finhand.test`,
    defaultCurrency: "BRL",
    timeZone: "America/Sao_Paulo",
  });

  return id;
}

async function insertUpload(
  database: Pick<DatabaseTransaction, "insert">,
  userId: string,
  options: { createdAt?: Date; status?: "uploaded" | "processed" } = {},
): Promise<string> {
  const id = randomUUID();
  const createdAt = options.createdAt ?? new Date();

  await database.insert(uploads).values({
    id,
    userId,
    kind: "document",
    source: "direct",
    s3ObjectKey: `integration-tests/upload-quotas/${id}`,
    originalFileName: "receipt.pdf",
    mimeType: "application/pdf",
    byteSize: BigInt(content.byteLength),
    checksumSha256,
    status: options.status ?? "uploaded",
    createdAt,
    updatedAt: createdAt,
  });

  return id;
}

describe("upload quota PostgreSQL concurrency", () => {
  it("allows only one concurrent upload to take the final active slot", async () => {
    const userId = await createUser();

    for (
      let index = 0;
      index < uploadQuotaPolicy.maximumActiveUploadsPerUser - 1;
      index += 1
    ) {
      await insertUpload(connection.database, userId);
    }

    const createQuotaBoundUpload = () =>
      runWithinNewUploadQuota(
        connection.database,
        userId,
        async (transaction) => insertUpload(transaction, userId),
      );
    const results = await Promise.allSettled([
      createQuotaBoundUpload(),
      createQuotaBoundUpload(),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({
      reason: expect.objectContaining({
        code: "ACTIVE_UPLOAD_LIMIT_EXCEEDED",
      }),
    });

    const [usage] = await connection.database
      .select({ value: count() })
      .from(uploads)
      .where(eq(uploads.userId, userId));
    expect(usage?.value).toBe(
      uploadQuotaPolicy.maximumActiveUploadsPerUser,
    );
  });

  it("enforces the rolling hourly upload budget independently of active jobs", async () => {
    const userId = await createUser();

    for (
      let index = 0;
      index < uploadQuotaPolicy.maximumUploadsPerUserPerWindow;
      index += 1
    ) {
      await insertUpload(connection.database, userId, {
        status: "processed",
      });
    }

    await expect(
      assertNewUploadQuotaAvailable(connection.database, userId),
    ).rejects.toEqual(
      new UploadQuotaExceededError(
        "Hourly upload limit reached. Try again later.",
        "HOURLY_UPLOAD_LIMIT_EXCEEDED",
      ),
    );
  });

  it("does not count uploads outside the rolling one-hour window", async () => {
    const userId = await createUser();
    const outsideWindow = new Date(
      Date.now() - uploadQuotaPolicy.uploadWindowMilliseconds - 60_000,
    );

    for (
      let index = 0;
      index < uploadQuotaPolicy.maximumUploadsPerUserPerWindow;
      index += 1
    ) {
      await insertUpload(connection.database, userId, {
        createdAt: outsideWindow,
        status: "processed",
      });
    }

    await expect(
      assertNewUploadQuotaAvailable(connection.database, userId),
    ).resolves.toBeUndefined();
  });
});
