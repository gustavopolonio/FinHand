import type { ZodTypeProvider } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";

import {
  archiveAccountForUser,
  createAccountForUser,
  listAccountsForUser,
  restoreAccountForUser,
  updateAccountForUser,
} from "../../services/accounts.js";
import {
  accountParamsSchema,
  createAccountBodySchema,
  updateAccountBodySchema,
} from "../../validation/account-schemas.js";

export async function accountRoutes(application: FastifyInstance) {
  application.addHook("preHandler", application.requireAuthentication);
  const accountsApplication =
    application.withTypeProvider<ZodTypeProvider>();

  accountsApplication.get("/api/accounts", async (request) => {
    const userAccounts = await listAccountsForUser(
      application.database,
      request.authenticatedUserId,
    );

    return { accounts: userAccounts };
  });

  accountsApplication.post(
    "/api/accounts",
    {
      schema: {
        body: createAccountBodySchema,
      },
    },
    async (request, reply) => {
      const account = await createAccountForUser(
        application.database,
        request.authenticatedUserId,
        request.body,
      );

      return reply.status(201).send({ account });
    },
  );

  accountsApplication.patch(
    "/api/accounts/:id",
    {
      schema: {
        params: accountParamsSchema,
        body: updateAccountBodySchema,
      },
    },
    async (request) => {
      const account = await updateAccountForUser(
        application.database,
        request.authenticatedUserId,
        request.params.id,
        request.body,
      );

      return { account };
    },
  );

  accountsApplication.post(
    "/api/accounts/:id/archive",
    {
      schema: {
        params: accountParamsSchema,
      },
    },
    async (request) => {
      const account = await archiveAccountForUser(
        application.database,
        request.authenticatedUserId,
        request.params.id,
      );

      return { account };
    },
  );

  accountsApplication.post(
    "/api/accounts/:id/restore",
    {
      schema: {
        params: accountParamsSchema,
      },
    },
    async (request) => {
      const account = await restoreAccountForUser(
        application.database,
        request.authenticatedUserId,
        request.params.id,
      );

      return { account };
    },
  );
}
