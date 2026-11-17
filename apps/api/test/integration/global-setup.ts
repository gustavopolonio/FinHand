import { migrate } from "drizzle-orm/node-postgres/migrator";

import {
  createTestDatabase,
  testMigrationsFolder,
} from "./database.js";

export default async function setupIntegrationDatabase(): Promise<void> {
  const { database, pool } = createTestDatabase();

  try {
    await migrate(database, { migrationsFolder: testMigrationsFolder });
  } finally {
    await pool.end();
  }
}
