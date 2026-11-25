import { createHash } from "node:crypto";

import fastifyRateLimit from "@fastify/rate-limit";
import type {
  FastifyReply,
  FastifyInstance,
  FastifyRequest,
  onRequestAsyncHookHandler,
  preHandlerAsyncHookHandler,
} from "fastify";

import { RateLimitExceededError } from "../errors/application-errors.js";

interface RateLimitPolicy {
  maximumRequests: number;
  timeWindowMilliseconds: number;
}

export interface RequestRateLimitPolicies {
  authenticatedUser: RateLimitPolicy;
  authenticationIp: RateLimitPolicy;
  captureSubmissionIp: RateLimitPolicy;
  captureSubmissionToken: RateLimitPolicy;
  captureVerificationIp: RateLimitPolicy;
  captureVerificationToken: RateLimitPolicy;
  generalIp: RateLimitPolicy;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticatedUserRateLimit: preHandlerAsyncHookHandler;
    captureSubmissionTokenRateLimit: onRequestAsyncHookHandler;
    captureVerificationTokenRateLimit: onRequestAsyncHookHandler;
  }
}

const oneMinuteMilliseconds = 60_000;
const fiveMinutesMilliseconds = 5 * oneMinuteMilliseconds;

export const requestRateLimitPolicies: RequestRateLimitPolicies =
  Object.freeze({
    authenticatedUser: Object.freeze({
      maximumRequests: 180,
      timeWindowMilliseconds: oneMinuteMilliseconds,
    }),
    authenticationIp: Object.freeze({
      maximumRequests: 20,
      timeWindowMilliseconds: oneMinuteMilliseconds,
    }),
    captureSubmissionIp: Object.freeze({
      maximumRequests: 10,
      timeWindowMilliseconds: fiveMinutesMilliseconds,
    }),
    captureSubmissionToken: Object.freeze({
      maximumRequests: 5,
      timeWindowMilliseconds: fiveMinutesMilliseconds,
    }),
    captureVerificationIp: Object.freeze({
      maximumRequests: 30,
      timeWindowMilliseconds: oneMinuteMilliseconds,
    }),
    captureVerificationToken: Object.freeze({
      maximumRequests: 30,
      timeWindowMilliseconds: fiveMinutesMilliseconds,
    }),
    generalIp: Object.freeze({
      maximumRequests: 300,
      timeWindowMilliseconds: oneMinuteMilliseconds,
    }),
  });

function requestRateLimitErrorResponse() {
  return {
    statusCode: 429,
    code: "RATE_LIMIT_EXCEEDED",
    error: "Too Many Requests",
    message: "Too many requests. Try again later.",
  };
}

function captureRateLimitErrorResponse() {
  return {
    statusCode: 429,
    code: "CAPTURE_RATE_LIMIT_EXCEEDED",
    error: "Too Many Requests",
    message: "Too many capture attempts. Try again later.",
  };
}

function captureCredentialRateLimitKey(request: {
  headers: { authorization?: string };
  ip: string;
}): string {
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
    request.headers.authorization ?? "",
  )?.[1];

  if (!token) {
    return `invalid:${request.ip}`;
  }

  return `token:${createHash("sha256").update(token).digest("hex")}`;
}

type AdditionalRateLimit = ReturnType<FastifyInstance["createRateLimit"]>;

async function enforceAdditionalRateLimit(
  rateLimit: AdditionalRateLimit,
  request: FastifyRequest,
  reply: FastifyReply,
  error: RateLimitExceededError,
): Promise<void> {
  const result = await rateLimit(request);

  if (result.isAllowed) return;

  reply.header("X-RateLimit-Limit", result.max);
  reply.header("X-RateLimit-Remaining", result.remaining);
  reply.header("X-RateLimit-Reset", result.ttlInSeconds);

  if (!result.isExceeded) return;

  reply.header("Retry-After", result.ttlInSeconds);
  throw error;
}

