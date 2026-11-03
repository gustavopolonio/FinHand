interface PostgresError extends Error {
  code?: string;
  constraint?: string;
}

function isPostgresError(error: unknown): error is PostgresError {
  return error instanceof Error && "code" in error && "constraint" in error;
}

export function isPostgresUniqueConstraintError(
  error: unknown,
  constraint: string,
): boolean {
  let currentError = error;

  while (currentError instanceof Error) {
    if (
      isPostgresError(currentError) &&
      currentError.code === "23505" &&
      currentError.constraint === constraint
    ) {
      return true;
    }

    currentError = currentError.cause;
  }

  return false;
}
