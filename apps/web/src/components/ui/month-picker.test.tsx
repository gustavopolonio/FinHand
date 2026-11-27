import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MonthPicker } from "./month-picker";
import {
  createMonthValue,
  formatMonthValue,
  parseMonthValue,
} from "./month-picker-data";

describe("MonthPicker", () => {
  it("renders the selected whole month as an accessible trigger", () => {
    const markup = renderToStaticMarkup(
      <MonthPicker onApply={vi.fn()} value="2026-11" />,
    );

    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("November 2026");
  });

  it("uses all time when no month is selected", () => {
    const markup = renderToStaticMarkup(
      <MonthPicker onApply={vi.fn()} value="" />,
    );

    expect(markup).toContain("All time");
  });

  it("parses, creates, and formats month-only values", () => {
    expect(parseMonthValue("2024-02")).toEqual({
      monthIndex: 1,
      year: 2024,
    });
    expect(parseMonthValue("2024-13")).toBeNull();
    expect(createMonthValue(2024, 1)).toBe("2024-02");
    expect(formatMonthValue("2024-02")).toBe("February 2024");
    expect(formatMonthValue("")).toBe("All time");
  });
});

