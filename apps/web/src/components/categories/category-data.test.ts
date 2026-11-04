import { describe, expect, it } from "vitest";

import type { Category, FinancialSummary } from "@/lib/api";

import {
  calculateCategoryOverview,
  categoriesWithTotals,
  sortCategoriesByVolume,
  summaryFiltersForMonth,
} from "./category-data";

const categories: Category[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Grocery",
    type: "expense",
    archivedAt: null,
    createdAt: "2026-11-01T12:00:00.000Z",
    updatedAt: "2026-11-01T12:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Transport",
    type: "expense",
    archivedAt: null,
    createdAt: "2026-11-01T12:00:00.000Z",
    updatedAt: "2026-11-01T12:00:00.000Z",
  },
];

const summary: FinancialSummary = {
  period: { from: null, to: "2026-11-04" },
  currencies: [
    {
      currencyCode: "BRL",
      activeBalanceMinor: "0",
      incomeMinor: "0",
      expenseMinor: "18014398509481987",
      netFlowMinor: "-18014398509481987",
    },
  ],
  accounts: [],
  categoryTotals: [
    {
      categoryId: categories[0]!.id,
      name: categories[0]!.name,
      type: "expense",
      currencyCode: "BRL",
      totalMinor: "9007199254740993",
      transactionCount: 4,
    },
    {
      categoryId: categories[1]!.id,
      name: categories[1]!.name,
      type: "expense",
      currencyCode: "BRL",
      totalMinor: "9007199254740993",
      transactionCount: 2,
    },
    {
      categoryId: null,
      name: "Uncategorized",
      type: "expense",
      currencyCode: "BRL",
      totalMinor: "1",
      transactionCount: 1,
    },
  ],
};

describe("category data helpers", () => {
  it("calculates exact categorized totals above Number safe range", () => {
    expect(calculateCategoryOverview(categories, summary, "BRL")).toEqual({
      activeCount: 2,
      categorizedExpenseMinor: "18014398509481986",
      categorizedPercentage: 99.9,
      expenseMinor: "18014398509481987",
      uncategorizedExpenseMinor: "1",
    });
  });

  it("combines and sorts category totals without floating-point money", () => {
    const combined = categoriesWithTotals(categories, summary, "BRL");

    expect(combined[0]?.transactionCount).toBe(4);
    expect(combined[0]?.percentage).toBe(49.9);
    expect(sortCategoriesByVolume(combined).map(({ name }) => name)).toEqual([
      "Grocery",
      "Transport",
    ]);
  });

  it("resolves calendar month boundaries without local-time conversion", () => {
    expect(summaryFiltersForMonth("2024-02")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
    expect(summaryFiltersForMonth("invalid")).toEqual({});
  });
});
