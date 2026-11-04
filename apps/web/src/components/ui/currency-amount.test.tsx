import { describe, expect, it } from "vitest";

import { formatCurrencyAmount } from "./currency-amount";

describe("formatCurrencyAmount", () => {
  it("formats exact positive and negative minor-unit values", () => {
    expect(formatCurrencyAmount("1245000", "BRL")).toBe("R$ 12,450.00");
    expect(formatCurrencyAmount("-124500", "BRL")).toBe("-R$ 1,245.00");
    expect(formatCurrencyAmount("900719925474099301", "USD")).toBe(
      "US$ 9,007,199,254,740,993.01",
    );
  });

  it("falls back to the currency code and rejects invalid money", () => {
    expect(formatCurrencyAmount("500", "JPY")).toBe("JPY 5.00");
    expect(() => formatCurrencyAmount("5.50", "BRL")).toThrow(
      "integer strings",
    );
  });
});
