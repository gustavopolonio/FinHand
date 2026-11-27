import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildDollarMarketSnapshot,
  getDollarMarketSnapshot,
  parseDollarQuotationHistory,
} from "./dollar-market";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dollar market helpers", () => {
  it("parses, sorts, and deduplicates BCB quotations without floating-point money", () => {
    expect(
      parseDollarQuotationHistory([
        { data: "26/11/2026", valor: "5.7446" },
        { data: "25/11/2026", valor: "5.8825" },
        { data: "26/11/2026", valor: "5.7000" },
      ]),
    ).toEqual([
      { date: "2026-11-25", rateTenThousandths: 58_825 },
      { date: "2026-11-26", rateTenThousandths: 57_000 },
    ]);
  });

  it("uses the latest seven market days and calculates a downward move", () => {
    const quotations = Array.from({ length: 9 }, (_, index) => ({
      date: `2026-11-${String(index + 1).padStart(2, "0")}`,
      rateTenThousandths: 50_000 + index * 100,
    }));
    quotations.at(-1)!.rateTenThousandths = 49_000;

    const snapshot = buildDollarMarketSnapshot(quotations);

    expect(snapshot.history).toHaveLength(7);
    expect(snapshot.history[0]?.date).toBe("2026-11-03");
    expect(snapshot.current.date).toBe("2026-11-09");
    expect(snapshot.previous?.date).toBe("2026-11-08");
    expect(snapshot.trend).toBe("down");
    expect(snapshot.changeBasisPoints).toBeLessThan(0);
  });

  it("supports a single quotation as a flat market state", () => {
    const snapshot = buildDollarMarketSnapshot([
      { date: "2026-11-26", rateTenThousandths: 57_446 },
    ]);

    expect(snapshot.previous).toBeNull();
    expect(snapshot.changeBasisPoints).toBe(0);
    expect(snapshot.trend).toBe("flat");
  });

  it("rejects malformed or empty provider responses", () => {
    expect(() => parseDollarQuotationHistory({})).toThrow("invalid history");
    expect(() =>
      parseDollarQuotationHistory([{ data: "31/02/2026", valor: "5.10" }]),
    ).toThrow("invalid date");
    expect(() => buildDollarMarketSnapshot([])).toThrow(
      "No dollar quotations",
    );
  });

  it("requests a dated history from BCB and returns a market snapshot", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          { data: "25/11/2026", valor: "5.8825" },
          { data: "26/11/2026", valor: "5.7446" },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetch);

    const snapshot = await getDollarMarketSnapshot({
      now: new Date(2026, 10, 26),
    });
    const requestedUrl = new URL(fetch.mock.calls[0]![0] as URL);

    expect(requestedUrl.hostname).toBe("api.bcb.gov.br");
    expect(requestedUrl.searchParams.get("dataInicial")).toBe("05/11/2026");
    expect(requestedUrl.searchParams.get("dataFinal")).toBe("26/11/2026");
    expect(snapshot.trend).toBe("down");

  });
});
