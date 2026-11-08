import { describe, expect, it } from "vitest";

import {
  captureTokenFromFragment,
  retainCaptureToken,
} from "./capture-token";

describe("captureTokenFromFragment", () => {
  const token = "a".repeat(43);

  it("reads a valid capture token from a URL fragment", () => {
    expect(captureTokenFromFragment(`#token=${token}`)).toBe(token);
  });

  it.each(["", "#", "#token=short", "#token=invalid!", "#other=value"])(
    "rejects invalid fragment %j",
    (fragment) => {
      expect(captureTokenFromFragment(fragment)).toBeNull();
    },
  );
});

describe("retainCaptureToken", () => {
  it("keeps the token when a repeated effect runs after the fragment is cleared", () => {
    const token = "a".repeat(43);

    expect(retainCaptureToken(token, "")).toBe(token);
  });
});
