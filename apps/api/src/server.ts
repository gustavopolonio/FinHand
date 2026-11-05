import { buildApplication } from "./app.js";
import { createAuthentication } from "./auth/authentication.js";
import {
  environment,
  getAuthenticationEnvironment,
  getDocumentStorageEnvironment,
} from "./config/environment.js";
import { createDatabase } from "./db/index.js";
import { createS3DocumentStorage } from "./storage/document-storage.js";

const databaseConnection = createDatabase(environment.databaseUrl);
const authenticationEnvironment = getAuthenticationEnvironment();
const documentStorageEnvironment = getDocumentStorageEnvironment();
const documentStorage = createS3DocumentStorage(documentStorageEnvironment);
const authentication = createAuthentication(
  databaseConnection.database,
  authenticationEnvironment,
);
const application = buildApplication({
  authentication,
  authenticationBaseUrl: authenticationEnvironment.baseUrl,
  corsOrigin: authenticationEnvironment.webUrl,
  databaseConnection,
  documentStorage,
  logger: { level: environment.logLevel },
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  application.log.info({ signal }, "Shutting down API");

  try {
    await application.close();
  } catch (error) {
    application.log.error(error, "Failed to shut down API cleanly");
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await application.listen({
    host: environment.apiHost,
    port: environment.apiPort,
  });
} catch (error) {
  application.log.error(error, "Failed to start API");
  await application.close();
  process.exitCode = 1;
}
