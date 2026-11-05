import { afterEach, describe, expect, it } from "vitest";

import { buildApplication } from "../../app.js";
import type { Authentication } from "../../auth/authentication.js";
import { createDatabase } from "../../db/index.js";
import { createTestDocumentStorage } from "../../test/document-storage.js";

const applications: ReturnType<typeof buildApplication>[] = [];

const authentication = {
  handler: async () => new Response(null, { status: 404 }),
  api: {
    getSession: async () => null,
  },
} as unknown as Authentication;

afterEach(async () => {
  await Promise.all(applications.splice(0).map((application) => application.close()));
});

describe("GET /health", () => {
  it("reports that the API is healthy", async () => {
    const databaseConnection = createDatabase(
      "postgresql://unused:unused@127.0.0.1:1/unused",
    );
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
      documentStorage: createTestDocumentStorage(),
    });
    applications.push(application);

    const response = await application.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json()).toEqual({ status: "ok" });
  });
});
