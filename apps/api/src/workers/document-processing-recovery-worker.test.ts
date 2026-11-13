import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type DocumentProcessingRecoveryWorkerLogger,
  startDocumentProcessingRecoveryWorker,
} from "./document-processing-recovery-worker.js";

function createLogger(): DocumentProcessingRecoveryWorkerLogger {
  return { error: vi.fn(), info: vi.fn() };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("document processing recovery worker", () => {
  it("runs immediately and repeats after the configured interval", async () => {
    vi.useFakeTimers();
    const recover = vi
      .fn()
      .mockResolvedValueOnce({ failedCount: 1, requeuedCount: 2 })
      .mockResolvedValue({ failedCount: 0, requeuedCount: 0 });
    const logger = createLogger();
    const worker = startDocumentProcessingRecoveryWorker({
      intervalMilliseconds: 1_000,
      logger,
      recover,
    });

    await vi.waitFor(() => expect(recover).toHaveBeenCalledOnce());
    expect(logger.info).toHaveBeenCalledWith(
      { failedCount: 1, requeuedCount: 2 },
      "Document processing recovery completed",
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(recover).toHaveBeenCalledTimes(2);

    await worker.stop();
  });

  it("does not overlap recovery executions", async () => {
    vi.useFakeTimers();
    let finishRecovery:
      | ((result: { failedCount: number; requeuedCount: number }) => void)
      | undefined;
    const activeRecovery = new Promise<{
      failedCount: number;
      requeuedCount: number;
    }>((resolve) => {
      finishRecovery = resolve;
    });
    const recover = vi.fn().mockReturnValue(activeRecovery);
    const worker = startDocumentProcessingRecoveryWorker({
      intervalMilliseconds: 1_000,
      logger: createLogger(),
      recover,
    });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(recover).toHaveBeenCalledOnce();

    finishRecovery?.({ failedCount: 0, requeuedCount: 1 });
    await activeRecovery;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(recover).toHaveBeenCalledTimes(2);

    await worker.stop();
  });

  it("logs a failure and continues running", async () => {
    vi.useFakeTimers();
    const error = new Error("database unavailable");
    const recover = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ failedCount: 0, requeuedCount: 1 });
    const logger = createLogger();
    const worker = startDocumentProcessingRecoveryWorker({
      intervalMilliseconds: 1_000,
      logger,
      recover,
    });

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        error,
        "Document processing recovery failed",
      ),
    );
    await vi.advanceTimersByTimeAsync(1_000);
    expect(recover).toHaveBeenCalledTimes(2);

    await worker.stop();
  });

  it("waits for active recovery before stopping", async () => {
    let finishRecovery:
      | ((result: { failedCount: number; requeuedCount: number }) => void)
      | undefined;
    const activeRecovery = new Promise<{
      failedCount: number;
      requeuedCount: number;
    }>((resolve) => {
      finishRecovery = resolve;
    });
    const recover = vi.fn().mockReturnValue(activeRecovery);
    const worker = startDocumentProcessingRecoveryWorker({
      logger: createLogger(),
      recover,
    });

    let didStop = false;
    const stopping = worker.stop().then(() => {
      didStop = true;
    });
    await Promise.resolve();
    expect(didStop).toBe(false);

    finishRecovery?.({ failedCount: 0, requeuedCount: 0 });
    await stopping;
    expect(recover).toHaveBeenCalledOnce();
  });

  it("rejects an invalid interval", () => {
    expect(() =>
      startDocumentProcessingRecoveryWorker({
        intervalMilliseconds: 0,
        logger: createLogger(),
        recover: vi.fn(),
      }),
    ).toThrow(
      "Document processing recovery interval must be a positive integer.",
    );
  });
});
