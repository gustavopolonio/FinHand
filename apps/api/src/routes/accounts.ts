import type { FastifyInstance } from "fastify";

import type { Authentication } from "../auth/authentication.js";
import { getAuthenticatedUserId } from "../auth/session.js";
import { listAccountsForUser } from "../services/accounts.js";

interface AccountRoutesOptions {
  authentication: Authentication;
}

export async function accountRoutes(
  application: FastifyInstance,
  options: AccountRoutesOptions,
) {
  application.get("/api/accounts", async (request, reply) => {
    const userId = await getAuthenticatedUserId(
      options.authentication,
      request,
    );

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const userAccounts = await listAccountsForUser(
      application.database,
      userId,
    );

    return { accounts: userAccounts };
  });
}
