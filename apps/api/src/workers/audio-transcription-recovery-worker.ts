import type { AudioProcessingRecoveryResult } from "../services/audio-transcription-recovery.js";

export interface AudioProcessingRecoveryWorkerLogger {
  error(error: unknown, message: string): void;
  info(context: AudioProcessingRecoveryResult, message: string): void;
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
      logger.info(result, "Audio processing recovery completed");
    } catch (error) {
      logger.error(error, "Audio processing recovery failed");
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
