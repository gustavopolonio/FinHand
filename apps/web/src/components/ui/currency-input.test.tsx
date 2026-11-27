import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CurrencyInput } from "./currency-input";

describe("CurrencyInput", () => {
  it("renders canonical money using the approved right-to-left display format", () => {
    const markup = renderToStaticMarkup(
      <CurrencyInput
        aria-label="Amount"
        currencyCode="BRL"
        onValueChange={vi.fn()}
        value="1234.56"
      />,
    );

    expect(markup).toContain("R$");
    expect(markup).toContain('inputMode="numeric"');
    expect(markup).toContain('value="1.234,56"');
    expect(markup).toContain("h-12");
  });

  it("preserves negative opening balances when that domain allows them", () => {
    const markup = renderToStaticMarkup(
      <CurrencyInput
        allowNegative
        aria-label="Opening balance"
        currencyCode="BRL"
        onValueChange={vi.fn()}
        value="-1250.75"
      />,
    );

    expect(markup).toContain('value="-1.250,75"');
  });
});
