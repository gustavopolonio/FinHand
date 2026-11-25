import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import {
  authenticationIpRateLimitOptions,
  registerRequestRateLimits,
  type RequestRateLimitPolicies,
} from "./request-rate-limits.js";

const applications: ReturnType<typeof Fastify>[] = [];

afterEach(async () => {
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

function createPolicies({
  authenticatedUser = 20,
  authenticationIp = 10,
  generalIp = 10,
}: {
  authenticatedUser?: number;
  authenticationIp?: number;
  generalIp?: number;
} = {}): RequestRateLimitPolicies {
  return {
    authenticatedUser: {
      maximumRequests: authenticatedUser,
      timeWindowMilliseconds: 60_000,
    },
    authenticationIp: {
      maximumRequests: authenticationIp,
      timeWindowMilliseconds: 60_000,
    },
    generalIp: {
      maximumRequests: generalIp,
      timeWindowMilliseconds: 60_000,
    },
  };
}

function createApplication(policies: RequestRateLimitPolicies) {
  const application = Fastify({ trustProxy: true });
  registerRequestRateLimits(application, policies);
  applications.push(application);
  return application;
}

describe("request rate limits", () => {
  it("limits the general request rate independently for each client IP", async () => {
    const application = createApplication(createPolicies({ generalIp: 2 }));
    application.register(async (routes) => {
      routes.get("/general", async () => ({ accepted: true }));
    });

    expect(
      (
        await application.inject({
          method: "GET",
          remoteAddress: "203.0.113.10",
          url: "/general",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await application.inject({
          method: "GET",
          remoteAddress: "203.0.113.10",
          url: "/general",
        })
      ).statusCode,
    ).toBe(200);

    const limitedResponse = await application.inject({
      method: "GET",
      remoteAddress: "203.0.113.10",
      url: "/general",
    });
    const otherIpResponse = await application.inject({
      method: "GET",
      remoteAddress: "203.0.113.11",
      url: "/general",
    });

    expect(limitedResponse.statusCode).toBe(429);
    expect(limitedResponse.headers["retry-after"]).toBeDefined();
    expect(limitedResponse.json()).toEqual({
      statusCode: 429,
      code: "RATE_LIMIT_EXCEEDED",
      error: "Too Many Requests",
      message: "Too many requests. Try again later.",
    });
    expect(otherIpResponse.statusCode).toBe(200);
  });

  it("applies a stricter shared IP limit to authentication routes", async () => {
    const policies = createPolicies({ authenticationIp: 1, generalIp: 10 });
    const application = createApplication(policies);
    application.register(async (routes) => {
      routes.get(
        "/authentication",
        {
          config: {
            rateLimit: authenticationIpRateLimitOptions(
              policies.authenticationIp,
            ),
          },
        },
        async () => ({ accepted: true }),
      );
      routes.get("/general", async () => ({ accepted: true }));
    });
    const headers = { "x-forwarded-for": "203.0.113.20" };

    const acceptedResponse = await application.inject({
      headers,
      method: "GET",
      url: "/authentication",
    });
    const limitedResponse = await application.inject({
      headers,
      method: "GET",
      url: "/authentication",
    });
    const generalResponse = await application.inject({
      headers,
      method: "GET",
      url: "/general",
    });

    expect(acceptedResponse.statusCode).toBe(200);
    expect(limitedResponse.statusCode).toBe(429);
    expect(generalResponse.statusCode).toBe(200);
  });

  it("shares an authenticated limit across requests from the same user", async () => {
    const application = createApplication(
      createPolicies({ authenticatedUser: 2, generalIp: 20 }),
    );
    application.decorateRequest("authenticatedUserId", "");
    application.get(
      "/protected",
      {
        preHandler: [
          async (request) => {
            request.authenticatedUserId = String(
              request.headers["x-test-user-id"],
            );
          },
          application.authenticatedUserRateLimit,
        ],
      },
      async () => ({ accepted: true }),
    );
    const userHeaders = { "x-test-user-id": "user-a" };

    expect(
      (
        await application.inject({
          headers: userHeaders,
          method: "GET",
          url: "/protected",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await application.inject({
          headers: userHeaders,
          method: "GET",
          url: "/protected",
        })
      ).statusCode,
    ).toBe(200);

    const limitedResponse = await application.inject({
      headers: userHeaders,
      method: "GET",
      url: "/protected",
    });
    const otherUserResponse = await application.inject({
      headers: { "x-test-user-id": "user-b" },
      method: "GET",
      url: "/protected",
    });

    expect(limitedResponse.statusCode).toBe(429);
    expect(otherUserResponse.statusCode).toBe(200);
  });

  it("does not charge browser preflight requests against the IP budget", async () => {
    const application = createApplication(createPolicies({ generalIp: 1 }));
    application.register(async (routes) => {
      routes.route({
        method: ["GET", "OPTIONS"],
        url: "/browser-request",
        async handler() {
          return { accepted: true };
        },
      });
    });

    expect(
      (
        await application.inject({
          method: "OPTIONS",
          url: "/browser-request",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await application.inject({
          method: "OPTIONS",
          url: "/browser-request",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await application.inject({
          method: "GET",
          url: "/browser-request",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await application.inject({
          method: "GET",
          url: "/browser-request",
        })
      ).statusCode,
    ).toBe(429);
  });
});
