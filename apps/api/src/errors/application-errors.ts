export class InputError extends Error {
  override readonly name = "InputError";
}

export class PayloadTooLargeError extends Error {
  override readonly name = "PayloadTooLargeError";
  readonly statusCode = 413;

  constructor(
    message: string,
    readonly code: "AUDIO_TOO_LARGE" | "DOCUMENT_TOO_LARGE",
  ) {
    super(message);
  }
}

export class ConflictError extends Error {
  override readonly name = "ConflictError";
}

export class NotFoundError extends Error {
  override readonly name = "NotFoundError";
}

export class GoneError extends Error {
  readonly code = "CAPTURE_SESSION_EXPIRED";
  override readonly name = "GoneError";
  readonly statusCode = 410;
}

export class UnauthorizedError extends Error {
  override readonly name = "UnauthorizedError";

  constructor() {
    super("Unauthorized");
  }
}

export class OriginNotAllowedError extends Error {
  readonly code = "ORIGIN_NOT_ALLOWED";
  override readonly name = "OriginNotAllowedError";
  readonly statusCode = 403;

  constructor() {
    super("Request origin is not allowed.");
  }
}

export class RequestUriTooLongError extends Error {
  readonly code = "REQUEST_URI_TOO_LONG";
  override readonly name = "RequestUriTooLongError";
  readonly statusCode = 414;

  constructor() {
    super("Request URL is too long.");
  }
}

export class UnsupportedMediaTypeError extends Error {
  readonly code = "UNSUPPORTED_MEDIA_TYPE";
  override readonly name = "UnsupportedMediaTypeError";
  readonly statusCode = 415;
}
