import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { environment } from "./config/environment.js";
import { createDatabase } from "./db/index.js";

const migrationsFolder = fileURLToPath(
  new URL("../drizzle", import.meta.url),
);
const databaseConnection = createDatabase(environment.databaseUrl);

try {
  await migrate(databaseConnection.database, { migrationsFolder });
  console.info("Database migrations completed successfully.");
} finally {
  await databaseConnection.pool.end();
}
