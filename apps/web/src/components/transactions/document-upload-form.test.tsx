import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DocumentUploadForm } from "./document-upload-form";

describe("DocumentUploadForm", () => {
  it("renders the supported direct-upload flow", () => {
    const markup = renderToStaticMarkup(
      <DocumentUploadForm
        accounts={[]}
        categories={[]}
        error={null}
        isUploading={false}
        onClearError={vi.fn()}
        onClose={vi.fn()}
        onConfirmCandidate={vi.fn()}
        onGetReview={vi.fn()}
        onUpdateCandidate={vi.fn()}
        onUpload={vi.fn()}
      />,
    );

    expect(markup).toContain('id="transaction-document-panel"');
    expect(markup).toContain("Select a receipt or invoice");
    expect(markup).toContain("Drop your receipt or invoice here");
    expect(markup).toContain("PDF, JPEG or PNG · Up to 10 MiB");
    expect(markup).toContain('type="file"');
    expect(markup).toContain(
      'accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"',
    );
    expect(markup).toContain("Upload document");
    expect(markup).toContain("extraction starts automatically");
  });

  it("renders a server error in the upload panel", () => {
    const markup = renderToStaticMarkup(
      <DocumentUploadForm
        accounts={[]}
        categories={[]}
        error="Document content does not match its declared file type."
        isUploading={false}
        onClearError={vi.fn()}
        onClose={vi.fn()}
        onConfirmCandidate={vi.fn()}
        onGetReview={vi.fn()}
        onUpdateCandidate={vi.fn()}
        onUpload={vi.fn()}
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain(
      "Document content does not match its declared file type.",
    );
  });
});
