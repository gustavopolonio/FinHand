import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Account, Category, Transaction } from "@/lib/api";

import { TransactionDrawer } from "./transaction-drawer";

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

const commonProps = {
  accounts: [account],
  categories: [category],
  error: null,
  isManagingCaptureSession: false,
  isSubmitting: false,
  isUploadingDocument: false,
  onCancelCaptureSession: vi.fn(),
  onClearError: vi.fn(),
  onClose: vi.fn(),
  onCreateCaptureSession: vi.fn(),
  onGetCaptureSessionProgress: vi.fn(),
  onSubmit: vi.fn(),
  onUploadDocument: vi.fn(),
};

describe("TransactionDrawer", () => {
  it("defaults to manual entry with document, camera, and phone options", () => {
    const markup = renderToStaticMarkup(
      <TransactionDrawer {...commonProps} transaction={null} />,
    );

    expect(markup).toContain("Add Transaction");
    expect(markup).toContain(
      'aria-label="Transaction creation method"',
    );
    expect(markup).toContain("Manual");
    expect(markup).toContain("Upload document");
    expect(markup).toContain("Take photo");
    expect(markup).toContain("Use phone");
    expect(markup).toContain('id="transaction-manual-panel"');
    expect(markup).toContain("Save Transaction");
  });

  it("does not show creation modes while editing a transaction", () => {
    const markup = renderToStaticMarkup(
      <TransactionDrawer {...commonProps} transaction={transaction} />,
    );

    expect(markup).toContain("Edit Transaction");
    expect(markup).not.toContain(
      'aria-label="Transaction creation method"',
    );
    expect(markup).toContain("Save Changes");
  });
});
