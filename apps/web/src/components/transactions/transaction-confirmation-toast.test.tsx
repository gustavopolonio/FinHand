import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TransactionConfirmationToast } from "./transaction-confirmation-toast";

describe("TransactionConfirmationToast", () => {
  it("announces the confirmed transaction", () => {
    const markup = renderToStaticMarkup(
      <TransactionConfirmationToast
        description="Weekly groceries"
        onDismiss={vi.fn()}
      />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Transaction created");
    expect(markup).toContain("Weekly groceries");
  });

  it("does not render without a transaction", () => {
    expect(
      renderToStaticMarkup(
        <TransactionConfirmationToast
          description={null}
          onDismiss={vi.fn()}
        />,
      ),
    ).toBe("");
  });
});
