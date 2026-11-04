import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../db/index.js";
import { categories } from "../db/schema/index.js";
import { createAuthentication } from "./authentication.js";

const getOAuthState = vi.hoisted(() => vi.fn());

vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  getOAuthState,
}));

const configuration = {
  baseUrl: "http://localhost:3001",
  betterAuthSecret: "a-secure-test-secret-with-32-characters",
  googleClientId: "google-client-id",
  googleClientSecret: "google-client-secret",
  webUrl: "http://localhost:3000",
};

beforeEach(() => {
  getOAuthState.mockReset();
});

describe("createAuthentication", () => {
  it("configures Google-only authentication with trusted web origins", () => {
    const authentication = createAuthentication(
      {} as Database,
      configuration,
    );

    expect(authentication.options).toMatchObject({
      baseURL: configuration.baseUrl,
      secret: configuration.betterAuthSecret,
      trustedOrigins: [configuration.webUrl],
      emailAndPassword: { enabled: false },
      socialProviders: {
        google: {
          clientId: configuration.googleClientId,
          clientSecret: configuration.googleClientSecret,
        },
      },
      advanced: { database: { generateId: "uuid" } },
    });
  });

  it("creates default categories after a user is created", async () => {
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });
    const database = { insert } as unknown as Database;
    const authentication = createAuthentication(database, configuration);
    const afterUserCreation =
      authentication.options.databaseHooks?.user?.create?.after;
    const userId = "33333333-3333-4333-8333-333333333333";

    expect(afterUserCreation).toBeTypeOf("function");
    await afterUserCreation?.({ id: userId } as never);

    expect(insert).toHaveBeenCalledWith(categories);
    expect(values).toHaveBeenCalledWith([
      { userId, name: "Salary", type: "income" },
      { userId, name: "Grocery", type: "expense" },
    ]);
    expect(onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("sets server-controlled defaults before creating a user", async () => {
    getOAuthState.mockResolvedValue({
      timeZone: " America/Sao_Paulo ",
    });
    const authentication = createAuthentication(
      {} as Database,
      configuration,
    );
    const beforeUserCreation =
      authentication.options.databaseHooks?.user?.create?.before;

    expect(beforeUserCreation).toBeTypeOf("function");
    await expect(
      beforeUserCreation?.({
        id: "33333333-3333-4333-8333-333333333333",
        email: "user@example.com",
        defaultCurrency: "USD",
        timeZone: "untrusted",
      } as never),
    ).resolves.toMatchObject({
      data: {
        id: "33333333-3333-4333-8333-333333333333",
        email: "user@example.com",
        defaultCurrency: "BRL",
        timeZone: "America/Sao_Paulo",
      },
    });
  });

  it.each(["create", "update"] as const)(
    "discards Google tokens before an auth account %s",
    async (operation) => {
      const authentication = createAuthentication(
        {} as Database,
        configuration,
      );
      const beforeAccountWrite =
        authentication.options.databaseHooks?.account?.[operation]?.before;

      expect(beforeAccountWrite).toBeTypeOf("function");
      await expect(
        beforeAccountWrite?.({
          id: "account-id",
          accessToken: "access-token",
          refreshToken: "refresh-token",
          idToken: "id-token",
          accessTokenExpiresAt: new Date(),
          refreshTokenExpiresAt: new Date(),
        } as never),
      ).resolves.toMatchObject({
        data: {
          id: "account-id",
          accessToken: null,
          refreshToken: null,
          idToken: null,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
        },
      });
    },
  );
});
