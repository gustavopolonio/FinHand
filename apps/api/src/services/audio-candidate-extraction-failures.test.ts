import { describe, expect, it } from "vitest";

import {
  classifyAudioCandidateExtractionFailure,
  classifyAudioCandidatePersistenceFailure,
} from "./audio-candidate-extraction-failures.js";

describe("audio candidate extraction failure classification", () => {
  it.each([
    [{ code: "ETIMEDOUT" }, "audio_candidate_extraction_timeout"],
    [{ status: 408 }, "audio_candidate_extraction_timeout"],
    [{ status: 429 }, "audio_candidate_extraction_rate_limited"],
    [{ status: 503 }, "audio_candidate_extraction_service_unavailable"],
    [{ code: "ECONNRESET" }, "audio_candidate_extraction_network_error"],
    [{ status: 401 }, "audio_candidate_extraction_authentication_failed"],
    [{ status: 400 }, "audio_candidate_extraction_request_rejected"],
    [new Error("unknown"), "audio_candidate_extraction_failed"],
  ])("classifies provider failure %#", (error, expected) => {
    expect(classifyAudioCandidateExtractionFailure(error)).toBe(expected);
  });

  it.each([
    [{ code: "40001" }, "audio_candidate_persistence_unavailable"],
    [{ code: "08006" }, "audio_candidate_persistence_unavailable"],
    [new Error("constraint failure"), "audio_candidate_persistence_failed"],
  ])("classifies persistence failure %#", (error, expected) => {
    expect(classifyAudioCandidatePersistenceFailure(error)).toBe(expected);
  });

  it("walks nested provider causes without exposing their messages", () => {
    const error = new Error("outer private detail", {
      cause: Object.assign(new Error("inner private detail"), { status: 429 }),
    });

    expect(classifyAudioCandidateExtractionFailure(error)).toBe(
      "audio_candidate_extraction_rate_limited",
    );
  });
});
