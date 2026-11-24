import { describe, expect, it } from "vitest";

import type { DocumentCaptureSessionProgress } from "@/lib/api";

import { isCaptureSessionProcessing } from "./capture-session-status";

function progress(
  status: DocumentCaptureSessionProgress["status"],
  uploadStatus?: NonNullable<
    DocumentCaptureSessionProgress["upload"]
  >["status"],
): DocumentCaptureSessionProgress {
  return {
    id: "session-id",
    status,
    expiresAt: "2026-11-08T12:05:00.000Z",
    upload: uploadStatus ? { id: "upload-id", status: uploadStatus } : null,
  };
}

describe("capture session status", () => {
  it.each([
    [progress("pending"), true],
    [progress("consumed", "pending"), true],
    [progress("consumed", "uploaded"), true],
    [progress("consumed", "processing"), true],
    [progress("consumed", "processed"), false],
    [progress("consumed", "failed"), false],
    [progress("expired"), false],
    [progress("cancelled"), false],
  ])("identifies whether processing is active", (value, expected) => {
    expect(isCaptureSessionProcessing(value)).toBe(expected);
  });
});
