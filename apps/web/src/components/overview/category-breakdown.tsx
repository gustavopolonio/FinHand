import type { FinancialSummary } from "@/lib/api";

import { Card } from "../ui/card";
import { CurrencyAmount } from "../ui/currency-amount";
import {
  createCategoryGradient,
  createCategorySlices,
} from "./overview-data";

interface CategoryBreakdownProps {
  currencyCode: string;
  summary: FinancialSummary;
}

export function CategoryBreakdown({
  currencyCode,
  summary,
}: CategoryBreakdownProps) {
  const slices = createCategorySlices(summary.categoryTotals, currencyCode);
  const totalMinor = slices
    .reduce((total, slice) => total + BigInt(slice.totalMinor), 0n)
    .toString();
  const topCategory = slices[0];

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div>
          <h2 className="text-lg font-bold tracking-[-0.015em] text-finhand-ink">
            Spending by category
          </h2>
          <p className="mt-1 text-sm text-finhand-muted">
            Expense distribution for the selected period
          </p>
        </div>
        <CurrencyAmount
          className="font-bold text-finhand-ink"
          currencyCode={currencyCode}
          value={totalMinor}
        />
      </div>

      {slices.length === 0 ? (
        <div className="grid min-h-64 place-items-center text-center">
          <div>
            <p className="font-semibold text-finhand-ink">No expenses yet</p>
            <p className="mt-1 text-sm text-finhand-muted">
              Expense categories will appear here for this period.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid items-center gap-8 md:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)]">
          <div className="relative mx-auto size-40 sm:size-44">
            <div
              aria-label="Expense distribution chart"
              className="size-full rounded-full"
              role="img"
              style={{ background: createCategoryGradient(slices) }}
            />
            <div className="absolute inset-7 grid place-items-center rounded-full bg-white text-center">
              <div>
                <p className="text-xs text-finhand-muted">Top expense</p>
                <p className="mt-1 text-2xl font-bold text-finhand-ink">
                  {topCategory?.percentage ?? 0}%
                </p>
                <p className="mt-0.5 max-w-24 truncate text-xs font-semibold text-finhand-interactive">
                  {topCategory?.name}
                </p>
              </div>
            </div>
          </div>

          <ul className="min-w-0 space-y-5">
            {slices.slice(0, 6).map((slice) => (
              <li key={`${slice.categoryId ?? "uncategorized"}-${slice.name}`}>
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold text-finhand-ink">
                    {slice.name}
                  </span>
                  <span className="col-start-2 row-start-2 text-xs text-finhand-muted sm:col-start-auto sm:row-start-auto">
                    {slice.transactionCount}{" "}
                    {slice.transactionCount === 1 ? "transaction" : "transactions"}
                  </span>
                  <CurrencyAmount
                    className="col-start-3 row-start-1 text-right font-semibold text-finhand-ink sm:col-start-auto sm:row-start-auto sm:min-w-28"
                    currencyCode={currencyCode}
                    value={slice.totalMinor}
                  />
                  <span className="col-start-3 row-start-2 text-right text-xs text-finhand-muted sm:col-start-auto sm:row-start-auto sm:w-10">
                    {slice.percentage}%
                  </span>
                </div>
                <div className="mt-2 ml-5 h-1.5 overflow-hidden rounded-full bg-finhand-accent-soft">
                  <div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: slice.color,
                      width: `${slice.percentage}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
