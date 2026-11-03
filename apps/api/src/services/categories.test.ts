import { describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import { categories } from "../db/schema/index.js";
import { createDefaultCategoriesForUser } from "./categories.js";

describe("createDefaultCategoriesForUser", () => {
  it("creates the private Salary and Grocery categories idempotently", async () => {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });
    const database = { insert } as unknown as Database;
    const userId = "33333333-3333-4333-8333-333333333333";

    await createDefaultCategoriesForUser(database, userId);

    expect(insert).toHaveBeenCalledWith(categories);
    expect(values).toHaveBeenCalledWith([
      { userId, name: "Salary", type: "income" },
      { userId, name: "Grocery", type: "expense" },
    ]);
    expect(onConflictDoNothing).toHaveBeenCalledOnce();
  });
});
