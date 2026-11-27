import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { TransactionFilters } from "./transaction-filters";

describe("TransactionFilters", () => {
  it("uses the shared date range picker instead of separate date inputs", () => {
    const markup = renderToStaticMarkup(
      <TransactionFilters
        accounts={[]}
        categories={[]}
        isCreateDisabled={false}
        isLoading={false}
        onChange={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(markup).toContain("All transactions");
    expect(markup).toContain("All time");
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain("Create transaction");
    expect(markup).not.toContain("Apply filters");
    expect(markup).not.toContain('type="date"');
    expect(markup).not.toContain("Start date");
    expect(markup).not.toContain("End date");
    expect(markup).toContain("sm:grid-cols-2");
    expect(markup).toContain("xl:flex");
  });
});
