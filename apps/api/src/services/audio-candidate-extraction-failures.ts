export const maximumAudioCandidateExtractionAttempts = 3;

export type AudioCandidateExtractionFailureCode =
  | "audio_candidate_extraction_timeout"
  | "audio_candidate_extraction_rate_limited"
  | "audio_candidate_extraction_service_unavailable"
  | "audio_candidate_extraction_network_error"
  | "audio_candidate_extraction_authentication_failed"
  | "audio_candidate_extraction_request_rejected"
  | "audio_candidate_extraction_failed"
  | "no_audio_transaction_candidates"
  | "no_usable_audio_transaction_candidates"
  | "audio_candidate_persistence_unavailable"
  | "audio_candidate_persistence_failed"
  | "audio_candidate_extraction_interrupted";

const timeoutErrorNames = new Set(["AbortError", "TimeoutError"]);
const timeoutErrorCodes = new Set([
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);
const networkErrorCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENETDOWN",
  "ENETUNREACH",
  "EPIPE",
]);
const transientPostgresCodes = new Set([
  "40001",
  "40P01",
  "53300",
  "57P01",
  "57P02",
  "57P03",
]);

interface ErrorDetails {
  code?: string;
  name?: string;
  status?: number;
}

function getErrorDetails(error: unknown): ErrorDetails[] {
  const details: ErrorDetails[] = [];
  let current = error;

  for (let index = 0; index < 5 && current !== undefined; index += 1) {
    if (typeof current !== "object" || current === null) {
      details.push({});
      break;
    }

    const record = current as Record<string, unknown>;
    details.push({
      code: typeof record.code === "string" ? record.code : undefined,
      name: typeof record.name === "string" ? record.name : undefined,
      status:
        typeof record.status === "number"
          ? record.status
          : typeof record.statusCode === "number"
            ? record.statusCode
            : undefined,
    });
    current = "cause" in record ? record.cause : undefined;
  }

  return details;
}

function hasStatus(
  details: ErrorDetails[],
  predicate: (status: number) => boolean,
) {
  return details.some(
    ({ status }) => status !== undefined && predicate(status),
  );
}

export function classifyAudioCandidateExtractionFailure(
  error: unknown,
): AudioCandidateExtractionFailureCode {
  const details = getErrorDetails(error);

  if (
    details.some(
      ({ code, name }) =>
        (code !== undefined && timeoutErrorCodes.has(code)) ||
        (name !== undefined && timeoutErrorNames.has(name)),
    ) ||
    hasStatus(details, (status) => status === 408)
  ) {
    return "audio_candidate_extraction_timeout";
  }
  if (hasStatus(details, (status) => status === 429)) {
    return "audio_candidate_extraction_rate_limited";
  }
  if (hasStatus(details, (status) => status === 401 || status === 403)) {
    return "audio_candidate_extraction_authentication_failed";
  }
  if (hasStatus(details, (status) => status >= 500)) {
    return "audio_candidate_extraction_service_unavailable";
  }
  if (
    details.some(
      ({ code }) => code !== undefined && networkErrorCodes.has(code),
    )
  ) {
    return "audio_candidate_extraction_network_error";
  }
  if (hasStatus(details, (status) => status >= 400 && status < 500)) {
    return "audio_candidate_extraction_request_rejected";
  }

  return "audio_candidate_extraction_failed";
}

export function classifyAudioCandidatePersistenceFailure(
  error: unknown,
): AudioCandidateExtractionFailureCode {
  const details = getErrorDetails(error);
  const transient = details.some(
    ({ code }) =>
      code !== undefined &&
      (code.startsWith("08") || transientPostgresCodes.has(code)),
  );

  return transient
    ? "audio_candidate_persistence_unavailable"
    : "audio_candidate_persistence_failed";
}
