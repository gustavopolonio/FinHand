import { afterEach, describe, expect, it, vi } from "vitest";

import type { DocumentCaptureSessionProgress } from "@/lib/api";

import {
  shouldContinueCaptureSessionPolling,
  startCaptureSessionPolling,
} from "./capture-session-polling";

const pendingProgress: DocumentCaptureSessionProgress = {
  id: "session-id",
  status: "pending",
  expiresAt: "2026-11-09T15:05:00.000Z",
  upload: null,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("capture session polling", () => {
  it.each([
    { status: "pending", uploadStatus: null, expected: true },
    { status: "consumed", uploadStatus: "uploaded", expected: false },
    { status: "consumed", uploadStatus: "processing", expected: true },
    { status: "consumed", uploadStatus: "processed", expected: false },
    { status: "consumed", uploadStatus: "failed", expected: false },
    { status: "expired", uploadStatus: null, expected: false },
    { status: "cancelled", uploadStatus: null, expected: false },
  ] as const)(
    "returns $expected for $status/$uploadStatus",
    ({ status, uploadStatus, expected }) => {
      expect(
        shouldContinueCaptureSessionPolling({
          ...pendingProgress,
          status,
          upload: uploadStatus
            ? { id: "upload-id", status: uploadStatus }
            : null,
        }),
      ).toBe(expected);
    },
  );

  it("polls without overlapping and stops at a terminal state", async () => {
    vi.useFakeTimers();
    let finishFirstRead:
      | ((progress: DocumentCaptureSessionProgress) => void)
      | undefined;
    const firstRead = new Promise<DocumentCaptureSessionProgress>((resolve) => {
      finishFirstRead = resolve;
    });
    const processedProgress: DocumentCaptureSessionProgress = {
      ...pendingProgress,
      status: "consumed",
      upload: { id: "upload-id", status: "processed" },
    };
    const readProgress = vi
      .fn()
      .mockReturnValueOnce(firstRead)
      .mockResolvedValueOnce(processedProgress);
    const onProgress = vi.fn();
    const polling = startCaptureSessionPolling({
      intervalMilliseconds: 2_000,
      onProgress,
      readProgress,
    });

    await vi.advanceTimersByTimeAsync(6_000);
    expect(readProgress).toHaveBeenCalledOnce();

    finishFirstRead?.(pendingProgress);
    await firstRead;
    expect(onProgress).toHaveBeenCalledWith(pendingProgress);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(readProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenLastCalledWith(processedProgress);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(readProgress).toHaveBeenCalledTimes(2);
    polling.stop();
  });

  it("retries after an unavailable progress response and stops cleanly", async () => {
    vi.useFakeTimers();
    const readProgress = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingProgress);
    const onProgress = vi.fn();
    const polling = startCaptureSessionPolling({
      intervalMilliseconds: 2_000,
      onProgress,
      readProgress,
    });

    await vi.advanceTimersByTimeAsync(2_000);
    expect(onProgress).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onProgress).toHaveBeenCalledWith(pendingProgress);

    polling.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(readProgress).toHaveBeenCalledTimes(2);
  });

  it("retries after an unexpected request rejection", async () => {
    vi.useFakeTimers();
    const readProgress = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(pendingProgress);
    const onProgress = vi.fn();
    const polling = startCaptureSessionPolling({
      intervalMilliseconds: 2_000,
      onProgress,
      readProgress,
    });

    await vi.advanceTimersByTimeAsync(4_000);
    expect(readProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith(pendingProgress);

    polling.stop();
  });
});
