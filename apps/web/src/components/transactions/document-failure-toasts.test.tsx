import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DocumentFailureToasts } from "./document-failure-toasts";

describe("DocumentFailureToasts", () => {
  it("renders filename, retry, and dismiss actions", () => {
    const markup = renderToStaticMarkup(
      <DocumentFailureToasts
        notices={[
          {
            uploadId: "11111111-1111-4111-8111-111111111111",
            originalFileName: "receipt.png",
          },
        ]}
        onDismiss={vi.fn()}
        onUploadAnother={vi.fn()}
      />,
    );

    expect(markup).toContain("Document processing failed");
    expect(markup).toContain("receipt.png");
    expect(markup).toContain("Dismiss");
    expect(markup).toContain("Upload another");
    expect(markup).toContain('role="alert"');
  });

  it("renders nothing without failures", () => {
    expect(
      renderToStaticMarkup(
        <DocumentFailureToasts
          notices={[]}
          onDismiss={vi.fn()}
          onUploadAnother={vi.fn()}
        />,
      ),
    ).toBe("");
  });
});
