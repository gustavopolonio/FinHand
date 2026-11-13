import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

import {
  createTransactionForUser,
  deleteTransactionForUser,
  listTransactionsForUser,
  updateTransactionForUser,
} from "../../services/transactions.js";
import { getTransactionDocumentSourceForUser } from "../../services/transaction-document-sources.js";
import type { DocumentStorage } from "../../storage/document-storage.js";
import {
  createTransactionBodySchema,
  listTransactionsQuerySchema,
  transactionParamsSchema,
  updateTransactionBodySchema,
} from "../../validation/transaction-schemas.js";

interface TransactionRoutesOptions {
  documentStorage: DocumentStorage;
}

export async function transactionRoutes(
  application: FastifyInstance,
  { documentStorage }: TransactionRoutesOptions,
) {
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

  transactionsApplication.get(
    "/api/transactions/:id/source-document",
    {
      schema: {
        params: transactionParamsSchema,
      },
    },
    async (request, reply) => {
      const source = await getTransactionDocumentSourceForUser({
        database: application.database,
        documentStorage,
        transactionId: request.params.id,
        userId: request.authenticatedUserId,
      });

      return reply.header("Cache-Control", "private, no-store").send(source);
    },
  );

  transactionsApplication.patch(
    "/api/transactions/:id",
    {
      schema: {
        params: transactionParamsSchema,
        body: updateTransactionBodySchema,
      },
    },
    async (request) => {
      const transaction = await updateTransactionForUser(
        application.database,
        request.authenticatedUserId,
        request.params.id,
        request.body,
      );

      return { transaction };
    },
  );

  transactionsApplication.delete(
    "/api/transactions/:id",
    {
      schema: {
        params: transactionParamsSchema,
      },
    },
    async (request, reply) => {
      await deleteTransactionForUser(
        application.database,
        request.authenticatedUserId,
        request.params.id,
      );

      return reply.status(204).send();
    },
  );
}
