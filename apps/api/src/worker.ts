import { createOpenAiDocumentTransactionExtractor } from "./ai/document-transaction-extractor.js";
import {
  environment,
  getDocumentExtractionEnvironment,
  getDocumentStorageEnvironment,
} from "./config/environment.js";
import { createDatabase } from "./db/index.js";
import { expirePendingDocumentCaptureSessions } from "./services/document-capture-session-cleanup.js";
import { processNextDocumentUpload } from "./services/document-extraction.js";
import { createS3DocumentStorage } from "./storage/document-storage.js";
import {
  type CleanupWorkerLogger,
  startDocumentCaptureSessionCleanupWorker,
} from "./workers/document-capture-session-cleanup-worker.js";
import {
  type DocumentExtractionWorkerLogger,
  startDocumentExtractionWorker,
} from "./workers/document-extraction-worker.js";

const databaseConnection = createDatabase(environment.databaseUrl);
const documentStorage = createS3DocumentStorage(
  getDocumentStorageEnvironment(),
);
const documentExtractionEnvironment = getDocumentExtractionEnvironment();
const extractor = createOpenAiDocumentTransactionExtractor({
  apiKey: documentExtractionEnvironment.apiKey,
  model: documentExtractionEnvironment.model,
});
const cleanupLogger: CleanupWorkerLogger = {
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
  logger: cleanupLogger,
});
const extractionLogger: DocumentExtractionWorkerLogger = {
  error(context, message) {
    console.error(message, context);
  },
  info(context, message) {
    console.info(message, context);
  },
};
const extractionWorker = startDocumentExtractionWorker({
  logger: extractionLogger,
  pollIntervalMilliseconds:
    documentExtractionEnvironment.pollIntervalMilliseconds,
  processNext: () =>
    processNextDocumentUpload({
      database: databaseConnection.database,
      documentStorage,
      extractor,
    }),
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.info("Shutting down worker", { signal });

  try {
    await Promise.all([cleanupWorker.stop(), extractionWorker.stop()]);
    documentStorage.close();
    await databaseConnection.pool.end();
  } catch (error) {
    console.error("Failed to shut down worker cleanly", error);
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
