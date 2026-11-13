import { describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import { ConflictError, NotFoundError } from "../errors/application-errors.js";
import { retryFailedDocumentUploadForUser } from "./document-retries.js";

const userId = "11111111-1111-4111-8111-111111111111";
const uploadId = "22222222-2222-4222-8222-222222222222";
const updatedAt = new Date("2026-11-13T12:00:00.000Z");

function createDatabaseFixture(
  upload: Record<string, unknown> | undefined,
  updatedUpload: Record<string, unknown> | null = {
    id: uploadId,
    status: "uploaded",
    failureCode: null,
    processingAttempts: 1,
    updatedAt,
  },
) {
  const returning = vi.fn().mockResolvedValue(
    updatedUpload === null ? [] : [updatedUpload],
  );
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  const findFirst = vi.fn().mockResolvedValue(upload);
  const database = {
    query: { uploads: { findFirst } },
    update,
  } as unknown as Database;

  return { database, findFirst, returning, set, update, where };
}

describe("retryFailedDocumentUploadForUser", () => {
  it("atomically returns a retryable failed document to the uploaded queue", async () => {
    const fixture = createDatabaseFixture({
      id: uploadId,
      status: "failed",
      failureCode: "ai_timeout",
      processingAttempts: 1,
    });

    await expect(
      retryFailedDocumentUploadForUser(fixture.database, userId, uploadId),
    ).resolves.toEqual({
      id: uploadId,
      status: "uploaded",
      failureCode: null,
      processingAttempts: 1,
      updatedAt: updatedAt.toISOString(),
    });
    expect(fixture.set).toHaveBeenCalledWith({
      status: "uploaded",
      failureCode: null,
      updatedAt: expect.any(Date),
    });
  });

  it("does not expose an upload outside the authenticated user's ownership", async () => {
    const fixture = createDatabaseFixture(undefined);

    await expect(
      retryFailedDocumentUploadForUser(fixture.database, userId, uploadId),
    ).rejects.toEqual(new NotFoundError("Document upload not found"));
    expect(fixture.update).not.toHaveBeenCalled();
  });

  it.each(["uploaded", "processing", "processed"])(
    "rejects an upload in %s status",
    async (status) => {
      const fixture = createDatabaseFixture({
        id: uploadId,
        status,
        failureCode: null,
        processingAttempts: 1,
      });

      await expect(
        retryFailedDocumentUploadForUser(fixture.database, userId, uploadId),
      ).rejects.toEqual(
        new ConflictError("Only failed document uploads can be retried."),
      );
      expect(fixture.update).not.toHaveBeenCalled();
    },
  );

  it("rejects a permanent content failure", async () => {
    const fixture = createDatabaseFixture({
      id: uploadId,
      status: "failed",
      failureCode: "no_transaction_candidates",
      processingAttempts: 1,
    });

    await expect(
      retryFailedDocumentUploadForUser(fixture.database, userId, uploadId),
    ).rejects.toEqual(
      new ConflictError("No financial transaction was found in this document."),
    );
    expect(fixture.update).not.toHaveBeenCalled();
  });

  it("rejects a transient failure after the attempt limit", async () => {
    const fixture = createDatabaseFixture({
      id: uploadId,
      status: "failed",
      failureCode: "ai_timeout",
      processingAttempts: 3,
    });

    await expect(
      retryFailedDocumentUploadForUser(fixture.database, userId, uploadId),
    ).rejects.toEqual(
      new ConflictError(
        "This document reached the processing attempt limit. Upload it again to continue.",
      ),
    );
  });

  it("rejects an unknown legacy failure code", async () => {
    const fixture = createDatabaseFixture({
      id: uploadId,
      status: "failed",
      failureCode: "legacy_failure",
      processingAttempts: 1,
    });

    await expect(
      retryFailedDocumentUploadForUser(fixture.database, userId, uploadId),
    ).rejects.toEqual(
      new ConflictError("Document processing failed. Upload the document again."),
    );
  });

  it("handles a concurrent state change without overwriting it", async () => {
    const fixture = createDatabaseFixture(
      {
        id: uploadId,
        status: "failed",
        failureCode: "ai_timeout",
        processingAttempts: 1,
      },
      null,
    );

    await expect(
      retryFailedDocumentUploadForUser(fixture.database, userId, uploadId),
    ).rejects.toEqual(
      new ConflictError(
        "The document upload changed before it could be retried.",
      ),
    );
  });
});
