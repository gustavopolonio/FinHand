import { describe, expect, it } from "vitest";

import type { Account, TransactionCandidate } from "@/lib/api";

import {
  candidateInputFromForm,
  formValuesFromCandidate,
  validateCandidateForConfirmation,
} from "./transaction-candidate-form";

const account: Account = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Checking",
  type: "checking",
  currencyCode: "BRL",
  openingBalanceMinor: "0",
  archivedAt: null,
  createdAt: "2026-11-10T12:00:00.000Z",
  updatedAt: "2026-11-10T12:00:00.000Z",
};

const candidate: TransactionCandidate = {
  id: "22222222-2222-4222-8222-222222222222",
  uploadId: "33333333-3333-4333-8333-333333333333",
  position: 0,
  accountId: null,
  categoryId: null,
  type: "expense",
  amountMinor: "4290",
  currencyCode: "BRL",
  occurredOn: "2026-11-10",
  description: "Groceries",
  counterparty: "Market",
  notes: null,
  extractionMetadata: null,
  status: "pending",
  createdAt: "2026-11-10T12:00:00.000Z",
  updatedAt: "2026-11-10T12:00:00.000Z",
};

describe("transaction candidate form", () => {
  it("converts extracted minor units into editable form values", () => {
    expect(formValuesFromCandidate(candidate)).toEqual({
      accountId: "",
      categoryId: "",
      type: "expense",
      amount: "42.90",
      currencyCode: "BRL",
      occurredOn: "2026-11-10",
      description: "Groceries",
      counterparty: "Market",
      notes: "",
    });
  });

  it("keeps unknown extracted fields visibly blank", () => {
    expect(
      formValuesFromCandidate({
        ...candidate,
        type: null,
        amountMinor: null,
        currencyCode: null,
        occurredOn: null,
        description: null,
        counterparty: null,
      }),
    ).toMatchObject({
      type: "",
      amount: "",
      currencyCode: "",
      occurredOn: "",
      description: "",
      counterparty: "",
    });
  });

  it("creates a nullable draft update and derives currency from the account", () => {
    expect(
      candidateInputFromForm(
        {
          accountId: account.id,
          categoryId: "",
          type: "expense",
          amount: "55.25",
          currencyCode: "USD",
          occurredOn: "2026-11-11",
          description: "Corrected groceries",
          counterparty: "",
          notes: "",
        },
        [account],
      ),
    ).toEqual({
      accountId: account.id,
      categoryId: null,
      type: "expense",
      amountMinor: "5525",
      currencyCode: "BRL",
      occurredOn: "2026-11-11",
      description: "Corrected groceries",
      counterparty: null,
      notes: null,
    });
  });

  it("rejects invalid and non-positive amounts before saving", () => {
    const values = formValuesFromCandidate(candidate);

    expect(() =>
      candidateInputFromForm({ ...values, amount: "12.345" }, []),
    ).toThrow("Enter a valid amount with up to two decimal places.");
    expect(() =>
      candidateInputFromForm({ ...values, amount: "0.00" }, []),
    ).toThrow("Transaction candidate amount must be greater than zero.");
  });

  it("builds a complete confirmation input from valid fields", () => {
    const values = {
      ...formValuesFromCandidate(candidate),
      accountId: account.id,
      categoryId: "",
      description: "  Groceries  ",
    };

    expect(validateCandidateForConfirmation(values, [account])).toEqual({
      isValid: true,
      input: {
        accountId: account.id,
        categoryId: null,
        type: "expense",
        amountMinor: "4290",
        currencyCode: "BRL",
        occurredOn: "2026-11-10",
        description: "Groceries",
        counterparty: "Market",
        notes: null,
      },
      errors: {},
    });
  });

  it("returns field errors without producing a confirmation request", () => {
    expect(
      validateCandidateForConfirmation(
        {
          accountId: "",
          categoryId: "",
          type: "",
          amount: "0.00",
          currencyCode: "",
          occurredOn: "",
          description: "   ",
          counterparty: "",
          notes: "",
        },
        [account],
      ),
    ).toEqual({
      isValid: false,
      input: null,
      errors: {
        accountId: "Select an account.",
        type: "Select income or expense.",
        amount: "Amount must be greater than zero.",
        currencyCode: "Enter a valid three-letter currency.",
        occurredOn: "Select a date.",
        description: "Enter a description.",
      },
    });
  });

  it("rejects archived accounts and unreal calendar dates", () => {
    const values = {
      ...formValuesFromCandidate(candidate),
      accountId: account.id,
      occurredOn: "2026-02-30",
    };

    expect(
      validateCandidateForConfirmation(values, [
        { ...account, archivedAt: "2026-11-12T12:00:00.000Z" },
      ]),
    ).toMatchObject({
      isValid: false,
      errors: {
        accountId: "Select an active account.",
        occurredOn: "Select a valid date.",
      },
    });
  });
});
