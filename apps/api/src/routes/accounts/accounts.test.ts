import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import type { Database } from "../../db/index.js";
import { accounts, users } from "../../db/schema/index.js";
import { registerApplicationErrorHandler } from "../../errors/error-handler.js";
import { registerSchemaCompilers } from "../../validation/schema-compilers.js";
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
  findAccount?: ReturnType<typeof vi.fn>;
  findUser?: ReturnType<typeof vi.fn>;
  insert?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
}) {
  const application = Fastify();
  const database = {
    query: {
      accounts: {
        findMany: options.findMany ?? vi.fn(),
        findFirst: options.findAccount ?? vi.fn(),
      },
      users: {
        findFirst: options.findUser ?? vi.fn(),
      },
    },
    insert: options.insert ?? vi.fn(),
    update: options.update ?? vi.fn(),
  } as unknown as Database;

  registerSchemaCompilers(application);
  registerApplicationErrorHandler(application);
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

  it("returns 401 when the authenticated owner no longer exists", async () => {
    const findUser = vi.fn().mockResolvedValue(null);
    const insert = vi.fn();
    const application = createApplication({
      userId: "33333333-3333-4333-8333-333333333333",
      findUser,
      insert,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/accounts",
      payload: { name: "Wallet", type: "cash" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("hides unexpected account creation errors", async () => {
    const findUser = vi.fn().mockResolvedValue({ defaultCurrency: "BRL" });
    const returning = vi.fn().mockResolvedValue([]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const application = createApplication({
      userId: "33333333-3333-4333-8333-333333333333",
      findUser,
      insert,
    });

    const response = await application.inject({
      method: "POST",
      url: "/api/accounts",
      payload: { name: "Wallet", type: "cash" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("did not return a record");
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

  it("rejects unknown fields instead of silently removing them", async () => {
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
        openingBalance: "100.00",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("FST_ERR_VALIDATION");
    expect(findUser).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/accounts/:id", () => {
  const accountId = "44444444-4444-4444-8444-444444444444";
  const userId = "33333333-3333-4333-8333-333333333333";

  it("rejects requests without an authenticated user", async () => {
    const update = vi.fn();
    const application = createApplication({ userId: null, update });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/accounts/${accountId}`,
      payload: { name: "Emergency fund" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(update).not.toHaveBeenCalled();
  });

  it("updates only an account owned by the authenticated user", async () => {
    const returning = vi.fn().mockResolvedValue([
      {
        id: accountId,
        name: "Emergency fund",
        type: "savings",
        currencyCode: "BRL",
        openingBalanceMinor: -2500n,
        archivedAt: null,
        createdAt: new Date("2026-11-01T12:00:00.000Z"),
        updatedAt: new Date("2026-11-02T18:00:00.000Z"),
      },
    ]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/accounts/${accountId}`,
      payload: {
        name: "  Emergency fund  ",
        type: "savings",
        openingBalanceMinor: "-2500",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      account: {
        id: accountId,
        name: "Emergency fund",
        type: "savings",
        currencyCode: "BRL",
        openingBalanceMinor: "-2500",
        archivedAt: null,
        createdAt: "2026-11-01T12:00:00.000Z",
        updatedAt: "2026-11-02T18:00:00.000Z",
      },
    });
    expect(update).toHaveBeenCalledWith(accounts);
    expect(set).toHaveBeenCalledWith({
      name: "Emergency fund",
      type: "savings",
      openingBalanceMinor: -2500n,
      updatedAt: expect.any(Date),
    });
    expect(where).toHaveBeenCalledOnce();
  });

  it("returns 404 when the account does not belong to the user", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/accounts/${accountId}`,
      payload: { name: "Not mine" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Account not found" });
  });

  it.each([
    {
      name: "an empty update",
      payload: {},
    },
    {
      name: "an unsupported type",
      payload: { type: "crypto" },
    },
    {
      name: "numeric money input",
      payload: { openingBalanceMinor: 10.5 },
    },
  ])("rejects $name before updating the database", async ({ payload }) => {
    const update = vi.fn();
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/accounts/${accountId}`,
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an invalid account ID before updating the database", async () => {
    const update = vi.fn();
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "PATCH",
      url: "/api/accounts/not-a-uuid",
      payload: { name: "Wallet" },
    });

    expect(response.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("POST /api/accounts/:id/archive", () => {
  const accountId = "44444444-4444-4444-8444-444444444444";
  const userId = "33333333-3333-4333-8333-333333333333";

  it("rejects requests without an authenticated user", async () => {
    const update = vi.fn();
    const application = createApplication({ userId: null, update });

    const response = await application.inject({
      method: "POST",
      url: `/api/accounts/${accountId}/archive`,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(update).not.toHaveBeenCalled();
  });

  it("archives an active account owned by the authenticated user", async () => {
    const archivedAt = new Date("2026-11-02T19:00:00.000Z");
    const returning = vi.fn().mockResolvedValue([
      {
        id: accountId,
        name: "Wallet",
        type: "cash",
        currencyCode: "BRL",
        openingBalanceMinor: 1000n,
        archivedAt,
        createdAt: new Date("2026-11-01T12:00:00.000Z"),
        updatedAt: archivedAt,
      },
    ]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "POST",
      url: `/api/accounts/${accountId}/archive`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      account: {
        id: accountId,
        name: "Wallet",
        type: "cash",
        currencyCode: "BRL",
        openingBalanceMinor: "1000",
        archivedAt: "2026-11-02T19:00:00.000Z",
        createdAt: "2026-11-01T12:00:00.000Z",
        updatedAt: "2026-11-02T19:00:00.000Z",
      },
    });
    expect(update).toHaveBeenCalledWith(accounts);
    const archiveValues = set.mock.calls[0]?.[0] as {
      archivedAt: Date;
      updatedAt: Date;
    };
    expect(archiveValues.archivedAt).toBeInstanceOf(Date);
    expect(archiveValues.updatedAt).toBe(archiveValues.archivedAt);
  });

  it("returns an already-archived account without changing its timestamp", async () => {
    const archivedAt = new Date("2026-10-15T10:00:00.000Z");
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const findAccount = vi.fn().mockResolvedValue({
      id: accountId,
      name: "Old wallet",
      type: "cash",
      currencyCode: "BRL",
      openingBalanceMinor: 0n,
      archivedAt,
      createdAt: new Date("2026-10-01T10:00:00.000Z"),
      updatedAt: archivedAt,
    });
    const application = createApplication({
      userId,
      findAccount,
      update,
    });

    const response = await application.inject({
      method: "POST",
      url: `/api/accounts/${accountId}/archive`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().account.archivedAt).toBe(
      "2026-10-15T10:00:00.000Z",
    );
    expect(findAccount).toHaveBeenCalledOnce();
  });

  it("returns 404 for a missing or foreign account", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const findAccount = vi.fn().mockResolvedValue(null);
    const application = createApplication({
      userId,
      findAccount,
      update,
    });

    const response = await application.inject({
      method: "POST",
      url: `/api/accounts/${accountId}/archive`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Account not found" });
  });

  it("rejects an invalid account ID before updating the database", async () => {
    const update = vi.fn();
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "POST",
      url: "/api/accounts/not-a-uuid/archive",
    });

    expect(response.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("POST /api/accounts/:id/restore", () => {
  const accountId = "44444444-4444-4444-8444-444444444444";
  const userId = "33333333-3333-4333-8333-333333333333";

  it("rejects requests without an authenticated user", async () => {
    const update = vi.fn();
    const application = createApplication({ userId: null, update });

    const response = await application.inject({
      method: "POST",
      url: `/api/accounts/${accountId}/restore`,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(update).not.toHaveBeenCalled();
  });

  it("restores an archived account owned by the authenticated user", async () => {
    const restoredAt = new Date("2026-11-02T20:00:00.000Z");
    const returning = vi.fn().mockResolvedValue([
      {
        id: accountId,
        name: "Wallet",
        type: "cash",
        currencyCode: "BRL",
        openingBalanceMinor: 1000n,
        archivedAt: null,
        createdAt: new Date("2026-11-01T12:00:00.000Z"),
        updatedAt: restoredAt,
      },
    ]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "POST",
      url: `/api/accounts/${accountId}/restore`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      account: {
        id: accountId,
        name: "Wallet",
        type: "cash",
        currencyCode: "BRL",
        openingBalanceMinor: "1000",
        archivedAt: null,
        createdAt: "2026-11-01T12:00:00.000Z",
        updatedAt: "2026-11-02T20:00:00.000Z",
      },
    });
    expect(update).toHaveBeenCalledWith(accounts);
    const restoreValues = set.mock.calls[0]?.[0] as {
      archivedAt: null;
      updatedAt: Date;
    };
    expect(restoreValues.archivedAt).toBeNull();
    expect(restoreValues.updatedAt).toBeInstanceOf(Date);
  });

  it("returns an already-active account without changing its timestamp", async () => {
    const updatedAt = new Date("2026-10-15T10:00:00.000Z");
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const findAccount = vi.fn().mockResolvedValue({
      id: accountId,
      name: "Wallet",
      type: "cash",
      currencyCode: "BRL",
      openingBalanceMinor: 0n,
      archivedAt: null,
      createdAt: new Date("2026-10-01T10:00:00.000Z"),
      updatedAt,
    });
    const application = createApplication({
      userId,
      findAccount,
      update,
    });

    const response = await application.inject({
      method: "POST",
      url: `/api/accounts/${accountId}/restore`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().account).toMatchObject({
      archivedAt: null,
      updatedAt: "2026-10-15T10:00:00.000Z",
    });
    expect(findAccount).toHaveBeenCalledOnce();
  });

  it("returns 404 for a missing or foreign account", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const findAccount = vi.fn().mockResolvedValue(null);
    const application = createApplication({
      userId,
      findAccount,
      update,
    });

    const response = await application.inject({
      method: "POST",
      url: `/api/accounts/${accountId}/restore`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Account not found" });
  });

  it("rejects an invalid account ID before updating the database", async () => {
    const update = vi.fn();
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "POST",
      url: "/api/accounts/not-a-uuid/restore",
    });

    expect(response.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
});
