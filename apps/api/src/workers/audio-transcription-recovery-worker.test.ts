import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type AudioProcessingRecoveryWorkerLogger,
  startAudioProcessingRecoveryWorker,
} from "./audio-transcription-recovery-worker.js";

function createLogger(): AudioProcessingRecoveryWorkerLogger {
  return { error: vi.fn(), info: vi.fn() };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("audio processing recovery worker", () => {
  it("runs immediately and repeats after the configured interval", async () => {
    vi.useFakeTimers();
    const result = { failedCount: 0, requeuedCount: 1 };
    const recover = vi.fn().mockResolvedValue(result);
    const logger = createLogger();
    const worker = startAudioProcessingRecoveryWorker({
      intervalMilliseconds: 1_000,
      logger,
      recover,
    });

    await vi.waitFor(() => expect(recover).toHaveBeenCalledOnce());
    expect(logger.info).toHaveBeenCalledWith(
      result,
      "Audio processing recovery completed",
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(recover).toHaveBeenCalledTimes(2);

    await worker.stop();
  });

  it("logs a recovery failure and keeps scheduling runs", async () => {
    vi.useFakeTimers();
    const error = new Error("database unavailable");
    const recover = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ failedCount: 0, requeuedCount: 0 });
    const logger = createLogger();
    const worker = startAudioProcessingRecoveryWorker({
      intervalMilliseconds: 1_000,
      logger,
      recover,
    });

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        error,
        "Audio processing recovery failed",
      ),
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(recover).toHaveBeenCalledTimes(2);

    await worker.stop();
  });

  it("rejects an invalid interval", () => {
    expect(() =>
      startAudioProcessingRecoveryWorker({
        intervalMilliseconds: 0,
        logger: createLogger(),
        recover: vi.fn(),
      }),
    ).toThrow(
      "Audio processing recovery interval must be a positive integer.",
    );
  });
});
