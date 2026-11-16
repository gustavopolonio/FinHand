import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { TransactionCandidateReview } from "@/lib/api";

import {
  shouldPollCandidateReview,
  TransactionCandidateReviewPanel,
} from "./transaction-candidate-review";

function reviewWithStatus(
  status: TransactionCandidateReview["upload"]["status"],
  kind: TransactionCandidateReview["upload"]["kind"] = "document",
): TransactionCandidateReview {
  return {
    upload: {
      id: "11111111-1111-4111-8111-111111111111",
      kind,
      originalFileName: "receipt.pdf",
      status,
      failureCode: status === "failed" ? "document_extraction_failed" : null,
      processingAttempts: 1,
      failure:
        status === "failed"
          ? {
              code: "document_extraction_failed",
              canRetry: false,
              message: "This document could not be analyzed.",
            }
          : null,
    },
    candidates: [],
  };
}

describe("transaction candidate review", () => {
  it.each([
    [null, true],
    [reviewWithStatus("pending"), true],
    [reviewWithStatus("uploaded"), true],
    [reviewWithStatus("processing"), true],
    [reviewWithStatus("processed"), false],
    [reviewWithStatus("failed"), false],
  ])("decides whether processing should continue polling", (review, expected) => {
    expect(shouldPollCandidateReview(review)).toBe(expected);
  });

  it("renders a queued state while the first status request loads", () => {
    const markup = renderToStaticMarkup(
      <TransactionCandidateReviewPanel
        accounts={[]}
        categories={[]}
        error={null}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
        onGetReview={vi.fn()}
        onReject={vi.fn()}
        onUpdate={vi.fn()}
        panelId="candidate-panel"
        tabId="candidate-tab"
        uploadId="11111111-1111-4111-8111-111111111111"
      />,
    );

    expect(markup).toContain('id="candidate-panel"');
    expect(markup).toContain("Document queued for analysis");
    expect(markup).toContain("appear here automatically");
  });

  it("polls audio uploads until their candidates are ready", () => {
    expect(shouldPollCandidateReview(reviewWithStatus("processing", "audio"))).toBe(
      true,
    );
    expect(shouldPollCandidateReview(reviewWithStatus("processed", "audio"))).toBe(
      false,
    );
  });
});
