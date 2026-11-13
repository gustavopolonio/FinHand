import { describe, expect, it } from "vitest";

import {
  classifyCandidatePersistenceFailure,
  classifyDocumentDownloadFailure,
  classifyDocumentExtractionFailure,
  getDocumentProcessingFailure,
  maximumDocumentProcessingAttempts,
} from "./document-processing-failures.js";

describe("document processing failure policies", () => {
  it.each([
    [{ name: "TimeoutError" }, "document_download_timeout"],
    [
      { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } },
      "document_not_found",
    ],
    [
      { name: "AccessDenied", $metadata: { httpStatusCode: 403 } },
      "document_access_denied",
    ],
    [{ code: "ECONNRESET" }, "document_storage_unavailable"],
    [{ $metadata: { httpStatusCode: 503 } }, "document_storage_unavailable"],
    [new Error("unknown"), "document_download_failed"],
  ])("classifies storage error %#", (error, expectedCode) => {
    expect(classifyDocumentDownloadFailure(error)).toBe(expectedCode);
  });

  it.each([
    [{ name: "AbortError" }, "ai_timeout"],
    [{ status: 429 }, "ai_rate_limited"],
    [{ status: 401 }, "ai_authentication_failed"],
    [{ status: 503 }, "ai_service_unavailable"],
    [{ code: "EAI_AGAIN" }, "ai_network_error"],
    [{ status: 422 }, "ai_request_rejected"],
    [new Error("invalid structured response"), "document_extraction_failed"],
  ])("classifies extraction error %#", (error, expectedCode) => {
    expect(classifyDocumentExtractionFailure(error)).toBe(expectedCode);
  });

  it("reads error status and codes from nested causes", () => {
    const error = new Error("wrapped", {
      cause: { code: "ETIMEDOUT" },
    });

    expect(classifyDocumentExtractionFailure(error)).toBe("ai_timeout");
  });

  it.each([
    [{ code: "08006" }, "candidate_persistence_unavailable"],
    [{ code: "40001" }, "candidate_persistence_unavailable"],
    [{ code: "23505" }, "candidate_persistence_failed"],
  ])("classifies persistence error %#", (error, expectedCode) => {
    expect(classifyCandidatePersistenceFailure(error)).toBe(expectedCode);
  });

  it("allows retrying transient failures below the attempt limit", () => {
    expect(getDocumentProcessingFailure("ai_timeout", 1)).toEqual({
      code: "ai_timeout",
      canRetry: true,
      message: "Document analysis timed out. You can try processing it again.",
    });
  });

  it("prevents retrying permanent and unknown failures", () => {
    expect(getDocumentProcessingFailure("no_transaction_candidates", 1))
      .toMatchObject({ canRetry: false });
    expect(getDocumentProcessingFailure("legacy_unknown_failure", 1))
      .toMatchObject({ canRetry: false });
  });

  it("prevents retry after the processing attempt limit", () => {
    expect(
      getDocumentProcessingFailure(
        "ai_timeout",
        maximumDocumentProcessingAttempts,
      ),
    ).toMatchObject({ canRetry: false });
  });
});
