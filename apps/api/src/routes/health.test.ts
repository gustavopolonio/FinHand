import { afterEach, describe, expect, it } from "vitest";

import { buildApplication } from "../app.js";
import { createDatabase } from "../db/index.js";

const applications: ReturnType<typeof buildApplication>[] = [];

afterEach(async () => {
  await Promise.all(applications.splice(0).map((application) => application.close()));
});

describe("GET /health", () => {
  it("reports that the API is healthy", async () => {
    const databaseConnection = createDatabase(
      "postgresql://unused:unused@127.0.0.1:1/unused",
    );
    const application = buildApplication({ databaseConnection });
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
