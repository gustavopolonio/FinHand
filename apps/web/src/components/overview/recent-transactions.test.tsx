import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { FinancialSummary, Transaction } from "@/lib/api";

import { RecentTransactions } from "./recent-transactions";

const accountId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const longDescription =
  "A deliberately long dashboard transaction description that must never resize or hide the remaining columns";

const summary: FinancialSummary = {
  period: { from: null, to: "2026-11-26" },
  currencies: [],
  accounts: [
    {
      accountId,
      name: "Checking",
      type: "checking",
      currencyCode: "BRL",
      archivedAt: null,
      balanceMinor: "10000",
    },
  ],
  categoryTotals: [
    {
      categoryId,
      name: "Grocery",
      type: "expense",
      currencyCode: "BRL",
      totalMinor: "2590",
      transactionCount: 1,
    },
  ],
};

const transaction: Transaction = {
  id: "33333333-3333-4333-8333-333333333333",
  accountId,
  categoryId,
  type: "expense",
  amountMinor: "2590",
  currencyCode: "BRL",
  occurredOn: "2026-11-26",
  description: longDescription,
  counterparty: "Supermarket",
  notes: null,
  origin: "manual",
  createdAt: "2026-11-26T12:00:00.000Z",
  updatedAt: "2026-11-26T12:00:00.000Z",
};

describe("RecentTransactions", () => {
  it("keeps long descriptions inside a fixed, truncating dashboard column", () => {
    const markup = renderToStaticMarkup(
      <RecentTransactions summary={summary} transactions={[transaction]} />,
    );

    expect(markup).toContain("table-fixed");
    expect(markup).toContain('class="w-[34%]"');
    expect(markup).toContain(`title="${longDescription}"`);
    expect(markup).toContain("truncate text-sm");
    expect(markup).toContain("Grocery");
    expect(markup).toContain("Checking");
    expect(markup).toContain("-R$ 25.90");
  });
});
