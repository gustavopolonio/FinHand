import { describe, expect, it } from "vitest";

import { normalizeBrowserTimeZone } from "./time-zone.js";

describe("normalizeBrowserTimeZone", () => {
  it("accepts a valid browser time zone", () => {
    expect(normalizeBrowserTimeZone(" America/Sao_Paulo ")).toBe(
      "America/Sao_Paulo",
    );
  });

  it.each([undefined, null, "", "Sao Paulo"])(
    "falls back to UTC for invalid input: %s",
    (value) => {
      expect(normalizeBrowserTimeZone(value)).toBe("UTC");
    },
  );
});
