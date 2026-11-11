import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  processingMessage,
  QrCaptureForm,
} from "./qr-capture-form";

const onGetProgress = vi.fn();

describe("QrCaptureForm", () => {
  it("explains the short-lived single-use phone flow before generation", () => {
    const markup = renderToStaticMarkup(
      <QrCaptureForm
        accounts={[]}
        categories={[]}
        error={null}
        isManaging={false}
        onCancel={vi.fn()}
        onClearError={vi.fn()}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onGetProgress={onGetProgress}
        onGetReview={vi.fn()}
        onUpdateCandidate={vi.fn()}
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
        accounts={[]}
        categories={[]}
        error="Capture session could not be created."
        isManaging={false}
        onCancel={vi.fn()}
        onClearError={vi.fn()}
        onClose={vi.fn()}
        onCreate={vi.fn()}
        onGetProgress={onGetProgress}
        onGetReview={vi.fn()}
        onUpdateCandidate={vi.fn()}
      />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Capture session could not be created.");
  });

  it("provides messages for received, processing, ready, and failed uploads", () => {
    expect(processingMessage("uploaded").title).toBe("Receipt received");
    expect(processingMessage("processing").title).toBe(
      "Processing your receipt",
    );
    expect(processingMessage("processed").title).toBe(
      "Receipt ready for review",
    );
    expect(processingMessage("failed").title).toBe(
      "Receipt processing failed",
    );
  });
});
