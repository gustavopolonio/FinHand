import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type DocumentExtractionWorkerLogger,
  startDocumentExtractionWorker,
} from "./document-extraction-worker.js";

const uploadId = "44444444-4444-4444-8444-444444444444";

function createLogger(): DocumentExtractionWorkerLogger {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("document extraction worker", () => {
  it("polls again after the idle interval when the queue is empty", async () => {
    vi.useFakeTimers();
    const processNext = vi.fn().mockResolvedValue(null);
    const worker = startDocumentExtractionWorker({
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

  it("immediately claims another job after processing an upload", async () => {
    vi.useFakeTimers();
    const result = {
      uploadId,
      status: "processed" as const,
      candidateCount: 2,
    };
    const processNext = vi
      .fn()
      .mockResolvedValueOnce(result)
      .mockResolvedValue(null);
    const logger = createLogger();
    const worker = startDocumentExtractionWorker({
      logger,
      pollIntervalMilliseconds: 1_000,
      processNext,
    });

    await vi.waitFor(() => expect(processNext).toHaveBeenCalledOnce());
    expect(logger.info).toHaveBeenCalledWith(
      {
        ...result,
        durationMs: expect.any(Number),
        event: "document.processing.completed",
      },
      "Document processing completed",
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(processNext).toHaveBeenCalledTimes(2);

    await worker.stop();
  });

  it("never overlaps extraction executions", async () => {
    vi.useFakeTimers();
    let finishProcessing:
      | ((value: { uploadId: string; status: "processed" }) => void)
      | undefined;
    const processing = new Promise<{
      uploadId: string;
      status: "processed";
    }>((resolve) => {
      finishProcessing = resolve;
    });
    const processNext = vi.fn().mockReturnValue(processing);
    const worker = startDocumentExtractionWorker({
      logger: createLogger(),
      pollIntervalMilliseconds: 1_000,
      processNext,
    });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(processNext).toHaveBeenCalledOnce();

    finishProcessing?.({ uploadId, status: "processed" });
    await processing;
    await vi.advanceTimersByTimeAsync(0);
    expect(processNext).toHaveBeenCalledTimes(2);

    finishProcessing?.({ uploadId, status: "processed" });
    await worker.stop();
  });

  it("logs an unexpected failure for safe serialization and continues polling", async () => {
    vi.useFakeTimers();
    const processNext = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("sensitive provider detail"))
      .mockResolvedValue(null);
    const logger = createLogger();
    const worker = startDocumentExtractionWorker({
      logger,
      pollIntervalMilliseconds: 1_000,
      processNext,
    });

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(
        {
          err: expect.any(TypeError),
          event: "document.worker.iteration.failed",
        },
        "Document extraction worker failed",
      ),
    );

    await vi.advanceTimersByTimeAsync(1_000);
    expect(processNext).toHaveBeenCalledTimes(2);

    await worker.stop();
  });

  it("logs failed processing results as warnings", async () => {
    vi.useFakeTimers();
    const result = {
      uploadId,
      status: "failed" as const,
      failureCode: "provider_unavailable",
    };
    const logger = createLogger();
    const worker = startDocumentExtractionWorker({
      logger,
      pollIntervalMilliseconds: 1_000,
      processNext: vi.fn().mockResolvedValueOnce(result).mockResolvedValue(null),
    });

    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledOnce());
    expect(logger.warn).toHaveBeenCalledWith(
      {
        ...result,
        durationMs: expect.any(Number),
        event: "document.processing.completed",
      },
      "Document processing failed",
    );

    await worker.stop();
  });

  it("waits for active processing and prevents future claims when stopped", async () => {
    let finishProcessing: (() => void) | undefined;
    const processing = new Promise<null>((resolve) => {
      finishProcessing = () => resolve(null);
    });
    const processNext = vi.fn().mockReturnValue(processing);
    const worker = startDocumentExtractionWorker({
      logger: createLogger(),
      processNext,
    });

    let didStop = false;
    const stopping = worker.stop().then(() => {
      didStop = true;
    });
    await Promise.resolve();
    expect(didStop).toBe(false);

    finishProcessing?.();
    await stopping;
    expect(processNext).toHaveBeenCalledOnce();
  });

  it("rejects an invalid poll interval", () => {
    expect(() =>
      startDocumentExtractionWorker({
        logger: createLogger(),
        pollIntervalMilliseconds: 0,
        processNext: vi.fn(),
      }),
    ).toThrow(
      "Document extraction poll interval must be a positive integer.",
    );
  });
});
