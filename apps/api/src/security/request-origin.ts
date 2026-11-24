import type { FastifyInstance } from "fastify";

import { OriginNotAllowedError } from "../errors/application-errors.js";

const stateChangingMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);
const originValidationExemptRoutePrefixes = ["/api/auth/"];
const tokenAuthenticatedRoutes = new Set([
  "/api/document-capture-session/document",
]);

interface OriginValidationInput {
  hasCookie: boolean;
  method: string;
  routeUrl: string;
}

export function requiresTrustedOrigin({
  hasCookie,
  method,
  routeUrl,
}: OriginValidationInput): boolean {
  if (!hasCookie || !stateChangingMethods.has(method)) return false;
  if (tokenAuthenticatedRoutes.has(routeUrl)) return false;

  return !originValidationExemptRoutePrefixes.some((prefix) =>
    routeUrl.startsWith(prefix),
  );
}

export function registerRequestOriginGuard(
  application: FastifyInstance,
  trustedOrigin: string,
): void {
  application.addHook("preHandler", async (request) => {
    if (
      !requiresTrustedOrigin({
        hasCookie: Boolean(request.headers.cookie),
        method: request.method,
        routeUrl: request.routeOptions.url ?? request.url,
      })
    ) {
      return;
    }

    if (request.headers.origin !== trustedOrigin) {
      throw new OriginNotAllowedError();
    }
  });
}
