import type { DocumentExtractionResult } from "../services/document-extraction.js";

export interface DocumentExtractionWorkerLogger {
  error(context: { err: unknown; event: string }, message: string): void;
  info(
    context: {
      durationMs: number;
      event: string;
      uploadId: string;
      status: "processed" | "failed";
      candidateCount?: number;
      failureCode?: string;
    },
    message: string,
  ): void;
  warn(
    context: {
      durationMs: number;
      event: string;
      uploadId: string;
      status: "processed" | "failed";
      candidateCount?: number;
      failureCode?: string;
    },
    message: string,
  ): void;
}

interface StartDocumentExtractionWorkerOptions {
  logger: DocumentExtractionWorkerLogger;
  pollIntervalMilliseconds?: number;
  processNext: () => Promise<DocumentExtractionResult | null>;
}

export interface DocumentExtractionWorker {
  stop(): Promise<void>;
}

export function startDocumentExtractionWorker({
  logger,
  pollIntervalMilliseconds = 2_000,
  processNext,
}: StartDocumentExtractionWorkerOptions): DocumentExtractionWorker {
  if (
    !Number.isInteger(pollIntervalMilliseconds) ||
    pollIntervalMilliseconds < 1
  ) {
    throw new Error(
      "Document extraction poll interval must be a positive integer.",
    );
  }

  let activeRun: Promise<void>;
  let isStopped = false;
  let timer: NodeJS.Timeout | undefined;

  async function run(): Promise<void> {
    let didProcessUpload = false;
    const startedAt = performance.now();

    try {
      const result = await processNext();

      if (result) {
        didProcessUpload = true;
        const context = {
          ...result,
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
          event: "document.processing.completed",
        };

        if (result.status === "failed") {
          logger.warn(context, "Document processing failed");
        } else {
          logger.info(context, "Document processing completed");
        }
      }
    } catch (error) {
      logger.error(
        { err: error, event: "document.worker.iteration.failed" },
        "Document extraction worker failed",
      );
    } finally {
      if (!isStopped) {
        timer = setTimeout(
          () => {
            activeRun = run();
          },
          didProcessUpload ? 0 : pollIntervalMilliseconds,
        );
      }
    }
  }

  activeRun = run();

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
