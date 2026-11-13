import type { DocumentProcessingRecoveryResult } from "../services/document-processing-recovery.js";

export const documentProcessingRecoveryIntervalMilliseconds = 60_000;

export interface DocumentProcessingRecoveryWorkerLogger {
  error(error: unknown, message: string): void;
  info(context: DocumentProcessingRecoveryResult, message: string): void;
}

interface StartDocumentProcessingRecoveryWorkerOptions {
  intervalMilliseconds?: number;
  logger: DocumentProcessingRecoveryWorkerLogger;
  recover: () => Promise<DocumentProcessingRecoveryResult>;
}

export interface DocumentProcessingRecoveryWorker {
  stop(): Promise<void>;
}

export function startDocumentProcessingRecoveryWorker(
  {
    intervalMilliseconds = documentProcessingRecoveryIntervalMilliseconds,
    logger,
    recover,
  }: StartDocumentProcessingRecoveryWorkerOptions,
): DocumentProcessingRecoveryWorker {
  if (!Number.isInteger(intervalMilliseconds) || intervalMilliseconds < 1) {
    throw new Error(
      "Document processing recovery interval must be a positive integer.",
    );
  }

  let activeRun: Promise<void>;
  let isStopped = false;
  let timer: NodeJS.Timeout | undefined;

  async function runRecovery(): Promise<void> {
    try {
      const result = await recover();
      logger.info(result, "Document processing recovery completed");
    } catch (error) {
      logger.error(error, "Document processing recovery failed");
    } finally {
      if (!isStopped) {
        timer = setTimeout(() => {
          activeRun = runRecovery();
        }, intervalMilliseconds);
      }
    }
  }

  activeRun = runRecovery();

  return {
    async stop() {
      isStopped = true;

      if (timer) {
        clearTimeout(timer);
      }

      await activeRun;
    },
  };
}
