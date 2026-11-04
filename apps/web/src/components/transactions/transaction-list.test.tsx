import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Account, Category, Transaction } from "@/lib/api";

import { TransactionList } from "./transaction-list";

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

const transaction: Transaction = {
  id: "33333333-3333-4333-8333-333333333333",
  accountId: account.id,
  categoryId: category.id,
  type: "expense",
  amountMinor: "2590",
  currencyCode: "BRL",
  occurredOn: "2026-11-03",
  description: "Weekly groceries",
  counterparty: "Supermarket",
  notes: null,
  origin: "manual",
  createdAt: "2026-11-03T15:00:00.000Z",
  updatedAt: "2026-11-03T15:00:00.000Z",
};

describe("TransactionList", () => {
  it("renders transaction references and a signed exact amount", () => {
    const markup = renderToStaticMarkup(
      <TransactionList
        accounts={[account]}
        busyTransactionId={null}
        categories={[category]}
        isLoading={false}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        transactions={[transaction]}
      />,
    );

    expect(markup).toContain("Weekly groceries");
    expect(markup).toContain("Supermarket");
    expect(markup).toContain("Grocery");
    expect(markup).toContain("Checking");
    expect(markup).toContain("-R$ 25.90");
  });

  it("renders the filtered empty state", () => {
    const markup = renderToStaticMarkup(
      <TransactionList
        accounts={[]}
        busyTransactionId={null}
        categories={[]}
        isLoading={false}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        transactions={[]}
      />,
    );

    expect(markup).toContain("No transactions found");
  });
});
