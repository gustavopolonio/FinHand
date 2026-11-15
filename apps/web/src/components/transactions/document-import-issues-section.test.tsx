import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DocumentImportIssue } from "@/lib/api";

import {
  DocumentImportIssueRows,
  DocumentImportIssuesList,
} from "./document-import-issues-section";

function issue(
  canRetry: boolean,
  overrides: Partial<DocumentImportIssue> = {},
): DocumentImportIssue {
  return {
    uploadId: canRetry ? "retryable-upload" : "permanent-upload",
    originalFileName: canRetry ? "receipt.pdf" : "empty-document.pdf",
    failure: {
      code: canRetry ? "provider_unavailable" : "no_candidates",
      canRetry,
      message: canRetry
        ? "The document service is temporarily unavailable."
        : "No transaction could be found in this document.",
    },
    createdAt: "2026-11-10T12:00:00.000Z",
    failedAt: "2026-11-10T12:01:00.000Z",
    ...overrides,
  };
}

describe("document import issues section", () => {
  it("renders a compact collapsed summary by default", () => {
    const markup = renderToStaticMarkup(
      <DocumentImportIssuesList
        dismissingUploadId={null}
        issues={[issue(true), issue(false)]}
        onDismiss={vi.fn()}
        onRetry={vi.fn()}
        onUploadAnother={vi.fn()}
        retryingUploadId={null}
      />,
    );

    expect(markup).toContain("Import issues");
    expect(markup).toContain("2 document imports need your attention");
    expect(markup).toContain("1 can be retried");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain("receipt.pdf");
  });

  it("shows retry, replacement, dismissal, and failure dates", () => {
    const markup = renderToStaticMarkup(
      <DocumentImportIssueRows
        dismissingUploadId={null}
        issues={[issue(true), issue(false)]}
        onDismiss={vi.fn()}
        onRetry={vi.fn()}
        onUploadAnother={vi.fn()}
        retryingUploadId={null}
      />,
    );

    expect(markup).toContain("Retry processing");
    expect(markup).toContain("Upload another");
    expect(markup.match(/Dismiss/g)).toHaveLength(2);
    expect(markup).toContain('dateTime="2026-11-10T12:01:00.000Z"');
    expect(markup).toContain("The document service is temporarily unavailable.");
    expect(markup).toContain("No transaction could be found in this document.");
  });
});
