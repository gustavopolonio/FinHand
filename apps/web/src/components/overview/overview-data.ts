import type { FinancialSummary, Transaction } from "@/lib/api";

export interface CategorySlice {
  categoryId: string | null;
  color: string;
  name: string;
  percentage: number;
  totalMinor: string;
  transactionCount: number;
}

const categoryColors = [
  "#1e1b4b",
  "#4f46e5",
  "#64748b",
  "#93c5fd",
  "#818cf8",
  "#cbd5e1",
];

export function signedTransactionAmount(transaction: Transaction) {
  return transaction.type === "expense"
    ? `-${transaction.amountMinor}`
    : transaction.amountMinor;
}

export function createCategorySlices(
  categoryTotals: FinancialSummary["categoryTotals"],
  currencyCode: string,
): CategorySlice[] {
  const expenses = categoryTotals
    .filter(
      (category) =>
        category.type === "expense" &&
        category.currencyCode === currencyCode,
    )
    .sort((left, right) => {
      const leftAmount = BigInt(left.totalMinor);
      const rightAmount = BigInt(right.totalMinor);

      return leftAmount === rightAmount
        ? left.name.localeCompare(right.name)
        : leftAmount > rightAmount
          ? -1
          : 1;
    });
  const total = expenses.reduce(
    (sum, category) => sum + BigInt(category.totalMinor),
    0n,
  );

  return expenses.map((category, index) => ({
    categoryId: category.categoryId,
    color: categoryColors[index % categoryColors.length] ?? "#1e1b4b",
    name: category.name,
    percentage:
      total === 0n
        ? 0
        : Number((BigInt(category.totalMinor) * 1_000n) / total) / 10,
    totalMinor: category.totalMinor,
    transactionCount: category.transactionCount,
  }));
}

export function createCategoryGradient(slices: CategorySlice[]) {
  if (slices.length === 0) return "#eef2ff";

  let start = 0;
  const segments = slices.map((slice) => {
    const end = start + slice.percentage;
    const segment = `${slice.color} ${start}% ${end}%`;
    start = end;
    return segment;
  });

  if (start < 100) {
    segments.push(`#eef2ff ${start}% 100%`);
  }

  return `conic-gradient(${segments.join(", ")})`;
}
