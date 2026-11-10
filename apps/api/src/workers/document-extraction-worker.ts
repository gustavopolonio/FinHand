import type { DocumentExtractionResult } from "../services/document-extraction.js";

export interface DocumentExtractionWorkerLogger {
  error(context: { errorName: string }, message: string): void;
  info(
    context: {
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

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
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

    try {
      const result = await processNext();

      if (result) {
        didProcessUpload = true;
        logger.info(result, "Document extraction completed");
      }
    } catch (error) {
      logger.error(
        { errorName: getErrorName(error) },
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
