import { Writable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { buildApplication } from "./app.js";
import type { Authentication } from "./auth/authentication.js";
import type { DatabaseConnection } from "./db/index.js";
import { createLoggerOptions } from "./logging/logger.js";
import type { UserEventListener } from "./realtime/user-events.js";
import { requestLimits } from "./security/request-limits.js";
import { requestRateLimitPolicies } from "./security/request-rate-limits.js";
import { createTestDocumentStorage } from "./test/document-storage.js";

function createDependencies() {
  const end = vi.fn().mockResolvedValue(undefined);
  const databaseConnection = {
    database: {},
    pool: { end },
  } as unknown as DatabaseConnection;
  const authentication = {
    handler: async () => new Response(null, { status: 404 }),
    api: { getSession: async () => null },
  } as unknown as Authentication;
  const documentStorage = createTestDocumentStorage();

  return { authentication, databaseConnection, documentStorage, end };
}

function createLogDestination(
  entries: Record<string, unknown>[],
  serializedEntries?: string[],
): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      const serializedEntry = chunk.toString();

      serializedEntries?.push(serializedEntry);
      entries.push(JSON.parse(serializedEntry) as Record<string, unknown>);
      callback();
    },
  });
}

describe("buildApplication", () => {
  it("closes the database pool when the application closes", async () => {
    const { authentication, databaseConnection, documentStorage, end } =
      createDependencies();
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
    });

    await application.ready();
    await application.close();

    expect(end).toHaveBeenCalledOnce();
    expect(documentStorage.close).toHaveBeenCalledOnce();
  });

  it("configures bounded request parsing and connection time", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
    });

    expect(application.initialConfig).toMatchObject({
      bodyLimit: requestLimits.bodyBytes,
      connectionTimeout: requestLimits.connectionTimeoutMilliseconds,
      requestTimeout: requestLimits.requestTimeoutMilliseconds,
      routerOptions: {
        maxParamLength: requestLimits.maximumParameterCharacters,
      },
    });
    await application.close();
  });

  it("accepts JSON at the body limit and rejects larger JSON safely", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
    });
    application.post("/api/test-json-limit", async () => ({ accepted: true }));
    const exactBody = `"${"a".repeat(requestLimits.bodyBytes - 2)}"`;
    const oversizedBody = `${exactBody} `;

    const acceptedResponse = await application.inject({
      headers: { "content-type": "application/json" },
      method: "POST",
      payload: exactBody,
      url: "/api/test-json-limit",
    });
    const rejectedResponse = await application.inject({
      headers: { "content-type": "application/json" },
      method: "POST",
      payload: oversizedBody,
      url: "/api/test-json-limit",
    });

    expect(Buffer.byteLength(exactBody)).toBe(requestLimits.bodyBytes);
    expect(acceptedResponse.statusCode).toBe(200);
    expect(rejectedResponse.statusCode).toBe(413);
    expect(rejectedResponse.json()).toEqual({
      statusCode: 413,
      code: "REQUEST_BODY_TOO_LARGE",
      error: "Payload Too Large",
      message: "Request body is too large.",
    });
    await application.close();
  });

  it("rejects an oversized request URL with a stable error", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
    });
    application.get("/api/test-url-limit", async () => ({ accepted: true }));
    const prefix = "/api/test-url-limit?value=";
    const oversizedUrl = `${prefix}${"a".repeat(
      requestLimits.maximumUrlCharacters - prefix.length + 1,
    )}`;

    const response = await application.inject({
      method: "GET",
      url: oversizedUrl,
    });

    expect(response.statusCode).toBe(414);
    expect(response.json()).toMatchObject({
      code: "REQUEST_URI_TOO_LONG",
      message: "Request URL is too long.",
    });
    await application.close();
  });

  it("starts and closes the realtime database listener with the application", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const userEventListener = {
      close: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
    } satisfies UserEventListener;
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
      userEventListener,
    });

    await application.ready();
    expect(userEventListener.start).toHaveBeenCalledOnce();

    await application.close();
    expect(userEventListener.close).toHaveBeenCalledOnce();
  });

  it("generates and returns a trusted request ID for every request", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
    });

    const firstResponse = await application.inject({
      headers: {
        origin: "http://localhost:3000",
        "x-request-id": "untrusted-client-id",
      },
      method: "GET",
      url: "/health",
    });
    const secondResponse = await application.inject({
      method: "GET",
      url: "/health",
    });

    expect(firstResponse.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(firstResponse.headers["x-request-id"]).not.toBe(
      "untrusted-client-id",
    );
    expect(firstResponse.headers["access-control-expose-headers"]).toBe(
      "Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, x-request-id",
    );
    expect(secondResponse.headers["x-request-id"]).not.toBe(
      firstResponse.headers["x-request-id"],
    );

    await application.close();
  });

  it("ignores a spoofed forwarded address without a trusted proxy", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
    });
    application.get("/test-client-ip", async (request) => ({
      ip: request.ip,
    }));

    const response = await application.inject({
      headers: { "x-forwarded-for": "203.0.113.20" },
      method: "GET",
      remoteAddress: "198.51.100.30",
      url: "/test-client-ip",
    });

    expect(response.json()).toEqual({ ip: "198.51.100.30" });
    await application.close();
  });

  it.each([
    {
      description: "production Caddy",
      forwardedFor: "203.0.113.20",
      hops: 1,
      remoteAddress: "172.20.0.4",
    },
    {
      description: "the local ngrok development proxy",
      forwardedFor: "203.0.113.20, 127.0.0.1",
      hops: 2,
      remoteAddress: "127.0.0.1",
    },
  ])(
    "derives the client address through $description",
    async ({ forwardedFor, hops, remoteAddress }) => {
      const { authentication, databaseConnection, documentStorage } =
        createDependencies();
      const application = buildApplication({
        authentication,
        authenticationBaseUrl: "http://localhost:3001",
        corsOrigin: "http://localhost:3000",
        databaseConnection,
        documentStorage,
        trustProxyHops: hops,
      });
      application.get("/test-client-ip", async (request) => ({
        ip: request.ip,
      }));

      const response = await application.inject({
        headers: { "x-forwarded-for": forwardedFor },
        method: "GET",
        remoteAddress,
        url: "/test-client-ip",
      });

      expect(response.json()).toEqual({ ip: "203.0.113.20" });
      await application.close();
    },
  );

  it.each([
    { description: "missing origin", origin: undefined },
    {
      description: "lookalike origin",
      origin: "https://finhand.example.evil.test",
    },
  ])(
    "rejects a cookie-authenticated mutation with a $description",
    async ({ origin }) => {
      const { authentication, databaseConnection, documentStorage } =
        createDependencies();
      const application = buildApplication({
        authentication,
        authenticationBaseUrl: "http://localhost:3001",
        corsOrigin: "http://localhost:3000",
        databaseConnection,
        documentStorage,
      });

      const response = await application.inject({
        headers: {
          cookie: "better-auth.session_token=test-session",
          ...(origin ? { origin } : {}),
        },
        method: "POST",
        payload: { name: "Cash", type: "cash" },
        url: "/api/accounts",
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({
        code: "ORIGIN_NOT_ALLOWED",
        message: "Request origin is not allowed.",
      });
      await application.close();
    },
  );

  it("allows the configured origin to reach normal authentication", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
    });

    const response = await application.inject({
      headers: {
        cookie: "better-auth.session_token=test-session",
        origin: "http://localhost:3000",
      },
      method: "POST",
      payload: { name: "Cash", type: "cash" },
      url: "/api/accounts",
    });
    expect(response.statusCode).toBe(401);
    await application.close();
  });

  it("exposes credentialed CORS responses only to the configured origin", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
    });

    const trustedResponse = await application.inject({
      headers: { origin: "http://localhost:3000" },
      method: "GET",
      url: "/health",
    });
    const untrustedResponse = await application.inject({
      headers: { origin: "https://localhost.attacker.test" },
      method: "GET",
      url: "/health",
    });

    expect(trustedResponse.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(trustedResponse.headers["access-control-allow-credentials"]).toBe(
      "true",
    );
    expect(untrustedResponse.headers["access-control-allow-origin"]).not.toBe(
      "https://localhost.attacker.test",
    );
    await application.close();
  });

  it.each([
    "/api/auth/test",
    "/api/document-capture-session/document",
  ])("leaves the specialized origin policy for %s intact", async (url) => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
    });

    const response = await application.inject({
      headers: {
        cookie: "better-auth.session_token=test-session",
        origin: "https://untrusted.example",
      },
      method: "POST",
      url,
    });

    expect(response.statusCode).not.toBe(403);
    await application.close();
  });

  it("requires authentication before opening the realtime event stream", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
    });

    const response = await application.inject({
      method: "GET",
      url: "/api/events",
    });

    expect(response.statusCode).toBe(401);
    await application.close();
  });

  it("prevents normal API responses from being stored", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
    });

    const apiResponse = await application.inject({
      method: "GET",
      url: "/api/me",
    });
    const healthResponse = await application.inject({
      method: "GET",
      url: "/health",
    });

    expect(apiResponse.headers["cache-control"]).toBe("private, no-store");
    expect(healthResponse.headers["cache-control"]).toBeUndefined();
    await application.close();
  });

  it("logs safe request completion data without the raw URL or query", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const entries: Record<string, unknown>[] = [];
    const serializedEntries: string[] = [];
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
      logger: {
        ...createLoggerOptions({
          environment: "test",
          level: "debug",
          service: "api",
        }),
        stream: createLogDestination(entries, serializedEntries),
      },
    });

    const response = await application.inject({
      method: "GET",
      url: "/health?access_token=private-token",
    });
    const completion = entries.find(
      (entry) => entry.event === "http.request.completed",
    );

    expect(response.statusCode).toBe(200);
    expect(completion).toMatchObject({
      event: "http.request.completed",
      level: "debug",
      method: "GET",
      requestId: response.headers["x-request-id"],
      route: "/health",
      statusCode: 200,
    });
    expect(completion?.durationMs).toEqual(expect.any(Number));
    expect(JSON.stringify(entries)).not.toContain("private-token");
    const serializedCompletion = serializedEntries.find((entry) =>
      entry.includes('"event":"http.request.completed"'),
    );
    expect(serializedCompletion?.match(/"requestId"/gu)).toHaveLength(1);

    await application.close();
  });

  it("logs unhandled errors without exposing their messages", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const entries: Record<string, unknown>[] = [];
    const serializedEntries: string[] = [];
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
      logger: {
        ...createLoggerOptions({
          environment: "test",
          level: "info",
          service: "api",
        }),
        stream: createLogDestination(entries, serializedEntries),
      },
    });
    application.get("/test-unhandled-error", async () => {
      throw new Error("customer account secret");
    });

    const response = await application.inject({
      method: "GET",
      url: "/test-unhandled-error",
    });
    const failure = entries.find(
      (entry) => entry.event === "http.request.failed",
    );

    expect(response.statusCode).toBe(500);
    expect(failure).toMatchObject({
      err: { type: "Error" },
      event: "http.request.failed",
      method: "GET",
      requestId: response.headers["x-request-id"],
      route: "/test-unhandled-error",
    });
    expect(JSON.stringify(entries)).not.toContain("customer account secret");
    const serializedFailure = serializedEntries.find((entry) =>
      entry.includes('"event":"http.request.failed"'),
    );
    expect(serializedFailure?.match(/"requestId"/gu)).toHaveLength(1);

    await application.close();
  });

  it("logs security rejections without credentials, raw URLs, or request bodies", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const entries: Record<string, unknown>[] = [];
    const serializedEntries: string[] = [];
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
      logger: {
        ...createLoggerOptions({
          environment: "test",
          level: "info",
          service: "api",
        }),
        stream: createLogDestination(entries, serializedEntries),
      },
    });

    await application.inject({
      headers: {
        cookie: "better-auth.session_token=private-cookie",
        origin: "https://private-origin.attacker.test",
      },
      method: "POST",
      payload: { name: "Cash", type: "cash" },
      url: "/api/accounts",
    });
    const oversizedUrlPrefix = "/api/accounts?access_token=private-query-";
    await application.inject({
      method: "GET",
      url: `${oversizedUrlPrefix}${"x".repeat(
        requestLimits.maximumUrlCharacters - oversizedUrlPrefix.length + 1,
      )}`,
    });
    await application.inject({
      headers: { "content-type": "application/json" },
      method: "POST",
      payload: JSON.stringify({
        value: `private-body-${"x".repeat(requestLimits.bodyBytes)}`,
      }),
      url: "/api/accounts",
    });

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await application.inject({
        headers: {
          authorization: `Bearer private-capture-${attempt}`,
        },
        method: "POST",
        url: "/api/document-capture-session/document",
      });
    }

    const rejections = entries.filter(
      (entry) => entry.event === "security.request.rejected",
    );
    expect(rejections.map((entry) => entry.code)).toEqual([
      "ORIGIN_NOT_ALLOWED",
      "REQUEST_URI_TOO_LONG",
      "REQUEST_BODY_TOO_LARGE",
      "CAPTURE_RATE_LIMIT_EXCEEDED",
    ]);
    expect(rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "security.request.rejected",
          level: "warn",
          requestId: expect.any(String),
          statusCode: expect.any(Number),
        }),
      ]),
    );
    expect(serializedEntries.join("\n")).not.toMatch(
      /private-cookie|private-origin|private-query|private-body|private-capture/u,
    );

    await application.close();
  });

  it("logs global IP rate-limit rejections returned by the Fastify plugin", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const entries: Record<string, unknown>[] = [];
    const serializedEntries: string[] = [];
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage,
      logger: {
        ...createLoggerOptions({
          environment: "test",
          level: "info",
          service: "api",
        }),
        stream: createLogDestination(entries, serializedEntries),
      },
    });

    let response;
    for (
      let attempt = 0;
      attempt <= requestRateLimitPolicies.generalIp.maximumRequests;
      attempt += 1
    ) {
      response = await application.inject({
        method: "GET",
        remoteAddress: "203.0.113.91",
        url: "/health",
      });
    }

    expect(response?.statusCode).toBe(429);
    expect(response?.json()).toEqual({
      statusCode: 429,
      code: "RATE_LIMIT_EXCEEDED",
      error: "Too Many Requests",
      message: "Too many requests. Try again later.",
    });
    expect(
      entries.filter(
        (entry) => entry.event === "security.request.rejected",
      ),
    ).toEqual([
      expect.objectContaining({
        code: "RATE_LIMIT_EXCEEDED",
        method: "GET",
        route: "/health",
        statusCode: 429,
      }),
    ]);
    expect(serializedEntries.join("\n")).not.toContain("203.0.113.91");

    await application.close();
  });
});
