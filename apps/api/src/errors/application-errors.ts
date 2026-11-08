export class InputError extends Error {
  override readonly name = "InputError";
}

export class PayloadTooLargeError extends Error {
  readonly code = "DOCUMENT_TOO_LARGE";
  override readonly name = "PayloadTooLargeError";
  readonly statusCode = 413;
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
