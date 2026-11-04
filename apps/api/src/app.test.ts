import { describe, expect, it, vi } from "vitest";

import { buildApplication } from "./app.js";
import type { Authentication } from "./auth/authentication.js";
import type { DatabaseConnection } from "./db/index.js";

describe("buildApplication", () => {
  it("closes the database pool when the application closes", async () => {
    const end = vi.fn().mockResolvedValue(undefined);
    const databaseConnection = {
      database: {},
      pool: { end },
    } as unknown as DatabaseConnection;
    const authentication = {
      handler: async () => new Response(null, { status: 404 }),
      api: { getSession: async () => null },
    } as unknown as Authentication;
    const application = buildApplication({
      authentication,
      authenticationBaseUrl: "http://localhost:3001",
      corsOrigin: "http://localhost:3000",
      databaseConnection,
    });

    await application.ready();
    await application.close();

    expect(end).toHaveBeenCalledOnce();
  });
});
