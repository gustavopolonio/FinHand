import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { QrCaptureForm } from "./qr-capture-form";

describe("QrCaptureForm", () => {
  it("explains the short-lived single-use phone flow before generation", () => {
    const markup = renderToStaticMarkup(
      <QrCaptureForm
        error={null}
        isManaging={false}
        onCancel={vi.fn()}
        onClearError={vi.fn()}
        onClose={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(markup).toContain('id="transaction-qr-panel"');
    expect(markup).toContain("Continue on your phone");
    expect(markup).toContain("expires after five minutes");
    expect(markup).toContain("Generate QR code");
  });

  it("renders session creation errors", () => {
    const markup = renderToStaticMarkup(
      <QrCaptureForm
        error="Capture session could not be created."
        isManaging={false}
        onCancel={vi.fn()}
        onClearError={vi.fn()}
        onClose={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Capture session could not be created.");
  });
});
