import { describe, expect, it } from "vitest";

import type { Account, FinancialSummary } from "@/lib/api";

import {
  accountsWithBalances,
  calculateAccountMetrics,
  sortAccountsByBalance,
} from "./account-data";

const account: Account = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Checking",
  type: "checking",
  currencyCode: "BRL",
  openingBalanceMinor: "9007199254740993",
  archivedAt: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
};

const summary: FinancialSummary = {
  period: { from: null, to: "2026-11-04" },
  currencies: [
    {
      currencyCode: "BRL",
      activeBalanceMinor: "9007199254741093",
      incomeMinor: "100",
      expenseMinor: "0",
      netFlowMinor: "100",
    },
  ],
  accounts: [
    {
      accountId: account.id,
      name: account.name,
      type: account.type,
      currencyCode: account.currencyCode,
      archivedAt: null,
      balanceMinor: "9007199254741093",
    },
  ],
  categoryTotals: [],
};

describe("account data helpers", () => {
  it("combines account metadata with exact calculated balances", () => {
    const combined = accountsWithBalances([account], summary);

    expect(combined[0]?.balanceMinor).toBe("9007199254741093");
    expect(calculateAccountMetrics(combined, summary, "BRL")).toEqual({
      activeBalanceMinor: "9007199254741093",
      activeCount: 1,
      netMovementMinor: "100",
      openingBalanceMinor: "9007199254740993",
    });
  });

  it("sorts account balances without Number conversion", () => {
    const combined = accountsWithBalances([account], summary);
    const smaller = {
      ...combined[0]!,
      id: "22222222-2222-4222-8222-222222222222",
      name: "Cash",
      balanceMinor: "9007199254741092",
    };

    expect(sortAccountsByBalance([smaller, combined[0]!])).toEqual([
      combined[0],
      smaller,
    ]);
  });
});
