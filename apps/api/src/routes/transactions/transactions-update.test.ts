import Fastify from "fastify";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import type { Database } from "../../db/index.js";
import {
  accounts,
  categories,
  transactions,
} from "../../db/schema/index.js";
import { registerApplicationErrorHandler } from "../../errors/error-handler.js";
import { registerSchemaCompilers } from "../../validation/schema-compilers.js";
import { transactionRoutes } from "./transactions.js";

const applications: ReturnType<typeof Fastify>[] = [];
const userId = "33333333-3333-4333-8333-333333333333";
const transactionId = "66666666-6666-4666-8666-666666666666";
const accountId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const newAccountId = "77777777-7777-4777-8777-777777777777";
const newCategoryId = "88888888-8888-4888-8888-888888888888";
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
  findTransaction?: ReturnType<typeof vi.fn>;
  findAccount?: ReturnType<typeof vi.fn>;
  findCategory?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
}) {
  const application = Fastify();
  const database = {
    query: {
      transactions: {
        findFirst: options.findTransaction ?? vi.fn(),
      },
      accounts: {
        findFirst: options.findAccount ?? vi.fn(),
      },
      categories: {
        findFirst: options.findCategory ?? vi.fn(),
      },
    },
    update: options.update ?? vi.fn(),
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

function existingTransaction() {
  return {
    id: transactionId,
    accountId,
    categoryId,
    type: "expense" as const,
  };
}

function returnedTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: transactionId,
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
    updatedAt: new Date("2026-11-04T15:00:00.000Z"),
    ...overrides,
  };
}

function createSuccessfulUpdate(record = returnedTransaction()) {
  const returning = vi.fn().mockResolvedValue([record]);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });

  return { returning, set, update, where };
}

