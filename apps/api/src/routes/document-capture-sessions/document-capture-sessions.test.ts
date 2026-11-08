import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import type { Database } from "../../db/index.js";
import { registerApplicationErrorHandler } from "../../errors/error-handler.js";
import {
  ConflictError,
  GoneError,
  UnauthorizedError,
} from "../../errors/application-errors.js";
import type { DocumentStorage } from "../../storage/document-storage.js";
import { registerSchemaCompilers } from "../../validation/schema-compilers.js";
import { documentCaptureSessionRoutes } from "./document-capture-sessions.js";

const captureMocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  create: vi.fn(),
  getAvailable: vi.fn(),
  tokenFromAuthorization: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("../../services/document-capture-sessions.js", () => ({
  cancelDocumentCaptureSession: captureMocks.cancel,
  captureTokenFromAuthorization: captureMocks.tokenFromAuthorization,
  createDocumentCaptureSession: captureMocks.create,
  getAvailableDocumentCaptureSession: captureMocks.getAvailable,
  uploadDocumentForCaptureSession: captureMocks.upload,
}));

const applications: ReturnType<typeof Fastify>[] = [];
const userId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const token = "a".repeat(43);
const expiresAt = "2026-11-08T12:05:00.000Z";

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

function createMultipartPayload() {
  const boundary = "finhand-capture-boundary";
  const content = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const header = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="document"; filename="receipt.jpg"\r\n' +
      "Content-Type: image/jpeg\r\n\r\n",
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    payload: Buffer.concat([header, content, footer]),
  };
}

function createApplication(authenticatedUserId: string | null) {
  const application = Fastify();
  const documentStorage = {
    close: vi.fn(),
    deleteDocument: vi.fn(),
    storeDocument: vi.fn(),
  } satisfies DocumentStorage;

  registerSchemaCompilers(application);
  registerApplicationErrorHandler(application);
  application.decorate("database", {} as Database);
  registerAuthenticationGuard(
    application,
    createAuthentication(authenticatedUserId),
  );
  application.register(documentCaptureSessionRoutes, {
    captureBaseUrl: "https://finhand.example",
    documentStorage,
  });
  applications.push(application);

  return application;
}

beforeEach(() => {
  captureMocks.tokenFromAuthorization.mockImplementation(
    (authorization: string | undefined) => {
      if (authorization !== `Bearer ${token}`) {
        throw new UnauthorizedError();
      }

      return token;
    },
  );
  captureMocks.create.mockResolvedValue({
    id: sessionId,
    status: "pending",
    expiresAt,
    token,
  });
  captureMocks.cancel.mockResolvedValue({
    id: sessionId,
    status: "cancelled",
    expiresAt,
  });
  captureMocks.getAvailable.mockResolvedValue({
    id: sessionId,
    status: "pending",
    expiresAt,
  });
  captureMocks.upload.mockImplementation(async (input) => {
    for await (const _chunk of input.source) {
      // Consume the multipart stream as the real upload service does.
    }

    return {
      id: "55555555-5555-4555-8555-555555555555",
      originalFileName: "receipt.jpg",
      mimeType: "image/jpeg",
      byteSize: "6",
      checksumSha256: "b".repeat(64),
      status: "uploaded",
      createdAt: "2026-11-08T12:00:01.000Z",
      updatedAt: "2026-11-08T12:00:01.000Z",
    };
  });
});

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

describe("POST /api/document-capture-sessions", () => {
  it("requires a Google-authenticated desktop user", async () => {
    const application = createApplication(null);

    const response = await application.inject({
      method: "POST",
      url: "/api/document-capture-sessions",
    });

    expect(response.statusCode).toBe(401);
    expect(captureMocks.create).not.toHaveBeenCalled();
  });

  it("creates a five-minute session URL with the token in its fragment", async () => {
    const application = createApplication(userId);

    const response = await application.inject({
      method: "POST",
      url: "/api/document-capture-sessions",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      session: {
        id: sessionId,
        status: "pending",
        expiresAt,
        captureUrl: `https://finhand.example/capture#token=${token}`,
      },
    });
    expect(captureMocks.create).toHaveBeenCalledWith(
      expect.anything(),
      userId,
    );
    expect(response.json().session).not.toHaveProperty("token");
  });
});

