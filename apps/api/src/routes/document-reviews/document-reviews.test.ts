import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import type { Database } from "../../db/index.js";
import { registerApplicationErrorHandler } from "../../errors/error-handler.js";
import { documentReviewRoutes } from "./document-reviews.js";

const reviewMocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("../../services/document-reviews.js", () => ({
  listOpenDocumentReviewsForUser: reviewMocks.list,
}));

const applications: ReturnType<typeof Fastify>[] = [];
const userId = "11111111-1111-4111-8111-111111111111";

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

  registerApplicationErrorHandler(application);
  application.decorate("database", {} as Database);
  registerAuthenticationGuard(
    application,
    createAuthentication(authenticatedUserId),
  );
  application.register(documentReviewRoutes);
  applications.push(application);

  return application;
}

beforeEach(() => {
  reviewMocks.list.mockResolvedValue([
    {
      uploadId: "22222222-2222-4222-8222-222222222222",
      originalFileName: "receipt.pdf",
      status: "processed",
      failureCode: null,
      pendingCandidateCount: 1,
      createdAt: "2026-11-10T12:00:00.000Z",
      updatedAt: "2026-11-10T12:01:00.000Z",
    },
  ]);
});

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

describe("GET /api/document-reviews", () => {
  it("lists only the authenticated user's open document reviews", async () => {
    const application = createApplication(userId);
    const response = await application.inject({
      method: "GET",
      url: "/api/document-reviews",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      reviews: [{ status: "processed", pendingCandidateCount: 1 }],
    });
    expect(reviewMocks.list).toHaveBeenCalledWith(
      expect.anything(),
      userId,
    );
  });

  it("requires authentication", async () => {
    const application = createApplication(null);
    const response = await application.inject({
      method: "GET",
      url: "/api/document-reviews",
    });

    expect(response.statusCode).toBe(401);
    expect(reviewMocks.list).not.toHaveBeenCalled();
  });
});
