import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { FinancialSummary } from "@/lib/api";

import { FinancialSummaryContent } from "./financial-summary-content";

const summary: FinancialSummary = {
  period: { from: "2026-11-01", to: "2026-11-30" },
  currencies: [
    {
      currencyCode: "BRL",
      activeBalanceMinor: "320000",
      incomeMinor: "300000",
      expenseMinor: "80000",
      netFlowMinor: "220000",
    },
  ],
  accounts: [
    {
      accountId: "11111111-1111-4111-8111-111111111111",
      name: "Checking",
      type: "checking",
      currencyCode: "BRL",
      archivedAt: null,
      balanceMinor: "320000",
    },
    {
      accountId: "22222222-2222-4222-8222-222222222222",
      name: "Old wallet",
      type: "cash",
      currencyCode: "BRL",
      archivedAt: "2026-10-01T12:00:00.000Z",
      balanceMinor: "5000",
    },
  ],
  categoryTotals: [
    {
      categoryId: "33333333-3333-4333-8333-333333333333",
      name: "Grocery",
      type: "expense",
      currencyCode: "BRL",
      totalMinor: "75000",
      transactionCount: 12,
    },
    {
      categoryId: null,
      name: "Uncategorized",
      type: "expense",
      currencyCode: "BRL",
      totalMinor: "5000",
      transactionCount: 1,
    },
  ],
};

describe("FinancialSummaryContent", () => {
  it("renders currency, account, and category summaries", () => {
    const markup = renderToStaticMarkup(
      <FinancialSummaryContent summary={summary} />,
    );

    expect(markup).toContain("2026-11-01 to 2026-11-30");
    expect(markup).toContain("Active balance");
    expect(markup).toContain("BRL 3200.00");
    expect(markup).toContain("BRL 3000.00");
    expect(markup).toContain("BRL 800.00");
    expect(markup).toContain("BRL 2200.00");
    expect(markup).toContain("Checking");
    expect(markup).toContain("Old wallet");
    expect(markup).toContain("Archived");
    expect(markup).toContain("Grocery");
    expect(markup).toContain("12 transactions");
    expect(markup).toContain("Uncategorized");
    expect(markup).toContain("1 transaction");
  });

  it("renders a clear empty state", () => {
    const markup = renderToStaticMarkup(
      <FinancialSummaryContent
        summary={{
          period: { from: null, to: "2026-11-04" },
          currencies: [],
          accounts: [],
          categoryTotals: [],
        }}
      />,
    );

    expect(markup).toContain(
      "No financial data is available for this period.",
    );
  });
});
