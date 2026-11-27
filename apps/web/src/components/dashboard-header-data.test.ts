import { describe, expect, it } from "vitest";

import {
  firstNameFromUser,
  getGreeting,
  getHeaderDateParts,
} from "./dashboard-header-data";

describe("dashboard header data", () => {
  it("derives a short name from the user's profile", () => {
    expect(firstNameFromUser(" Gustavo Polonio ", "user@example.com")).toBe(
      "Gustavo",
    );
    expect(firstNameFromUser(null, "finhand@example.com")).toBe("finhand");
  });

  it("uses the user's time zone for the greeting and current date", () => {
    const date = new Date("2026-11-04T13:00:00.000Z");

    expect(getGreeting(date, "America/Sao_Paulo")).toBe("Good morning");
    expect(getHeaderDateParts(date, "America/Sao_Paulo")).toEqual({
      date: "November 4",
      weekday: "Wednesday",
    });
  });
});
