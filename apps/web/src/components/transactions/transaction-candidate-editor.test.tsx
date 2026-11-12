import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Account, Category, TransactionCandidate } from "@/lib/api";

import { TransactionCandidateEditor } from "./transaction-candidate-editor";

const account: Account = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Checking",
  type: "checking",
  currencyCode: "BRL",
  openingBalanceMinor: "0",
  archivedAt: null,
  createdAt: "2026-11-10T12:00:00.000Z",
  updatedAt: "2026-11-10T12:00:00.000Z",
};
const category: Category = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Grocery",
  type: "expense",
  archivedAt: null,
  createdAt: "2026-11-10T12:00:00.000Z",
  updatedAt: "2026-11-10T12:00:00.000Z",
};
const candidate: TransactionCandidate = {
  id: "33333333-3333-4333-8333-333333333333",
  uploadId: "44444444-4444-4444-8444-444444444444",
  position: 0,
  accountId: null,
  categoryId: null,
  type: "expense",
  amountMinor: "4290",
  currencyCode: "BRL",
  occurredOn: "2026-11-10",
  description: "Groceries",
  counterparty: "Market",
  notes: null,
  extractionMetadata: {
    warnings: ["The total was slightly blurred."],
  },
  status: "pending",
  createdAt: "2026-11-10T12:00:00.000Z",
  updatedAt: "2026-11-10T12:00:00.000Z",
};

describe("TransactionCandidateEditor", () => {
  it("shows extracted values, warnings, selectors, and draft semantics", () => {
    const markup = renderToStaticMarkup(
      <TransactionCandidateEditor
        accounts={[account]}
        candidate={candidate}
        categories={[category]}
        error={null}
        onConfirm={vi.fn()}
        onConfirmed={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(markup).toContain("Extraction notes");
    expect(markup).toContain("The total was slightly blurred.");
    expect(markup).toContain('value="42.90"');
    expect(markup).toContain('value="Groceries"');
    expect(markup).toContain('aria-label="Candidate account"');
    expect(markup).toContain("does not create a transaction");
    expect(markup).toContain("Save draft");
    expect(markup).toContain("Hold to confirm");
  });
});
