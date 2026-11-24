import { describe, expect, it } from "vitest";

import { RequestUriTooLongError } from "../errors/application-errors.js";
import {
  enforceRequestUrlLimit,
  requestLimits,
} from "./request-limits.js";

describe("request limits", () => {
  it("accepts a URL at the configured boundary", () => {
    expect(() =>
      enforceRequestUrlLimit("/".repeat(requestLimits.maximumUrlCharacters)),
    ).not.toThrow();
  });

  it("rejects a URL beyond the configured boundary", () => {
    expect(() =>
      enforceRequestUrlLimit(
        "/".repeat(requestLimits.maximumUrlCharacters + 1),
      ),
    ).toThrow(new RequestUriTooLongError());
  });
});
