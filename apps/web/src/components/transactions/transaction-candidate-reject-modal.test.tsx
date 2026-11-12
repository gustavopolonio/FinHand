import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { TransactionCandidate } from "@/lib/api";

import { TransactionCandidateRejectModal } from "./transaction-candidate-reject-modal";

const candidate: TransactionCandidate = {
  id: "11111111-1111-4111-8111-111111111111",
  uploadId: "22222222-2222-4222-8222-222222222222",
  position: 0,
  accountId: null,
  categoryId: null,
  type: "expense",
  amountMinor: "4290",
  currencyCode: "BRL",
  occurredOn: "2026-11-12",
  description: "Groceries",
  counterparty: "Market",
  notes: null,
  extractionMetadata: null,
  status: "pending",
  createdAt: "2026-11-12T12:00:00.000Z",
  updatedAt: "2026-11-12T12:00:00.000Z",
};

describe("TransactionCandidateRejectModal", () => {
  it("explains that discarding does not create a transaction", () => {
    const markup = renderToStaticMarkup(
      <TransactionCandidateRejectModal
        candidate={candidate}
        error={null}
        isRejecting={false}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(markup).toContain('role="alertdialog"');
    expect(markup).toContain("Discard candidate");
    expect(markup).toContain("without creating a transaction");
    expect(markup).toContain("Groceries");
  });

  it("shows rejection progress and errors", () => {
    const markup = renderToStaticMarkup(
      <TransactionCandidateRejectModal
        candidate={candidate}
        error="Candidate is already confirmed."
        isRejecting
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(markup).toContain("Discarding");
    expect(markup).toContain("Candidate is already confirmed.");
  });
});
