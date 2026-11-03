import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import type { Database } from "../../db/index.js";
import { categories } from "../../db/schema/index.js";
import { registerApplicationErrorHandler } from "../../errors/error-handler.js";
import { categoryRoutes } from "./categories.js";

const applications: ReturnType<typeof Fastify>[] = [];
const userId = "33333333-3333-4333-8333-333333333333";

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
      categories: {
        findMany: options.findMany ?? vi.fn(),
      },
    },
  } as unknown as Database;

  registerApplicationErrorHandler(application);
  application.decorate("database", database);
  registerAuthenticationGuard(
    application,
    createAuthentication(options.userId),
  );
  application.register(categoryRoutes);
  applications.push(application);

  return application;
}

describe("GET /api/categories", () => {
  it("rejects requests without an authenticated user", async () => {
    const findMany = vi.fn();
    const application = createApplication({ userId: null, findMany });

    const response = await application.inject({
      method: "GET",
      url: "/api/categories",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns an empty collection when the user has no categories", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const application = createApplication({ userId, findMany });

    const response = await application.inject({
      method: "GET",
      url: "/api/categories",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ categories: [] });
    expect(findMany).toHaveBeenCalledOnce();
  });

  it("lists active and archived categories owned by the user", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Grocery",
        type: "expense",
        archivedAt: null,
        createdAt: new Date("2026-11-01T12:00:00.000Z"),
        updatedAt: new Date("2026-11-02T12:00:00.000Z"),
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Old salary",
        type: "income",
        archivedAt: new Date("2026-11-02T13:00:00.000Z"),
        createdAt: new Date("2026-10-01T12:00:00.000Z"),
        updatedAt: new Date("2026-11-02T13:00:00.000Z"),
      },
    ]);
    const application = createApplication({ userId, findMany });

    const response = await application.inject({
      method: "GET",
      url: "/api/categories",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      categories: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Grocery",
          type: "expense",
          archivedAt: null,
          createdAt: "2026-11-01T12:00:00.000Z",
          updatedAt: "2026-11-02T12:00:00.000Z",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Old salary",
          type: "income",
          archivedAt: "2026-11-02T13:00:00.000Z",
          createdAt: "2026-10-01T12:00:00.000Z",
          updatedAt: "2026-11-02T13:00:00.000Z",
        },
      ],
    });

    const queryConfiguration = findMany.mock.calls[0]?.[0] as {
      orderBy: (
        category: typeof categories,
        operators: {
          asc: (column: unknown) => unknown;
        },
      ) => unknown[];
      where: (
        category: typeof categories,
        operators: {
          eq: (left: unknown, right: unknown) => unknown;
        },
      ) => unknown;
    };
    const userFilter = Symbol("user filter");
    const eq = vi.fn().mockReturnValue(userFilter);

    expect(queryConfiguration.where(categories, { eq })).toBe(userFilter);
    expect(eq).toHaveBeenCalledWith(categories.userId, userId);

    const typeOrder = Symbol("type order");
    const nameOrder = Symbol("name order");
    const idOrder = Symbol("id order");
    const asc = vi
      .fn()
      .mockReturnValueOnce(typeOrder)
      .mockReturnValueOnce(nameOrder)
      .mockReturnValueOnce(idOrder);

    expect(queryConfiguration.orderBy(categories, { asc })).toEqual([
      typeOrder,
      nameOrder,
      idOrder,
    ]);
    expect(asc.mock.calls).toEqual([
      [categories.type],
      [categories.name],
      [categories.id],
    ]);
  });

  it("returns a safe 500 response when the database query fails", async () => {
    const findMany = vi
      .fn()
      .mockRejectedValue(new Error("Sensitive database failure"));
    const application = createApplication({ userId, findMany });

    const response = await application.inject({
      method: "GET",
      url: "/api/categories",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("Sensitive database failure");
  });
});
