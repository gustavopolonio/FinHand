import type { FastifyInstance } from "fastify";

import { listAccountsForUser } from "../services/accounts.js";

export async function accountRoutes(application: FastifyInstance) {
  application.get(
    "/api/accounts",
    { preHandler: application.requireAuthentication },
    async (request) => {
      const userAccounts = await listAccountsForUser(
        application.database,
        request.authenticatedUserId,
      );

      return { accounts: userAccounts };
    },
  );
}
