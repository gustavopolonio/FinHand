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
    <Card className="p-6">
      <div className="flex items-start justify-between gap-6">
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
        <div className="mt-8 grid grid-cols-[220px_1fr] items-center gap-8">
          <div className="relative mx-auto size-44">
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
                <p className="mt-0.5 max-w-24 truncate text-xs font-semibold text-finhand-primary">
                  {topCategory?.name}
                </p>
              </div>
            </div>
          </div>

          <ul className="space-y-4">
            {slices.slice(0, 6).map((slice) => (
              <li key={`${slice.categoryId ?? "uncategorized"}-${slice.name}`}>
                <div className="flex items-center gap-3 text-sm">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="min-w-0 flex-1 truncate font-semibold text-finhand-ink">
                    {slice.name}
                  </span>
                  <span className="text-xs text-finhand-muted">
                    {slice.transactionCount}{" "}
                    {slice.transactionCount === 1 ? "transaction" : "transactions"}
                  </span>
                  <CurrencyAmount
                    className="min-w-28 text-right font-semibold text-finhand-ink"
                    currencyCode={currencyCode}
                    value={slice.totalMinor}
                  />
                  <span className="w-10 text-right text-xs text-finhand-muted">
                    {slice.percentage}%
                  </span>
                </div>
                <div className="mt-2 ml-5 h-1.5 overflow-hidden rounded-full bg-finhand-mint-soft">
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
