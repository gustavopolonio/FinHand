import type { AudioProcessingRecoveryResult } from "../services/audio-transcription-recovery.js";

export interface AudioProcessingRecoveryWorkerLogger {
  debug(context: Record<string, unknown>, message: string): void;
  error(context: { err: unknown; event: string }, message: string): void;
  info(context: Record<string, unknown>, message: string): void;
}

interface StartAudioProcessingRecoveryWorkerOptions {
  intervalMilliseconds?: number;
  logger: AudioProcessingRecoveryWorkerLogger;
  recover: () => Promise<AudioProcessingRecoveryResult>;
}

export interface AudioProcessingRecoveryWorker {
  stop(): Promise<void>;
}

export function startAudioProcessingRecoveryWorker({
  intervalMilliseconds = 60_000,
  logger,
  recover,
}: StartAudioProcessingRecoveryWorkerOptions): AudioProcessingRecoveryWorker {
  if (!Number.isInteger(intervalMilliseconds) || intervalMilliseconds < 1) {
    throw new Error(
      "Audio processing recovery interval must be a positive integer.",
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
        event: "audio.processing.recovery.completed",
      };

      if (result.failedCount + result.requeuedCount === 0) {
        logger.debug(context, "Audio processing recovery completed");
      } else {
        logger.info(context, "Audio processing recovery completed");
      }
    } catch (error) {
      logger.error(
        { err: error, event: "audio.processing.recovery.failed" },
        "Audio processing recovery failed",
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
      if (timer) clearTimeout(timer);
      await activeRun;
    },
  };
}
