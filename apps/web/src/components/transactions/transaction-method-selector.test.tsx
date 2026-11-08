import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TransactionMethodSelector } from "./transaction-method-selector";

describe("TransactionMethodSelector", () => {
  it("shows separate manual, document, camera, and phone modes", () => {
    const markup = renderToStaticMarkup(
      <TransactionMethodSelector
        disabled={false}
        onChange={vi.fn()}
        value="manual"
      />,
    );

    expect(markup).toContain('role="group"');
    expect(markup).toContain("Manual");
    expect(markup).toContain("Upload document");
    expect(markup).toContain("Take photo");
    expect(markup).toContain("Use phone");
    expect(markup).toContain('id="transaction-manual-tab"');
    expect(markup).toContain(
      'aria-controls="transaction-manual-panel" aria-pressed="true"',
    );
    expect(markup).toContain('id="transaction-document-tab"');
    expect(markup).toContain(
      'aria-controls="transaction-document-panel" aria-pressed="false"',
    );
    expect(markup).toContain('id="transaction-camera-tab"');
    expect(markup).toContain(
      'aria-controls="transaction-camera-panel" aria-pressed="false"',
    );
    expect(markup).toContain('id="transaction-qr-tab"');
    expect(markup).toContain(
      'aria-controls="transaction-qr-panel" aria-pressed="false"',
    );
  });
});
