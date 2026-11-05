import { afterEach, describe, expect, it } from "vitest";

import { buildApplication } from "../../app.js";
import type { Authentication } from "../../auth/authentication.js";
import { createDatabase } from "../../db/index.js";
import { createTestDocumentStorage } from "../../test/document-storage.js";

const applications: ReturnType<typeof buildApplication>[] = [];

afterEach(async () => {
  await Promise.all(
    applications.splice(0).map((application) => application.close()),
  );
});

function createApplication(authentication: Authentication) {
  const application = buildApplication({
    authentication,
    authenticationBaseUrl: "http://localhost:3001",
    corsOrigin: "http://localhost:3000",
    databaseConnection: createDatabase(
      "postgresql://unused:unused@127.0.0.1:1/unused",
    ),
    documentStorage: createTestDocumentStorage(),
  });
  applications.push(application);
  return application;
}

describe("authentication routes", () => {
  it("forwards authentication requests and response cookies", async () => {
    let receivedRequest: Request | undefined;
    const authentication = {
      async handler(request: Request) {
        receivedRequest = request;
        return new Response(JSON.stringify({ redirect: true }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie": "finhand.session=test; HttpOnly; SameSite=Lax",
          },
        });
      },
      api: { getSession: async () => null },
    } as unknown as Authentication;
    const application = createApplication(authentication);

    const response = await application.inject({
      method: "POST",
      url: "/api/auth/sign-in/social",
      payload: { provider: "google" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.cookies[0]?.name).toBe("finhand.session");
    expect(receivedRequest?.url).toBe(
      "http://localhost:3001/api/auth/sign-in/social",
    );
    await expect(receivedRequest?.json()).resolves.toEqual({
      provider: "google",
    });
  });

  it("forwards authentication error responses", async () => {
    const authentication = {
      handler: async () =>
        new Response(JSON.stringify({ error: "Invalid authentication" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      api: { getSession: async () => null },
    } as unknown as Authentication;
    const application = createApplication(authentication);

    const response = await application.inject({
      method: "POST",
      url: "/api/auth/sign-in/social",
      payload: { provider: "google" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Invalid authentication" });
  });

  it("hides unexpected authentication handler errors", async () => {
    const authentication = {
      handler: async () => {
        throw new Error("Sensitive OAuth failure");
      },
      api: { getSession: async () => null },
    } as unknown as Authentication;
    const application = createApplication(authentication);

    const response = await application.inject({
      method: "GET",
      url: "/api/auth/get-session",
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Internal server error" });
    expect(response.body).not.toContain("Sensitive OAuth failure");
  });

  it("rejects protected requests without a valid session", async () => {
    const authentication = {
      handler: async () => new Response(null, { status: 404 }),
      api: { getSession: async () => null },
    } as unknown as Authentication;
    const application = createApplication(authentication);

    const response = await application.inject({
      method: "GET",
      url: "/api/me",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
  });

  it("allows credentialed requests only from the configured web origin", async () => {
    const authentication = {
      handler: async () => new Response(null, { status: 404 }),
      api: { getSession: async () => null },
    } as unknown as Authentication;
    const application = createApplication(authentication);

    const response = await application.inject({
      method: "OPTIONS",
      url: "/api/me",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "DELETE",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"]).toContain(
      "DELETE",
    );
  });

  it("does not echo an unconfigured origin in CORS headers", async () => {
    const authentication = {
      handler: async () => new Response(null, { status: 404 }),
      api: { getSession: async () => null },
    } as unknown as Authentication;
    const application = createApplication(authentication);

    const response = await application.inject({
      method: "OPTIONS",
      url: "/api/me",
      headers: {
        origin: "https://untrusted.example",
        "access-control-request-method": "GET",
      },
    });

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(response.headers["access-control-allow-origin"]).not.toBe(
      "https://untrusted.example",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe(
      "true",
    );
  });
});
