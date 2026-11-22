import { createOpenAiAudioTranscriber } from "./ai/audio-transcriber.js";
import { createOpenAiAudioTransactionExtractor } from "./ai/audio-transaction-extractor.js";
import { createOpenAiDocumentTransactionExtractor } from "./ai/document-transaction-extractor.js";
import {
  environment,
  getAudioTranscriptionEnvironment,
  getDocumentExtractionEnvironment,
  getDocumentStorageEnvironment,
} from "./config/environment.js";
import { createDatabase } from "./db/index.js";
import { createApplicationLogger } from "./logging/logger.js";
import { processNextAudioUpload } from "./services/audio-processing.js";
import { recoverExpiredAudioProcessingLeases } from "./services/audio-transcription-recovery.js";
import { expirePendingDocumentCaptureSessions } from "./services/document-capture-session-cleanup.js";
import { processNextDocumentUpload } from "./services/document-extraction.js";
import { recoverExpiredDocumentProcessingLeases } from "./services/document-processing-recovery.js";
import { createS3DocumentStorage } from "./storage/document-storage.js";
import { startAudioProcessingRecoveryWorker } from "./workers/audio-transcription-recovery-worker.js";
import { startAudioProcessingWorker } from "./workers/audio-transcription-worker.js";
import { startDocumentCaptureSessionCleanupWorker } from "./workers/document-capture-session-cleanup-worker.js";
import { startDocumentExtractionWorker } from "./workers/document-extraction-worker.js";
import { startDocumentProcessingRecoveryWorker } from "./workers/document-processing-recovery-worker.js";

const logger = createApplicationLogger({
  environment: environment.nodeEnvironment,
  level: environment.logLevel,
  service: "worker",
});
const databaseConnection = createDatabase(environment.databaseUrl);
const documentStorage = createS3DocumentStorage(
  getDocumentStorageEnvironment(),
);
const documentExtractionEnvironment = getDocumentExtractionEnvironment();
const audioTranscriptionEnvironment = getAudioTranscriptionEnvironment();
const extractor = createOpenAiDocumentTransactionExtractor({
  apiKey: documentExtractionEnvironment.apiKey,
  model: documentExtractionEnvironment.model,
});
const audioTranscriber = createOpenAiAudioTranscriber({
  apiKey: audioTranscriptionEnvironment.apiKey,
  model: audioTranscriptionEnvironment.model,
});
const audioExtractor = createOpenAiAudioTransactionExtractor({
  apiKey: audioTranscriptionEnvironment.apiKey,
  model: audioTranscriptionEnvironment.extractionModel,
});
const cleanupLogger = logger.child({ component: "document-capture-cleanup" });
const cleanupWorker = startDocumentCaptureSessionCleanupWorker({
  cleanup: () =>
    expirePendingDocumentCaptureSessions(databaseConnection.database),
  logger: cleanupLogger,
});
const extractionLogger = logger.child({ component: "document-extraction" });
const extractionWorker = startDocumentExtractionWorker({
  logger: extractionLogger,
  pollIntervalMilliseconds:
    documentExtractionEnvironment.pollIntervalMilliseconds,
  processNext: () =>
    processNextDocumentUpload({
      database: databaseConnection.database,
      documentStorage,
      extractor,
      leaseDurationMilliseconds:
        documentExtractionEnvironment.leaseDurationMilliseconds,
    }),
});
const audioProcessingLogger = logger.child({ component: "audio-processing" });
const audioProcessingWorker = startAudioProcessingWorker({
  logger: audioProcessingLogger,
  pollIntervalMilliseconds:
    audioTranscriptionEnvironment.pollIntervalMilliseconds,
  processNext: () =>
    processNextAudioUpload({
      database: databaseConnection.database,
      documentStorage,
      extractor: audioExtractor,
      leaseDurationMilliseconds:
        audioTranscriptionEnvironment.leaseDurationMilliseconds,
      transcriber: audioTranscriber,
    }),
});
const audioProcessingRecoveryLogger = logger.child({
  component: "audio-processing-recovery",
});
const audioProcessingRecoveryWorker =
  startAudioProcessingRecoveryWorker({
    intervalMilliseconds:
      audioTranscriptionEnvironment.recoveryIntervalMilliseconds,
    logger: audioProcessingRecoveryLogger,
    recover: () =>
      recoverExpiredAudioProcessingLeases(databaseConnection.database),
  });
const recoveryLogger = logger.child({
  component: "document-processing-recovery",
});
const recoveryWorker = startDocumentProcessingRecoveryWorker({
  intervalMilliseconds:
    documentExtractionEnvironment.recoveryIntervalMilliseconds,
  logger: recoveryLogger,
  recover: () =>
    recoverExpiredDocumentProcessingLeases(databaseConnection.database),
});

logger.info(
  {
    event: "worker.started",
    workers: [
      "audio-processing",
      "audio-processing-recovery",
      "document-capture-cleanup",
      "document-extraction",
      "document-processing-recovery",
    ],
  },
  "Worker process started",
);

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.info(
    { event: "worker.shutdown.started", signal },
    "Shutting down worker",
  );

  try {
    await Promise.all([
      audioProcessingRecoveryWorker.stop(),
      audioProcessingWorker.stop(),
      cleanupWorker.stop(),
      extractionWorker.stop(),
      recoveryWorker.stop(),
    ]);
    documentStorage.close();
    await databaseConnection.pool.end();
    logger.info(
      { event: "worker.shutdown.completed", signal },
      "Worker shut down cleanly",
    );
    logger.flush();
  } catch (error) {
    logger.error(
      { err: error, event: "worker.shutdown.failed", signal },
      "Failed to shut down worker cleanly",
    );
    logger.flush();
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
