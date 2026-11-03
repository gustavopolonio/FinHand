import { describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import { categories } from "../db/schema/index.js";
import { createAuthentication } from "./authentication.js";

describe("createAuthentication", () => {
  it("creates default categories after a user is created", async () => {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });
    const database = { insert } as unknown as Database;
    const authentication = createAuthentication(database, {
      baseUrl: "http://localhost:3001",
      betterAuthSecret: "a-secure-test-secret-with-32-characters",
      googleClientId: "google-client-id",
      googleClientSecret: "google-client-secret",
      webUrl: "http://localhost:3000",
    });
    const afterUserCreation =
      authentication.options.databaseHooks?.user?.create?.after;
    const userId = "33333333-3333-4333-8333-333333333333";

    expect(afterUserCreation).toBeTypeOf("function");
    await afterUserCreation?.({ id: userId } as never);

    expect(insert).toHaveBeenCalledWith(categories);
    expect(values).toHaveBeenCalledWith([
      { userId, name: "Salary", type: "income" },
      { userId, name: "Grocery", type: "expense" },
    ]);
    expect(onConflictDoNothing).toHaveBeenCalledOnce();
  });
});
