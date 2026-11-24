import type { DocumentCaptureSessionProgress } from "@/lib/api";

export function isCaptureSessionProcessing(
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
