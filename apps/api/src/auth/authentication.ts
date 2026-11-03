import { betterAuth } from "better-auth";
import { getOAuthState } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { Database } from "../db/index.js";
import {
  authAccounts,
  authSessions,
  authVerifications,
  users,
} from "../db/schema/index.js";
import { createDefaultCategoriesForUser } from "../services/categories.js";
import { normalizeBrowserTimeZone } from "./time-zone.js";

export interface AuthenticationConfiguration {
  baseUrl: string;
  betterAuthSecret: string;
  googleClientId: string;
  googleClientSecret: string;
  webUrl: string;
}

export function createAuthentication(
  database: Database,
  configuration: AuthenticationConfiguration,
) {
  return betterAuth({
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: {
        account: authAccounts,
        session: authSessions,
        user: users,
        verification: authVerifications,
      },
    }),
    baseURL: configuration.baseUrl,
    secret: configuration.betterAuthSecret,
    trustedOrigins: [configuration.webUrl],
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      google: {
        clientId: configuration.googleClientId,
        clientSecret: configuration.googleClientSecret,
      },
    },
    user: {
      fields: {
        image: "imageUrl",
        name: "displayName",
      },
      additionalFields: {
        defaultCurrency: {
          type: "string",
          required: true,
          defaultValue: "BRL",
          input: false,
        },
        timeZone: {
          type: "string",
          required: true,
          defaultValue: "UTC",
          input: false,
        },
      },
    },
    advanced: {
      database: {
        generateId: "uuid",
      },
    },
    databaseHooks: {
      user: {
        create: {
          async before(user) {
            const oauthState = await getOAuthState<{ timeZone?: unknown }>();

            return {
              data: {
                ...user,
                defaultCurrency: "BRL",
                timeZone: normalizeBrowserTimeZone(oauthState?.timeZone),
              },
            };
          },
          async after(user) {
            await createDefaultCategoriesForUser(database, user.id);
          },
        },
      },
      account: {
        create: {
          async before(account) {
            return {
              data: {
                ...account,
                accessToken: null,
                refreshToken: null,
                idToken: null,
                accessTokenExpiresAt: null,
                refreshTokenExpiresAt: null,
              },
            };
          },
        },
        update: {
          async before(account) {
            return {
              data: {
                ...account,
                accessToken: null,
                refreshToken: null,
                idToken: null,
                accessTokenExpiresAt: null,
                refreshTokenExpiresAt: null,
              },
            };
          },
        },
      },
    },
  });
}

export type Authentication = ReturnType<typeof createAuthentication>;
