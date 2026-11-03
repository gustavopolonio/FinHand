import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

import { listTransactionsForUser } from "../../services/transactions.js";
import { listTransactionsQuerySchema } from "../../validation/transaction-schemas.js";

export async function transactionRoutes(application: FastifyInstance) {
  application.addHook("preHandler", application.requireAuthentication);
  const transactionsApplication =
    application.withTypeProvider<ZodTypeProvider>();

  transactionsApplication.get(
    "/api/transactions",
    {
      schema: {
        querystring: listTransactionsQuerySchema,
      },
    },
    async (request) =>
      listTransactionsForUser(
        application.database,
        request.authenticatedUserId,
        request.query,
      ),
  );
}
