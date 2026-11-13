export const maximumDocumentProcessingAttempts = 3;

export const documentProcessingFailurePolicies = {
  document_download_timeout: {
    retryable: true,
    message: "The document download timed out. You can try processing it again.",
  },
  document_storage_unavailable: {
    retryable: true,
    message: "Document storage is temporarily unavailable. You can try again.",
  },
  ai_timeout: {
    retryable: true,
    message: "Document analysis timed out. You can try processing it again.",
  },
  ai_rate_limited: {
    retryable: true,
    message: "Document analysis is temporarily busy. You can try again.",
  },
  ai_service_unavailable: {
    retryable: true,
    message: "Document analysis is temporarily unavailable. You can try again.",
  },
  ai_network_error: {
    retryable: true,
    message: "A network error interrupted document analysis. You can try again.",
  },
  candidate_persistence_unavailable: {
    retryable: true,
    message:
      "The extracted transaction could not be saved temporarily. You can try again.",
  },
  document_not_found: {
    retryable: false,
    message: "The uploaded document could not be found. Upload it again.",
  },
  document_access_denied: {
    retryable: false,
    message: "Document processing is currently unavailable.",
  },
  document_download_failed: {
    retryable: false,
    message: "The uploaded document could not be read. Upload it again.",
  },
  document_checksum_mismatch: {
    retryable: false,
    message: "The uploaded document is corrupted. Upload it again.",
  },
  unsupported_document_type: {
    retryable: false,
    message:
      "This document type is not supported. Upload a PDF, JPEG, or PNG file.",
  },
  ai_authentication_failed: {
    retryable: false,
    message: "Document processing is currently unavailable.",
  },
  ai_request_rejected: {
    retryable: false,
    message: "This document could not be analyzed. Upload another document.",
  },
  document_extraction_failed: {
    retryable: false,
    message: "This document could not be analyzed. Upload another document.",
  },
  no_transaction_candidates: {
    retryable: false,
    message: "No financial transaction was found in this document.",
  },
  no_usable_transaction_candidates: {
    retryable: false,
    message: "The document did not contain usable transaction information.",
  },
  candidate_persistence_failed: {
    retryable: false,
    message: "The extracted transaction could not be saved.",
  },
} as const;

export type DocumentProcessingFailureCode =
  keyof typeof documentProcessingFailurePolicies;

export interface DocumentProcessingFailure {
  code: string;
  canRetry: boolean;
  message: string;
}

const unknownFailurePolicy = {
  retryable: false,
  message: "Document processing failed. Upload the document again.",
} as const;

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

function errorChain(error: unknown): unknown[] {
  const errors: unknown[] = [];
  let current = error;

  for (let index = 0; index < 5 && current !== undefined; index += 1) {
    errors.push(current);
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? current.cause
        : undefined;
  }

  return errors;
}

function getErrorDetails(error: unknown): ErrorDetails[] {
  return errorChain(error).map((current) => {
    if (typeof current !== "object" || current === null) return {};

    const record = current as Record<string, unknown>;
    const metadata =
      typeof record.$metadata === "object" && record.$metadata !== null
        ? (record.$metadata as Record<string, unknown>)
        : undefined;

    return {
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
    };
  });
}

function isTimeout(details: ErrorDetails[]): boolean {
  return details.some(
    ({ code, name }) =>
      (code !== undefined && timeoutErrorCodes.has(code)) ||
      (name !== undefined && timeoutErrorNames.has(name)),
  );
}

function isNetworkFailure(details: ErrorDetails[]): boolean {
  return details.some(
    ({ code }) => code !== undefined && networkErrorCodes.has(code),
  );
}

function hasStatus(
  details: ErrorDetails[],
  predicate: (status: number) => boolean,
) {
  return details.some(
    ({ status }) => status !== undefined && predicate(status),
  );
}

export function getDocumentProcessingFailure(
  failureCode: string | null,
  processingAttempts: number,
): DocumentProcessingFailure | null {
  if (failureCode === null) return null;

  const policy =
    documentProcessingFailurePolicies[
      failureCode as DocumentProcessingFailureCode
    ] ?? unknownFailurePolicy;
  const reachedAttemptLimit =
    processingAttempts >= maximumDocumentProcessingAttempts;

  return {
    code: failureCode,
    canRetry: policy.retryable && !reachedAttemptLimit,
    message:
      policy.retryable && reachedAttemptLimit
        ? "This document reached the processing attempt limit. Upload it again to continue."
        : policy.message,
  };
}

export function classifyDocumentDownloadFailure(
  error: unknown,
): DocumentProcessingFailureCode {
  const details = getErrorDetails(error);

  if (isTimeout(details)) return "document_download_timeout";
  if (
    details.some(({ code, name }) =>
      [code, name].some(
        (value) => value === "NoSuchKey" || value === "NotFound",
      ),
    ) ||
    hasStatus(details, (status) => status === 404)
  ) {
    return "document_not_found";
  }
  if (hasStatus(details, (status) => status === 401 || status === 403)) {
    return "document_access_denied";
  }
  if (
    isNetworkFailure(details) ||
    hasStatus(
      details,
      (status) => status === 408 || status === 429 || status >= 500,
    )
  ) {
    return "document_storage_unavailable";
  }

  return "document_download_failed";
}

export function classifyDocumentExtractionFailure(
  error: unknown,
): DocumentProcessingFailureCode {
  const details = getErrorDetails(error);

  if (isTimeout(details) || hasStatus(details, (status) => status === 408)) {
    return "ai_timeout";
  }
  if (hasStatus(details, (status) => status === 429)) return "ai_rate_limited";
  if (hasStatus(details, (status) => status === 401 || status === 403)) {
    return "ai_authentication_failed";
  }
  if (hasStatus(details, (status) => status >= 500)) {
    return "ai_service_unavailable";
  }
  if (isNetworkFailure(details)) return "ai_network_error";
  if (hasStatus(details, (status) => status >= 400 && status < 500)) {
    return "ai_request_rejected";
  }

  return "document_extraction_failed";
}

export function classifyCandidatePersistenceFailure(
  error: unknown,
): DocumentProcessingFailureCode {
  const details = getErrorDetails(error);
  const isTransient = details.some(
    ({ code }) =>
      code !== undefined &&
      (code.startsWith("08") || transientPostgresCodes.has(code)),
  );

  return isTransient
    ? "candidate_persistence_unavailable"
    : "candidate_persistence_failed";
}
