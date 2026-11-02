import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../auth/authentication.js";
import { registerAuthenticationGuard } from "../auth/require-authentication.js";
import type { Database } from "../db/index.js";
import { accounts, users } from "../db/schema/index.js";
import { accountRoutes } from "./accounts.js";

const applications: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

function createAuthentication(userId: string | null) {
  return {
    handler: async () => new Response(null, { status: 404 }),
    api: {
      getSession: async () =>
        userId
          ? {
              session: { id: "session-id" },
              user: { id: userId },
            }
          : null,
    },
  } as unknown as Authentication;
}

function createApplication(options: {
  userId: string | null;
  findMany?: ReturnType<typeof vi.fn>;
  findUser?: ReturnType<typeof vi.fn>;
  insert?: ReturnType<typeof vi.fn>;
}) {
  const application = Fastify();
  const database = {
    query: {
      accounts: {
        findMany: options.findMany ?? vi.fn(),
      },
      users: {
        findFirst: options.findUser ?? vi.fn(),
      },
    },
    insert: options.insert ?? vi.fn(),
  } as unknown as Database;

  application.decorate("database", database);
  registerAuthenticationGuard(
    application,
    createAuthentication(options.userId),
  );
  application.register(accountRoutes);
  applications.push(application);

  return application;
}

describe("GET /api/accounts", () => {
  it("rejects requests without an authenticated user", async () => {
    const findMany = vi.fn();
    const application = createApplication({ userId: null, findMany });

    const response = await application.inject({
      method: "GET",
      url: "/api/accounts",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("lists the authenticated user's accounts with safe money serialization", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Checking",
        type: "checking",
        currencyCode: "BRL",
        openingBalanceMinor: 9007199254740993n,
        archivedAt: null,
        createdAt: new Date("2026-11-01T12:00:00.000Z"),
        updatedAt: new Date("2026-11-02T12:00:00.000Z"),
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Old wallet",
        type: "cash",
        currencyCode: "BRL",
        openingBalanceMinor: -500n,
        archivedAt: new Date("2026-11-02T13:00:00.000Z"),
        createdAt: new Date("2026-10-01T12:00:00.000Z"),
        updatedAt: new Date("2026-11-02T13:00:00.000Z"),
      },
    ]);
    const application = createApplication({
      userId: "33333333-3333-4333-8333-333333333333",
      findMany,
    });

    const response = await application.inject({
      method: "GET",
      url: "/api/accounts",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accounts: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Checking",
          type: "checking",
          currencyCode: "BRL",
          openingBalanceMinor: "9007199254740993",
          archivedAt: null,
          createdAt: "2026-11-01T12:00:00.000Z",
          updatedAt: "2026-11-02T12:00:00.000Z",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Old wallet",
          type: "cash",
          currencyCode: "BRL",
          openingBalanceMinor: "-500",
          archivedAt: "2026-11-02T13:00:00.000Z",
          createdAt: "2026-10-01T12:00:00.000Z",
          updatedAt: "2026-11-02T13:00:00.000Z",
        },
      ],
    });
    expect(findMany).toHaveBeenCalledOnce();

    const queryConfiguration = findMany.mock.calls[0]?.[0] as {
      where: (
        account: typeof accounts,
        operators: {
          eq: (left: unknown, right: unknown) => unknown;
        },
      ) => unknown;
    };
    const userFilter = Symbol("user filter");
    const eq = vi.fn().mockReturnValue(userFilter);

    expect(queryConfiguration.where(accounts, { eq })).toBe(userFilter);
    expect(eq).toHaveBeenCalledWith(
      accounts.userId,
      "33333333-3333-4333-8333-333333333333",
    );
  });
});

describe("POST /api/accounts", () => {
  it("rejects requests without an authenticated user", async () => {
    const findUser = vi.fn();
    const insert = vi.fn();
    const application = createApplication({
      userId: null,
      findUser,
      insert,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/accounts",
      payload: {
        name: "Wallet",
        type: "cash",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(findUser).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("creates an account using the user's default currency", async () => {
    const userId = "33333333-3333-4333-8333-333333333333";
    const findUser = vi.fn().mockResolvedValue({ defaultCurrency: "BRL" });
    const returning = vi.fn().mockResolvedValue([
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Wallet",
        type: "cash",
        currencyCode: "BRL",
        openingBalanceMinor: 150050n,
        archivedAt: null,
        createdAt: new Date("2026-11-02T14:00:00.000Z"),
        updatedAt: new Date("2026-11-02T14:00:00.000Z"),
      },
    ]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const application = createApplication({
      userId,
      findUser,
      insert,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/accounts",
      payload: {
        name: "  Wallet  ",
        type: "cash",
        openingBalanceMinor: "150050",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      account: {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Wallet",
        type: "cash",
        currencyCode: "BRL",
        openingBalanceMinor: "150050",
        archivedAt: null,
        createdAt: "2026-11-02T14:00:00.000Z",
        updatedAt: "2026-11-02T14:00:00.000Z",
      },
    });
    expect(insert).toHaveBeenCalledWith(accounts);
    expect(values).toHaveBeenCalledWith({
      userId,
      name: "Wallet",
      type: "cash",
      currencyCode: "BRL",
      openingBalanceMinor: 150050n,
    });

    const ownerQuery = findUser.mock.calls[0]?.[0] as {
      where: (
        user: typeof users,
        operators: {
          eq: (left: unknown, right: unknown) => unknown;
        },
      ) => unknown;
    };
    const ownerFilter = Symbol("owner filter");
    const eq = vi.fn().mockReturnValue(ownerFilter);

    expect(ownerQuery.where(users, { eq })).toBe(ownerFilter);
    expect(eq).toHaveBeenCalledWith(users.id, userId);
  });

  it.each([
    {
      name: "blank name",
      payload: { name: "   ", type: "cash" },
      error: "Account name is required.",
    },
    {
      name: "unsupported currency",
      payload: { name: "Wallet", type: "cash", currencyCode: "ZZZ" },
      error: "Currency code must be a supported three-letter ISO 4217 code.",
    },
    {
      name: "balance outside BIGINT range",
      payload: {
        name: "Wallet",
        type: "cash",
        openingBalanceMinor: "9223372036854775808",
      },
      error: "Opening balance is outside PostgreSQL BIGINT range.",
    },
  ])("rejects $name", async ({ payload, error }) => {
    const findUser = vi.fn();
    const insert = vi.fn();
    const application = createApplication({
      userId: "33333333-3333-4333-8333-333333333333",
      findUser,
      insert,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/accounts",
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error });
    expect(findUser).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects numeric money input before the handler runs", async () => {
    const findUser = vi.fn();
    const insert = vi.fn();
    const application = createApplication({
      userId: "33333333-3333-4333-8333-333333333333",
      findUser,
      insert,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/accounts",
      payload: {
        name: "Wallet",
        type: "cash",
        openingBalanceMinor: 10.5,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(findUser).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
