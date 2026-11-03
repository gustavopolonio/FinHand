import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

import {
  createTransactionForUser,
  listTransactionsForUser,
} from "../../services/transactions.js";
import {
  createTransactionBodySchema,
  listTransactionsQuerySchema,
} from "../../validation/transaction-schemas.js";

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

  transactionsApplication.post(
    "/api/transactions",
    {
      schema: {
        body: createTransactionBodySchema,
      },
    },
    async (request, reply) => {
      const transaction = await createTransactionForUser(
        application.database,
        request.authenticatedUserId,
        request.body,
      );

      return reply.status(201).send({ transaction });
    },
  );
}
