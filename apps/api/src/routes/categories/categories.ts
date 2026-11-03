import type { FastifyInstance } from "fastify";

import { listCategoriesForUser } from "../../services/categories.js";

export async function categoryRoutes(application: FastifyInstance) {
  application.addHook("preHandler", application.requireAuthentication);

  application.get("/api/categories", async (request) => {
    const userCategories = await listCategoriesForUser(
      application.database,
      request.authenticatedUserId,
    );

    return { categories: userCategories };
  });
}
