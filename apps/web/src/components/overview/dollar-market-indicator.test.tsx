import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DollarMarketIndicatorView } from "./dollar-market-indicator";

describe("DollarMarketIndicatorView", () => {
  it("renders the current quotation, downward movement, and accessible history", () => {
    const markup = renderToStaticMarkup(
      <DollarMarketIndicatorView
        snapshot={{
          changeBasisPoints: -234,
          current: {
            date: "2026-11-26",
            rateTenThousandths: 57_446,
          },
          history: [
            { date: "2026-11-25", rateTenThousandths: 58_825 },
            { date: "2026-11-26", rateTenThousandths: 57_446 },
          ],
          previous: {
            date: "2026-11-25",
            rateTenThousandths: 58_825,
          },
          trend: "down",
        }}
      />,
    );

    expect(markup).toContain("USD / BRL");
    expect(markup).toContain("R$ 5.7446");
    expect(markup).toContain("−2.34%");
    expect(markup).toContain("Last 7 market days");
    expect(markup).toContain("Nov 25: R$ 5.8825");
    expect(markup).toContain('role="tooltip"');
  });
});
