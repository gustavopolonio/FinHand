import { Writable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { buildApplication } from "./app.js";
import type { Authentication } from "./auth/authentication.js";
import type { DatabaseConnection } from "./db/index.js";
import { createLoggerOptions } from "./logging/logger.js";
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

function createLogDestination(entries: Record<string, unknown>[]): Writable {
  return new Writable({
    write(chunk, _encoding, callback) {
      entries.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
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
      "x-request-id",
    );
    expect(secondResponse.headers["x-request-id"]).not.toBe(
      firstResponse.headers["x-request-id"],
    );

    await application.close();
  });

  it("logs safe request completion data without the raw URL or query", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const entries: Record<string, unknown>[] = [];
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
        stream: createLogDestination(entries),
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

    await application.close();
  });

  it("logs unhandled errors without exposing their messages", async () => {
    const { authentication, databaseConnection, documentStorage } =
      createDependencies();
    const entries: Record<string, unknown>[] = [];
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
        stream: createLogDestination(entries),
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

    await application.close();
  });
});
