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
import { processNextAudioUpload } from "./services/audio-processing.js";
import { recoverExpiredAudioProcessingLeases } from "./services/audio-transcription-recovery.js";
import { expirePendingDocumentCaptureSessions } from "./services/document-capture-session-cleanup.js";
import { processNextDocumentUpload } from "./services/document-extraction.js";
import {
  type AudioProcessingWorkerLogger,
  startAudioProcessingWorker,
} from "./workers/audio-transcription-worker.js";
import {
  type AudioProcessingRecoveryWorkerLogger,
  startAudioProcessingRecoveryWorker,
} from "./workers/audio-transcription-recovery-worker.js";
import {
  recoverExpiredDocumentProcessingLeases,
} from "./services/document-processing-recovery.js";
import { createS3DocumentStorage } from "./storage/document-storage.js";
import {
  type CleanupWorkerLogger,
  startDocumentCaptureSessionCleanupWorker,
} from "./workers/document-capture-session-cleanup-worker.js";
import {
  type DocumentExtractionWorkerLogger,
  startDocumentExtractionWorker,
} from "./workers/document-extraction-worker.js";
import {
  type DocumentProcessingRecoveryWorkerLogger,
  startDocumentProcessingRecoveryWorker,
} from "./workers/document-processing-recovery-worker.js";

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
      leaseDurationMilliseconds:
        documentExtractionEnvironment.leaseDurationMilliseconds,
    }),
});
const audioProcessingLogger: AudioProcessingWorkerLogger = {
  error(context, message) {
    console.error(message, context);
  },
  info(context, message) {
    console.info(message, context);
  },
};
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
const audioProcessingRecoveryLogger: AudioProcessingRecoveryWorkerLogger = {
  error(error, message) {
    console.error(message, error);
  },
  info(context, message) {
    console.info(message, context);
  },
};
const audioProcessingRecoveryWorker =
  startAudioProcessingRecoveryWorker({
    intervalMilliseconds:
      audioTranscriptionEnvironment.recoveryIntervalMilliseconds,
    logger: audioProcessingRecoveryLogger,
    recover: () =>
      recoverExpiredAudioProcessingLeases(databaseConnection.database),
  });
const recoveryLogger: DocumentProcessingRecoveryWorkerLogger = {
  error(error, message) {
    console.error(message, error);
  },
  info(context, message) {
    console.info(message, context);
  },
};
const recoveryWorker = startDocumentProcessingRecoveryWorker({
  intervalMilliseconds:
    documentExtractionEnvironment.recoveryIntervalMilliseconds,
  logger: recoveryLogger,
  recover: () =>
    recoverExpiredDocumentProcessingLeases(databaseConnection.database),
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.info("Shutting down worker", { signal });

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
  } catch (error) {
    console.error("Failed to shut down worker cleanly", error);
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
