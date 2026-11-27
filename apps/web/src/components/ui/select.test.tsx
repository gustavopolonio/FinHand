import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  findNextEnabledOptionIndex,
  Select,
  type SelectOption,
} from "./select";

const options: SelectOption[] = [
  { label: "Checking", value: "checking" },
  { disabled: true, label: "Archived", value: "archived" },
  { label: "Savings", value: "savings" },
];

describe("Select", () => {
  it("renders the selected value as an accessible combobox", () => {
    const markup = renderToStaticMarkup(
      <Select
        ariaLabel="Account type"
        onValueChange={vi.fn()}
        options={options}
        value="checking"
      />,
    );

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("Checking");
  });

  it("uses a plain chevron for compact toolbar selects", () => {
    const markup = renderToStaticMarkup(
      <Select
        ariaLabel="Transaction type"
        onValueChange={vi.fn()}
        options={options}
        value="checking"
        variant="compact"
      />,
    );

    expect(markup).toContain("text-finhand-subtle");
    expect(markup).toContain("hover:bg-finhand-canvas-muted");
    expect(markup).not.toContain(
      "rounded-md bg-finhand-accent text-finhand-interactive",
    );
  });

  it("accepts a control-specific trigger height", () => {
    const markup = renderToStaticMarkup(
      <Select
        ariaLabel="Account"
        onValueChange={vi.fn()}
        options={options}
        triggerClassName="h-12"
        value="checking"
        variant="compact"
      />,
    );

    expect(markup).toContain("h-12");
  });

  it("skips disabled options in both navigation directions", () => {
    expect(findNextEnabledOptionIndex(options, 0, 1)).toBe(2);
    expect(findNextEnabledOptionIndex(options, 2, -1)).toBe(0);
  });
});
