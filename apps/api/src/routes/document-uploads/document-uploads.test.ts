import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import type { Database } from "../../db/index.js";
import { registerApplicationErrorHandler } from "../../errors/error-handler.js";
import { maximumDocumentUploadBytes } from "../../services/document-uploads.js";
import type {
  DocumentStorage,
  StoreDocumentInput,
} from "../../storage/document-storage.js";
import { documentUploadRoutes } from "./document-uploads.js";

const applications: ReturnType<typeof Fastify>[] = [];
const userId = "33333333-3333-4333-8333-333333333333";

function createAuthentication(authenticatedUserId: string | null) {
  return {
    handler: async () => new Response(null, { status: 404 }),
    api: {
      getSession: async () =>
        authenticatedUserId
          ? {
              session: { id: "session-id" },
              user: { id: authenticatedUserId },
            }
          : null,
    },
  } as unknown as Authentication;
}

function createMultipartPayload(options: {
  content?: Buffer;
  fieldName?: string;
  fileName?: string;
  mimeType?: string;
} = {}) {
  const boundary = "finhand-test-boundary";
  const content = options.content ?? Buffer.from("%PDF-1.7\nreceipt");
  const fieldName = options.fieldName ?? "document";
  const fileName = options.fileName ?? "receipt.pdf";
  const mimeType = options.mimeType ?? "application/pdf";
  const header = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload: Buffer.concat([header, content, footer]),
  };
}

function createEmptyMultipartPayload() {
  const boundary = "finhand-empty-boundary";

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload: Buffer.from(`--${boundary}--\r\n`),
  };
}

function createStorage(options: { storeError?: Error } = {}) {
  const storedContent: Buffer[] = [];
  const storage = {
    close: vi.fn(),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    storeDocument: vi.fn(async ({ body }: StoreDocumentInput) => {
      for await (const chunk of body) {
        storedContent.push(Buffer.from(chunk));
      }

      if (options.storeError) {
        throw options.storeError;
      }
    }),
  } satisfies DocumentStorage;

  return { storage, storedContent };
}

function createApplication(options: {
  documentStorage?: DocumentStorage;
  insert?: ReturnType<typeof vi.fn>;
  userId: string | null;
}) {
  const application = Fastify();
  const database = {
    insert: options.insert ?? vi.fn(),
  } as unknown as Database;
  const documentStorage = options.documentStorage ?? createStorage().storage;

  registerApplicationErrorHandler(application);
  application.decorate("database", database);
  registerAuthenticationGuard(
    application,
    createAuthentication(options.userId),
  );
  application.register(documentUploadRoutes, { documentStorage });
  applications.push(application);

  return application;
}

function createInsert() {
  let insertedValues: Record<string, unknown> | undefined;
  const returning = vi.fn(async () => [
    {
      id: insertedValues?.id,
      originalFileName: insertedValues?.originalFileName,
      mimeType: insertedValues?.mimeType,
      byteSize: insertedValues?.byteSize,
      checksumSha256: insertedValues?.checksumSha256,
      status: insertedValues?.status,
      createdAt: new Date("2026-11-05T12:00:00.000Z"),
      updatedAt: new Date("2026-11-05T12:00:01.000Z"),
    },
  ]);
  const values = vi.fn((value: Record<string, unknown>) => {
    insertedValues = value;
    return { returning };
  });
  const insert = vi.fn().mockReturnValue({ values });

  return { insert, values };
}

afterEach(async () => {
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

describe("POST /api/uploads/documents", () => {
  it("rejects a request without an authenticated user before processing it", async () => {
    const insert = vi.fn();
    const storageFixture = createStorage();
    const application = createApplication({
      documentStorage: storageFixture.storage,
      insert,
      userId: null,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/documents",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(storageFixture.storage.storeDocument).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("requires a multipart request", async () => {
    const application = createApplication({ userId });

    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/documents",
      payload: { document: "not a file" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Document upload must use multipart/form-data.",
    });
  });

  it("requires one document file", async () => {
    const application = createApplication({ userId });
    const multipart = createEmptyMultipartPayload();

    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/documents",
      headers: { "content-type": multipart.contentType },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "A document file is required." });
  });

  it("requires the document form field name", async () => {
    const application = createApplication({ userId });
    const multipart = createMultipartPayload({ fieldName: "file" });

    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/documents",
      headers: { "content-type": multipart.contentType },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'The uploaded file must use the "document" form field.',
    });
  });

  it("stores a private document owned by the authenticated user", async () => {
    const insertFixture = createInsert();
    const storageFixture = createStorage();
    const application = createApplication({
      documentStorage: storageFixture.storage,
      insert: insertFixture.insert,
      userId,
    });
    const content = Buffer.from("%PDF-1.7\nreceipt");
    const multipart = createMultipartPayload({ content });

    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/documents",
      headers: { "content-type": multipart.contentType },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      upload: {
        id: expect.any(String),
        originalFileName: "receipt.pdf",
        mimeType: "application/pdf",
        byteSize: content.length.toString(),
        checksumSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        status: "uploaded",
        createdAt: "2026-11-05T12:00:00.000Z",
        updatedAt: "2026-11-05T12:00:01.000Z",
      },
    });
    expect(Buffer.concat(storageFixture.storedContent)).toEqual(content);
    expect(insertFixture.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        source: "direct",
        s3ObjectKey: expect.stringMatching(
          new RegExp(`^${userId}/documents/[0-9a-f-]+$`),
        ),
      }),
    );
  });

  it("rejects a file whose content does not match its declared type", async () => {
    const insert = vi.fn();
    const storageFixture = createStorage();
    const application = createApplication({
      documentStorage: storageFixture.storage,
      insert,
      userId,
    });
    const multipart = createMultipartPayload({
      content: Buffer.from("plain text"),
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/documents",
      headers: { "content-type": multipart.contentType },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Document content does not match its declared file type.",
    });
    expect(storageFixture.storage.deleteDocument).toHaveBeenCalledOnce();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects files larger than 10 MB and removes any partial object", async () => {
    const insert = vi.fn();
    const storageFixture = createStorage();
    const application = createApplication({
      documentStorage: storageFixture.storage,
      insert,
      userId,
    });
    const content = Buffer.alloc(maximumDocumentUploadBytes + 1, 0);
    Buffer.from("%PDF-").copy(content);
    const multipart = createMultipartPayload({ content });

    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/documents",
      headers: { "content-type": multipart.contentType },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(413);
    expect(insert).not.toHaveBeenCalled();
    expect(storageFixture.storage.deleteDocument).toHaveBeenCalledOnce();
  });

  it("returns a safe error and cleans storage when persistence fails", async () => {
    const returning = vi.fn().mockRejectedValue(new Error("database secret"));
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const storageFixture = createStorage();
    const application = createApplication({
      documentStorage: storageFixture.storage,
      insert,
      userId,
    });
    const multipart = createMultipartPayload();

    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/documents",
      headers: { "content-type": multipart.contentType },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("database secret");
    expect(storageFixture.storage.deleteDocument).toHaveBeenCalledOnce();
  });
});
