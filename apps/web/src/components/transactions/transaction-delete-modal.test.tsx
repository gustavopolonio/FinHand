import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Transaction } from "@/lib/api";

import { TransactionDeleteModal } from "./transaction-delete-modal";

const transaction: Transaction = {
  id: "33333333-3333-4333-8333-333333333333",
  accountId: "11111111-1111-4111-8111-111111111111",
  categoryId: "22222222-2222-4222-8222-222222222222",
  type: "expense",
  amountMinor: "34250",
  currencyCode: "BRL",
  occurredOn: "2026-11-03",
  description: "Weekly groceries",
  counterparty: "Supermarket",
  notes: null,
  origin: "manual",
  createdAt: "2026-11-03T15:00:00.000Z",
  updatedAt: "2026-11-03T15:00:00.000Z",
};

describe("TransactionDeleteModal", () => {
  it("shows the irreversible action and the transaction being deleted", () => {
    const markup = renderToStaticMarkup(
      <TransactionDeleteModal
        accountName="Checking"
        categoryName="Grocery"
        error={null}
        isDeleting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        transaction={transaction}
      />,
    );

    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain("Delete transaction");
    expect(markup).toContain("cannot be reversed");
    expect(markup).toContain("Weekly groceries");
    expect(markup).toContain("Supermarket");
    expect(markup).toContain("-R$ 342.50");
    expect(markup).toContain("Checking");
    expect(markup).toContain("Grocery");
    expect(markup).toContain("Keep transaction");
    expect(markup).toContain("Delete entry");
  });

  it("disables dismissal and exposes an error while deletion is running", () => {
    const markup = renderToStaticMarkup(
      <TransactionDeleteModal
        accountName="Checking"
        categoryName="Grocery"
        error="Transaction could not be deleted."
        isDeleting
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        transaction={transaction}
      />,
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Deleting…");
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Transaction could not be deleted.");
    expect(markup.match(/disabled=""/g)).toHaveLength(3);
  });

  it("preserves income semantics in the transaction summary", () => {
    const markup = renderToStaticMarkup(
      <TransactionDeleteModal
        accountName="Savings"
        categoryName="Salary"
        error={null}
        isDeleting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        transaction={{
          ...transaction,
          categoryId: null,
          counterparty: null,
          type: "income",
        }}
      />,
    );

    expect(markup).toContain("R$ 342.50");
    expect(markup).not.toContain("-R$ 342.50");
    expect(markup).toContain("Credit");
    expect(markup).toContain("No counterparty");
  });
});
