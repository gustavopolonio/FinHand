import { describe, expect, it } from "vitest";

import {
  buildDateRangePresets,
  dateFromInputValue,
  dateToInputValue,
  formatDateRangeLabel,
} from "./date-range-picker-data";

describe("date range picker data", () => {
  it("converts input dates without shifting them across time zones", () => {
    const date = dateFromInputValue("2026-11-26");

    expect(date).toBeDefined();
    expect(dateToInputValue(date!)).toBe("2026-11-26");
    expect(dateFromInputValue("2026-02-31")).toBeUndefined();
  });

  it("builds rolling and calendar presets from the current day", () => {
    const presets = buildDateRangePresets(new Date(2026, 10, 26, 18, 30));
    const lastSevenDays = presets.find(({ id }) => id === "last-7-days");
    const lastMonth = presets.find(({ id }) => id === "last-month");

    expect(dateToInputValue(lastSevenDays!.range!.from!)).toBe("2026-11-20");
    expect(dateToInputValue(lastSevenDays!.range!.to!)).toBe("2026-11-26");
    expect(dateToInputValue(lastMonth!.range!.from!)).toBe("2026-10-01");
    expect(dateToInputValue(lastMonth!.range!.to!)).toBe("2026-10-31");
  });

  it("formats the active period for the trigger", () => {
    expect(formatDateRangeLabel({})).toBe("All time");
    expect(
      formatDateRangeLabel({ from: "2026-11-20", to: "2026-11-26" }),
    ).toBe("Nov 20, 2026 – Nov 26, 2026");
    expect(
      formatDateRangeLabel({ from: "2026-11-26", to: "2026-11-26" }),
    ).toBe("Nov 26, 2026");
  });
});
