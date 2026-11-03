import fastifyCors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";

import type { Authentication } from "./auth/authentication.js";
import { registerAuthenticationGuard } from "./auth/require-authentication.js";
import type { Database, DatabaseConnection } from "./db/index.js";
import { registerApplicationErrorHandler } from "./errors/error-handler.js";
import { accountRoutes } from "./routes/accounts/accounts.js";
import { authenticationRoutes } from "./routes/authentication/authentication.js";
import { categoryRoutes } from "./routes/categories/categories.js";
import { healthRoutes } from "./routes/health/health.js";
import { transactionRoutes } from "./routes/transactions/transactions.js";
import { userRoutes } from "./routes/users/users.js";
import { registerSchemaCompilers } from "./validation/schema-compilers.js";

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

  registerSchemaCompilers(application);
  registerApplicationErrorHandler(application);
  application.decorate("database", databaseConnection.database);
  registerAuthenticationGuard(application, authentication);
  application.addHook("onClose", async () => {
    await databaseConnection.pool.end();
  });

  application.register(fastifyCors, {
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86_400,
  });

  application.register(healthRoutes);
  application.register(accountRoutes);
  application.register(categoryRoutes);
  application.register(transactionRoutes);
  application.register(authenticationRoutes, {
    authentication,
    baseUrl: authenticationBaseUrl,
  });
  application.register(userRoutes);

  return application;
}
