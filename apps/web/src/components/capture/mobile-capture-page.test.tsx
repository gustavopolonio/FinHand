import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MobileCapturePage } from "./mobile-capture-page";

describe("MobileCapturePage", () => {
  it("renders an upload-only validation state without financial data", () => {
    const markup = renderToStaticMarkup(<MobileCapturePage />);

    expect(markup).toContain("FinHand secure capture");
    expect(markup).toContain("One-time receipt upload");
    expect(markup).toContain("Checking secure link");
    expect(markup).not.toContain("Accounts");
    expect(markup).not.toContain("Transactions");
  });
});
