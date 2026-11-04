import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import type { Database } from "../../db/index.js";
import { registerApplicationErrorHandler } from "../../errors/error-handler.js";
import { registerSchemaCompilers } from "../../validation/schema-compilers.js";
import { financialSummaryRoutes } from "./financial-summary.js";

const applications: ReturnType<typeof Fastify>[] = [];
const userId = "33333333-3333-4333-8333-333333333333";

interface SelectChain {
  from: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
}

afterEach(async () => {
  vi.useRealTimers();
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

function createSelectMock(
  results: Array<unknown[] | Error>,
): ReturnType<typeof vi.fn> & { chains: SelectChain[] } {
  const chains: SelectChain[] = [];
  const select = vi.fn(() => {
    const result = results.shift() ?? [];
    const chain = {} as SelectChain;

    chain.from = vi.fn(() => chain);
    chain.leftJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.groupBy = vi.fn(() => chain);
    chain.orderBy = vi.fn(() =>
      result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
    );
    chains.push(chain);

    return chain;
  }) as ReturnType<typeof vi.fn> & { chains: SelectChain[] };

  select.chains = chains;
  return select;
}

function createApplication(options: {
  authenticatedUserId: string | null;
  findUser?: ReturnType<typeof vi.fn>;
  select?: ReturnType<typeof vi.fn>;
}) {
  const application = Fastify();
  let database: Database;
  const transaction = vi.fn(
    async (callback: (transactionDatabase: Database) => unknown) =>
      callback(database),
  );

  database = {
    query: {
      users: {
        findFirst:
          options.findUser ??
          vi.fn().mockResolvedValue({ timeZone: "America/Sao_Paulo" }),
      },
    },
    select: options.select ?? createSelectMock([[], [], []]),
    transaction,
  } as unknown as Database;

  registerSchemaCompilers(application);
  registerApplicationErrorHandler(application);
  application.decorate("database", database);
  registerAuthenticationGuard(
    application,
    createAuthentication(options.authenticatedUserId),
  );
  application.register(financialSummaryRoutes);
  applications.push(application);

  return application;
}

describe("GET /api/financial-summary", () => {
  it("rejects requests without an authenticated user", async () => {
    const findUser = vi.fn();
    const select = vi.fn();
    const application = createApplication({
      authenticatedUserId: null,
      findUser,
      select,
    });

    const response = await application.inject({
      method: "GET",
      url: "/api/financial-summary",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(findUser).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it("returns an empty all-time summary through today in the user's time zone", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T02:30:00.000Z"));
    const findUser = vi
      .fn()
      .mockResolvedValue({ timeZone: "America/Sao_Paulo" });
    const select = createSelectMock([[], [], []]);
    const application = createApplication({
      authenticatedUserId: userId,
      findUser,
      select,
    });

    const response = await application.inject({
      method: "GET",
      url: "/api/financial-summary",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      period: { from: null, to: "2026-11-04" },
      currencies: [],
      accounts: [],
      categoryTotals: [],
    });
    expect(findUser).toHaveBeenCalledOnce();
    expect(select).toHaveBeenCalledTimes(3);

    const ownerQuery = findUser.mock.calls[0]?.[0] as {
      where: (
        user: { id: unknown },
        operators: { eq: (left: unknown, right: unknown) => unknown },
      ) => unknown;
    };
    const ownerFilter = Symbol("owner filter");
    const eq = vi.fn().mockReturnValue(ownerFilter);
    const userTable = { id: Symbol("user id") };

    expect(ownerQuery.where(userTable, { eq })).toBe(ownerFilter);
    expect(eq).toHaveBeenCalledWith(userTable.id, userId);
  });

  it("calculates balances and period totals without mixing currencies", async () => {
    const archivedAt = new Date("2026-10-01T12:00:00.000Z");
    const select = createSelectMock([
      [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Checking",
          type: "checking",
          currencyCode: "BRL",
          archivedAt: null,
          balanceMinor: "9007199254740993",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Wallet",
          type: "cash",
          currencyCode: "BRL",
          archivedAt: null,
          balanceMinor: "7",
        },
        {
          id: "44444444-4444-4444-8444-444444444444",
          name: "Old account",
          type: "savings",
          currencyCode: "BRL",
          archivedAt,
          balanceMinor: "999999",
        },
        {
          id: "55555555-5555-4555-8555-555555555555",
          name: "Dollar wallet",
          type: "cash",
          currencyCode: "USD",
          archivedAt: null,
          balanceMinor: "2500",
        },
      ],
      [
        {
          currencyCode: "BRL",
          incomeMinor: "300000",
          expenseMinor: "80000",
          netFlowMinor: "220000",
        },
        {
          currencyCode: "EUR",
          incomeMinor: "0",
          expenseMinor: "1200",
          netFlowMinor: "-1200",
        },
      ],
      [
        {
          categoryId: "66666666-6666-4666-8666-666666666666",
          categoryName: "Grocery",
          type: "expense",
          currencyCode: "BRL",
          totalMinor: "75000",
          transactionCount: 12,
        },
        {
          categoryId: null,
          categoryName: null,
          type: "expense",
          currencyCode: "BRL",
          totalMinor: "5000",
          transactionCount: 2,
        },
      ],
    ]);
    const application = createApplication({
      authenticatedUserId: userId,
      findUser: vi.fn().mockResolvedValue({ timeZone: "UTC" }),
      select,
    });

    const response = await application.inject({
      method: "GET",
      url: "/api/financial-summary?from=2026-11-01&to=2026-11-30",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      period: { from: "2026-11-01", to: "2026-11-30" },
      currencies: [
        {
          currencyCode: "BRL",
          activeBalanceMinor: "9007199254741000",
          incomeMinor: "300000",
          expenseMinor: "80000",
          netFlowMinor: "220000",
        },
        {
          currencyCode: "EUR",
          activeBalanceMinor: "0",
          incomeMinor: "0",
          expenseMinor: "1200",
          netFlowMinor: "-1200",
        },
        {
          currencyCode: "USD",
          activeBalanceMinor: "2500",
          incomeMinor: "0",
          expenseMinor: "0",
          netFlowMinor: "0",
        },
      ],
      accounts: [
        {
          accountId: "11111111-1111-4111-8111-111111111111",
          name: "Checking",
          type: "checking",
          currencyCode: "BRL",
          archivedAt: null,
          balanceMinor: "9007199254740993",
        },
        {
          accountId: "22222222-2222-4222-8222-222222222222",
          name: "Wallet",
          type: "cash",
          currencyCode: "BRL",
          archivedAt: null,
          balanceMinor: "7",
        },
        {
          accountId: "44444444-4444-4444-8444-444444444444",
          name: "Old account",
          type: "savings",
          currencyCode: "BRL",
          archivedAt: "2026-10-01T12:00:00.000Z",
          balanceMinor: "999999",
        },
        {
          accountId: "55555555-5555-4555-8555-555555555555",
          name: "Dollar wallet",
          type: "cash",
          currencyCode: "USD",
          archivedAt: null,
          balanceMinor: "2500",
        },
      ],
      categoryTotals: [
        {
          categoryId: "66666666-6666-4666-8666-666666666666",
          name: "Grocery",
          type: "expense",
          currencyCode: "BRL",
          totalMinor: "75000",
          transactionCount: 12,
        },
        {
          categoryId: null,
          name: "Uncategorized",
          type: "expense",
          currencyCode: "BRL",
          totalMinor: "5000",
          transactionCount: 2,
        },
      ],
    });
    expect(select).toHaveBeenCalledTimes(3);
  });

  it.each([
    "from=2026-11-01",
    "to=2026-11-30",
    "from=2026-02-30&to=2026-03-01",
    "from=2026-11-30&to=2026-11-01",
    "from=not-a-date&to=2026-11-01",
    "unexpected=value",
  ])("rejects invalid query parameters: %s", async (query) => {
    const findUser = vi.fn();
    const select = vi.fn();
    const application = createApplication({
      authenticatedUserId: userId,
      findUser,
      select,
    });

    const response = await application.inject({
      method: "GET",
      url: `/api/financial-summary?${query}`,
    });

    expect(response.statusCode).toBe(400);
    expect(findUser).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it("returns 401 when the authenticated owner no longer exists", async () => {
    const findUser = vi.fn().mockResolvedValue(undefined);
    const select = vi.fn();
    const application = createApplication({
      authenticatedUserId: userId,
      findUser,
      select,
    });

    const response = await application.inject({
      method: "GET",
      url: "/api/financial-summary",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(select).not.toHaveBeenCalled();
  });

  it("returns a safe 500 response when an aggregate query fails", async () => {
    const select = createSelectMock([
      new Error("Sensitive database failure"),
      [],
      [],
    ]);
    const application = createApplication({
      authenticatedUserId: userId,
      findUser: vi.fn().mockResolvedValue({ timeZone: "UTC" }),
      select,
    });

    const response = await application.inject({
      method: "GET",
      url: "/api/financial-summary",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("Sensitive database failure");
  });

  it("returns a safe 500 response when the user's time zone is invalid", async () => {
    const select = vi.fn();
    const application = createApplication({
      authenticatedUserId: userId,
      findUser: vi.fn().mockResolvedValue({ timeZone: "Invalid/Zone" }),
      select,
    });

    const response = await application.inject({
      method: "GET",
      url: "/api/financial-summary",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(select).not.toHaveBeenCalled();
  });
});
