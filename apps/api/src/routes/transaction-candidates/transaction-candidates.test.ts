import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import type { Database } from "../../db/index.js";
import { registerApplicationErrorHandler } from "../../errors/error-handler.js";
import { registerSchemaCompilers } from "../../validation/schema-compilers.js";
import { transactionCandidateRoutes } from "./transaction-candidates.js";

const candidateMocks = vi.hoisted(() => ({
  getReview: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../services/transaction-candidates.js", () => ({
  getTransactionCandidateReviewForUser: candidateMocks.getReview,
  updateTransactionCandidateForUser: candidateMocks.update,
}));

const applications: ReturnType<typeof Fastify>[] = [];
const userId = "11111111-1111-4111-8111-111111111111";
const uploadId = "22222222-2222-4222-8222-222222222222";
const candidateId = "33333333-3333-4333-8333-333333333333";
const candidate = {
  id: candidateId,
  uploadId,
  position: 0,
  accountId: null,
  categoryId: null,
  type: "expense",
  amountMinor: "4290",
  currencyCode: "BRL",
  occurredOn: "2026-11-10",
  description: "Groceries",
  counterparty: "Market",
  notes: null,
  extractionMetadata: null,
  status: "pending",
  createdAt: "2026-11-10T12:00:00.000Z",
  updatedAt: "2026-11-10T12:00:00.000Z",
};

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
  application.register(transactionCandidateRoutes);
  applications.push(application);

  return application;
}

beforeEach(() => {
  candidateMocks.getReview.mockResolvedValue({
    upload: {
      id: uploadId,
      originalFileName: "receipt.pdf",
      status: "processed",
      failureCode: null,
    },
    candidates: [candidate],
  });
  candidateMocks.update.mockResolvedValue(candidate);
});

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

describe("GET /api/transaction-candidates", () => {
  it("returns the authenticated user's upload and candidates", async () => {
    const application = createApplication(userId);
    const response = await application.inject({
      method: "GET",
      url: `/api/transaction-candidates?uploadId=${uploadId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      upload: { id: uploadId, status: "processed" },
      candidates: [{ id: candidateId, amountMinor: "4290" }],
    });
    expect(candidateMocks.getReview).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      uploadId,
    );
  });

  it("requires authentication", async () => {
    const application = createApplication(null);
    const response = await application.inject({
      method: "GET",
      url: `/api/transaction-candidates?uploadId=${uploadId}`,
    });

    expect(response.statusCode).toBe(401);
    expect(candidateMocks.getReview).not.toHaveBeenCalled();
  });

  it.each([
    "/api/transaction-candidates",
    "/api/transaction-candidates?uploadId=not-a-uuid",
  ])("validates the upload query for %s", async (url) => {
    const application = createApplication(userId);
    const response = await application.inject({ method: "GET", url });

    expect(response.statusCode).toBe(400);
    expect(candidateMocks.getReview).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/transaction-candidates/:id", () => {
  it("updates only the candidate draft", async () => {
    const application = createApplication(userId);
    const payload = {
      accountId: "44444444-4444-4444-8444-444444444444",
      categoryId: null,
      type: "expense",
      amountMinor: "5500",
      currencyCode: "brl",
      occurredOn: "2026-11-11",
      description: "Corrected groceries",
      counterparty: "Corner market",
      notes: null,
    };
    const response = await application.inject({
      method: "PATCH",
      url: `/api/transaction-candidates/${candidateId}`,
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ candidate });
    expect(candidateMocks.update).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      candidateId,
      payload,
    );
  });

  it.each([
    {
      name: "invalid candidate identifier",
      id: "not-a-uuid",
      payload: { description: "Groceries" },
    },
    { name: "empty body", id: candidateId, payload: {} },
    {
      name: "unknown field",
      id: candidateId,
      payload: { description: "Groceries", status: "confirmed" },
    },
    {
      name: "decimal minor-unit amount",
      id: candidateId,
      payload: { amountMinor: "42.90" },
    },
    {
      name: "invalid date",
      id: candidateId,
      payload: { occurredOn: "2026-02-30" },
    },
  ])("rejects $name", async ({ id, payload }) => {
    const application = createApplication(userId);
    const response = await application.inject({
      method: "PATCH",
      url: `/api/transaction-candidates/${id}`,
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(candidateMocks.update).not.toHaveBeenCalled();
  });
});
