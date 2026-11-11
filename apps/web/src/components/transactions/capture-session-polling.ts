import type { DocumentCaptureSessionProgress } from "@/lib/api";

export const captureStatusPollingIntervalMilliseconds = 2_000;

export function shouldContinueCaptureSessionPolling(
  progress: DocumentCaptureSessionProgress,
): boolean {
  if (progress.status === "pending") return true;
  if (progress.status !== "consumed") return false;

  return (
    progress.upload?.status === "pending" ||
    progress.upload?.status === "uploaded" ||
    progress.upload?.status === "processing"
  );
}

interface StartCaptureSessionPollingOptions {
  intervalMilliseconds?: number;
  onProgress: (progress: DocumentCaptureSessionProgress) => void;
  readProgress: () => Promise<DocumentCaptureSessionProgress | null>;
}

export function startCaptureSessionPolling({
  intervalMilliseconds = captureStatusPollingIntervalMilliseconds,
  onProgress,
  readProgress,
}: StartCaptureSessionPollingOptions) {
  let isStopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const scheduleNextPoll = () => {
    timeoutId = setTimeout(poll, intervalMilliseconds);
  };

  const poll = async () => {
    let progress: DocumentCaptureSessionProgress | null;

    try {
      progress = await readProgress();
    } catch {
      if (!isStopped) scheduleNextPoll();
      return;
    }

    if (isStopped) return;

    if (!progress) {
      scheduleNextPoll();
      return;
    }

    onProgress(progress);

    if (shouldContinueCaptureSessionPolling(progress)) {
      scheduleNextPoll();
    }
  };

  scheduleNextPoll();

  return {
    stop() {
      isStopped = true;

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    },
  };
}
