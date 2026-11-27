import { describe, expect, it } from "vitest";

import { parseLocationLabel } from "./location";

describe("location helpers", () => {
  it("formats a city with an uppercase ISO country code", () => {
    expect(
      parseLocationLabel({ city: "São Paulo", countryCode: "br" }),
    ).toBe("São Paulo, BR");
  });

  it("uses the city rather than a more granular locality", () => {
    expect(
      parseLocationLabel({ city: "New York", countryCode: "us", locality: "Brooklyn" }),
    ).toBe("New York, US");
    expect(parseLocationLabel({ city: "New York", countryCode: "us" })).toBe(
      "New York, US",
    );
  });

  it("uses the locality when the provider reports a metropolitan region", () => {
    expect(
      parseLocationLabel({
        city: "Região Metropolitana de São Paulo",
        countryCode: "br",
        locality: "São Paulo",
      }),
    ).toBe("São Paulo, BR");
  });

  it("rejects incomplete provider responses", () => {
    expect(() => parseLocationLabel({ city: "São Paulo" })).toThrow(
      "incomplete location",
    );
    expect(() => parseLocationLabel(null)).toThrow("invalid response");
  });
});
