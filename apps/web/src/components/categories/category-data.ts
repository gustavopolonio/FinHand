import type {
  Category,
  CategoryType,
  FinancialSummary,
} from "@/lib/api";

export interface CategoryWithTotals extends Category {
  percentage: number;
  totalMinor: string;
  transactionCount: number;
}

export interface CategoryOverview {
  activeCount: number;
  categorizedExpenseMinor: string;
  categorizedPercentage: number;
  expenseMinor: string;
  uncategorizedExpenseMinor: string;
}

export function summaryFiltersForMonth(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);

  if (!match) return {};

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);

  if (monthNumber < 1 || monthNumber > 12) return {};

  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    from: `${match[1]}-${match[2]}-01`,
    to: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, "0")}`,
  };
}

function percentageOf(value: bigint, total: bigint) {
  if (total === 0n) return 0;

  return Number((value * 1_000n) / total) / 10;
}

export function categoriesWithTotals(
  categories: Category[],
  summary: FinancialSummary,
  currencyCode: string,
): CategoryWithTotals[] {
  const totals = new Map(
    summary.categoryTotals
      .filter(
        (category) =>
          category.currencyCode === currencyCode &&
          category.categoryId !== null,
      )
      .map((category) => [category.categoryId, category]),
  );
  const currency = summary.currencies.find(
    (candidate) => candidate.currencyCode === currencyCode,
  );
  const typeTotals: Record<CategoryType, bigint> = {
    income: BigInt(currency?.incomeMinor ?? "0"),
    expense: BigInt(currency?.expenseMinor ?? "0"),
  };

  return categories.map((category) => {
    const total = totals.get(category.id);
    const totalMinor = total?.totalMinor ?? "0";

    return {
      ...category,
      percentage: percentageOf(
        BigInt(totalMinor),
        typeTotals[category.type],
      ),
      totalMinor,
      transactionCount: total?.transactionCount ?? 0,
    };
  });
}

export function sortCategoriesByVolume(categories: CategoryWithTotals[]) {
  return [...categories].sort((left, right) => {
    const leftTotal = BigInt(left.totalMinor);
    const rightTotal = BigInt(right.totalMinor);

    if (leftTotal === rightTotal) return left.name.localeCompare(right.name);
    return leftTotal > rightTotal ? -1 : 1;
  });
}

export function calculateCategoryOverview(
  categories: Category[],
  summary: FinancialSummary,
  currencyCode: string,
): CategoryOverview {
  const currency = summary.currencies.find(
    (candidate) => candidate.currencyCode === currencyCode,
  );
  const expense = BigInt(currency?.expenseMinor ?? "0");
  const categoryIds = new Set(categories.map((category) => category.id));
  const categorized = summary.categoryTotals
    .filter(
      (category) =>
        category.currencyCode === currencyCode &&
        category.type === "expense" &&
        category.categoryId !== null &&
        categoryIds.has(category.categoryId),
    )
    .reduce((total, category) => total + BigInt(category.totalMinor), 0n);
  const uncategorized = expense > categorized ? expense - categorized : 0n;

  return {
    activeCount: categories.filter((category) => !category.archivedAt).length,
    categorizedExpenseMinor: categorized.toString(),
    categorizedPercentage: percentageOf(categorized, expense),
    expenseMinor: expense.toString(),
    uncategorizedExpenseMinor: uncategorized.toString(),
  };
}
