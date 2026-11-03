import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

import {
  archiveCategoryForUser,
  createCategoryForUser,
  listCategoriesForUser,
  renameCategoryForUser,
  restoreCategoryForUser,
} from "../../services/categories.js";
import {
  categoryParamsSchema,
  createCategoryBodySchema,
  renameCategoryBodySchema,
} from "../../validation/category-schemas.js";

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

  categoriesApplication.patch(
    "/api/categories/:id",
    {
      schema: {
        params: categoryParamsSchema,
        body: renameCategoryBodySchema,
      },
    },
    async (request) => {
      const category = await renameCategoryForUser(
        application.database,
        request.authenticatedUserId,
        request.params.id,
        request.body,
      );

      return { category };
    },
  );

  categoriesApplication.post(
    "/api/categories/:id/archive",
    {
      schema: {
        params: categoryParamsSchema,
      },
    },
    async (request) => {
      const category = await archiveCategoryForUser(
        application.database,
        request.authenticatedUserId,
        request.params.id,
      );

      return { category };
    },
  );

  categoriesApplication.post(
    "/api/categories/:id/restore",
    {
      schema: {
        params: categoryParamsSchema,
      },
    },
    async (request) => {
      const category = await restoreCategoryForUser(
        application.database,
        request.authenticatedUserId,
        request.params.id,
      );

      return { category };
    },
  );
}
