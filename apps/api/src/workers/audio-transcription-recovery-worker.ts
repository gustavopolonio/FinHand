import type { AudioTranscriptionRecoveryResult } from "../services/audio-transcription-recovery.js";

export interface AudioTranscriptionRecoveryWorkerLogger {
  error(error: unknown, message: string): void;
  info(context: AudioTranscriptionRecoveryResult, message: string): void;
}

interface StartAudioTranscriptionRecoveryWorkerOptions {
  intervalMilliseconds?: number;
  logger: AudioTranscriptionRecoveryWorkerLogger;
  recover: () => Promise<AudioTranscriptionRecoveryResult>;
}

export interface AudioTranscriptionRecoveryWorker {
  stop(): Promise<void>;
}

export function startAudioTranscriptionRecoveryWorker({
  intervalMilliseconds = 60_000,
  logger,
  recover,
}: StartAudioTranscriptionRecoveryWorkerOptions): AudioTranscriptionRecoveryWorker {
  if (!Number.isInteger(intervalMilliseconds) || intervalMilliseconds < 1) {
    throw new Error(
      "Audio transcription recovery interval must be a positive integer.",
    );
  }

  let activeRun: Promise<void>;
  let isStopped = false;
  let timer: NodeJS.Timeout | undefined;

  async function runRecovery(): Promise<void> {
    try {
      const result = await recover();
      logger.info(result, "Audio transcription recovery completed");
    } catch (error) {
      logger.error(error, "Audio transcription recovery failed");
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
