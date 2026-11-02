import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import type { Authentication } from "./authentication.js";
import { registerAuthenticationGuard } from "./require-authentication.js";

const applications: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

function createApplication(userId: string | null) {
  const authentication = {
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
  const application = Fastify();

  registerAuthenticationGuard(application, authentication);
  application.get(
    "/protected",
    { preHandler: application.requireAuthentication },
    async (request) => ({ userId: request.authenticatedUserId }),
  );
  applications.push(application);

  return application;
}

describe("requireAuthentication", () => {
  it("rejects a request without a valid session", async () => {
    const application = createApplication(null);

    const response = await application.inject({
      method: "GET",
      url: "/protected",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
  });

  it("makes the authenticated user ID available to the route", async () => {
    const application = createApplication(
      "11111111-1111-4111-8111-111111111111",
    );

    const response = await application.inject({
      method: "GET",
      url: "/protected",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      userId: "11111111-1111-4111-8111-111111111111",
    });
  });
});
