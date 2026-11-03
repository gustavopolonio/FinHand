import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type Account,
  archiveAccount,
  createAccount,
  getAccounts,
  restoreAccount,
  updateAccount,
} from "./api";

const account: Account = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Checking",
  type: "checking",
  currencyCode: "BRL",
  openingBalanceMinor: "12345",
  archivedAt: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-02T12:00:00.000Z",
};

function successfulResponse(body: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("accounts API", () => {
  it("lists accounts with credentials", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ accounts: [account] }));
    vi.stubGlobal("fetch", fetch);

    await expect(getAccounts()).resolves.toEqual([account]);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/accounts",
      expect.objectContaining({
        credentials: "include",
      }),
    );
  });

  it("creates an account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ account }));
    vi.stubGlobal("fetch", fetch);
    const input = {
      name: "Checking",
      type: "checking" as const,
      openingBalanceMinor: "12345",
    };

    await expect(createAccount(input)).resolves.toEqual(account);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/accounts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  });

  it("updates an account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ account }));
    vi.stubGlobal("fetch", fetch);
    const input = {
      name: "Main checking",
      type: "checking" as const,
      openingBalanceMinor: "20000",
    };

    await expect(updateAccount(account.id, input)).resolves.toEqual(account);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/accounts/${account.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  });

  it("archives an account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ account }));
    vi.stubGlobal("fetch", fetch);

    await expect(archiveAccount(account.id)).resolves.toEqual(account);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/accounts/${account.id}/archive`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("restores an account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ account }));
    vi.stubGlobal("fetch", fetch);

    await expect(restoreAccount(account.id)).resolves.toEqual(account);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/accounts/${account.id}/restore`,
      expect.objectContaining({ method: "POST" }),
    );
  });
});
