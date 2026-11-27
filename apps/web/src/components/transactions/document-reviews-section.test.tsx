import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DocumentReview } from "@/lib/api";

import {
  DocumentReviewRows,
  DocumentReviewsList,
  hasProcessingDocumentReviews,
} from "./document-reviews-section";

function review(
  status: DocumentReview["status"],
  overrides: Partial<DocumentReview> = {},
): DocumentReview {
  return {
    uploadId: `${status}-upload`,
    kind: "document",
    originalFileName: `${status}-receipt.pdf`,
    status,
    failureCode: status === "failed" ? "document_extraction_failed" : null,
    pendingCandidateCount: status === "processed" ? 1 : 0,
    createdAt: "2026-11-10T12:00:00.000Z",
    updatedAt: "2026-11-10T12:01:00.000Z",
    ...overrides,
  };
}

describe("document reviews section", () => {
  it.each([
    [[review("pending")], true],
    [[review("uploaded")], true],
    [[review("processing")], true],
    [[review("processed")], false],
    [[review("failed")], false],
    [[], false],
  ])("identifies whether the list has active processing", (reviews, expected) => {
    expect(hasProcessingDocumentReviews(reviews)).toBe(expected);
  });

  it("renders a compact collapsed summary by default", () => {
    const markup = renderToStaticMarkup(
      <DocumentReviewsList
        onOpenReview={vi.fn()}
        reviews={[
          review("uploaded"),
          review("processing"),
          review("processed", { pendingCandidateCount: 2 }),
        ]}
      />,
    );

    expect(markup).toContain("Pending transactions");
    expect(markup).toContain("1 transaction needs your review");
    expect(markup).toContain("2 processing");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("Review next");
    expect(markup).not.toContain("uploaded-receipt.pdf");
  });

  it("renders document creation dates and actionable row states", () => {
    const markup = renderToStaticMarkup(
      <DocumentReviewRows
        onOpenReview={vi.fn()}
        reviews={[
          review("uploaded"),
          review("processing"),
          review("processed", { pendingCandidateCount: 2 }),
        ]}
      />,
    );

    expect(markup).toContain("Waiting for analysis");
    expect(markup).toContain("Analyzing document");
    expect(markup).toContain("2 candidates ready for review");
    expect(markup).toContain("Created");
    expect(markup).toContain('dateTime="2026-11-10T12:00:00.000Z"');
    expect(markup).toContain("Review");
    expect(markup).not.toContain("Document processing failed");
  });

  it("identifies recordings while they are being analyzed", () => {
    const markup = renderToStaticMarkup(
      <DocumentReviewRows
        onOpenReview={vi.fn()}
        reviews={[
          review("processing", {
            kind: "audio",
            originalFileName: "voice-recording.webm",
          }),
        ]}
      />,
    );

    expect(markup).toContain("voice-recording.webm");
    expect(markup).toContain("Analyzing recording");
  });
});
