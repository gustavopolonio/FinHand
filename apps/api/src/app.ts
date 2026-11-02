import fastifyCors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";

import type { Authentication } from "./auth/authentication.js";
import { registerAuthenticationGuard } from "./auth/require-authentication.js";
import type { Database, DatabaseConnection } from "./db/index.js";
import { accountRoutes } from "./routes/accounts.js";
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
  registerAuthenticationGuard(application, authentication);
  application.addHook("onClose", async () => {
    await databaseConnection.pool.end();
  });

  application.register(fastifyCors, {
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86_400,
  });

  application.register(healthRoutes);
  application.register(accountRoutes);
  application.register(authenticationRoutes, {
    authentication,
    baseUrl: authenticationBaseUrl,
  });
  application.register(userRoutes);

  return application;
}
