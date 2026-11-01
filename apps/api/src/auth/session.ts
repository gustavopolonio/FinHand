import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";

import type { Authentication } from "./authentication.js";

export async function getAuthenticatedUserId(
  authentication: Authentication,
  request: FastifyRequest,
): Promise<string | null> {
  const session = await authentication.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  return session?.user.id ?? null;
}
