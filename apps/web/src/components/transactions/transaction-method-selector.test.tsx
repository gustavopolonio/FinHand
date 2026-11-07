import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TransactionMethodSelector } from "./transaction-method-selector";

describe("TransactionMethodSelector", () => {
  it("shows separate manual, document, and camera modes", () => {
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
  });
});
