import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DateRangePicker } from "./date-range-picker";

describe("DateRangePicker", () => {
  it("renders the active range as an accessible popover trigger", () => {
    const markup = renderToStaticMarkup(
      <DateRangePicker
        onApply={vi.fn()}
        value={{ from: "2026-11-20", to: "2026-11-26" }}
      />,
    );

    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("Nov 20, 2026 – Nov 26, 2026");
    expect(markup).not.toContain("Choose dashboard period");
  });
});
