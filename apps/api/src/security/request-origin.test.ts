import { describe, expect, it } from "vitest";

import { requiresTrustedOrigin } from "./request-origin.js";

describe("request origin policy", () => {
  it.each([
    {
      description: "cookie-authenticated mutation",
      input: { hasCookie: true, method: "POST", routeUrl: "/api/accounts" },
      expected: true,
    },
    {
      description: "safe cookie-authenticated read",
      input: { hasCookie: true, method: "GET", routeUrl: "/api/accounts" },
      expected: false,
    },
    {
      description: "non-browser mutation without cookies",
      input: { hasCookie: false, method: "POST", routeUrl: "/api/accounts" },
      expected: false,
    },
    {
      description: "Better Auth request",
      input: {
        hasCookie: true,
        method: "POST",
        routeUrl: "/api/auth/*",
      },
      expected: false,
    },
    {
      description: "capture-token upload",
      input: {
        hasCookie: true,
        method: "POST",
        routeUrl: "/api/document-capture-session/document",
      },
      expected: false,
    },
  ])("returns $expected for $description", ({ expected, input }) => {
    expect(requiresTrustedOrigin(input)).toBe(expected);
  });
});
