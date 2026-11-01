import { sql } from "drizzle-orm";

import { environment } from "../src/config/environment.js";
import { createDatabase } from "../src/db/index.js";

const { database, pool } = createDatabase(environment.databaseUrl);

try {
  await database.execute(sql`select 1`);
  console.log("Database connection verified.");
} finally {
  await pool.end();
}
