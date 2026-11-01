import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance } from "fastify";

import type { Authentication } from "../auth/authentication.js";

interface AuthenticationRoutesOptions {
  authentication: Authentication;
  baseUrl: string;
}

export async function authenticationRoutes(
  application: FastifyInstance,
  options: AuthenticationRoutesOptions,
) {
  application.route({
    method: ["GET", "POST"],
    url: "/api/auth/*",
    async handler(request, reply) {
      const requestUrl = new URL(request.url, options.baseUrl);
      const fetchRequest = new Request(requestUrl, {
        method: request.method,
        headers: fromNodeHeaders(request.headers),
        ...(request.body === undefined
          ? {}
          : { body: JSON.stringify(request.body) }),
      });

      const response = await options.authentication.handler(fetchRequest);
      const setCookies = response.headers.getSetCookie();

      response.headers.forEach((value, name) => {
        if (name !== "set-cookie") {
          reply.header(name, value);
        }
      });

      if (setCookies.length > 0) {
        reply.header("set-cookie", setCookies);
      }

      reply.status(response.status);

      if (!response.body) {
        return reply.send();
      }

      return reply.send(await response.text());
    },
  });
}
