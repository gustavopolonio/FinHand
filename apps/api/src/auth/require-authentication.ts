import { fromNodeHeaders } from "better-auth/node";
import type {
  FastifyInstance,
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
) {
  application.decorateRequest("authenticatedUserId", "");
  application.decorate(
    "requireAuthentication",
    async function requireAuthentication(request) {
      const session = await authentication.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        throw new UnauthorizedError();
      }

      request.authenticatedUserId = session.user.id;
    },
  );
}
