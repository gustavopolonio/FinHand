import Fastify from "fastify";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "../../auth/authentication.js";
import { registerAuthenticationGuard } from "../../auth/require-authentication.js";
import type { Database } from "../../db/index.js";
import { registerApplicationErrorHandler } from "../../errors/error-handler.js";
import { userRoutes } from "./users.js";

const applications: ReturnType<typeof Fastify>[] = [];
const userId = "33333333-3333-4333-8333-333333333333";

afterEach(async () => {
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

function createApplication(findUser: ReturnType<typeof vi.fn>) {
  const authentication = {
    handler: async () => new Response(null, { status: 404 }),
    api: {
      getSession: async () => ({
        session: { id: "session-id" },
        user: { id: userId },
      }),
    },
  } as unknown as Authentication;
  const database = {
    query: { users: { findFirst: findUser } },
  } as unknown as Database;
  const application = Fastify();

  registerApplicationErrorHandler(application);
  application.decorate("database", database);
  registerAuthenticationGuard(application, authentication);
  application.register(userRoutes);
  applications.push(application);

  return application;
}

describe("GET /api/me", () => {
  it("returns 401 when the authenticated user no longer exists", async () => {
    const application = createApplication(vi.fn().mockResolvedValue(null));

    const response = await application.inject({
      method: "GET",
      url: "/api/me",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns the authenticated user", async () => {
    const user = {
      id: userId,
      email: "user@example.com",
      displayName: "User",
      imageUrl: null,
      defaultCurrency: "BRL",
      timeZone: "America/Sao_Paulo",
    };
    const findUser = vi.fn().mockResolvedValue(user);
    const application = createApplication(findUser);

    const response = await application.inject({
      method: "GET",
      url: "/api/me",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(user);
    const query = findUser.mock.calls[0]?.[0] as { where: SQL };
    const compiledWhere = new PgDialect().sqlToQuery(query.where);

    expect(compiledWhere.params).toEqual([userId]);
  });
});
