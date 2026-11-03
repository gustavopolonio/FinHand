import type { FastifyInstance } from "fastify";

import { accountTypes } from "../db/schema/index.js";
import {
  archiveAccountForUser,
  createAccountForUser,
  listAccountsForUser,
  restoreAccountForUser,
  type CreateAccountInput,
  type UpdateAccountInput,
  updateAccountForUser,
} from "../services/accounts.js";

interface AccountParams {
  id: string;
}

export async function accountRoutes(application: FastifyInstance) {
  application.addHook("preHandler", application.requireAuthentication);

  application.get("/api/accounts", async (request) => {
    const userAccounts = await listAccountsForUser(
      application.database,
      request.authenticatedUserId,
    );

    return { accounts: userAccounts };
  });

  application.post<{ Body: CreateAccountInput }>(
    "/api/accounts",
    {
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
      const account = await createAccountForUser(
        application.database,
        request.authenticatedUserId,
        request.body,
      );

      return reply.status(201).send({ account });
    },
  );

  application.patch<{ Body: UpdateAccountInput; Params: AccountParams }>(
    "/api/accounts/:id",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            type: { type: "string", enum: [...accountTypes] },
            openingBalanceMinor: {
              type: "string",
              pattern: "^-?\\d+$",
            },
          },
        },
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

  application.post<{ Params: AccountParams }>(
    "/api/accounts/:id/archive",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
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

  application.post<{ Params: AccountParams }>(
    "/api/accounts/:id/restore",
    {
      schema: {
        params: {
          type: "object",
          additionalProperties: false,
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
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
