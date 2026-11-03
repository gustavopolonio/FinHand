import { describe, expect, it } from "vitest";

import type { Account, Category, Transaction } from "@/lib/api";

import {
  formValuesFromTransaction,
  resolveCreateFormValues,
  transactionInputFromForm,
  type TransactionFormValues,
} from "./transaction-form";

const account: Account = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Checking",
  type: "checking",
  currencyCode: "BRL",
  openingBalanceMinor: "0",
  archivedAt: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
};

const category: Category = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Grocery",
  type: "expense",
  archivedAt: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
};

const values: TransactionFormValues = {
  accountId: account.id,
  categoryId: category.id,
  type: "expense",
  amount: "25.90",
  occurredOn: "2026-11-03",
  description: "Weekly groceries",
  counterparty: "Supermarket",
  notes: "Household food",
};

describe("transaction form helpers", () => {
  it("converts form money to exact positive minor units", () => {
    expect(transactionInputFromForm(values)).toEqual({
      accountId: account.id,
      categoryId: category.id,
      type: "expense",
      amountMinor: "2590",
      occurredOn: "2026-11-03",
      description: "Weekly groceries",
      counterparty: "Supermarket",
      notes: "Household food",
    });
  });

  it("rejects zero and negative transaction amounts", () => {
    expect(() =>
      transactionInputFromForm({ ...values, amount: "0.00" }),
    ).toThrow("greater than zero");
    expect(() =>
      transactionInputFromForm({ ...values, amount: "-1.00" }),
    ).toThrow("greater than zero");
  });

  it("falls back to available create options and clears incompatible categories", () => {
    expect(
      resolveCreateFormValues(
        {
          ...values,
          accountId: "33333333-3333-4333-8333-333333333333",
          type: "income",
        },
        [account],
        [category],
      ),
    ).toEqual({
      ...values,
      accountId: account.id,
      categoryId: "",
      type: "income",
    });
  });

  it("maps an API transaction back to editable form values", () => {
    const transaction: Transaction = {
      id: "44444444-4444-4444-8444-444444444444",
      accountId: account.id,
      categoryId: null,
      type: "expense",
      amountMinor: "2590",
      currencyCode: "BRL",
      occurredOn: "2026-11-03",
      description: "Weekly groceries",
      counterparty: null,
      notes: null,
      origin: "manual",
      createdAt: "2026-11-03T15:00:00.000Z",
      updatedAt: "2026-11-03T15:00:00.000Z",
    };

    expect(formValuesFromTransaction(transaction)).toEqual({
      accountId: account.id,
      categoryId: "",
      type: "expense",
      amount: "25.90",
      occurredOn: "2026-11-03",
      description: "Weekly groceries",
      counterparty: "",
      notes: "",
    });
  });
});
