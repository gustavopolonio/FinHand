import { fromNodeHeaders } from "better-auth/node";
import type {
  FastifyInstance,
  preHandlerHookHandler,
} from "fastify";

import type { Authentication } from "./authentication.js";

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
    async function requireAuthentication(request, reply) {
      const session = await authentication.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      request.authenticatedUserId = session.user.id;
    },
  );
}
