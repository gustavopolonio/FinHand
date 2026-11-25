import { fromNodeHeaders } from "better-auth/node";
import type {
  FastifyReply,
  FastifyInstance,
  FastifyRequest,
  preHandlerHookHandler,
} from "fastify";

import type { Authentication } from "./authentication.js";
import { UnauthorizedError } from "../errors/application-errors.js";

declare module "fastify" {
  interface FastifyInstance {
    requireAuthentication: preHandlerHookHandler;
  }

  interface FastifyRequest {
    authenticatedUserId: string;
  }
}

export function registerAuthenticationGuard(
  application: FastifyInstance,
  authentication: Authentication,
  afterAuthentication?: (
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<void>,
) {
  application.decorateRequest("authenticatedUserId", "");
  application.decorate(
    "requireAuthentication",
    async function requireAuthentication(request, reply) {
      const session = await authentication.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        throw new UnauthorizedError();
      }

      request.authenticatedUserId = session.user.id;
      await afterAuthentication?.(request, reply);
    },
  );
}
