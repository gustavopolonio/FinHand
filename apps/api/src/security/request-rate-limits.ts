import fastifyRateLimit from "@fastify/rate-limit";
import type {
  FastifyInstance,
  preHandlerAsyncHookHandler,
} from "fastify";

interface RateLimitPolicy {
  maximumRequests: number;
  timeWindowMilliseconds: number;
}

export interface RequestRateLimitPolicies {
  authenticatedUser: RateLimitPolicy;
  authenticationIp: RateLimitPolicy;
  generalIp: RateLimitPolicy;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticatedUserRateLimit: preHandlerAsyncHookHandler;
  }
}

const oneMinuteMilliseconds = 60_000;

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
    generalIp: Object.freeze({
      maximumRequests: 300,
      timeWindowMilliseconds: oneMinuteMilliseconds,
    }),
  });

function rateLimitErrorResponse() {
  return {
    statusCode: 429,
    code: "RATE_LIMIT_EXCEEDED",
    error: "Too Many Requests",
    message: "Too many requests. Try again later.",
  };
}

export function authenticationIpRateLimitOptions(
  policy = requestRateLimitPolicies.authenticationIp,
) {
  return {
    errorResponseBuilder: rateLimitErrorResponse,
    groupId: "authentication-ip",
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
    errorResponseBuilder: rateLimitErrorResponse,
    global: true,
    groupId: "general-ip",
    max: policies.generalIp.maximumRequests,
    timeWindow: policies.generalIp.timeWindowMilliseconds,
  });

  let authenticatedUserLimit: preHandlerAsyncHookHandler | undefined;

  application.decorate(
    "authenticatedUserRateLimit",
    async function authenticatedUserRateLimit(request, reply) {
      authenticatedUserLimit ??= application.rateLimit({
        errorResponseBuilder: rateLimitErrorResponse,
        groupId: "authenticated-user",
        keyGenerator: (authenticatedRequest) =>
          authenticatedRequest.authenticatedUserId,
        max: policies.authenticatedUser.maximumRequests,
        timeWindow: policies.authenticatedUser.timeWindowMilliseconds,
      });

      await authenticatedUserLimit.call(application, request, reply);
    },
  );
}
