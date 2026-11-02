import type { FastifyInstance } from "fastify";

import { accountTypes } from "../db/schema/index.js";
import {
  AccountInputError,
  AccountOwnerNotFoundError,
  createAccountForUser,
  listAccountsForUser,
  type CreateAccountInput,
} from "../services/accounts.js";

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

  application.post<{ Body: CreateAccountInput }>(
    "/api/accounts",
    {
      preHandler: application.requireAuthentication,
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["name", "type"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            type: { type: "string", enum: [...accountTypes] },
            currencyCode: { type: "string", minLength: 3, maxLength: 3 },
            openingBalanceMinor: {
              type: "string",
              pattern: "^-?\\d+$",
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const account = await createAccountForUser(
          application.database,
          request.authenticatedUserId,
          request.body,
        );

        return reply.status(201).send({ account });
      } catch (error) {
        if (error instanceof AccountInputError) {
          return reply.status(400).send({ error: error.message });
        }

        if (error instanceof AccountOwnerNotFoundError) {
          return reply.status(401).send({ error: "Unauthorized" });
        }

        throw error;
      }
    },
  );
}
