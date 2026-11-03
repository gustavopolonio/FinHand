import { describe, expect, it } from "vitest";

import {
  formatMinorUnits,
  majorToMinorUnits,
  minorToMajorUnits,
} from "./money";

describe("money helpers", () => {
  it("converts decimal input to exact minor units", () => {
    expect(majorToMinorUnits("123.45")).toBe("12345");
    expect(majorToMinorUnits("-10,5")).toBe("-1050");
    expect(majorToMinorUnits("9007199254740993.01")).toBe(
      "900719925474099301",
    );
  });

  it("rejects values with more than two decimal places", () => {
    expect(() => majorToMinorUnits("10.999")).toThrow(
      "Enter a valid amount",
    );
  });

  it("formats minor units without floating-point arithmetic", () => {
    expect(minorToMajorUnits("12345")).toBe("123.45");
    expect(minorToMajorUnits("-5")).toBe("-0.05");
    expect(formatMinorUnits("12345", "BRL")).toBe("BRL 123.45");
  });
});