export function authenticationIpRateLimitOptions(
  policy = requestRateLimitPolicies.authenticationIp,
) {
  return {
    errorResponseBuilder: requestRateLimitErrorResponse,
    groupId: "authentication-ip",
    max: policy.maximumRequests,
    timeWindow: policy.timeWindowMilliseconds,
  } as const;
}

export function captureVerificationIpRateLimitOptions(
  policy = requestRateLimitPolicies.captureVerificationIp,
) {
  return {
    errorResponseBuilder: captureRateLimitErrorResponse,
    groupId: "capture-verification-ip",
    max: policy.maximumRequests,
    timeWindow: policy.timeWindowMilliseconds,
  } as const;
}

export function captureSubmissionIpRateLimitOptions(
  policy = requestRateLimitPolicies.captureSubmissionIp,
) {
  return {
    errorResponseBuilder: captureRateLimitErrorResponse,
    groupId: "capture-submission-ip",
    max: policy.maximumRequests,
    timeWindow: policy.timeWindowMilliseconds,
  } as const;
}

export function registerRequestRateLimits(
  application: FastifyInstance,
  policies: RequestRateLimitPolicies = requestRateLimitPolicies,
) {
  application.register(fastifyRateLimit, {
    allowList: (request) => request.method === "OPTIONS",
    errorResponseBuilder: requestRateLimitErrorResponse,
    global: true,
    groupId: "general-ip",
    max: policies.generalIp.maximumRequests,
    timeWindow: policies.generalIp.timeWindowMilliseconds,
  });

  let authenticatedUserLimit: AdditionalRateLimit | undefined;

  application.decorate(
    "authenticatedUserRateLimit",
    async function authenticatedUserRateLimit(request, reply) {
      authenticatedUserLimit ??= application.createRateLimit({
        keyGenerator: (authenticatedRequest) =>
          authenticatedRequest.authenticatedUserId,
        max: policies.authenticatedUser.maximumRequests,
        timeWindow: policies.authenticatedUser.timeWindowMilliseconds,
      });

      await enforceAdditionalRateLimit(
        authenticatedUserLimit,
        request,
        reply,
        new RateLimitExceededError(
          "Too many requests. Try again later.",
          "RATE_LIMIT_EXCEEDED",
        ),
      );
    },
  );

  let captureVerificationTokenLimit: AdditionalRateLimit | undefined;
  application.decorate(
    "captureVerificationTokenRateLimit",
    async function captureVerificationTokenRateLimit(request, reply) {
      captureVerificationTokenLimit ??= application.createRateLimit({
        keyGenerator: captureCredentialRateLimitKey,
        max: policies.captureVerificationToken.maximumRequests,
        timeWindow:
          policies.captureVerificationToken.timeWindowMilliseconds,
      });

      await enforceAdditionalRateLimit(
        captureVerificationTokenLimit,
        request,
        reply,
        new RateLimitExceededError(
          "Too many capture attempts. Try again later.",
          "CAPTURE_RATE_LIMIT_EXCEEDED",
        ),
      );
    },
  );

  let captureSubmissionTokenLimit: AdditionalRateLimit | undefined;
  application.decorate(
    "captureSubmissionTokenRateLimit",
    async function captureSubmissionTokenRateLimit(request, reply) {
      captureSubmissionTokenLimit ??= application.createRateLimit({
        keyGenerator: captureCredentialRateLimitKey,
        max: policies.captureSubmissionToken.maximumRequests,
        timeWindow: policies.captureSubmissionToken.timeWindowMilliseconds,
      });

      await enforceAdditionalRateLimit(
        captureSubmissionTokenLimit,
        request,
        reply,
        new RateLimitExceededError(
          "Too many capture attempts. Try again later.",
          "CAPTURE_RATE_LIMIT_EXCEEDED",
        ),
      );
    },
  );
}
