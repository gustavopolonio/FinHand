import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

import {
  getTransactionCandidateReviewForUser,
  updateTransactionCandidateForUser,
} from "../../services/transaction-candidates.js";
import {
  listTransactionCandidatesQuerySchema,
  transactionCandidateParamsSchema,
  updateTransactionCandidateBodySchema,
} from "../../validation/transaction-candidate-schemas.js";

export async function transactionCandidateRoutes(
  application: FastifyInstance,
) {
  application.addHook("preHandler", application.requireAuthentication);
  const candidatesApplication =
    application.withTypeProvider<ZodTypeProvider>();

  candidatesApplication.get(
    "/api/transaction-candidates",
    {
      schema: { querystring: listTransactionCandidatesQuerySchema },
    },
    async (request) =>
      getTransactionCandidateReviewForUser(
        application.database,
        request.authenticatedUserId,
        request.query.uploadId,
      ),
  );

  candidatesApplication.patch(
    "/api/transaction-candidates/:id",
    {
      schema: {
        params: transactionCandidateParamsSchema,
        body: updateTransactionCandidateBodySchema,
      },
    },
    async (request) => {
      const candidate = await updateTransactionCandidateForUser(
        application.database,
        request.authenticatedUserId,
        request.params.id,
        request.body,
      );

      return { candidate };
    },
  );
}
