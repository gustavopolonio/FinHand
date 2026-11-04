import Fastify from "fastify";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import type { Database } from "../../db/index.js";
import { transactions } from "../../db/schema/index.js";
import { registerApplicationErrorHandler } from "../../errors/error-handler.js";
import { registerSchemaCompilers } from "../../validation/schema-compilers.js";
import { transactionRoutes } from "./transactions.js";

const applications: ReturnType<typeof Fastify>[] = [];
const userId = "33333333-3333-4333-8333-333333333333";
const transactionId = "66666666-6666-4666-8666-666666666666";
const postgresDialect = new PgDialect();

function getSqlParameters(expression: unknown) {
  return postgresDialect.sqlToQuery(expression as SQL).params;
}

afterEach(async () => {
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

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

function createApplication(options: {
  userId: string | null;
  deleteTransaction?: ReturnType<typeof vi.fn>;
}) {
  const application = Fastify();
  const database = {
    delete: options.deleteTransaction ?? vi.fn(),
  } as unknown as Database;

  registerSchemaCompilers(application);
  registerApplicationErrorHandler(application);
  application.decorate("database", database);
  registerAuthenticationGuard(
    application,
    createAuthentication(options.userId),
  );
  application.register(transactionRoutes);
  applications.push(application);

  return application;
}

function createDelete(returnedRecords: unknown[]) {
  const returning = vi.fn().mockResolvedValue(returnedRecords);
  const where = vi.fn().mockReturnValue({ returning });
  const deleteTransaction = vi.fn().mockReturnValue({ where });

  return { deleteTransaction, returning, where };
}

describe("DELETE /api/transactions/:id", () => {
  it("rejects requests without an authenticated user", async () => {
    const deleteTransaction = vi.fn();
    const application = createApplication({
      userId: null,
      deleteTransaction,
    });

    const response = await application.inject({
      method: "DELETE",
      url: `/api/transactions/${transactionId}`,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  it("rejects an invalid transaction ID", async () => {
    const deleteTransaction = vi.fn();
    const application = createApplication({ userId, deleteTransaction });

    const response = await application.inject({
      method: "DELETE",
      url: "/api/transactions/not-a-uuid",
    });

    expect(response.statusCode).toBe(400);
    expect(deleteTransaction).not.toHaveBeenCalled();
  });

  it("deletes the authenticated user's transaction and returns no content", async () => {
    const { deleteTransaction, returning, where } = createDelete([
      { id: transactionId },
    ]);
    const application = createApplication({ userId, deleteTransaction });

    const response = await application.inject({
      method: "DELETE",
      url: `/api/transactions/${transactionId}`,
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe("");
    expect(deleteTransaction).toHaveBeenCalledOnce();
    expect(deleteTransaction).toHaveBeenCalledWith(transactions);
    expect(where).toHaveBeenCalledOnce();
    expect(getSqlParameters(where.mock.calls[0]?.[0])).toEqual([
      transactionId,
      userId,
    ]);
    expect(returning).toHaveBeenCalledWith({ id: transactions.id });
  });

  it("returns 404 when the transaction is missing or belongs to another user", async () => {
    const { deleteTransaction } = createDelete([]);
    const application = createApplication({ userId, deleteTransaction });

    const response = await application.inject({
      method: "DELETE",
      url: `/api/transactions/${transactionId}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Transaction not found" });
  });

  it("leaves the resource deleted when the same request is repeated", async () => {
    const returning = vi
      .fn()
      .mockResolvedValueOnce([{ id: transactionId }])
      .mockResolvedValueOnce([]);
    const where = vi.fn().mockReturnValue({ returning });
    const deleteTransaction = vi.fn().mockReturnValue({ where });
    const application = createApplication({ userId, deleteTransaction });

    const firstResponse = await application.inject({
      method: "DELETE",
      url: `/api/transactions/${transactionId}`,
    });
    const repeatedResponse = await application.inject({
      method: "DELETE",
      url: `/api/transactions/${transactionId}`,
    });

    expect(firstResponse.statusCode).toBe(204);
    expect(repeatedResponse.statusCode).toBe(404);
    expect(repeatedResponse.json()).toEqual({
      error: "Transaction not found",
    });
    expect(deleteTransaction).toHaveBeenCalledTimes(2);
  });

  it("returns a safe 500 response when deletion fails", async () => {
    const where = vi
      .fn()
      .mockRejectedValue(new Error("Sensitive database failure"));
    const deleteTransaction = vi.fn().mockReturnValue({ where });
    const application = createApplication({ userId, deleteTransaction });

    const response = await application.inject({
      method: "DELETE",
      url: `/api/transactions/${transactionId}`,
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("Sensitive database failure");
  });
});
