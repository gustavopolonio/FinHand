import Fastify from "fastify";
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
import type { DocumentStorage } from "../../storage/document-storage.js";
import { createTestDocumentStorage } from "../../test/document-storage.js";
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
  findAccount?: ReturnType<typeof vi.fn>;
  findCategory?: ReturnType<typeof vi.fn>;
  insert?: ReturnType<typeof vi.fn>;
  select?: ReturnType<typeof vi.fn>;
  documentStorage?: DocumentStorage;
}) {
  const application = Fastify();
  const database = {
    query: {
      transactions: {
        findMany: options.findMany ?? vi.fn(),
      },
      accounts: {
        findFirst: options.findAccount ?? vi.fn(),
      },
      categories: {
        findFirst: options.findCategory ?? vi.fn(),
      },
    },
    insert: options.insert ?? vi.fn(),
    select: options.select ?? vi.fn(),
  } as unknown as Database;

  registerSchemaCompilers(application);
  registerApplicationErrorHandler(application);
  application.decorate("database", database);
  registerAuthenticationGuard(
    application,
    createAuthentication(options.userId),
  );
  application.register(transactionRoutes, {
    documentStorage:
      options.documentStorage ?? createTestDocumentStorage(),
  });
  applications.push(application);

  return application;
}

function createSourceSelect(source: Record<string, unknown> | undefined) {
  const limit = vi.fn().mockResolvedValue(source ? [source] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const secondInnerJoin = vi.fn().mockReturnValue({ where });
  const firstInnerJoin = vi.fn().mockReturnValue({ innerJoin: secondInnerJoin });
  const from = vi.fn().mockReturnValue({ innerJoin: firstInnerJoin });
  const select = vi.fn().mockReturnValue({ from });

  return { limit, select, where };
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

describe("GET /api/transactions/:id/source-document", () => {
  const transactionId = "44444444-4444-4444-8444-444444444444";

  it("returns a non-cacheable private preview for a document transaction", async () => {
    const selectFixture = createSourceSelect({
      contentType: "application/pdf",
      fileName: "receipt.pdf",
      objectKey: `${userId}/documents/upload-id`,
    });
    const documentStorage = createTestDocumentStorage();
    vi.mocked(documentStorage.createDocumentPreviewUrl).mockResolvedValue(
      "https://signed.example/receipt",
    );
    const application = createApplication({
      documentStorage,
      select: selectFixture.select,
      userId,
    });

    const response = await application.inject({
      method: "GET",
      url: `/api/transactions/${transactionId}/source-document`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.json()).toEqual({
      contentType: "application/pdf",
      expiresAt: expect.any(String),
      fileName: "receipt.pdf",
      url: "https://signed.example/receipt",
    });
  });

  it("does not expose a missing or unowned source document", async () => {
    const selectFixture = createSourceSelect(undefined);
    const application = createApplication({
      select: selectFixture.select,
      userId,
    });

    const response = await application.inject({
      method: "GET",
      url: `/api/transactions/${transactionId}/source-document`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Transaction source document not found",
    });
  });

  it("requires authentication before reading source metadata", async () => {
    const select = vi.fn();
    const application = createApplication({ select, userId: null });

    const response = await application.inject({
      method: "GET",
      url: `/api/transactions/${transactionId}/source-document`,
    });

    expect(response.statusCode).toBe(401);
    expect(select).not.toHaveBeenCalled();
  });

  it("validates the transaction identifier", async () => {
    const select = vi.fn();
    const application = createApplication({ select, userId });

    const response = await application.inject({
      method: "GET",
      url: "/api/transactions/not-a-uuid/source-document",
    });

    expect(response.statusCode).toBe(400);
    expect(select).not.toHaveBeenCalled();
  });
});

describe("POST /api/transactions", () => {
  const validPayload = {
    accountId,
    categoryId,
    type: "expense",
    amountMinor: "2590",
    occurredOn: "2026-11-03",
    description: "Weekly groceries",
    counterparty: "Supermarket",
    notes: "Household food",
  };

  function createSuccessfulInsert() {
    const createdTransaction = {
      ...createTransactionRecord("66666666-6666-4666-8666-666666666666"),
      notes: "Household food",
    };
    const returning = vi.fn().mockResolvedValue([createdTransaction]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });

    return { createdTransaction, insert, returning, values };
  }

  it("rejects requests without an authenticated user", async () => {
    const findAccount = vi.fn();
    const insert = vi.fn();
    const application = createApplication({
      userId: null,
      findAccount,
      insert,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/transactions",
      payload: validPayload,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(findAccount).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("creates a normalized manual transaction using its account currency", async () => {
    const findAccount = vi.fn().mockResolvedValue({
      id: accountId,
      currencyCode: "BRL",
      archivedAt: null,
    });
    const findCategory = vi.fn().mockResolvedValue({
      id: categoryId,
      type: "expense",
      archivedAt: null,
    });
    const { createdTransaction, insert, values } = createSuccessfulInsert();
    const application = createApplication({
      userId,
      findAccount,
      findCategory,
      insert,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/transactions",
      payload: {
        ...validPayload,
        description: "  Weekly groceries  ",
        counterparty: "  Supermarket  ",
        notes: "  Household food  ",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      transaction: {
        id: createdTransaction.id,
        accountId,
        categoryId,
        type: "expense",
        amountMinor: "2590",
        currencyCode: "BRL",
        occurredOn: "2026-11-03",
        description: "Weekly groceries",
        counterparty: "Supermarket",
        notes: "Household food",
        origin: "manual",
        createdAt: "2026-11-03T15:00:00.000Z",
        updatedAt: "2026-11-03T15:00:00.000Z",
      },
    });
    expect(insert).toHaveBeenCalledWith(transactions);
    expect(values).toHaveBeenCalledWith({
      userId,
      accountId,
      categoryId,
      type: "expense",
      amountMinor: 2_590n,
      currencyCode: "BRL",
      occurredOn: "2026-11-03",
      description: "Weekly groceries",
      counterparty: "Supermarket",
      notes: "Household food",
      origin: "manual",
    });

    const accountQuery = findAccount.mock.calls[0]?.[0] as {
      where: (
        account: typeof accounts,
        operators: {
          and: (...conditions: unknown[]) => unknown;
          eq: (left: unknown, right: unknown) => unknown;
        },
      ) => unknown;
    };
    const accountConditions = [Symbol("account id"), Symbol("account owner")];
    const accountFilter = Symbol("account filter");
    const accountEq = vi
      .fn()
      .mockReturnValueOnce(accountConditions[0])
      .mockReturnValueOnce(accountConditions[1]);
    const accountAnd = vi.fn().mockReturnValue(accountFilter);

    expect(
      accountQuery.where(accounts, { and: accountAnd, eq: accountEq }),
    ).toBe(accountFilter);
    expect(accountEq.mock.calls).toEqual([
      [accounts.id, accountId],
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
    const categoryConditions = [
      Symbol("category id"),
      Symbol("category owner"),
    ];
    const categoryFilter = Symbol("category filter");
    const categoryEq = vi
      .fn()
      .mockReturnValueOnce(categoryConditions[0])
      .mockReturnValueOnce(categoryConditions[1]);
    const categoryAnd = vi.fn().mockReturnValue(categoryFilter);

    expect(
      categoryQuery.where(categories, {
        and: categoryAnd,
        eq: categoryEq,
      }),
    ).toBe(categoryFilter);
    expect(categoryEq.mock.calls).toEqual([
      [categories.id, categoryId],
      [categories.userId, userId],
    ]);
  });

  it("creates an uncategorized transaction with empty optional text normalized to null", async () => {
    const findAccount = vi.fn().mockResolvedValue({
      id: accountId,
      currencyCode: "BRL",
      archivedAt: null,
    });
    const findCategory = vi.fn();
    const { insert, values } = createSuccessfulInsert();
    const application = createApplication({
      userId,
      findAccount,
      findCategory,
      insert,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/transactions",
      payload: {
        accountId,
        categoryId: null,
        type: "expense",
        amountMinor: "2590",
        occurredOn: "2026-11-03",
        description: "Groceries",
        counterparty: "   ",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(findCategory).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryId: null,
        counterparty: null,
        notes: null,
      }),
    );
  });

  it.each([
    ["invalid account ID", { ...validPayload, accountId: "not-a-uuid" }],
    ["invalid category ID", { ...validPayload, categoryId: "not-a-uuid" }],
    ["invalid type", { ...validPayload, type: "transfer" }],
    ["decimal amount", { ...validPayload, amountMinor: "25.90" }],
    ["negative amount", { ...validPayload, amountMinor: "-2590" }],
    ["invalid date", { ...validPayload, occurredOn: "2026-02-30" }],
    ["empty description", { ...validPayload, description: "" }],
    ["client-controlled origin", { ...validPayload, origin: "document" }],
    ["client-controlled currency", { ...validPayload, currencyCode: "USD" }],
  ])("rejects %s", async (_scenario, payload) => {
    const findAccount = vi.fn();
    const insert = vi.fn();
    const application = createApplication({ userId, findAccount, insert });

    const response = await application.inject({
      method: "POST",
      url: "/api/transactions",
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(findAccount).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    ["0", "Transaction amount must be greater than zero."],
    [
      "9223372036854775808",
      "Transaction amount is outside PostgreSQL BIGINT range.",
    ],
  ])("rejects the out-of-range amount %s", async (amountMinor, error) => {
    const findAccount = vi.fn();
    const insert = vi.fn();
    const application = createApplication({ userId, findAccount, insert });

    const response = await application.inject({
      method: "POST",
      url: "/api/transactions",
      payload: { ...validPayload, amountMinor },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error });
    expect(findAccount).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only description", async () => {
    const findAccount = vi.fn();
    const application = createApplication({ userId, findAccount });

    const response = await application.inject({
      method: "POST",
      url: "/api/transactions",
      payload: { ...validPayload, description: "   " },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Transaction description is required.",
    });
    expect(findAccount).not.toHaveBeenCalled();
  });

  it("returns 404 when the account is missing or belongs to another user", async () => {
    const findAccount = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn();
    const application = createApplication({ userId, findAccount, insert });

    const response = await application.inject({
      method: "POST",
      url: "/api/transactions",
      payload: validPayload,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Account not found" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an archived account", async () => {
    const findAccount = vi.fn().mockResolvedValue({
      id: accountId,
      currencyCode: "BRL",
      archivedAt: new Date("2026-11-02T12:00:00.000Z"),
    });
    const insert = vi.fn();
    const application = createApplication({ userId, findAccount, insert });

    const response = await application.inject({
      method: "POST",
      url: "/api/transactions",
      payload: validPayload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "Archived accounts cannot receive new transactions.",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 404 when the category is missing or belongs to another user", async () => {
    const findAccount = vi.fn().mockResolvedValue({
      id: accountId,
      currencyCode: "BRL",
      archivedAt: null,
    });
    const findCategory = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn();
    const application = createApplication({
      userId,
      findAccount,
      findCategory,
      insert,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/transactions",
      payload: validPayload,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Category not found" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an archived category", async () => {
    const findAccount = vi.fn().mockResolvedValue({
      id: accountId,
      currencyCode: "BRL",
      archivedAt: null,
    });
    const findCategory = vi.fn().mockResolvedValue({
      id: categoryId,
      type: "expense",
      archivedAt: new Date("2026-11-02T12:00:00.000Z"),
    });
    const insert = vi.fn();
    const application = createApplication({
      userId,
      findAccount,
      findCategory,
      insert,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/transactions",
      payload: validPayload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "Archived categories cannot receive new transactions.",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a category whose type does not match the transaction", async () => {
    const findAccount = vi.fn().mockResolvedValue({
      id: accountId,
      currencyCode: "BRL",
      archivedAt: null,
    });
    const findCategory = vi.fn().mockResolvedValue({
      id: categoryId,
      type: "income",
      archivedAt: null,
    });
    const insert = vi.fn();
    const application = createApplication({
      userId,
      findAccount,
      findCategory,
      insert,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/transactions",
      payload: validPayload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Transaction type must match the selected category type.",
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns a safe 500 response when creation returns no transaction", async () => {
    const findAccount = vi.fn().mockResolvedValue({
      id: accountId,
      currencyCode: "BRL",
      archivedAt: null,
    });
    const findCategory = vi.fn().mockResolvedValue({
      id: categoryId,
      type: "expense",
      archivedAt: null,
    });
    const returning = vi.fn().mockResolvedValue([]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const application = createApplication({
      userId,
      findAccount,
      findCategory,
      insert,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/transactions",
      payload: validPayload,
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("did not return a record");
  });
});
