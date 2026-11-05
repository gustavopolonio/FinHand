import { ChartNoAxesCombined, CircleAlert } from "lucide-react";

import type { Category, FinancialSummary } from "@/lib/api";

import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { CurrencyAmount } from "../ui/currency-amount";
import type { CategoryWithTotals } from "./category-data";
import { calculateCategoryOverview, sortCategoriesByVolume } from "./category-data";

interface CategorySummaryProps {
  categories: Category[];
  categoryData: CategoryWithTotals[];
  currencyCode: string;
  summary: FinancialSummary;
}

export function CategorySummary({
  categories,
  categoryData,
  currencyCode,
  summary,
}: CategorySummaryProps) {
  const overview = calculateCategoryOverview(
    categories,
    summary,
    currencyCode,
  );
  const topExpenses = sortCategoriesByVolume(
    categoryData.filter(
      (category) => category.type === "expense" && !category.archivedAt,
    ),
  ).slice(0, 2);
  const expenseCategoryCount = categoryData.filter(
    (category) => category.type === "expense" && !category.archivedAt,
  ).length;

  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-6">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="grid size-11 place-items-center rounded-xl bg-finhand-accent-soft text-finhand-interactive">
              <ChartNoAxesCombined aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-finhand-muted">
                Categorized outflow
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <CurrencyAmount
                  className="text-2xl font-bold tracking-[-0.025em] text-finhand-ink"
                  currencyCode={currencyCode}
                  value={overview.categorizedExpenseMinor}
                />
                <span className="text-sm text-finhand-muted">
                  of {" "}
                  <CurrencyAmount
                    currencyCode={currencyCode}
                    value={overview.expenseMinor}
                  />
                </span>
              </div>
            </div>
          </div>
          <Badge variant="income">
            {overview.categorizedPercentage}% categorized
          </Badge>
        </div>

        <div className="mt-8 h-2 overflow-hidden rounded-full bg-finhand-expense-soft">
          <div
            className="h-full rounded-full bg-finhand-primary"
            style={{ width: `${overview.categorizedPercentage}%` }}
          />
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-xl border border-finhand-expense-border bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-muted">
          <CircleAlert
            aria-hidden="true"
            className="size-5 shrink-0 text-finhand-warning"
          />
          <span>
            Uncategorized expenses: {" "}
            <CurrencyAmount
              className="font-semibold text-finhand-ink"
              currencyCode={currencyCode}
              value={overview.uncategorizedExpenseMinor}
            />
          </span>
        </div>
      </Card>

      <Card className="flex items-center justify-between gap-6 p-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-finhand-muted">
            Top concentration
          </p>
          {topExpenses.length === 0 ? (
            <p className="mt-4 text-sm text-finhand-muted">
              No expense activity for this period.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {topExpenses.map((category) => (
                <li className="min-w-0" key={category.id}>
                  <p className="truncate text-sm font-bold text-finhand-ink">
                    {category.name}
                  </p>
                  <p className="mt-0.5 text-xs text-finhand-muted">
                    {category.percentage}% of expenses
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative size-28 shrink-0">
          <div
            aria-label={`${overview.categorizedPercentage}% of expenses categorized`}
            className="size-full rounded-full"
            role="img"
            style={{
              background: `conic-gradient(#1e1b4b 0 ${overview.categorizedPercentage}%, #eef2ff ${overview.categorizedPercentage}% 100%)`,
            }}
          />
          <div className="absolute inset-3 grid place-items-center rounded-full bg-white text-center">
            <div>
              <p className="text-xs text-finhand-muted">Active</p>
              <p className="text-xl font-bold text-finhand-ink">
                {expenseCategoryCount}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
