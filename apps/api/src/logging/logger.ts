import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from "pino";

export const redactedLogValue = "[Redacted]";

const sensitiveLogPaths = [
  "authorization",
  "cookie",
  "password",
  "secret",
  "apiKey",
  "accessToken",
  "refreshToken",
  "idToken",
  "presignedUrl",
  "signedUrl",
  "originalFileName",
  "amount",
  "balance",
  "merchant",
  "description",
  "notes",
  "transcript",
  "prompt",
  "documentContent",
  "body",
  "headers.authorization",
  "headers.cookie",
  "headers['x-api-key']",
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "request.headers.authorization",
  "request.headers.cookie",
  "request.headers['x-api-key']",
  "req.body",
  "request.body",
  "*.authorization",
  "*.cookie",
  "*.password",
  "*.secret",
  "*.apiKey",
  "*.accessToken",
  "*.refreshToken",
  "*.idToken",
  "*.presignedUrl",
  "*.signedUrl",
  "*.originalFileName",
  "*.amount",
  "*.balance",
  "*.merchant",
  "*.description",
  "*.notes",
  "*.transcript",
  "*.prompt",
  "*.documentContent",
  "*.body",
] as const;

interface ErrorWithCode {
  code?: unknown;
  name?: unknown;
  stack?: unknown;
}

interface ApplicationLoggerOptions {
  environment: "development" | "test" | "production";
  level: string;
  service: "api" | "worker";
}

function getErrorCode(error: ErrorWithCode): string | undefined {
  if (typeof error.code === "string" || typeof error.code === "number") {
    return String(error.code);
  }

  return undefined;
}

function getSafeStack(stack: unknown): string | undefined {
  if (typeof stack !== "string") return undefined;

  const frames = stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("at "))
    .slice(0, 20)
    .join("\n");
  return frames || undefined;
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") {
    return { type: "UnknownError" };
  }

  const errorRecord = error as ErrorWithCode;
  const type =
    typeof errorRecord.name === "string" && errorRecord.name.length > 0
      ? errorRecord.name
      : "UnknownError";

  return {
    type,
    code: getErrorCode(errorRecord),
    stack: getSafeStack(errorRecord.stack),
  };
}

export function createLoggerOptions({
  environment,
  level,
  service,
}: ApplicationLoggerOptions): LoggerOptions {
  return {
    base: { environment, service },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    level,
    messageKey: "message",
    redact: {
      censor: redactedLogValue,
      paths: [...sensitiveLogPaths],
    },
    serializers: {
      err: serializeError,
      error: serializeError,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
}

export function createApplicationLogger(
  options: ApplicationLoggerOptions,
  destination?: DestinationStream,
): Logger {
  const loggerOptions = createLoggerOptions(options);

  return destination
    ? pino(loggerOptions, destination)
    : pino(loggerOptions);
}
