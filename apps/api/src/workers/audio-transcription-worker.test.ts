import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type AudioProcessingWorkerLogger,
  startAudioProcessingWorker,
} from "./audio-transcription-worker.js";

const uploadId = "44444444-4444-4444-8444-444444444444";

function createLogger(): AudioProcessingWorkerLogger {
  return { error: vi.fn(), info: vi.fn() };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("audio processing worker", () => {
  it("waits for the poll interval when the queue is empty", async () => {
    vi.useFakeTimers();
    const processNext = vi.fn().mockResolvedValue(null);
    const worker = startAudioProcessingWorker({
      logger: createLogger(),
      pollIntervalMilliseconds: 1_000,
      processNext,
    });

    await vi.waitFor(() => expect(processNext).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(999);
    expect(processNext).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(processNext).toHaveBeenCalledTimes(2);

    await worker.stop();
  });

  it("immediately claims another upload after completing a stage", async () => {
    vi.useFakeTimers();
    const result = { uploadId, status: "transcribed" as const };
    const processNext = vi
      .fn()
      .mockResolvedValueOnce(result)
      .mockResolvedValue(null);
    const logger = createLogger();
    const worker = startAudioProcessingWorker({
      logger,
      pollIntervalMilliseconds: 1_000,
      processNext,
    });

    await vi.waitFor(() => expect(processNext).toHaveBeenCalledOnce());
    expect(logger.info).toHaveBeenCalledWith(
      result,
      "Audio processing completed",
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(processNext).toHaveBeenCalledTimes(2);

    await worker.stop();
  });

  it("does not overlap audio processing runs", async () => {
    vi.useFakeTimers();
    let finish: ((value: null) => void) | undefined;
    const processing = new Promise<null>((resolve) => {
      finish = resolve;
    });
    const processNext = vi.fn().mockReturnValue(processing);
    const worker = startAudioProcessingWorker({
      logger: createLogger(),
      pollIntervalMilliseconds: 1_000,
      processNext,
    });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(processNext).toHaveBeenCalledOnce();
    finish?.(null);
    await processing;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(processNext).toHaveBeenCalledTimes(2);

    finish?.(null);
    await worker.stop();
  });

  it("logs only a safe error name and continues", async () => {
    vi.useFakeTimers();
    const processNext = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("private provider detail"))
      .mockResolvedValue(null);
    const logger = createLogger();
    const worker = startAudioProcessingWorker({
      logger,
      pollIntervalMilliseconds: 1_000,
      processNext,
    });

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        { errorName: "TypeError" },
        "Audio processing worker failed",
      ),
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      "private provider detail",
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(processNext).toHaveBeenCalledTimes(2);

    await worker.stop();
  });

  it("waits for an active run while stopping", async () => {
    let finish: (() => void) | undefined;
    const processing = new Promise<null>((resolve) => {
      finish = () => resolve(null);
    });
    const processNext = vi.fn().mockReturnValue(processing);
    const worker = startAudioProcessingWorker({
      logger: createLogger(),
      processNext,
    });

    let stopped = false;
    const stopping = worker.stop().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    finish?.();
    await stopping;
    expect(processNext).toHaveBeenCalledOnce();
  });

  it("rejects an invalid poll interval", () => {
    expect(() =>
      startAudioProcessingWorker({
        logger: createLogger(),
        pollIntervalMilliseconds: 0,
        processNext: vi.fn(),
      }),
    ).toThrow(
      "Audio processing poll interval must be a positive integer.",
    );
  });
});
