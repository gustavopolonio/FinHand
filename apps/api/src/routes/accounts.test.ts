import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../auth/authentication.js";
import type { Database } from "../db/index.js";
import { accounts } from "../db/schema/index.js";
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
  findMany: ReturnType<typeof vi.fn>;
}) {
  const application = Fastify();
  const database = {
    query: {
      accounts: {
        findMany: options.findMany,
      },
    },
  } as unknown as Database;

  application.decorate("database", database);
  application.register(accountRoutes, {
    authentication: createAuthentication(options.userId),
  });
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
