import { describe, expect, it } from "vitest";

import type { FinancialSummary, Transaction } from "@/lib/api";

import {
  createCategoryGradient,
  createCategorySlices,
  firstNameFromUser,
  getGreeting,
  signedTransactionAmount,
} from "./overview-data";

const categoryTotals: FinancialSummary["categoryTotals"] = [
  {
    categoryId: "11111111-1111-4111-8111-111111111111",
    name: "Grocery",
    type: "expense",
    currencyCode: "BRL",
    totalMinor: "9007199254740993",
    transactionCount: 12,
  },
  {
    categoryId: "22222222-2222-4222-8222-222222222222",
    name: "Transport",
    type: "expense",
    currencyCode: "BRL",
    totalMinor: "9007199254740993",
    transactionCount: 3,
  },
  {
    categoryId: "33333333-3333-4333-8333-333333333333",
    name: "Salary",
    type: "income",
    currencyCode: "BRL",
    totalMinor: "500000",
    transactionCount: 1,
  },
];

describe("overview data helpers", () => {
  it("calculates category percentages without floating-point money", () => {
    const slices = createCategorySlices(categoryTotals, "BRL");

    expect(slices.map(({ name, percentage }) => ({ name, percentage }))).toEqual([
      { name: "Grocery", percentage: 50 },
      { name: "Transport", percentage: 50 },
    ]);
    expect(createCategoryGradient(slices)).toContain("conic-gradient");
  });

  it("derives greetings and names for the workspace header", () => {
    expect(firstNameFromUser(" Gustavo Polonio ", "user@example.com")).toBe(
      "Gustavo",
    );
    expect(firstNameFromUser(null, "finhand@example.com")).toBe("finhand");
    expect(
      getGreeting(new Date("2026-11-04T13:00:00.000Z"), "America/Sao_Paulo"),
    ).toBe("Good morning");
  });

  it("applies the transaction type sign without changing the amount", () => {
    const transaction = {
      type: "expense",
      amountMinor: "2590",
    } as Transaction;

    expect(signedTransactionAmount(transaction)).toBe("-2590");
    expect(
      signedTransactionAmount({ ...transaction, type: "income" }),
    ).toBe("2590");
  });
});
