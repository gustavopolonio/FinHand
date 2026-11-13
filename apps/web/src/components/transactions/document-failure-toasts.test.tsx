import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DocumentFailureToasts } from "./document-failure-toasts";

describe("DocumentFailureToasts", () => {
  it("renders a retry action for transient failures", () => {
    const markup = renderToStaticMarkup(
      <DocumentFailureToasts
        notices={[
          {
            uploadId: "11111111-1111-4111-8111-111111111111",
            originalFileName: "receipt.png",
            failure: {
              code: "ai_timeout",
              canRetry: true,
              message: "Document analysis timed out. You can try again.",
            },
          },
        ]}
        onDismiss={vi.fn()}
        onRetry={vi.fn()}
        onUploadAnother={vi.fn()}
        retryingUploadId={null}
      />,
    );

    expect(markup).toContain("Document processing failed");
    expect(markup).toContain("receipt.png");
    expect(markup).toContain("Dismiss");
    expect(markup).toContain("Document analysis timed out");
    expect(markup).toContain("Retry processing");
    expect(markup).not.toContain("Upload another");
    expect(markup).toContain('role="alert"');
  });

  it("offers another upload for a permanent content failure", () => {
    const markup = renderToStaticMarkup(
      <DocumentFailureToasts
        notices={[
          {
            uploadId: "11111111-1111-4111-8111-111111111111",
            originalFileName: "receipt.png",
            failure: {
              code: "no_transaction_candidates",
              canRetry: false,
              message: "No financial transaction was found.",
            },
          },
        ]}
        onDismiss={vi.fn()}
        onRetry={vi.fn()}
        onUploadAnother={vi.fn()}
        retryingUploadId={null}
      />,
    );

    expect(markup).toContain("Upload another");
    expect(markup).not.toContain("Retry processing");
  });

  it("renders nothing without failures", () => {
    expect(
      renderToStaticMarkup(
        <DocumentFailureToasts
          notices={[]}
          onDismiss={vi.fn()}
          onRetry={vi.fn()}
          onUploadAnother={vi.fn()}
          retryingUploadId={null}
        />,
      ),
    ).toBe("");
  });
});
