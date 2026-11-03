import Fastify from "fastify";
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
const accountId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";

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
  findMany?: ReturnType<typeof vi.fn>;
}) {
  const application = Fastify();
  const database = {
    query: {
      transactions: {
        findMany: options.findMany ?? vi.fn(),
      },
    },
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

function createTransactionRecord(id: string) {
  return {
    id,
    accountId,
    categoryId,
    type: "expense" as const,
    amountMinor: 2_590n,
    currencyCode: "BRL",
    occurredOn: "2026-11-03",
    description: "Weekly groceries",
    counterparty: "Supermarket",
    notes: null,
    origin: "manual" as const,
    createdAt: new Date("2026-11-03T15:00:00.000Z"),
    updatedAt: new Date("2026-11-03T15:00:00.000Z"),
  };
}

describe("GET /api/transactions", () => {
  it("rejects requests without an authenticated user", async () => {
    const findMany = vi.fn();
    const application = createApplication({ userId: null, findMany });

    const response = await application.inject({
      method: "GET",
      url: "/api/transactions",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns an empty first page with the default pagination", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const application = createApplication({ userId, findMany });

    const response = await application.inject({
      method: "GET",
      url: "/api/transactions",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      transactions: [],
      pagination: { limit: 50, offset: 0, hasMore: false },
    });
    expect(findMany).toHaveBeenCalledOnce();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 51, offset: 0 }),
    );
  });

  it("filters, orders, paginates, and serializes the user's transactions", async () => {
    const firstTransaction = createTransactionRecord(
      "44444444-4444-4444-8444-444444444444",
    );
    const extraTransaction = createTransactionRecord(
      "55555555-5555-4555-8555-555555555555",
    );
    const findMany = vi
      .fn()
      .mockResolvedValue([firstTransaction, extraTransaction]);
    const application = createApplication({ userId, findMany });

    const response = await application.inject({
      method: "GET",
      url:
        `/api/transactions?type=expense&accountId=${accountId}` +
        `&categoryId=${categoryId}&from=2026-11-01&to=2026-11-30` +
        "&limit=1&offset=2",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      transactions: [
        {
          id: firstTransaction.id,
          accountId,
          categoryId,
          type: "expense",
          amountMinor: "2590",
          currencyCode: "BRL",
          occurredOn: "2026-11-03",
          description: "Weekly groceries",
          counterparty: "Supermarket",
          notes: null,
          origin: "manual",
          createdAt: "2026-11-03T15:00:00.000Z",
          updatedAt: "2026-11-03T15:00:00.000Z",
        },
      ],
      pagination: { limit: 1, offset: 2, hasMore: true },
    });

    const queryConfiguration = findMany.mock.calls[0]?.[0] as {
      limit: number;
      offset: number;
      where: (
        transaction: typeof transactions,
        operators: {
          and: (...conditions: unknown[]) => unknown;
          eq: (left: unknown, right: unknown) => unknown;
          gte: (left: unknown, right: unknown) => unknown;
          lte: (left: unknown, right: unknown) => unknown;
        },
      ) => unknown;
      orderBy: (
        transaction: typeof transactions,
        operators: { desc: (column: unknown) => unknown },
      ) => unknown[];
    };
    expect(queryConfiguration.limit).toBe(2);
    expect(queryConfiguration.offset).toBe(2);

    const conditions = [
      Symbol("owner condition"),
      Symbol("type condition"),
      Symbol("account condition"),
      Symbol("category condition"),
      Symbol("from condition"),
      Symbol("to condition"),
    ];
    const combinedConditions = Symbol("combined conditions");
    const eq = vi
      .fn()
      .mockReturnValueOnce(conditions[0])
      .mockReturnValueOnce(conditions[1])
      .mockReturnValueOnce(conditions[2])
      .mockReturnValueOnce(conditions[3]);
    const gte = vi.fn().mockReturnValue(conditions[4]);
    const lte = vi.fn().mockReturnValue(conditions[5]);
    const and = vi.fn().mockReturnValue(combinedConditions);

    expect(
      queryConfiguration.where(transactions, { and, eq, gte, lte }),
    ).toBe(combinedConditions);
    expect(eq.mock.calls).toEqual([
      [transactions.userId, userId],
      [transactions.type, "expense"],
      [transactions.accountId, accountId],
      [transactions.categoryId, categoryId],
    ]);
    expect(gte).toHaveBeenCalledWith(
      transactions.occurredOn,
      "2026-11-01",
    );
    expect(lte).toHaveBeenCalledWith(
      transactions.occurredOn,
      "2026-11-30",
    );
    expect(and).toHaveBeenCalledWith(...conditions);

    const occurredOnOrder = Symbol("occurred-on order");
    const createdAtOrder = Symbol("created-at order");
    const idOrder = Symbol("id order");
    const desc = vi
      .fn()
      .mockReturnValueOnce(occurredOnOrder)
      .mockReturnValueOnce(createdAtOrder)
      .mockReturnValueOnce(idOrder);

    expect(queryConfiguration.orderBy(transactions, { desc })).toEqual([
      occurredOnOrder,
      createdAtOrder,
      idOrder,
    ]);
    expect(desc.mock.calls).toEqual([
      [transactions.occurredOn],
      [transactions.createdAt],
      [transactions.id],
    ]);
  });

  it.each([
    "type=transfer",
    "accountId=not-a-uuid",
    "categoryId=not-a-uuid",
    "from=2026-02-30",
    "from=2026-11-30&to=2026-11-01",
    "limit=0",
    "limit=101",
    "limit=1.5",
    "offset=-1",
    "offset=1.5",
    "unexpected=value",
  ])("rejects invalid query parameters: %s", async (query) => {
    const findMany = vi.fn();
    const application = createApplication({ userId, findMany });

    const response = await application.inject({
      method: "GET",
      url: `/api/transactions?${query}`,
    });

    expect(response.statusCode).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns a safe 500 response when the database query fails", async () => {
    const findMany = vi
      .fn()
      .mockRejectedValue(new Error("Sensitive database failure"));
    const application = createApplication({ userId, findMany });

    const response = await application.inject({
      method: "GET",
      url: "/api/transactions",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("Sensitive database failure");
  });
});
