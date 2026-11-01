import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("renders the project foundation status", () => {
    const markup = renderToStaticMarkup(HomePage());

    expect(markup).toContain("FinHand");
    expect(markup).toContain("Project foundation is ready");
    expect(markup).toContain("Frontend running successfully");
  });
});
