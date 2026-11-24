import { STATUS_CODES } from "node:http";

import type { FastifyInstance } from "fastify";

import {
  ConflictError,
  InputError,
  NotFoundError,
  UnauthorizedError,
} from "./application-errors.js";

interface ClientHttpError extends Error {
  code?: string;
  statusCode: number;
}

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
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  );
}

export function registerApplicationErrorHandler(
  application: FastifyInstance,
) {
  application.setErrorHandler((error, request, reply) => {
    if (hasErrorCode(error) && error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return reply.status(413).send({
        statusCode: 413,
        code: "REQUEST_BODY_TOO_LARGE",
        error: "Payload Too Large",
        message: "Request body is too large.",
      });
    }

    if (hasErrorCode(error) && error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
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
