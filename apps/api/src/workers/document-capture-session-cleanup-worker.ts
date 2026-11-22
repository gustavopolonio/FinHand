export const documentCaptureSessionCleanupIntervalMilliseconds = 60_000;

export interface CleanupWorkerLogger {
  debug(context: Record<string, unknown>, message: string): void;
  error(context: { err: unknown; event: string }, message: string): void;
  info(context: Record<string, unknown>, message: string): void;
}

interface StartCleanupWorkerOptions {
  cleanup: () => Promise<number>;
  intervalMilliseconds?: number;
  logger: CleanupWorkerLogger;
}

export interface CleanupWorker {
  stop(): Promise<void>;
}

export function startDocumentCaptureSessionCleanupWorker({
  cleanup,
  intervalMilliseconds = documentCaptureSessionCleanupIntervalMilliseconds,
  logger,
}: StartCleanupWorkerOptions): CleanupWorker {
  if (!Number.isInteger(intervalMilliseconds) || intervalMilliseconds < 1) {
    throw new Error("Cleanup interval must be a positive integer.");
  }

  let activeRun: Promise<void>;
  let isStopped = false;
  let timer: NodeJS.Timeout | undefined;

  async function runCleanup(): Promise<void> {
    try {
      const expiredSessionCount = await cleanup();
      const context = {
        event: "document.capture.cleanup.completed",
        expiredSessionCount,
      };

      if (expiredSessionCount === 0) {
        logger.debug(context, "Document capture session cleanup completed");
      } else {
        logger.info(context, "Document capture session cleanup completed");
      }
    } catch (error) {
      logger.error(
        { err: error, event: "document.capture.cleanup.failed" },
        "Document capture session cleanup failed",
      );
    } finally {
      if (!isStopped) {
        timer = setTimeout(() => {
          activeRun = runCleanup();
        }, intervalMilliseconds);
      }
    }
  }

  activeRun = runCleanup();

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
