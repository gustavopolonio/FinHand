import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ReceiptCameraForm } from "./receipt-camera-form";

describe("ReceiptCameraForm", () => {
  it("renders a camera flow separate from document selection", () => {
    const markup = renderToStaticMarkup(
      <ReceiptCameraForm
        error={null}
        isUploading={false}
        onClearError={vi.fn()}
        onClose={vi.fn()}
        onUpload={vi.fn()}
      />,
    );

    expect(markup).toContain('id="transaction-camera-panel"');
    expect(markup).toContain('aria-labelledby="transaction-camera-tab"');
    expect(markup).toContain("Photograph a receipt");
    expect(markup).toContain("Open rear camera");
    expect(markup).toContain("Upload photo");
    expect(markup).not.toContain("application/pdf");
  });

  it("renders upload errors in the camera panel", () => {
    const markup = renderToStaticMarkup(
      <ReceiptCameraForm
        error="The uploaded photo could not be stored."
        isUploading={false}
        onClearError={vi.fn()}
        onClose={vi.fn()}
        onUpload={vi.fn()}
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("The uploaded photo could not be stored.");
  });
});
