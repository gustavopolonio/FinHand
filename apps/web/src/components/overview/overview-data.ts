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
  "#2d6a4f",
  "#40916c",
  "#74c69d",
  "#b7d8c8",
  "#c8d0cb",
  "#d95d52",
];

export function firstNameFromUser(
  displayName: string | null,
  email: string,
) {
  return displayName?.trim().split(/\s+/)[0] || email.split("@")[0];
}

export function getGreeting(date: Date, timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone,
    }).format(date),
  );

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

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
    color: categoryColors[index % categoryColors.length] ?? "#2d6a4f",
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
  if (slices.length === 0) return "#e8f5ee";

  let start = 0;
  const segments = slices.map((slice) => {
    const end = start + slice.percentage;
    const segment = `${slice.color} ${start}% ${end}%`;
    start = end;
    return segment;
  });

  if (start < 100) {
    segments.push(`#e8f5ee ${start}% 100%`);
  }

  return `conic-gradient(${segments.join(", ")})`;
}
