"use client";

import { FilterX, Plus } from "lucide-react";
import { useState } from "react";

import type {
  Account,
  Category,
  TransactionFilters as TransactionFilterValues,
  TransactionType,
} from "@/lib/api";
import { transactionTypes } from "@/lib/api";
import {
  accountOptions,
  categoryOptions,
} from "@/components/financial-select-options";

import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { DateRangePicker } from "../ui/date-range-picker";
import type { DateRangeValue } from "../ui/date-range-picker-data";
import { Select } from "../ui/select";
import { transactionTypeLabels } from "./transaction-form";

interface TransactionFiltersProps {
  accounts: Account[];
  categories: Category[];
  isCreateDisabled: boolean;
  isLoading: boolean;
  onChange: (filters: TransactionFilterValues) => void;
  onCreate: () => void;
}

interface FilterState {
  accountId: string;
  categoryId: string;
  dateRange: DateRangeValue;
  type: TransactionType | "";
}

function filterValues({
  accountId,
  categoryId,
  dateRange,
  type,
}: FilterState): TransactionFilterValues {
  return {
    ...(type ? { type } : {}),
    ...(accountId ? { accountId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(dateRange.from ? { from: dateRange.from } : {}),
    ...(dateRange.to ? { to: dateRange.to } : {}),
  };
}

export function TransactionFilters({
  accounts,
  categories,
  isCreateDisabled,
  isLoading,
  onChange,
  onCreate,
}: TransactionFiltersProps) {
  const [type, setType] = useState<TransactionType | "">("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>({});
  const matchingCategories = type
    ? categories.filter((category) => category.type === type)
    : categories;
  const hasFilters = Boolean(
    type || accountId || categoryId || dateRange.from || dateRange.to,
  );

  function changeType(value: string) {
    const nextType = transactionTypes.includes(value as TransactionType)
      ? (value as TransactionType)
      : "";
    const selectedCategory = categories.find(
      (category) => category.id === categoryId,
    );
    const nextCategoryId =
      selectedCategory && nextType && selectedCategory.type !== nextType
        ? ""
        : categoryId;

    setType(nextType);
    setCategoryId(nextCategoryId);
    onChange(
      filterValues({
        accountId,
        categoryId: nextCategoryId,
        dateRange,
        type: nextType,
      }),
    );
  }

  function changeAccount(nextAccountId: string) {
    setAccountId(nextAccountId);
    onChange(
      filterValues({
        accountId: nextAccountId,
        categoryId,
        dateRange,
        type,
      }),
    );
  }

  function changeCategory(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    onChange(
      filterValues({
        accountId,
        categoryId: nextCategoryId,
        dateRange,
        type,
      }),
    );
  }

  function applyDateRange(value: DateRangeValue) {
    setDateRange(value);
    onChange(filterValues({ accountId, categoryId, dateRange: value, type }));
  }

  function reset() {
    setType("");
    setAccountId("");
    setCategoryId("");
    setDateRange({});
    onChange({});
  }

  return (
    <Card className="@container p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 @min-[48rem]:grid-cols-4 @min-[68rem]:flex @min-[68rem]:flex-nowrap @min-[68rem]:items-center">
        <Select
          ariaLabel="Filter by transaction type"
          className="min-w-0 w-full @min-[68rem]:min-w-44 @min-[68rem]:flex-1"
          disabled={isLoading}
          menuLabel="Transaction types"
          onValueChange={changeType}
          options={[
            { label: "All transactions", value: "" },
            ...transactionTypes.map((candidate) => ({
              label: transactionTypeLabels[candidate],
              value: candidate,
            })),
          ]}
          value={type}
          variant="compact"
        />

        <Select
          ariaLabel="Filter by account"
          className="min-w-0 w-full @min-[68rem]:min-w-44 @min-[68rem]:flex-1"
          disabled={isLoading}
          menuLabel={`Accounts (${accounts.length})`}
          onValueChange={changeAccount}
          options={[
            { label: "All accounts", value: "" },
            ...accountOptions(accounts, { disableArchived: false }).map(
              (option) => ({ ...option, icon: undefined }),
            ),
          ]}
          value={accountId}
          variant="compact"
        />

        <Select
          ariaLabel="Filter by category"
          className="min-w-0 w-full @min-[68rem]:min-w-44 @min-[68rem]:flex-1"
          disabled={isLoading}
          menuLabel={`Categories (${matchingCategories.length})`}
          onValueChange={changeCategory}
          options={[
            { label: "All categories", value: "" },
            ...categoryOptions(matchingCategories, {
              disableArchived: false,
            }),
          ]}
          value={categoryId}
          variant="compact"
        />

        <DateRangePicker
          align="right"
          ariaLabel="Choose transaction date range"
          disabled={isLoading}
          onApply={applyDateRange}
          triggerClassName="h-10 w-full justify-between @min-[68rem]:w-40"
          value={dateRange}
        />

        <Button
          className="w-full shrink-0 @min-[48rem]:col-start-3 @min-[68rem]:w-auto"
          disabled={isLoading || !hasFilters}
          onClick={reset}
          size="sm"
          variant="ghost"
        >
          <FilterX aria-hidden="true" className="size-4" />
          Clear
        </Button>

        <Button
          className="w-full shrink-0 @min-[48rem]:col-start-4 @min-[68rem]:ml-auto @min-[68rem]:w-auto"
          disabled={isCreateDisabled}
          onClick={onCreate}
        >
          <Plus aria-hidden="true" className="size-4" />
          Create transaction
        </Button>
      </div>
    </Card>
  );
}
