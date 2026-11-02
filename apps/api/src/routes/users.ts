import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

import { users } from "../db/schema/index.js";

export async function userRoutes(application: FastifyInstance) {
  application.get(
    "/api/me",
    { preHandler: application.requireAuthentication },
    async (request, reply) => {
      const user = await application.database.query.users.findFirst({
        columns: {
          id: true,
          email: true,
          displayName: true,
          imageUrl: true,
          defaultCurrency: true,
          timeZone: true,
        },
        where: eq(users.id, request.authenticatedUserId),
      });

      if (!user) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      return user;
    },
  );
}
