import { describe, expect, it } from "vitest";

import {
  classifyAudioDownloadFailure,
  classifyAudioTranscriptionFailure,
  classifyTranscriptPersistenceFailure,
} from "./audio-transcription-failures.js";

describe("audio transcription failure classification", () => {
  it.each([
    [{ code: "ETIMEDOUT" }, "audio_download_timeout"],
    [{ name: "NoSuchKey" }, "audio_not_found"],
    [{ status: 403 }, "audio_access_denied"],
    [{ code: "ECONNRESET" }, "audio_storage_unavailable"],
    [new Error("invalid object"), "audio_download_failed"],
  ])("classifies an S3 failure", (error, expectedCode) => {
    expect(classifyAudioDownloadFailure(error)).toBe(expectedCode);
  });

  it.each([
    [{ name: "TimeoutError" }, "transcription_timeout"],
    [{ status: 429 }, "transcription_rate_limited"],
    [{ status: 401 }, "transcription_authentication_failed"],
    [{ status: 503 }, "transcription_service_unavailable"],
    [{ code: "EAI_AGAIN" }, "transcription_network_error"],
    [{ status: 400 }, "transcription_request_rejected"],
    [new Error("unknown"), "transcription_failed"],
  ])("classifies an OpenAI failure", (error, expectedCode) => {
    expect(classifyAudioTranscriptionFailure(error)).toBe(expectedCode);
  });

  it("distinguishes transient database failures", () => {
    expect(classifyTranscriptPersistenceFailure({ code: "40001" })).toBe(
      "transcript_persistence_unavailable",
    );
    expect(classifyTranscriptPersistenceFailure(new Error("constraint"))).toBe(
      "transcript_persistence_failed",
    );
  });
});
