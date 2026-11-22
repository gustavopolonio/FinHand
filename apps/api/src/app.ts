import { randomUUID } from "node:crypto";

import fastifyCors from "@fastify/cors";
import Fastify, { LogController, type FastifyServerOptions } from "fastify";

import type { Authentication } from "./auth/authentication.js";
import { registerAuthenticationGuard } from "./auth/require-authentication.js";
import type { Database, DatabaseConnection } from "./db/index.js";
import { registerApplicationErrorHandler } from "./errors/error-handler.js";
import { accountRoutes } from "./routes/accounts/accounts.js";
import { audioUploadRoutes } from "./routes/audio-uploads/audio-uploads.js";
import { authenticationRoutes } from "./routes/authentication/authentication.js";
import { categoryRoutes } from "./routes/categories/categories.js";
import { documentCaptureSessionRoutes } from "./routes/document-capture-sessions/document-capture-sessions.js";
import { documentImportIssueRoutes } from "./routes/document-import-issues/document-import-issues.js";
import { documentReviewRoutes } from "./routes/document-reviews/document-reviews.js";
import { documentUploadRoutes } from "./routes/document-uploads/document-uploads.js";
import { financialSummaryRoutes } from "./routes/financial-summary/financial-summary.js";
import { healthRoutes } from "./routes/health/health.js";
import { transactionCandidateRoutes } from "./routes/transaction-candidates/transaction-candidates.js";
import { transactionRoutes } from "./routes/transactions/transactions.js";
import { userRoutes } from "./routes/users/users.js";
import type { DocumentStorage } from "./storage/document-storage.js";
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
  documentStorage: DocumentStorage;
  logger?: FastifyServerOptions["logger"];
}

export function buildApplication({
  authentication,
  authenticationBaseUrl,
  corsOrigin,
  databaseConnection,
  documentStorage,
  logger = false,
}: BuildApplicationOptions) {
  const application = Fastify({
    genReqId: () => randomUUID(),
    logger,
    logController: new LogController({
      disableRequestLogging: true,
      requestIdLogLabel: "requestId",
    }),
    requestIdHeader: false,
  });

  registerSchemaCompilers(application);
  registerApplicationErrorHandler(application);
  application.decorate("database", databaseConnection.database);
  registerAuthenticationGuard(application, authentication);
  application.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
  application.addHook("onResponse", async (request, reply) => {
    const context = {
      durationMs: Math.round(reply.elapsedTime * 100) / 100,
      event: "http.request.completed",
      method: request.method,
      route: request.routeOptions.url,
      statusCode: reply.statusCode,
    };

    if (request.routeOptions.url === "/health") {
      request.log.debug(context, "HTTP request completed");
      return;
    }

    request.log.info(context, "HTTP request completed");
  });
  application.addHook("onClose", async () => {
    documentStorage.close();
    await databaseConnection.pool.end();
  });

  application.register(fastifyCors, {
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["x-request-id"],
    maxAge: 86_400,
  });

  application.register(healthRoutes);
  application.register(accountRoutes);
  application.register(audioUploadRoutes, { documentStorage });
  application.register(categoryRoutes);
  application.register(transactionRoutes, { documentStorage });
  application.register(transactionCandidateRoutes);
  application.register(financialSummaryRoutes);
  application.register(documentUploadRoutes, { documentStorage });
  application.register(documentReviewRoutes);
  application.register(documentImportIssueRoutes);
  application.register(documentCaptureSessionRoutes, {
    captureBaseUrl: corsOrigin,
    documentStorage,
  });
  application.register(authenticationRoutes, {
    authentication,
    baseUrl: authenticationBaseUrl,
  });
  application.register(userRoutes);

  return application;
}
