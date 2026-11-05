import {
  Archive,
  ArrowDown,
  ArrowUpRight,
  Pencil,
  RotateCcw,
  Tags,
} from "lucide-react";

import type { Category } from "@/lib/api";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { CurrencyAmount } from "../ui/currency-amount";
import type { CategoryWithTotals } from "./category-data";
import { categoryTypeLabels } from "./category-form";

interface CategoryTableProps {
  busyCategoryId: string | null;
  categories: CategoryWithTotals[];
  currencyCode: string;
  onArchiveToggle: (category: Category) => void;
  onEdit: (category: Category) => void;
}

export function CategoryTable({
  busyCategoryId,
  categories,
  currencyCode,
  onArchiveToggle,
  onEdit,
}: CategoryTableProps) {
  if (categories.length === 0) {
    return (
      <Card className="grid min-h-64 place-items-center p-8 text-center">
        <div>
          <Tags className="mx-auto size-8 text-finhand-subtle" />
          <h2 className="mt-4 text-lg font-bold text-finhand-ink">
            No categories found
          </h2>
          <p className="mt-1 text-sm text-finhand-muted">
            Change the filter or create a new category.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <table className="w-full border-collapse text-left">
        <thead className="bg-finhand-canvas-muted">
          <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-finhand-muted">
            <th className="px-6 py-4">Category name</th>
            <th className="px-4 py-4">Type</th>
            <th className="px-4 py-4 text-right">Period volume</th>
            <th className="px-4 py-4 text-center">Transactions</th>
            <th className="px-4 py-4">Status</th>
            <th className="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            const TypeIcon =
              category.type === "income" ? ArrowDown : ArrowUpRight;
            const isCurrentBusy = busyCategoryId === category.id;
            const isDisabled = busyCategoryId !== null;

            return (
              <tr
                className="border-t border-finhand-divider transition hover:bg-finhand-canvas-muted"
                key={category.id}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                        category.type === "income"
                          ? "bg-finhand-income-soft text-finhand-income"
                          : "bg-finhand-accent-soft text-finhand-interactive"
                      }`}
                    >
                      <TypeIcon aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <p className="font-bold text-finhand-ink">
                        {category.name}
                      </p>
                      <p className="mt-0.5 text-xs text-finhand-muted">
                        {category.archivedAt
                          ? "Retained for historical transactions"
                          : "Available for transaction categorization"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <Badge
                    variant={
                      category.type === "income" ? "income" : "neutral"
                    }
                  >
                    {categoryTypeLabels[category.type]}
                  </Badge>
                </td>
                <td className="min-w-44 px-4 py-4 text-right">
                  <CurrencyAmount
                    className="font-bold text-finhand-ink"
                    currencyCode={currencyCode}
                    value={category.totalMinor}
                  />
                  <div className="mt-2 ml-auto h-1.5 max-w-36 overflow-hidden rounded-full bg-finhand-accent-soft">
                    <div
                      className="h-full rounded-full bg-finhand-primary"
                      style={{ width: `${category.percentage}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-finhand-muted">
                    {category.percentage}% of {category.type}
                  </p>
                </td>
                <td className="px-4 py-4 text-center text-sm text-finhand-muted">
                  {category.transactionCount}
                </td>
                <td className="px-4 py-4">
                  <Badge className={category.archivedAt ? "opacity-70" : ""}>
                    {category.archivedAt ? "Archived" : "Active"}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-1">
                    {!category.archivedAt ? (
                      <Button
                        aria-label={`Edit ${category.name}`}
                        disabled={isDisabled}
                        onClick={() => onEdit(category)}
                        size="sm"
                        title="Edit category"
                        variant="ghost"
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </Button>
                    ) : null}
                    <Button
                      aria-label={`${category.archivedAt ? "Restore" : "Archive"} ${category.name}`}
                      disabled={isDisabled}
                      onClick={() => onArchiveToggle(category)}
                      size="sm"
                      title={
                        category.archivedAt
                          ? "Restore category"
                          : "Archive category"
                      }
                      variant="ghost"
                    >
                      {isCurrentBusy ? (
                        <span className="size-4 animate-spin rounded-full border-2 border-finhand-muted/30 border-t-finhand-muted" />
                      ) : category.archivedAt ? (
                        <RotateCcw aria-hidden="true" className="size-4" />
                      ) : (
                        <Archive aria-hidden="true" className="size-4" />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
