import { STATUS_CODES } from "node:http";

import type {
  FastifyInstance,
  FastifyRequest,
} from "fastify";

import {
  ConflictError,
  InputError,
  NotFoundError,
  UnauthorizedError,
} from "./application-errors.js";

interface ClientHttpError {
  code?: string;
  message: string;
  statusCode: number;
}

const securityRejectionCodes = new Set([
  "ACTIVE_UPLOAD_LIMIT_EXCEEDED",
  "AUDIO_TOO_LARGE",
  "CAPTURE_RATE_LIMIT_EXCEEDED",
  "DOCUMENT_TOO_LARGE",
  "HOURLY_UPLOAD_LIMIT_EXCEEDED",
  "ORIGIN_NOT_ALLOWED",
  "RATE_LIMIT_EXCEEDED",
  "REQUEST_BODY_TOO_LARGE",
  "REQUEST_URI_TOO_LONG",
  "UNSUPPORTED_MEDIA_TYPE",
]);

function hasErrorCode(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  );
}

function isClientHttpError(error: unknown): error is ClientHttpError {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500 &&
    "message" in error &&
    typeof error.message === "string"
  );
}

function logSecurityRejection(
  request: FastifyRequest,
  statusCode: number,
  code: string,
): void {
  if (!securityRejectionCodes.has(code)) return;

  request.log.warn(
    {
      code,
      event: "security.request.rejected",
      method: request.method,
      route: request.routeOptions.url,
      statusCode,
    },
    "Security policy rejected request",
  );
}

export function registerApplicationErrorHandler(
  application: FastifyInstance,
) {
  application.setErrorHandler((error, request, reply) => {
    if (hasErrorCode(error) && error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      logSecurityRejection(request, 413, "REQUEST_BODY_TOO_LARGE");
      return reply.status(413).send({
        statusCode: 413,
        code: "REQUEST_BODY_TOO_LARGE",
        error: "Payload Too Large",
        message: "Request body is too large.",
      });
    }

    if (hasErrorCode(error) && error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
      logSecurityRejection(request, 415, "UNSUPPORTED_MEDIA_TYPE");
      return reply.status(415).send({
        statusCode: 415,
        code: "UNSUPPORTED_MEDIA_TYPE",
        error: "Unsupported Media Type",
        message: "Request content type is not supported.",
      });
    }

    if (error instanceof InputError) {
      return reply.status(400).send({ error: error.message });
    }

    if (error instanceof ConflictError) {
      return reply.status(409).send({ error: error.message });
    }

    if (error instanceof UnauthorizedError) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    if (error instanceof NotFoundError) {
      return reply.status(404).send({ error: error.message });
    }

    if (isClientHttpError(error)) {
      if (error.code) {
        logSecurityRejection(request, error.statusCode, error.code);
      }

      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        code: error.code,
        error: STATUS_CODES[error.statusCode] ?? "Request Error",
        message: error.message,
      });
    }

    request.log.error(
      {
        err: error,
        event: "http.request.failed",
        method: request.method,
        route: request.routeOptions.url,
      },
      "Unhandled request error",
    );

    return reply.status(500).send({ error: "Internal server error" });
  });
}
