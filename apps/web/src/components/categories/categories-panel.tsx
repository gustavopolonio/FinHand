"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useDashboardUser } from "@/components/dashboard-shell";
import { currencyOptions } from "@/components/financial-select-options";
import {
  ApiError,
  type Category,
  type CategoryType,
  type FinancialSummary,
  type FinancialSummaryFilters,
  archiveCategory,
  createCategory,
  getCategories,
  getFinancialSummary,
  renameCategory,
  restoreCategory,
} from "@/lib/api";
import { cn } from "@/lib/class-names";

import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { MonthPicker } from "../ui/month-picker";
import { Select } from "../ui/select";
import {
  categoriesWithTotals,
  sortCategoriesForDisplay,
  summaryFiltersForMonth,
} from "./category-data";
import { type CategoryFormValues } from "./category-form";
import { CategoryModal } from "./category-modal";
import { CategorySummary } from "./category-summary";
import { CategoryTable } from "./category-table";

type CategoryTab = CategoryType;
type CategoryEditor =
  | { kind: "create" }
  | { category: Category; kind: "edit" };

const tabs: Array<{ label: string; value: CategoryTab }> = [
  { label: "Expense Categories", value: "expense" },
  { label: "Income Categories", value: "income" },
];

function CategoriesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading categories" className="space-y-6">
      <div className="grid grid-cols-[2fr_1fr] gap-6">
        <div className="h-56 animate-pulse rounded-2xl bg-white" />
        <div className="h-56 animate-pulse rounded-2xl bg-white" />
      </div>
      <div className="h-16 animate-pulse rounded-2xl bg-finhand-accent-soft" />
      <div className="h-96 animate-pulse rounded-2xl bg-white" />
    </div>
  );
}

function sortCategoryRecords(categories: Category[]) {
  return [...categories].sort(
    (left, right) =>
      left.type.localeCompare(right.type) || left.name.localeCompare(right.name),
  );
}

