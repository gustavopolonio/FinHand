import { describe, expect, it } from "vitest";

import {
  calculateVoiceInputLevel,
  formatVoiceRecordingDuration,
  maximumVoiceRecordingSeconds,
  microphoneErrorMessage,
  selectVoiceRecordingMimeType,
  voiceRecordingDurationMilliseconds,
  voiceRecordingElapsedSeconds,
} from "./voice-recording";

describe("voice recording utilities", () => {
  it("selects the first browser-supported audio format", () => {
    expect(
      selectVoiceRecordingMimeType(
        (mimeType) => mimeType === "audio/mp4",
      ),
    ).toBe("audio/mp4");
    expect(selectVoiceRecordingMimeType(() => false)).toBeNull();
  });

  it("measures and clamps elapsed recording time to 30 seconds", () => {
    expect(voiceRecordingElapsedSeconds(1_000, 1_999)).toBe(0);
    expect(voiceRecordingElapsedSeconds(1_000, 6_500)).toBe(5);
    expect(voiceRecordingElapsedSeconds(1_000, 45_000)).toBe(
      maximumVoiceRecordingSeconds,
    );
    expect(voiceRecordingElapsedSeconds(2_000, 1_000)).toBe(0);
  });

  it("does not add paused time to the recorded duration", () => {
    expect(voiceRecordingDurationMilliseconds(7_500, null, 50_000)).toBe(
      7_500,
    );
    expect(voiceRecordingDurationMilliseconds(7_500, 20_000, 22_500)).toBe(
      10_000,
    );
  });

  it("formats a bounded recording timer", () => {
    expect(formatVoiceRecordingDuration(0)).toBe("00:00");
    expect(formatVoiceRecordingDuration(7)).toBe("00:07");
    expect(formatVoiceRecordingDuration(45)).toBe("00:30");
  });

  it("distinguishes silence from audible microphone input", () => {
    expect(calculateVoiceInputLevel(new Uint8Array([128, 128, 128]))).toBe(0);
    expect(calculateVoiceInputLevel(new Uint8Array([96, 160, 96, 160]))).toBe(
      1,
    );
    expect(calculateVoiceInputLevel(new Uint8Array())).toBe(0);
  });

  it("returns safe microphone permission and device errors", () => {
    expect(
      microphoneErrorMessage(
        new DOMException("Browser details", "NotAllowedError"),
      ),
    ).toContain("Microphone access was denied");
    expect(
      microphoneErrorMessage(new DOMException("Browser details", "NotFoundError")),
    ).toBe("No microphone was found on this device.");
    expect(microphoneErrorMessage(new Error("sensitive details"))).not.toContain(
      "sensitive details",
    );
  });
});
