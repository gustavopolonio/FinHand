import type { AudioProcessingResult } from "../services/audio-processing.js";

export interface AudioProcessingWorkerLogger {
  error(context: { err: unknown; event: string }, message: string): void;
  info(
    context: {
      durationMs: number;
      event: string;
      uploadId: string;
      status: "transcribed" | "processed" | "failed";
      failureCode?: string;
    },
    message: string,
  ): void;
  warn(
    context: {
      durationMs: number;
      event: string;
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
    const startedAt = performance.now();

    try {
      const result = await processNext();

      if (result) {
        didProcessUpload = true;
        const context = {
          ...result,
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
          event: "audio.processing.completed",
        };

        if (result.status === "failed") {
          logger.warn(context, "Audio processing failed");
        } else {
          logger.info(context, "Audio processing completed");
        }
      }
    } catch (error) {
      logger.error(
        { err: error, event: "audio.worker.iteration.failed" },
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
