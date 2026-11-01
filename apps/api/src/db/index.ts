import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema/index.js";

export function createDatabase(connectionString: string) {
  if (!connectionString.trim()) {
    throw new Error("A database connection string is required.");
  }

  const pool = new Pool({ connectionString });
  const database = drizzle({ client: pool, schema });

  return { database, pool };
}

export type DatabaseConnection = ReturnType<typeof createDatabase>;
export type Database = ReturnType<typeof createDatabase>["database"];
