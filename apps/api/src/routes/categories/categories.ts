import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

import {
  createCategoryForUser,
  listCategoriesForUser,
} from "../../services/categories.js";
import { createCategoryBodySchema } from "../../validation/category-schemas.js";

export async function categoryRoutes(application: FastifyInstance) {
  application.addHook("preHandler", application.requireAuthentication);
  const categoriesApplication =
    application.withTypeProvider<ZodTypeProvider>();

  categoriesApplication.get("/api/categories", async (request) => {
    const userCategories = await listCategoriesForUser(
      application.database,
      request.authenticatedUserId,
    );

    return { categories: userCategories };
  });

  categoriesApplication.post(
    "/api/categories",
    {
      schema: {
        body: createCategoryBodySchema,
      },
    },
    async (request, reply) => {
      const category = await createCategoryForUser(
        application.database,
        request.authenticatedUserId,
        request.body,
      );

      return reply.status(201).send({ category });
    },
  );
}
