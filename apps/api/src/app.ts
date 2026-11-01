import Fastify, { type FastifyServerOptions } from "fastify";

import type { Database, DatabaseConnection } from "./db/index.js";
import { healthRoutes } from "./routes/health.js";

declare module "fastify" {
  interface FastifyInstance {
    database: Database;
  }
}

interface BuildApplicationOptions {
  databaseConnection: DatabaseConnection;
  logger?: FastifyServerOptions["logger"];
}

export function buildApplication({
  databaseConnection,
  logger = false,
}: BuildApplicationOptions) {
  const application = Fastify({ logger });

  application.decorate("database", databaseConnection.database);
  application.addHook("onClose", async () => {
    await databaseConnection.pool.end();
  });

  application.register(healthRoutes);

  return application;
}
