import fastifyCors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";

import type { Authentication } from "./auth/authentication.js";
import type { Database, DatabaseConnection } from "./db/index.js";
import { authenticationRoutes } from "./routes/authentication.js";
import { healthRoutes } from "./routes/health.js";
import { userRoutes } from "./routes/users.js";

declare module "fastify" {
  interface FastifyInstance {
    database: Database;
  }
}

interface BuildApplicationOptions {
  authentication: Authentication;
  authenticationBaseUrl: string;
  corsOrigin: string;
  databaseConnection: DatabaseConnection;
  logger?: FastifyServerOptions["logger"];
}

export function buildApplication({
  authentication,
  authenticationBaseUrl,
  corsOrigin,
  databaseConnection,
  logger = false,
}: BuildApplicationOptions) {
  const application = Fastify({ logger });

  application.decorate("database", databaseConnection.database);
  application.addHook("onClose", async () => {
    await databaseConnection.pool.end();
  });

  application.register(fastifyCors, {
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86_400,
  });

  application.register(healthRoutes);
  application.register(authenticationRoutes, {
    authentication,
    baseUrl: authenticationBaseUrl,
  });
  application.register(userRoutes, { authentication });

  return application;
}
