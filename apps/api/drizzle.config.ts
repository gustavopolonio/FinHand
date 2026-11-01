import { defineConfig } from "drizzle-kit";

import { environment } from "./src/config/environment.js";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: environment.databaseUrl,
  },
  verbose: true,
});
