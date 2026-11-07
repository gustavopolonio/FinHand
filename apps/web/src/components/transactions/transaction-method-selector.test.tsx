import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TransactionMethodSelector } from "./transaction-method-selector";

describe("TransactionMethodSelector", () => {
  it("shows manual and document modes with the current selection", () => {
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
    expect(markup).toContain('id="transaction-manual-tab"');
    expect(markup).toContain(
      'aria-controls="transaction-manual-panel" aria-pressed="true"',
    );
    expect(markup).toContain('id="transaction-document-tab"');
    expect(markup).toContain(
      'aria-controls="transaction-document-panel" aria-pressed="false"',
    );
  });
});