describe("POST /api/document-capture-sessions/:id/cancel", () => {
  it("cancels only an authenticated user's session", async () => {
    const application = createApplication(userId);

    const response = await application.inject({
      method: "POST",
      url: `/api/document-capture-sessions/${sessionId}/cancel`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      session: { id: sessionId, status: "cancelled", expiresAt },
    });
    expect(captureMocks.cancel).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      sessionId,
    );
  });

  it("validates the session identifier", async () => {
    const application = createApplication(userId);

    const response = await application.inject({
      method: "POST",
      url: "/api/document-capture-sessions/not-a-uuid/cancel",
    });

    expect(response.statusCode).toBe(400);
    expect(captureMocks.cancel).not.toHaveBeenCalled();
  });
});

describe("GET /api/document-capture-session", () => {
  it("uses the token without requiring a Google session or exposing user data", async () => {
    const application = createApplication(null);

    const response = await application.inject({
      method: "GET",
      url: "/api/document-capture-session",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      session: {
        status: "pending",
        expiresAt,
        acceptedMimeTypes: [
          "application/pdf",
          "image/jpeg",
          "image/png",
        ],
        maximumBytes: 10 * 1024 * 1024,
      },
    });
    expect(response.body).not.toContain(userId);
    expect(response.body).not.toContain(sessionId);
  });

  it("rejects requests without a capture token", async () => {
    const application = createApplication(null);

    const response = await application.inject({
      method: "GET",
      url: "/api/document-capture-session",
    });

    expect(response.statusCode).toBe(401);
    expect(captureMocks.getAvailable).not.toHaveBeenCalled();
  });

  it("returns an explicit expiration response without exposing user data", async () => {
    captureMocks.getAvailable.mockRejectedValueOnce(
      new GoneError("This capture session has expired."),
    );
    const application = createApplication(null);

    const response = await application.inject({
      method: "GET",
      url: "/api/document-capture-session",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(410);
    expect(response.json()).toEqual({
      statusCode: 410,
      code: "CAPTURE_SESSION_EXPIRED",
      error: "Gone",
      message: "This capture session has expired.",
    });
    expect(response.body).not.toContain(userId);
  });

  it("rejects an already consumed session", async () => {
    captureMocks.getAvailable.mockRejectedValueOnce(
      new ConflictError("This capture session is no longer available."),
    );
    const application = createApplication(null);

    const response = await application.inject({
      method: "GET",
      url: "/api/document-capture-session",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "This capture session is no longer available.",
    });
  });
});

describe("POST /api/document-capture-session/document", () => {
  it("accepts one token-authorized document without Google authentication", async () => {
    const application = createApplication(null);
    const multipart = createMultipartPayload();

    const response = await application.inject({
      method: "POST",
      url: "/api/document-capture-session/document",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": multipart.contentType,
      },
      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().upload).toMatchObject({
      originalFileName: "receipt.jpg",
      status: "uploaded",
    });
    expect(captureMocks.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        token,
        fileName: "receipt.jpg",
        mimeType: "image/jpeg",
      }),
    );
  });

  it("validates the token before accepting a multipart body", async () => {
    const application = createApplication(null);

    const response = await application.inject({
      method: "POST",
      url: "/api/document-capture-session/document",
    });

    expect(response.statusCode).toBe(401);
    expect(captureMocks.upload).not.toHaveBeenCalled();
  });

  it("requires multipart form data after token validation", async () => {
    const application = createApplication(null);

    const response = await application.inject({
      method: "POST",
      url: "/api/document-capture-session/document",
      headers: { authorization: `Bearer ${token}` },
      payload: { document: "not-a-file" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Document upload must use multipart/form-data.",
    });
  });
});
