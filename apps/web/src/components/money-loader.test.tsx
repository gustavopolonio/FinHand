import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MoneyLoader } from "./money-loader";

describe("MoneyLoader", () => {
  it("renders a stable, accessible session-loading state", () => {
    const markup = renderToStaticMarkup(<MoneyLoader />);

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Checking your session");
    expect(markup.match(/money-loader__coin/g)).toHaveLength(3);
  });
});
