import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import type { Database } from "../../db/index.js";
import {
  activeCategoryNameUniqueIndexName,
  categories,
} from "../../db/schema/index.js";
import { registerApplicationErrorHandler } from "../../errors/error-handler.js";
import { registerSchemaCompilers } from "../../validation/schema-compilers.js";
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
  insert?: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
}) {
  const application = Fastify();
  const database = {
    query: {
      categories: {
        findMany: options.findMany ?? vi.fn(),
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

describe("POST /api/categories", () => {
  it("rejects requests without an authenticated user", async () => {
    const insert = vi.fn();
    const application = createApplication({ userId: null, insert });

    const response = await application.inject({
      method: "POST",
      url: "/api/categories",
      payload: { name: "Transport", type: "expense" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("creates a category owned by the authenticated user", async () => {
    const returning = vi.fn().mockResolvedValue([
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Transport",
        type: "expense",
        archivedAt: null,
        createdAt: new Date("2026-11-03T12:00:00.000Z"),
        updatedAt: new Date("2026-11-03T12:00:00.000Z"),
      },
    ]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const application = createApplication({ userId, insert });

    const response = await application.inject({
      method: "POST",
      url: "/api/categories",
      payload: { name: "  Transport  ", type: "expense" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      category: {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Transport",
        type: "expense",
        archivedAt: null,
        createdAt: "2026-11-03T12:00:00.000Z",
        updatedAt: "2026-11-03T12:00:00.000Z",
      },
    });
    expect(insert).toHaveBeenCalledWith(categories);
    expect(values).toHaveBeenCalledWith({
      userId,
      name: "Transport",
      type: "expense",
    });
  });

  it("allows the same name for different category types", async () => {
    const returning = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "44444444-4444-4444-8444-444444444444",
          name: "Other",
          type: "income",
          archivedAt: null,
          createdAt: new Date("2026-11-03T12:00:00.000Z"),
          updatedAt: new Date("2026-11-03T12:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "55555555-5555-4555-8555-555555555555",
          name: "Other",
          type: "expense",
          archivedAt: null,
          createdAt: new Date("2026-11-03T12:01:00.000Z"),
          updatedAt: new Date("2026-11-03T12:01:00.000Z"),
        },
      ]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const application = createApplication({ userId, insert });

    const incomeResponse = await application.inject({
      method: "POST",
      url: "/api/categories",
      payload: { name: "Other", type: "income" },
    });
    const expenseResponse = await application.inject({
      method: "POST",
      url: "/api/categories",
      payload: { name: "Other", type: "expense" },
    });

    expect(incomeResponse.statusCode).toBe(201);
    expect(expenseResponse.statusCode).toBe(201);
    expect(values.mock.calls).toEqual([
      [{ userId, name: "Other", type: "income" }],
      [{ userId, name: "Other", type: "expense" }],
    ]);
  });

  it.each([
    {
      name: "a blank name",
      payload: { name: "   ", type: "expense" },
    },
    {
      name: "a missing name",
      payload: { type: "expense" },
    },
    {
      name: "a missing type",
      payload: { name: "Transport" },
    },
    {
      name: "an unsupported type",
      payload: { name: "Transport", type: "transfer" },
    },
    {
      name: "a name longer than 100 characters",
      payload: { name: "a".repeat(101), type: "expense" },
    },
    {
      name: "an unknown field",
      payload: { name: "Transport", type: "expense", color: "green" },
    },
  ])("rejects $name", async ({ payload }) => {
    const insert = vi.fn();
    const application = createApplication({ userId, insert });

    const response = await application.inject({
      method: "POST",
      url: "/api/categories",
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("returns 409 for a duplicate active name within the same type", async () => {
    const postgresError = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint: activeCategoryNameUniqueIndexName,
    });
    const returning = vi
      .fn()
      .mockRejectedValue(new Error("query failed", { cause: postgresError }));
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const application = createApplication({ userId, insert });

    const response = await application.inject({
      method: "POST",
      url: "/api/categories",
      payload: { name: "grocery", type: "expense" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "An active category with this name and type already exists.",
    });
  });

  it("returns a safe 500 response when creation returns no category", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const application = createApplication({ userId, insert });

    const response = await application.inject({
      method: "POST",
      url: "/api/categories",
      payload: { name: "Transport", type: "expense" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("did not return a record");
  });

  it("returns a safe 500 response for unrelated database failures", async () => {
    const returning = vi
      .fn()
      .mockRejectedValue(new Error("Sensitive database failure"));
    const values = vi.fn().mockReturnValue({ returning });
    const insert = vi.fn().mockReturnValue({ values });
    const application = createApplication({ userId, insert });

    const response = await application.inject({
      method: "POST",
      url: "/api/categories",
      payload: { name: "Transport", type: "expense" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("Sensitive database failure");
  });
});

describe("PATCH /api/categories/:id", () => {
  const categoryId = "44444444-4444-4444-8444-444444444444";

  it("rejects requests without an authenticated user", async () => {
    const update = vi.fn();
    const application = createApplication({ userId: null, update });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/categories/${categoryId}`,
      payload: { name: "Food" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
    expect(update).not.toHaveBeenCalled();
  });

  it("renames a category owned by the authenticated user", async () => {
    const returning = vi.fn().mockResolvedValue([
      {
        id: categoryId,
        name: "Food",
        type: "expense",
        archivedAt: null,
        createdAt: new Date("2026-11-01T12:00:00.000Z"),
        updatedAt: new Date("2026-11-03T14:00:00.000Z"),
      },
    ]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/categories/${categoryId}`,
      payload: { name: "  Food  " },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      category: {
        id: categoryId,
        name: "Food",
        type: "expense",
        archivedAt: null,
        createdAt: "2026-11-01T12:00:00.000Z",
        updatedAt: "2026-11-03T14:00:00.000Z",
      },
    });
    expect(update).toHaveBeenCalledWith(categories);
    expect(set).toHaveBeenCalledWith({
      name: "Food",
      updatedAt: expect.any(Date),
    });
    expect(where).toHaveBeenCalledOnce();
  });

  it("allows an archived category to be renamed", async () => {
    const archivedAt = new Date("2026-11-02T13:00:00.000Z");
    const returning = vi.fn().mockResolvedValue([
      {
        id: categoryId,
        name: "Previous grocery",
        type: "expense",
        archivedAt,
        createdAt: new Date("2026-11-01T12:00:00.000Z"),
        updatedAt: new Date("2026-11-03T14:00:00.000Z"),
      },
    ]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/categories/${categoryId}`,
      payload: { name: "Previous grocery" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().category).toMatchObject({
      name: "Previous grocery",
      archivedAt: "2026-11-02T13:00:00.000Z",
    });
  });

  it("returns 404 for a missing or foreign category", async () => {
    const returning = vi.fn().mockResolvedValue([]);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/categories/${categoryId}`,
      payload: { name: "Food" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Category not found" });
  });

  it.each([
    {
      name: "a blank name",
      payload: { name: "   " },
    },
    {
      name: "a missing name",
      payload: {},
    },
    {
      name: "a non-string name",
      payload: { name: 123 },
    },
    {
      name: "a name longer than 100 characters",
      payload: { name: "a".repeat(101) },
    },
    {
      name: "an unknown field",
      payload: { name: "Food", color: "green" },
    },
    {
      name: "an attempt to change the immutable type",
      payload: { name: "Food", type: "income" },
    },
  ])("rejects $name", async ({ payload }) => {
    const update = vi.fn();
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/categories/${categoryId}`,
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects an invalid category ID before updating the database", async () => {
    const update = vi.fn();
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "PATCH",
      url: "/api/categories/not-a-uuid",
      payload: { name: "Food" },
    });

    expect(response.statusCode).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 409 when the new active name already exists", async () => {
    const postgresError = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint: activeCategoryNameUniqueIndexName,
    });
    const returning = vi
      .fn()
      .mockRejectedValue(new Error("query failed", { cause: postgresError }));
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/categories/${categoryId}`,
      payload: { name: "grocery" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "An active category with this name and type already exists.",
    });
  });

  it("returns a safe 500 response for unrelated database failures", async () => {
    const returning = vi
      .fn()
      .mockRejectedValue(new Error("Sensitive database failure"));
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    const update = vi.fn().mockReturnValue({ set });
    const application = createApplication({ userId, update });

    const response = await application.inject({
      method: "PATCH",
      url: `/api/categories/${categoryId}`,
      payload: { name: "Food" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("Sensitive database failure");
  });
});
