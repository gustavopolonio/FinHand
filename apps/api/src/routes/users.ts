import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import type { Authentication } from "../auth/authentication.js";
import { getAuthenticatedUserId } from "../auth/session.js";
import { users } from "../db/schema/index.js";

interface UserRoutesOptions {
  authentication: Authentication;
}

export async function userRoutes(
  application: FastifyInstance,
  options: UserRoutesOptions,
) {
  application.get("/api/me", async (request, reply) => {
    const userId = await getAuthenticatedUserId(
      options.authentication,
      request,
    );

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const user = await application.database.query.users.findFirst({
      columns: {
        id: true,
        email: true,
        displayName: true,
        imageUrl: true,
        defaultCurrency: true,
        timeZone: true,
      },
      where: eq(users.id, userId),
    });

    if (!user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    return user;
  });
}
