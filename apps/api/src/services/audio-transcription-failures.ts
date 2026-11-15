export const maximumAudioTranscriptionAttempts = 3;

export type AudioTranscriptionFailureCode =
  | "audio_download_timeout"
  | "audio_storage_unavailable"
  | "audio_not_found"
  | "audio_access_denied"
  | "audio_download_failed"
  | "audio_checksum_mismatch"
  | "unsupported_audio_type"
  | "transcription_timeout"
  | "transcription_rate_limited"
  | "transcription_service_unavailable"
  | "transcription_network_error"
  | "transcription_authentication_failed"
  | "transcription_request_rejected"
  | "transcription_failed"
  | "empty_audio_transcript"
  | "transcript_persistence_unavailable"
  | "transcript_persistence_failed"
  | "audio_transcription_interrupted";

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
    if (typeof current === "object" && current !== null) {
      const record = current as Record<string, unknown>;
      const metadata =
        typeof record.$metadata === "object" && record.$metadata !== null
          ? (record.$metadata as Record<string, unknown>)
          : undefined;
      details.push({
        code:
          typeof record.code === "string"
            ? record.code
            : typeof record.Code === "string"
              ? record.Code
              : undefined,
        name: typeof record.name === "string" ? record.name : undefined,
        status:
          typeof record.status === "number"
            ? record.status
            : typeof record.statusCode === "number"
              ? record.statusCode
              : typeof metadata?.httpStatusCode === "number"
                ? metadata.httpStatusCode
                : undefined,
      });
      current = "cause" in record ? record.cause : undefined;
    } else {
      details.push({});
      current = undefined;
    }
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

function isTimeout(details: ErrorDetails[]) {
  return details.some(
    ({ code, name }) =>
      (code !== undefined && timeoutErrorCodes.has(code)) ||
      (name !== undefined && timeoutErrorNames.has(name)),
  );
}

function isNetworkFailure(details: ErrorDetails[]) {
  return details.some(
    ({ code }) => code !== undefined && networkErrorCodes.has(code),
  );
}

export function classifyAudioDownloadFailure(
  error: unknown,
): AudioTranscriptionFailureCode {
  const details = getErrorDetails(error);

  if (isTimeout(details)) return "audio_download_timeout";
  if (
    details.some(({ code, name }) =>
      [code, name].some(
        (value) => value === "NoSuchKey" || value === "NotFound",
      ),
    ) ||
    hasStatus(details, (status) => status === 404)
  ) {
    return "audio_not_found";
  }
  if (hasStatus(details, (status) => status === 401 || status === 403)) {
    return "audio_access_denied";
  }
  if (
    isNetworkFailure(details) ||
    hasStatus(
      details,
      (status) => status === 408 || status === 429 || status >= 500,
    )
  ) {
    return "audio_storage_unavailable";
  }

  return "audio_download_failed";
}

export function classifyAudioTranscriptionFailure(
  error: unknown,
): AudioTranscriptionFailureCode {
  const details = getErrorDetails(error);

  if (isTimeout(details) || hasStatus(details, (status) => status === 408)) {
    return "transcription_timeout";
  }
  if (hasStatus(details, (status) => status === 429)) {
    return "transcription_rate_limited";
  }
  if (hasStatus(details, (status) => status === 401 || status === 403)) {
    return "transcription_authentication_failed";
  }
  if (hasStatus(details, (status) => status >= 500)) {
    return "transcription_service_unavailable";
  }
  if (isNetworkFailure(details)) return "transcription_network_error";
  if (hasStatus(details, (status) => status >= 400 && status < 500)) {
    return "transcription_request_rejected";
  }

  return "transcription_failed";
}

export function classifyTranscriptPersistenceFailure(
  error: unknown,
): AudioTranscriptionFailureCode {
  const details = getErrorDetails(error);
  const isTransient = details.some(
    ({ code }) =>
      code !== undefined &&
      (code.startsWith("08") || transientPostgresCodes.has(code)),
  );

  return isTransient
    ? "transcript_persistence_unavailable"
    : "transcript_persistence_failed";
}
