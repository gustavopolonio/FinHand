import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import { NotFoundError } from "../errors/application-errors.js";
import { createTestDocumentStorage } from "../test/document-storage.js";
import { documentPreviewUrlLifetimeSeconds } from "./document-previews.js";
import { getTransactionDocumentSourceForUser } from "./transaction-document-sources.js";

const postgresDialect = new PgDialect();
const transactionId = "22222222-2222-4222-8222-222222222222";
const userId = "11111111-1111-4111-8111-111111111111";

function createDatabase(source: unknown) {
  const limit = vi.fn().mockResolvedValue(source ? [source] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const secondInnerJoin = vi.fn().mockReturnValue({ where });
  const firstInnerJoin = vi.fn().mockReturnValue({ innerJoin: secondInnerJoin });
  const from = vi.fn().mockReturnValue({ innerJoin: firstInnerJoin });
  const select = vi.fn().mockReturnValue({ from });

  return {
    database: { select } as unknown as Database,
    firstInnerJoin,
    limit,
    secondInnerJoin,
    select,
    where,
  };
}

describe("getTransactionDocumentSourceForUser", () => {
  it("creates a private preview for the document that produced the transaction", async () => {
    const fixture = createDatabase({
      contentType: "image/jpeg",
      fileName: "receipt.jpg",
      objectKey: `${userId}/documents/source-id`,
    });
    const documentStorage = createTestDocumentStorage();
    vi.mocked(documentStorage.createDocumentPreviewUrl).mockResolvedValue(
      "https://signed.example/receipt",
    );

    await expect(
      getTransactionDocumentSourceForUser({
        database: fixture.database,
        documentStorage,
        now: new Date("2026-11-13T12:00:00.000Z"),
        transactionId,
        userId,
      }),
    ).resolves.toEqual({
      contentType: "image/jpeg",
      expiresAt: "2026-11-13T12:05:00.000Z",
      fileName: "receipt.jpg",
      url: "https://signed.example/receipt",
    });
    expect(documentStorage.createDocumentPreviewUrl).toHaveBeenCalledWith(
      `${userId}/documents/source-id`,
      documentPreviewUrlLifetimeSeconds,
    );

    const whereExpression = fixture.where.mock.calls[0]?.[0] as SQL;
    expect(postgresDialect.sqlToQuery(whereExpression).params).toEqual(
      expect.arrayContaining([
        transactionId,
        userId,
        "document",
        "confirmed",
        "document",
      ]),
    );
  });

  it("does not expose manual, missing, or another user's source", async () => {
    const fixture = createDatabase(undefined);
    const documentStorage = createTestDocumentStorage();

    await expect(
      getTransactionDocumentSourceForUser({
        database: fixture.database,
        documentStorage,
        transactionId,
        userId,
      }),
    ).rejects.toEqual(
      new NotFoundError("Transaction source document not found"),
    );
    expect(documentStorage.createDocumentPreviewUrl).not.toHaveBeenCalled();
  });
});
