import { describe, expect, it } from "vitest";

import type { Account } from "@/lib/api";

import {
  accountInputFromForm,
  formValuesFromAccount,
} from "./account-form";

const account: Account = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Checking",
  type: "checking",
  currencyCode: "BRL",
  openingBalanceMinor: "123456789012345678",
  archivedAt: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
};

describe("account form helpers", () => {
  it("converts an exact decimal opening balance to minor units", () => {
    expect(
      accountInputFromForm({
        name: "Wallet",
        type: "cash",
        openingBalance: "-1250.75",
      }),
    ).toEqual({
      name: "Wallet",
      type: "cash",
      openingBalanceMinor: "-125075",
    });
  });

  it("maps an account to editable values without losing precision", () => {
    expect(formValuesFromAccount(account)).toEqual({
      name: "Checking",
      type: "checking",
      openingBalance: "1234567890123456.78",
    });
  });
});