export function CategoriesPanel() {
  const router = useRouter();
  const user = useDashboardUser();
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState(
    user.defaultCurrency,
  );
  const [tab, setTab] = useState<CategoryTab>("expense");
  const [appliedMonth, setAppliedMonth] = useState("");
  const [editor, setEditor] = useState<CategoryEditor | null>(null);
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportError = useCallback(
    (cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace("/");
        return;
      }

      setError(
        cause instanceof Error ? cause.message : "Something went wrong.",
      );
    },
    [router],
  );

  const loadData = useCallback(
    async (filters: FinancialSummaryFilters = {}) => {
      try {
        const [userCategories, financialSummary] = await Promise.all([
          getCategories(),
          getFinancialSummary(filters),
        ]);
        setCategories(userCategories);
        setSummary(financialSummary);
      } catch (cause) {
        reportError(cause);
      } finally {
        setIsLoading(false);
        setIsLoadingSummary(false);
      }
    },
    [reportError],
  );

  useEffect(() => {
    let isActive = true;

    void Promise.all([getCategories(), getFinancialSummary()])
      .then(([userCategories, financialSummary]) => {
        if (!isActive) return;

        setCategories(userCategories);
        setSummary(financialSummary);
      })
      .catch((cause: unknown) => {
        if (isActive) reportError(cause);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [reportError]);

  function replaceCategory(updatedCategory: Category) {
    setCategories((current) =>
      sortCategoryRecords(
        current.map((category) =>
          category.id === updatedCategory.id ? updatedCategory : category,
        ),
      ),
    );
  }

  async function submitEditor(
    values: CategoryFormValues,
  ): Promise<boolean> {
    if (!editor) return false;

    const categoryId = editor.kind === "edit" ? editor.category.id : "new";
    setBusyCategoryId(categoryId);
    setError(null);

    try {
      if (editor.kind === "create") {
        const category = await createCategory(values);
        setCategories((current) =>
          sortCategoryRecords([...current, category]),
        );
        setTab(category.type);
      } else {
        replaceCategory(
          await renameCategory(editor.category.id, { name: values.name }),
        );
      }

      return true;
    } catch (cause) {
      reportError(cause);
      return false;
    } finally {
      setBusyCategoryId(null);
    }
  }

  async function changeArchiveState(category: Category) {
    setBusyCategoryId(category.id);
    setError(null);

    try {
      const updatedCategory = category.archivedAt
        ? await restoreCategory(category.id)
        : await archiveCategory(category.id);

      replaceCategory(updatedCategory);
    } catch (cause) {
      reportError(cause);
    } finally {
      setBusyCategoryId(null);
    }
  }

  function applyMonth(month: string) {
    setError(null);
    setAppliedMonth(month);
    setIsLoadingSummary(true);
    void loadData(month ? summaryFiltersForMonth(month) : {});
  }

  if (isLoading && !summary) return <CategoriesSkeleton />;

  if (!summary) {
    return (
      <Card className="grid min-h-80 place-items-center p-10 text-center">
        <div>
          <h1 className="text-2xl font-bold text-finhand-ink">
            We couldn&apos;t load your categories
          </h1>
          <p className="mt-2 text-sm text-finhand-muted">{error}</p>
          <Button
            className="mt-6"
            onClick={() => {
              setError(null);
              setIsLoading(true);
              void loadData();
            }}
          >
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  const availableCurrencies = summary.currencies
    .map((currency) => currency.currencyCode)
    .sort();
  const currencyCode = availableCurrencies.includes(selectedCurrency)
    ? selectedCurrency
    : availableCurrencies.includes(user.defaultCurrency)
      ? user.defaultCurrency
      : (availableCurrencies[0] ?? user.defaultCurrency);
  const categoryData = categoriesWithTotals(
    categories,
    summary,
    currencyCode,
  );
  const visibleCategories = sortCategoriesForDisplay(
    categoryData.filter((category) => category.type === tab),
  );
  const tabCounts: Record<CategoryTab, number> = {
    expense: categories.filter((category) => category.type === "expense")
      .length,
    income: categories.filter((category) => category.type === "income").length,
  };
  const editedCategory =
    editor?.kind === "edit" ? editor.category : null;
  const defaultType: CategoryType = tab === "income" ? "income" : "expense";

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold text-finhand-muted">
            Period
          </p>
          <MonthPicker
            ariaLabel="Choose category summary month"
            disabled={isLoadingSummary}
            onApply={applyMonth}
            value={appliedMonth}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button
            disabled={isLoadingSummary}
            onClick={() => {
              setError(null);
              setEditor({ kind: "create" });
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add category
          </Button>
        </div>
      </div>

      {availableCurrencies.length > 1 ? (
        <div className="flex justify-end">
          <label className="text-xs font-semibold text-finhand-muted">
            Currency
            <Select
              ariaLabel="Categories currency"
              className="mt-1 w-28"
              menuLabel="Currencies"
              onValueChange={setSelectedCurrency}
              options={currencyOptions(availableCurrencies)}
              value={currencyCode}
              variant="compact"
            />
          </label>
        </div>
      ) : null}

      <div className={isLoadingSummary ? "animate-pulse opacity-60" : ""}>
        <CategorySummary
          categories={categories}
          categoryData={categoryData}
          currencyCode={currencyCode}
          summary={summary}
        />
      </div>

      {error ? (
        <div
          className="rounded-xl border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-5">
        <div className="flex rounded-xl bg-finhand-accent-soft p-1">
          {tabs.map((candidate) => (
            <button
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition",
                tab === candidate.value
                  ? "bg-white text-finhand-primary-strong shadow-finhand-card"
                  : "text-finhand-muted hover:text-finhand-ink",
              )}
              key={candidate.value}
              onClick={() => setTab(candidate.value)}
              type="button"
            >
              {candidate.label}
              <span className="rounded-full bg-finhand-accent px-2 py-0.5 text-[10px]">
                {tabCounts[candidate.value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <CategoryTable
        busyCategoryId={busyCategoryId}
        categories={visibleCategories}
        currencyCode={currencyCode}
        onArchiveToggle={(category) => void changeArchiveState(category)}
        onEdit={(category) => {
          setError(null);
          setEditor({ category, kind: "edit" });
        }}
      />

      {editor ? (
        <CategoryModal
          category={editedCategory}
          defaultType={defaultType}
          error={error}
          isSubmitting={busyCategoryId !== null}
          key={editor.kind === "create" ? `create-${defaultType}` : editor.category.id}
          onClose={() => setEditor(null)}
          onSubmit={submitEditor}
        />
      ) : null}
    </div>
  );
}
