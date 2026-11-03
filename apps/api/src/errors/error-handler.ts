import { STATUS_CODES } from "node:http";

import type { FastifyInstance } from "fastify";

import {
  InputError,
  NotFoundError,
  UnauthorizedError,
} from "./application-errors.js";

interface ClientHttpError extends Error {
  code?: string;
  statusCode: number;
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
    if (error instanceof InputError) {
      return reply.status(400).send({ error: error.message });
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

    request.log.error({ err: error }, "Unhandled request error");

    return reply.status(500).send({ error: "Internal server error" });
  });
}
