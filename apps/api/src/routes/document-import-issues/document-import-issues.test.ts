import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import type { Database } from "../../db/index.js";
import { registerApplicationErrorHandler } from "../../errors/error-handler.js";
import { registerSchemaCompilers } from "../../validation/schema-compilers.js";
import { documentImportIssueRoutes } from "./document-import-issues.js";

const issueMocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
  list: vi.fn(),
}));

vi.mock("../../services/document-import-issues.js", () => ({
  dismissDocumentImportIssueForUser: issueMocks.dismiss,
  listDocumentImportIssuesForUser: issueMocks.list,
}));

const applications: ReturnType<typeof Fastify>[] = [];
const userId = "11111111-1111-4111-8111-111111111111";
const uploadId = "22222222-2222-4222-8222-222222222222";

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

function createApplication(authenticatedUserId: string | null) {
  const application = Fastify();

  registerSchemaCompilers(application);
  registerApplicationErrorHandler(application);
  application.decorate("database", {} as Database);
  registerAuthenticationGuard(
    application,
    createAuthentication(authenticatedUserId),
  );
  application.register(documentImportIssueRoutes);
  applications.push(application);

  return application;
}

beforeEach(() => {
  issueMocks.list.mockResolvedValue([
    {
      uploadId,
      originalFileName: "receipt.jpg",
      failure: {
        code: "ai_timeout",
        canRetry: true,
        message: "Document analysis timed out.",
      },
      createdAt: "2026-11-14T12:00:00.000Z",
      failedAt: "2026-11-14T12:01:00.000Z",
    },
  ]);
  issueMocks.dismiss.mockResolvedValue({
    uploadId,
    dismissedAt: "2026-11-15T12:00:00.000Z",
    changed: true,
  });
});

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

describe("GET /api/document-import-issues", () => {
  it("lists the authenticated user's unresolved failures", async () => {
    const application = createApplication(userId);
    const response = await application.inject({
      method: "GET",
      url: "/api/document-import-issues",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      issues: [{ uploadId, failure: { canRetry: true } }],
    });
    expect(issueMocks.list).toHaveBeenCalledWith(expect.anything(), userId);
  });

  it("requires authentication", async () => {
    const application = createApplication(null);
    const response = await application.inject({
      method: "GET",
      url: "/api/document-import-issues",
    });

    expect(response.statusCode).toBe(401);
    expect(issueMocks.list).not.toHaveBeenCalled();
  });
});

describe("POST /api/uploads/documents/:id/dismiss-failure", () => {
  it("dismisses an owned failed import", async () => {
    const application = createApplication(userId);
    const response = await application.inject({
      method: "POST",
      url: `/api/uploads/documents/${uploadId}/dismiss-failure`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      issue: { uploadId, changed: true },
    });
    expect(issueMocks.dismiss).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      uploadId,
    );
  });

  it("requires authentication", async () => {
    const application = createApplication(null);
    const response = await application.inject({
      method: "POST",
      url: `/api/uploads/documents/${uploadId}/dismiss-failure`,
    });

    expect(response.statusCode).toBe(401);
    expect(issueMocks.dismiss).not.toHaveBeenCalled();
  });

  it("validates the upload identifier", async () => {
    const application = createApplication(userId);
    const response = await application.inject({
      method: "POST",
      url: "/api/uploads/documents/not-a-uuid/dismiss-failure",
    });

    expect(response.statusCode).toBe(400);
    expect(issueMocks.dismiss).not.toHaveBeenCalled();
  });
});
