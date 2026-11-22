import type { DocumentProcessingRecoveryResult } from "../services/document-processing-recovery.js";

export const documentProcessingRecoveryIntervalMilliseconds = 60_000;

export interface DocumentProcessingRecoveryWorkerLogger {
  debug(context: Record<string, unknown>, message: string): void;
  error(context: { err: unknown; event: string }, message: string): void;
  info(context: Record<string, unknown>, message: string): void;
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
      const context = {
        ...result,
        event: "document.processing.recovery.completed",
      };

      if (result.failedCount + result.requeuedCount === 0) {
        logger.debug(context, "Document processing recovery completed");
      } else {
        logger.info(context, "Document processing recovery completed");
      }
    } catch (error) {
      logger.error(
        { err: error, event: "document.processing.recovery.failed" },
        "Document processing recovery failed",
      );
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
