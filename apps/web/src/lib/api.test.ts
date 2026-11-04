import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type Account,
  type Category,
  type Transaction,
  archiveAccount,
  archiveCategory,
  createAccount,
  createCategory,
  createTransaction,
  deleteTransaction,
  getAccounts,
  getCategories,
  getFinancialSummary,
  getTransactions,
  renameCategory,
  restoreAccount,
  restoreCategory,
  updateAccount,
  updateTransaction,
} from "./api";

const account: Account = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Checking",
  type: "checking",
  currencyCode: "BRL",
  openingBalanceMinor: "12345",
  archivedAt: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-02T12:00:00.000Z",
};

const category: Category = {
  id: "55555555-5555-4555-8555-555555555555",
  name: "Grocery",
  type: "expense",
  archivedAt: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-02T12:00:00.000Z",
};

const transaction: Transaction = {
  id: "66666666-6666-4666-8666-666666666666",
  accountId: account.id,
  categoryId: category.id,
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
};

function successfulResponse(body: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("accounts API", () => {
  it("lists accounts with credentials", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ accounts: [account] }));
    vi.stubGlobal("fetch", fetch);

    await expect(getAccounts()).resolves.toEqual([account]);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/accounts",
      expect.objectContaining({
        credentials: "include",
      }),
    );
  });

  it("creates an account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ account }));
    vi.stubGlobal("fetch", fetch);
    const input = {
      name: "Checking",
      type: "checking" as const,
      openingBalanceMinor: "12345",
    };

    await expect(createAccount(input)).resolves.toEqual(account);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/accounts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("updates an account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ account }));
    vi.stubGlobal("fetch", fetch);
    const input = {
      name: "Main checking",
      type: "checking" as const,
      openingBalanceMinor: "20000",
    };

    await expect(updateAccount(account.id, input)).resolves.toEqual(account);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/accounts/${account.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  });

  it("archives an account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ account }));
    vi.stubGlobal("fetch", fetch);

    await expect(archiveAccount(account.id)).resolves.toEqual(account);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/accounts/${account.id}/archive`,
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).has("Content-Type")).toBe(false);
  });

  it("restores an account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ account }));
    vi.stubGlobal("fetch", fetch);

    await expect(restoreAccount(account.id)).resolves.toEqual(account);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/accounts/${account.id}/restore`,
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).has("Content-Type")).toBe(false);
  });
});

describe("categories API", () => {
  it("lists categories with credentials", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ categories: [category] }));
    vi.stubGlobal("fetch", fetch);

    await expect(getCategories()).resolves.toEqual([category]);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/categories",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("creates a category", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ category }));
    vi.stubGlobal("fetch", fetch);
    const input = { name: "Grocery", type: "expense" as const };

    await expect(createCategory(input)).resolves.toEqual(category);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/categories",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  });

  it("renames a category", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ category }));
    vi.stubGlobal("fetch", fetch);
    const input = { name: "Food" };

    await expect(renameCategory(category.id, input)).resolves.toEqual(category);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/categories/${category.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  });

  it("archives a category without declaring an empty JSON body", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ category }));
    vi.stubGlobal("fetch", fetch);

    await expect(archiveCategory(category.id)).resolves.toEqual(category);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/categories/${category.id}/archive`,
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).has("Content-Type")).toBe(false);
  });

  it("restores a category without declaring an empty JSON body", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ category }));
    vi.stubGlobal("fetch", fetch);

    await expect(restoreCategory(category.id)).resolves.toEqual(category);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/categories/${category.id}/restore`,
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).has("Content-Type")).toBe(false);
  });
});

describe("transactions API", () => {
  it("lists a filtered transaction page", async () => {
    const page = {
      transactions: [transaction],
      pagination: { limit: 10, offset: 20, hasMore: true },
    };
    const fetch = vi.fn().mockResolvedValue(successfulResponse(page));
    vi.stubGlobal("fetch", fetch);

    await expect(
      getTransactions({
        type: "expense",
        accountId: account.id,
        categoryId: category.id,
        from: "2026-11-01",
        to: "2026-11-30",
        limit: 10,
        offset: 20,
      }),
    ).resolves.toEqual(page);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/transactions" +
        `?type=expense&accountId=${account.id}&categoryId=${category.id}` +
        "&from=2026-11-01&to=2026-11-30&limit=10&offset=20",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("creates a transaction", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ transaction }));
    vi.stubGlobal("fetch", fetch);
    const input = {
      accountId: account.id,
      categoryId: category.id,
      type: "expense" as const,
      amountMinor: "2590",
      occurredOn: "2026-11-03",
      description: "Weekly groceries",
      counterparty: "Supermarket",
      notes: null,
    };

    await expect(createTransaction(input)).resolves.toEqual(transaction);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/transactions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  });

  it("updates a transaction", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ transaction }));
    vi.stubGlobal("fetch", fetch);
    const input = { description: "Updated groceries", categoryId: null };

    await expect(updateTransaction(transaction.id, input)).resolves.toEqual(
      transaction,
    );
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/transactions/${transaction.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  });

  it("deletes a transaction without parsing a 204 response body", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetch);

    await expect(deleteTransaction(transaction.id)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/transactions/${transaction.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).has("Content-Type")).toBe(false);
  });
});

describe("financial summary API", () => {
  const summary = {
    period: { from: null, to: "2026-11-04" },
    currencies: [],
    accounts: [],
    categoryTotals: [],
  };

  it("gets an all-time summary without query parameters", async () => {
    const fetch = vi.fn().mockResolvedValue(successfulResponse(summary));
    vi.stubGlobal("fetch", fetch);

    await expect(getFinancialSummary()).resolves.toEqual(summary);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/financial-summary",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("gets a summary for an explicit period", async () => {
    const fetch = vi.fn().mockResolvedValue(successfulResponse(summary));
    vi.stubGlobal("fetch", fetch);

    await expect(
      getFinancialSummary({ from: "2026-11-01", to: "2026-11-30" }),
    ).resolves.toEqual(summary);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/financial-summary?from=2026-11-01&to=2026-11-30",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
