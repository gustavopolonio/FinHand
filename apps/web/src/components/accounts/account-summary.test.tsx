import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { FinancialSummary } from "@/lib/api";

import type { AccountWithBalance } from "./account-data";
import { AccountSummary } from "./account-summary";

const account: AccountWithBalance = {
  archivedAt: null,
  balanceMinor: "125000",
  createdAt: "2026-11-01T12:00:00.000Z",
  currencyCode: "BRL",
  id: "11111111-1111-4111-8111-111111111111",
  name: "Checking",
  openingBalanceMinor: "100000",
  type: "checking",
  updatedAt: "2026-11-01T12:00:00.000Z",
};

const summary: FinancialSummary = {
  accounts: [
    {
      accountId: account.id,
      archivedAt: null,
      balanceMinor: account.balanceMinor,
      currencyCode: account.currencyCode,
      name: account.name,
      type: account.type,
    },
  ],
  categoryTotals: [],
  currencies: [
    {
      activeBalanceMinor: account.balanceMinor,
      currencyCode: "BRL",
      expenseMinor: "0",
      incomeMinor: "25000",
      netFlowMinor: "25000",
    },
  ],
  period: { from: null, to: "2026-11-26" },
};

describe("AccountSummary", () => {
  it("shows the three useful financial metrics without a redundant account count", () => {
    const markup = renderToStaticMarkup(
      <AccountSummary
        accounts={[account]}
        currencyCode="BRL"
        summary={summary}
      />,
    );

    expect(markup).toContain("Active balance");
    expect(markup).toContain("Opening balances");
    expect(markup).toContain("Net movement");
    expect(markup).not.toContain(">Active accounts<");
    expect(markup).toContain("md:grid-cols-3");
  });
});
