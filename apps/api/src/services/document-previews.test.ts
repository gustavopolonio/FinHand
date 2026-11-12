import { describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import { NotFoundError } from "../errors/application-errors.js";
import { createTestDocumentStorage } from "../test/document-storage.js";
import {
  documentPreviewUrlLifetimeSeconds,
  getDocumentPreviewForUser,
} from "./document-previews.js";

const uploadId = "22222222-2222-4222-8222-222222222222";
const userId = "11111111-1111-4111-8111-111111111111";

function createDatabase(upload: unknown) {
  const findFirst = vi.fn().mockResolvedValue(upload);

  return {
    database: {
      query: { uploads: { findFirst } },
    } as unknown as Database,
    findFirst,
  };
}

describe("getDocumentPreviewForUser", () => {
  it("creates a five-minute preview for the owned document", async () => {
    const { database, findFirst } = createDatabase({
      mimeType: "application/pdf",
      s3ObjectKey: `${userId}/documents/${uploadId}`,
    });
    const documentStorage = createTestDocumentStorage();
    vi.mocked(documentStorage.createDocumentPreviewUrl).mockResolvedValue(
      "https://signed.example/receipt",
    );

    await expect(
      getDocumentPreviewForUser({
        database,
        documentStorage,
        now: new Date("2026-11-12T12:00:00.000Z"),
        uploadId,
        userId,
      }),
    ).resolves.toEqual({
      url: "https://signed.example/receipt",
      contentType: "application/pdf",
      expiresAt: "2026-11-12T12:05:00.000Z",
    });

    expect(documentStorage.createDocumentPreviewUrl).toHaveBeenCalledWith(
      `${userId}/documents/${uploadId}`,
      documentPreviewUrlLifetimeSeconds,
    );

    const query = findFirst.mock.calls[0]?.[0];
    const conditions = query.where(
      { id: "upload.id", userId: "upload.userId", kind: "upload.kind" },
      {
        and: (...values: unknown[]) => values,
        eq: (column: unknown, value: unknown) => ({ column, value }),
      },
    );
    expect(conditions).toEqual([
      { column: "upload.id", value: uploadId },
      { column: "upload.userId", value: userId },
      { column: "upload.kind", value: "document" },
    ]);
  });

  it("does not expose a URL when the owned document does not exist", async () => {
    const { database } = createDatabase(undefined);
    const documentStorage = createTestDocumentStorage();

    await expect(
      getDocumentPreviewForUser({
        database,
        documentStorage,
        uploadId,
        userId,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(documentStorage.createDocumentPreviewUrl).not.toHaveBeenCalled();
  });
});
