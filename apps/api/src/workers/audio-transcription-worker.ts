import type { AudioTranscriptionResult } from "../services/audio-transcription.js";

export interface AudioTranscriptionWorkerLogger {
  error(context: { errorName: string }, message: string): void;
  info(
    context: {
      uploadId: string;
      status: "transcribed" | "failed";
      failureCode?: string;
    },
    message: string,
  ): void;
}

interface StartAudioTranscriptionWorkerOptions {
  logger: AudioTranscriptionWorkerLogger;
  pollIntervalMilliseconds?: number;
  processNext: () => Promise<AudioTranscriptionResult | null>;
}

export interface AudioTranscriptionWorker {
  stop(): Promise<void>;
}

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

export function startAudioTranscriptionWorker({
  logger,
  pollIntervalMilliseconds = 2_000,
  processNext,
}: StartAudioTranscriptionWorkerOptions): AudioTranscriptionWorker {
  if (
    !Number.isInteger(pollIntervalMilliseconds) ||
    pollIntervalMilliseconds < 1
  ) {
    throw new Error(
      "Audio transcription poll interval must be a positive integer.",
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
        logger.info(result, "Audio transcription completed");
      }
    } catch (error) {
      logger.error(
        { errorName: getErrorName(error) },
        "Audio transcription worker failed",
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
