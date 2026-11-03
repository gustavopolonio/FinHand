export class InputError extends Error {
  override readonly name = "InputError";
}

export class ConflictError extends Error {
  override readonly name = "ConflictError";
}

export class NotFoundError extends Error {
  override readonly name = "NotFoundError";
}

export class UnauthorizedError extends Error {
  override readonly name = "UnauthorizedError";

  constructor() {
    super("Unauthorized");
  }
}