describe("PATCH /api/transactions/:id", () => {
  it("rejects requests without an authenticated user", async () => {
    const findTransaction = vi.fn();
    const update = vi.fn();
    const application = createApplication({
      userId: null,
      findTransaction,
      update,
    });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/transactions/${transactionId}`,
      payload: { description: "New description" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(findTransaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("updates every editable field and derives currency from a reassigned account", async () => {
    const findTransaction = vi.fn().mockResolvedValue(existingTransaction());
    const findAccount = vi.fn().mockResolvedValue({
      id: newAccountId,
      currencyCode: "USD",
      archivedAt: null,
    });
    const findCategory = vi.fn().mockResolvedValue({
      id: newCategoryId,
      type: "income",
      archivedAt: null,
    });
    const updatedRecord = returnedTransaction({
      accountId: newAccountId,
      categoryId: newCategoryId,
      type: "income",
      amountMinor: 5_000n,
      currencyCode: "USD",
      occurredOn: "2026-11-04",
      description: "Refund",
      counterparty: "Store",
      notes: "Returned item",
    });
    const { set, update, where } = createSuccessfulUpdate(updatedRecord);
    const application = createApplication({
      userId,
      findTransaction,
      findAccount,
      findCategory,
      update,
    });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/transactions/${transactionId}`,
      payload: {
        accountId: newAccountId,
        categoryId: newCategoryId,
        type: "income",
        amountMinor: "5000",
        occurredOn: "2026-11-04",
        description: "  Refund  ",
        counterparty: "  Store  ",
        notes: "  Returned item  ",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      transaction: {
        id: transactionId,
        accountId: newAccountId,
        categoryId: newCategoryId,
        type: "income",
        amountMinor: "5000",
        currencyCode: "USD",
        occurredOn: "2026-11-04",
        description: "Refund",
        counterparty: "Store",
        notes: "Returned item",
        origin: "manual",
        createdAt: "2026-11-03T15:00:00.000Z",
        updatedAt: "2026-11-04T15:00:00.000Z",
      },
    });
    expect(update).toHaveBeenCalledWith(transactions);
    expect(set).toHaveBeenCalledWith({
      accountId: newAccountId,
      categoryId: newCategoryId,
      type: "income",
      amountMinor: 5_000n,
      currencyCode: "USD",
      occurredOn: "2026-11-04",
      description: "Refund",
      counterparty: "Store",
      notes: "Returned item",
      updatedAt: expect.any(Date),
    });

    const transactionQuery = findTransaction.mock.calls[0]?.[0] as {
      where: (
        transaction: typeof transactions,
        operators: {
          and: (...conditions: unknown[]) => unknown;
          eq: (left: unknown, right: unknown) => unknown;
        },
      ) => unknown;
    };
    const transactionConditions = [
      Symbol("transaction id"),
      Symbol("transaction owner"),
    ];
    const transactionFilter = Symbol("transaction filter");
    const transactionEq = vi
      .fn()
      .mockReturnValueOnce(transactionConditions[0])
      .mockReturnValueOnce(transactionConditions[1]);
    const transactionAnd = vi.fn().mockReturnValue(transactionFilter);

    expect(
      transactionQuery.where(transactions, {
        and: transactionAnd,
        eq: transactionEq,
      }),
    ).toBe(transactionFilter);
    expect(transactionEq.mock.calls).toEqual([
      [transactions.id, transactionId],
      [transactions.userId, userId],
    ]);

    const accountQuery = findAccount.mock.calls[0]?.[0] as {
      where: (
        account: typeof accounts,
        operators: {
          and: (...conditions: unknown[]) => unknown;
          eq: (left: unknown, right: unknown) => unknown;
        },
      ) => unknown;
    };
    const accountEq = vi.fn().mockReturnValue(Symbol("account condition"));
    const accountAnd = vi.fn().mockReturnValue(Symbol("account filter"));
    accountQuery.where(accounts, { and: accountAnd, eq: accountEq });
    expect(accountEq.mock.calls).toEqual([
      [accounts.id, newAccountId],
      [accounts.userId, userId],
    ]);

    const categoryQuery = findCategory.mock.calls[0]?.[0] as {
      where: (
        category: typeof categories,
        operators: {
          and: (...conditions: unknown[]) => unknown;
          eq: (left: unknown, right: unknown) => unknown;
        },
      ) => unknown;
    };
    const categoryEq = vi
      .fn()
      .mockReturnValue(Symbol("category condition"));
    const categoryAnd = vi.fn().mockReturnValue(Symbol("category filter"));
    categoryQuery.where(categories, {
      and: categoryAnd,
      eq: categoryEq,
    });
    expect(categoryEq.mock.calls).toEqual([
      [categories.id, newCategoryId],
      [categories.userId, userId],
    ]);
    expect(getSqlParameters(where.mock.calls[0]?.[0])).toEqual([
      transactionId,
      userId,
    ]);
  });

  it("edits unrelated fields without revalidating unchanged archived relationships", async () => {
    const findTransaction = vi.fn().mockResolvedValue(existingTransaction());
    const findAccount = vi.fn();
    const findCategory = vi.fn();
    const { set, update } = createSuccessfulUpdate(
      returnedTransaction({ description: "Corrected groceries" }),
    );
    const application = createApplication({
      userId,
      findTransaction,
      findAccount,
      findCategory,
      update,
    });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/transactions/${transactionId}`,
      payload: { description: "Corrected groceries" },
    });

    expect(response.statusCode).toBe(200);
    expect(findAccount).not.toHaveBeenCalled();
    expect(findCategory).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({
      description: "Corrected groceries",
      updatedAt: expect.any(Date),
    });
  });

  it("clears the category and optional text fields with null", async () => {
    const findTransaction = vi.fn().mockResolvedValue(existingTransaction());
    const findCategory = vi.fn();
    const { set, update } = createSuccessfulUpdate(
      returnedTransaction({
        categoryId: null,
        counterparty: null,
        notes: null,
      }),
    );
    const application = createApplication({
      userId,
      findTransaction,
      findCategory,
      update,
    });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/transactions/${transactionId}`,
      payload: { categoryId: null, counterparty: null, notes: null },
    });

    expect(response.statusCode).toBe(200);
    expect(findCategory).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({
      categoryId: null,
      counterparty: null,
      notes: null,
      updatedAt: expect.any(Date),
    });
  });

  it("returns 404 when the transaction is missing or belongs to another user", async () => {
    const findTransaction = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn();
    const application = createApplication({
      userId,
      findTransaction,
      update,
    });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/transactions/${transactionId}`,
      payload: { description: "New description" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Transaction not found" });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid transaction ID", "/api/transactions/not-a-uuid", { notes: null }],
    ["empty body", `/api/transactions/${transactionId}`, {}],
    [
      "client-controlled origin",
      `/api/transactions/${transactionId}`,
      { origin: "document" },
    ],
    [
      "client-controlled currency",
      `/api/transactions/${transactionId}`,
      { currencyCode: "USD" },
    ],
    [
      "invalid account ID",
      `/api/transactions/${transactionId}`,
      { accountId: "not-a-uuid" },
    ],
    [
      "invalid category ID",
      `/api/transactions/${transactionId}`,
      { categoryId: "not-a-uuid" },
    ],
    ["invalid type", `/api/transactions/${transactionId}`, { type: "transfer" }],
    [
      "decimal amount",
      `/api/transactions/${transactionId}`,
      { amountMinor: "25.90" },
    ],
    [
      "negative amount",
      `/api/transactions/${transactionId}`,
      { amountMinor: "-2590" },
    ],
    [
      "invalid date",
      `/api/transactions/${transactionId}`,
      { occurredOn: "2026-02-30" },
    ],
    [
      "empty description",
      `/api/transactions/${transactionId}`,
      { description: "" },
    ],
  ])("rejects %s", async (_scenario, url, payload) => {
    const findTransaction = vi.fn();
    const update = vi.fn();
    const application = createApplication({
      userId,
      findTransaction,
      update,
    });

    const response = await application.inject({
      method: "PATCH",
      url,
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(findTransaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ["0", "Transaction amount must be greater than zero."],
    [
      "9223372036854775808",
      "Transaction amount is outside PostgreSQL BIGINT range.",
    ],
  ])("rejects the out-of-range amount %s", async (amountMinor, error) => {
    const findTransaction = vi.fn().mockResolvedValue(existingTransaction());
    const update = vi.fn();
    const application = createApplication({
      userId,
      findTransaction,
      update,
    });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/transactions/${transactionId}`,
      payload: { amountMinor },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error });
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only description", async () => {
    const findTransaction = vi.fn().mockResolvedValue(existingTransaction());
    const update = vi.fn();
    const application = createApplication({
      userId,
      findTransaction,
      update,
    });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/transactions/${transactionId}`,
      payload: { description: "   " },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Transaction description is required.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined, 404, "Account not found"],
    [
      "archived",
      {
        id: newAccountId,
        currencyCode: "USD",
        archivedAt: new Date("2026-11-02T12:00:00.000Z"),
      },
      409,
      "Archived accounts cannot receive new transactions.",
    ],
  ])(
    "rejects a %s reassigned account",
    async (_scenario, account, statusCode, error) => {
      const findTransaction = vi.fn().mockResolvedValue(existingTransaction());
      const findAccount = vi.fn().mockResolvedValue(account);
      const update = vi.fn();
      const application = createApplication({
        userId,
        findTransaction,
        findAccount,
        update,
      });

      const response = await application.inject({
        method: "PATCH",
        url: `/api/transactions/${transactionId}`,
        payload: { accountId: newAccountId },
      });

      expect(response.statusCode).toBe(statusCode);
      expect(response.json()).toEqual({ error });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["missing", undefined, 404, "Category not found"],
    [
      "archived",
      {
        id: newCategoryId,
        type: "expense",
        archivedAt: new Date("2026-11-02T12:00:00.000Z"),
      },
      409,
      "Archived categories cannot receive new transactions.",
    ],
    [
      "type-incompatible",
      { id: newCategoryId, type: "income", archivedAt: null },
      400,
      "Transaction type must match the selected category type.",
    ],
  ])(
    "rejects a %s reassigned category",
    async (_scenario, category, statusCode, error) => {
      const findTransaction = vi.fn().mockResolvedValue(existingTransaction());
      const findCategory = vi.fn().mockResolvedValue(category);
      const update = vi.fn();
      const application = createApplication({
        userId,
        findTransaction,
        findCategory,
        update,
      });

      const response = await application.inject({
        method: "PATCH",
        url: `/api/transactions/${transactionId}`,
        payload: { categoryId: newCategoryId },
      });

      expect(response.statusCode).toBe(statusCode);
      expect(response.json()).toEqual({ error });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("rejects a type change that leaves an incompatible category attached", async () => {
    const findTransaction = vi.fn().mockResolvedValue(existingTransaction());
    const findCategory = vi.fn().mockResolvedValue({
      id: categoryId,
      type: "expense",
      archivedAt: null,
    });
    const update = vi.fn();
    const application = createApplication({
      userId,
      findTransaction,
      findCategory,
      update,
    });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/transactions/${transactionId}`,
      payload: { type: "income" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Transaction type must match the selected category type.",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("allows a type change when the category is cleared in the same request", async () => {
    const findTransaction = vi.fn().mockResolvedValue(existingTransaction());
    const findCategory = vi.fn();
    const { set, update } = createSuccessfulUpdate(
      returnedTransaction({ categoryId: null, type: "income" }),
    );
    const application = createApplication({
      userId,
      findTransaction,
      findCategory,
      update,
    });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/transactions/${transactionId}`,
      payload: { categoryId: null, type: "income" },
    });

    expect(response.statusCode).toBe(200);
    expect(findCategory).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith({
      categoryId: null,
      type: "income",
      updatedAt: expect.any(Date),
    });
  });

  it("returns 404 when the transaction disappears before the update", async () => {
    const findTransaction = vi.fn().mockResolvedValue(existingTransaction());
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const application = createApplication({
      userId,
      findTransaction,
      update,
    });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/transactions/${transactionId}`,
      payload: { notes: "New note" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Transaction not found" });
  });

  it("returns a safe 500 response when the update fails", async () => {
    const findTransaction = vi.fn().mockResolvedValue(existingTransaction());
    const set = vi
      .fn()
      .mockRejectedValue(new Error("Sensitive database failure"));
    const update = vi.fn().mockReturnValue({ set });
    const application = createApplication({
      userId,
      findTransaction,
      update,
    });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/transactions/${transactionId}`,
      payload: { notes: "New note" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("Sensitive database failure");
  });
});
