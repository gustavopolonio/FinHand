import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("renders Google authentication", () => {
    const markup = renderToStaticMarkup(HomePage());

    expect(markup).toContain("FinHand");
    expect(markup).toContain("Continue with Google");
  });
});
