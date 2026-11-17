import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { sql } from "drizzle-orm";

import { createDatabase } from "../../src/db/index.js";
import type { Database } from "../../src/db/index.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const defaultTestDatabaseUrl =
  "postgresql://finhand_test:finhand_test@127.0.0.1:5434/finhand_test";

config({
  path: resolve(currentDirectory, "../../../../.env"),
  quiet: true,
});

export function getTestDatabaseUrl(): string {
  const connectionString =
    process.env.TEST_DATABASE_URL?.trim() || defaultTestDatabaseUrl;
  let databaseUrl: URL;

  try {
    databaseUrl = new URL(connectionString);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (
    databaseUrl.protocol !== "postgresql:" ||
    decodeURIComponent(databaseUrl.pathname) !== "/finhand_test"
  ) {
    throw new Error(
      'Integration tests require a PostgreSQL database named "finhand_test".',
    );
  }

  return connectionString;
}

export function createTestDatabase() {
  return createDatabase(getTestDatabaseUrl());
}

export async function resetTestDatabase(database: Database): Promise<void> {
  await database.execute(sql`
    truncate table auth_verifications, users restart identity cascade
  `);
}

export const testMigrationsFolder = resolve(currentDirectory, "../../drizzle");
