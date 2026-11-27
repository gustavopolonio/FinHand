import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Account } from "@/lib/api";

import { AccountDrawer } from "./account-drawer";

const account: Account = {
  archivedAt: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  currencyCode: "BRL",
  id: "11111111-1111-4111-8111-111111111111",
  name: "Checking",
  openingBalanceMinor: "100000",
  type: "checking",
  updatedAt: "2026-11-01T12:00:00.000Z",
};

const commonProps = {
  defaultCurrency: "BRL",
  error: null,
  isSubmitting: false,
  onClose: vi.fn(),
  onSubmit: vi.fn(),
};

describe("AccountDrawer", () => {
  it("keeps the edit modal concise", () => {
    const markup = renderToStaticMarkup(
      <AccountDrawer {...commonProps} account={account} />,
    );

    expect(markup).toContain("Edit Account");
    expect(markup).not.toContain(
      "Update the account name, type, or starting balance.",
    );
  });

  it("retains helpful context when creating an account", () => {
    const markup = renderToStaticMarkup(
      <AccountDrawer {...commonProps} account={null} />,
    );

    expect(markup).toContain("Add Account");
    expect(markup).toContain(
      "Add an account to start tracking its financial activity.",
    );
  });
});
