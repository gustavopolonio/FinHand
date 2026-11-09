import { environment } from "./config/environment.js";
import { createDatabase } from "./db/index.js";
import { expirePendingDocumentCaptureSessions } from "./services/document-capture-session-cleanup.js";
import {
  type CleanupWorkerLogger,
  startDocumentCaptureSessionCleanupWorker,
} from "./workers/document-capture-session-cleanup-worker.js";

const databaseConnection = createDatabase(environment.databaseUrl);
const logger: CleanupWorkerLogger = {
  error(error, message) {
    console.error(message, error);
  },
  info(context, message) {
    console.info(message, context);
  },
};
const cleanupWorker = startDocumentCaptureSessionCleanupWorker({
  cleanup: () =>
    expirePendingDocumentCaptureSessions(databaseConnection.database),
  logger,
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.info("Shutting down worker", { signal });

  try {
    await cleanupWorker.stop();
    await databaseConnection.pool.end();
  } catch (error) {
    console.error("Failed to shut down worker cleanly", error);
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
