import { describe, expect, it } from "vitest";

import { createDatabase } from "./index.js";

describe("createDatabase", () => {
  it.each(["", "   "])("rejects an empty connection string", (value) => {
    expect(() => createDatabase(value)).toThrow(
      "A database connection string is required.",
    );
  });

  it("creates a lazy database client and connection pool", async () => {
    const connection = createDatabase(
      "postgresql://unused:unused@127.0.0.1:1/unused",
    );

    expect(connection.database).toBeDefined();
    expect(connection.pool).toBeDefined();

    await connection.pool.end();
  });
});
