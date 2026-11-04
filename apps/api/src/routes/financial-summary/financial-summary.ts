import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

import { getFinancialSummaryForUser } from "../../services/financial-summary.js";
import { financialSummaryQuerySchema } from "../../validation/financial-summary-schemas.js";

export async function financialSummaryRoutes(application: FastifyInstance) {
  application.addHook("preHandler", application.requireAuthentication);
  const summaryApplication =
    application.withTypeProvider<ZodTypeProvider>();

  summaryApplication.get(
    "/api/financial-summary",
    {
      schema: {
        querystring: financialSummaryQuerySchema,
      },
    },
    async (request) =>
      getFinancialSummaryForUser(
        application.database,
        request.authenticatedUserId,
        request.query,
      ),
  );
}
