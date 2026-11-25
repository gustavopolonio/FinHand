import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { environment } from "./config/environment.js";
import { createDatabase } from "./db/index.js";
import { executeDatabaseMigrations } from "./db/migrations.js";

const migrationsFolder = fileURLToPath(
  new URL("../drizzle", import.meta.url),
);
const databaseConnection = createDatabase(environment.databaseUrl);

try {
  await executeDatabaseMigrations(
    databaseConnection,
    async (database) => migrate(database, { migrationsFolder }),
  );
  console.info("Database migrations completed successfully.");
} finally {
  await databaseConnection.pool.end();
}
