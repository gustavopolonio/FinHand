import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Authentication } from "./authentication.js";
import { registerApplicationErrorHandler } from "../errors/error-handler.js";
import { registerAuthenticationGuard } from "./require-authentication.js";

const applications: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

function createApplication(
  userId: string | null,
  afterAuthentication?: Parameters<typeof registerAuthenticationGuard>[2],
) {
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

  registerApplicationErrorHandler(application);
  registerAuthenticationGuard(
    application,
    authentication,
    afterAuthentication,
  );
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

  it("runs authenticated request policies only after resolving the user", async () => {
    const afterAuthentication = vi.fn();
    const application = createApplication(
      "11111111-1111-4111-8111-111111111111",
      afterAuthentication,
    );

    const response = await application.inject({
      method: "GET",
      url: "/protected",
    });

    expect(response.statusCode).toBe(200);
    expect(afterAuthentication).toHaveBeenCalledOnce();
    expect(afterAuthentication.mock.calls[0]?.[0]).toMatchObject({
      authenticatedUserId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("does not run authenticated request policies for invalid sessions", async () => {
    const afterAuthentication = vi.fn();
    const application = createApplication(null, afterAuthentication);

    const response = await application.inject({
      method: "GET",
      url: "/protected",
    });

    expect(response.statusCode).toBe(401);
    expect(afterAuthentication).not.toHaveBeenCalled();
  });
});
