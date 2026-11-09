import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type CleanupWorkerLogger,
  startDocumentCaptureSessionCleanupWorker,
} from "./document-capture-session-cleanup-worker.js";

function createLogger(): CleanupWorkerLogger {
  return {
    error: vi.fn(),
    info: vi.fn(),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("document capture session cleanup worker", () => {
  it("runs immediately and then waits until the configured interval", async () => {
    vi.useFakeTimers();
    const cleanup = vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    const logger = createLogger();
    const worker = startDocumentCaptureSessionCleanupWorker({
      cleanup,
      intervalMilliseconds: 1_000,
      logger,
    });

    await vi.waitFor(() => expect(cleanup).toHaveBeenCalledTimes(1));
    expect(logger.info).toHaveBeenCalledWith(
      { expiredSessionCount: 2 },
      "Document capture session cleanup completed",
    );

    await vi.advanceTimersByTimeAsync(999);
    expect(cleanup).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(cleanup).toHaveBeenCalledTimes(2);

    await worker.stop();
  });

  it("never overlaps cleanup executions", async () => {
    vi.useFakeTimers();
    let finishFirstCleanup: ((count: number) => void) | undefined;
    const firstCleanup = new Promise<number>((resolve) => {
      finishFirstCleanup = resolve;
    });
    const cleanup = vi
      .fn()
      .mockReturnValueOnce(firstCleanup)
      .mockResolvedValue(0);
    const worker = startDocumentCaptureSessionCleanupWorker({
      cleanup,
      intervalMilliseconds: 1_000,
      logger: createLogger(),
    });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(cleanup).toHaveBeenCalledTimes(1);

    finishFirstCleanup?.(1);
    await firstCleanup;
    await vi.advanceTimersByTimeAsync(999);
    expect(cleanup).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(cleanup).toHaveBeenCalledTimes(2);

    await worker.stop();
  });

  it("logs failures and continues running", async () => {
    vi.useFakeTimers();
    const error = new Error("database unavailable");
    const cleanup = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(3);
    const logger = createLogger();
    const worker = startDocumentCaptureSessionCleanupWorker({
      cleanup,
      intervalMilliseconds: 1_000,
      logger,
    });

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        error,
        "Document capture session cleanup failed",
      ),
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      { expiredSessionCount: 3 },
      "Document capture session cleanup completed",
    );

    await worker.stop();
  });

  it("waits for an active cleanup and prevents future executions when stopped", async () => {
    vi.useFakeTimers();
    let finishCleanup: ((count: number) => void) | undefined;
    const cleanupResult = new Promise<number>((resolve) => {
      finishCleanup = resolve;
    });
    const cleanup = vi.fn().mockReturnValue(cleanupResult);
    const worker = startDocumentCaptureSessionCleanupWorker({
      cleanup,
      intervalMilliseconds: 1_000,
      logger: createLogger(),
    });

    let didStop = false;
    const stopping = worker.stop().then(() => {
      didStop = true;
    });
    await Promise.resolve();
    expect(didStop).toBe(false);

    finishCleanup?.(0);
    await stopping;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid intervals", () => {
    expect(() =>
      startDocumentCaptureSessionCleanupWorker({
        cleanup: vi.fn(),
        intervalMilliseconds: 0,
        logger: createLogger(),
      }),
    ).toThrow("Cleanup interval must be a positive integer.");
  });
});
