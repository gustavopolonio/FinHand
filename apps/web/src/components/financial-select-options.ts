import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowUpRight,
  Banknote,
  CreditCard,
  Landmark,
  PiggyBank,
  Tags,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import type {
  Account,
  AccountType,
  Category,
  CategoryType,
} from "@/lib/api";
import type { SelectOption } from "@/components/ui/select";

export const accountTypeLabels: Record<AccountType, string> = {
  cash: "Cash",
  checking: "Checking",
  savings: "Savings",
  credit: "Credit",
  investment: "Investment",
  other: "Other",
};

export const accountTypeIcons: Record<AccountType, LucideIcon> = {
  cash: Banknote,
  checking: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
  other: WalletCards,
};

export const categoryTypeLabels: Record<CategoryType, string> = {
  income: "Income",
  expense: "Expense",
};

export function accountOptions(
  accounts: Account[],
  { disableArchived = true }: { disableArchived?: boolean } = {},
): SelectOption[] {
  return accounts.map((account) => ({
    badge: account.archivedAt
      ? "Archived"
      : accountTypeLabels[account.type],
    description: account.currencyCode,
    disabled: disableArchived && Boolean(account.archivedAt),
    icon: accountTypeIcons[account.type],
    label: account.name,
    value: account.id,
  }));
}

export function accountTypeOptions(): SelectOption[] {
  return (Object.keys(accountTypeLabels) as AccountType[]).map((type) => ({
    icon: accountTypeIcons[type],
    label: accountTypeLabels[type],
    value: type,
  }));
}

export function categoryOptions(
  categories: Category[],
  { disableArchived = true }: { disableArchived?: boolean } = {},
): SelectOption[] {
  return categories.map((category) => ({
    badge: category.archivedAt
      ? "Archived"
      : categoryTypeLabels[category.type],
    disabled: disableArchived && Boolean(category.archivedAt),
    icon: category.type === "income" ? ArrowDown : ArrowUpRight,
    label: category.name,
    value: category.id,
  }));
}

export function categoryOptionsWithUncategorized(
  categories: Category[],
  configuration?: { disableArchived?: boolean },
): SelectOption[] {
  return [
    {
      badge: "Optional",
      icon: Tags,
      label: "Uncategorized",
      value: "",
    },
    ...categoryOptions(categories, configuration),
  ];
}

export function currencyOptions(currencies: string[]): SelectOption[] {
  return currencies.map((currency) => ({
    label: currency,
    value: currency,
  }));
}
