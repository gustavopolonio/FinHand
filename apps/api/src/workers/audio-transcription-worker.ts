import type { AudioProcessingResult } from "../services/audio-processing.js";

export interface AudioProcessingWorkerLogger {
  error(context: { errorName: string }, message: string): void;
  info(
    context: {
      uploadId: string;
      status: "transcribed" | "processed" | "failed";
      failureCode?: string;
    },
    message: string,
  ): void;
}

interface StartAudioProcessingWorkerOptions {
  logger: AudioProcessingWorkerLogger;
  pollIntervalMilliseconds?: number;
  processNext: () => Promise<AudioProcessingResult | null>;
}

export interface AudioProcessingWorker {
  stop(): Promise<void>;
}

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

export function startAudioProcessingWorker({
  logger,
  pollIntervalMilliseconds = 2_000,
  processNext,
}: StartAudioProcessingWorkerOptions): AudioProcessingWorker {
  if (
    !Number.isInteger(pollIntervalMilliseconds) ||
    pollIntervalMilliseconds < 1
  ) {
    throw new Error(
      "Audio processing poll interval must be a positive integer.",
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
        logger.info(result, "Audio processing completed");
      }
    } catch (error) {
      logger.error(
        { errorName: getErrorName(error) },
        "Audio processing worker failed",
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

      if (timer) clearTimeout(timer);

      await activeRun;
    },
  };
}
