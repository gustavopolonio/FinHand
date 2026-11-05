"use client";

import { CalendarDays, FilterX } from "lucide-react";
import { type FormEvent, useState } from "react";

import type {
  Account,
  Category,
  TransactionFilters as TransactionFilterValues,
  TransactionType,
} from "@/lib/api";
import { transactionTypes } from "@/lib/api";
import { cn } from "@/lib/class-names";
import {
  accountOptions,
  categoryOptions,
} from "@/components/financial-select-options";

import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Select } from "../ui/select";
import { transactionTypeLabels } from "./transaction-form";

interface TransactionFiltersProps {
  accounts: Account[];
  categories: Category[];
  isLoading: boolean;
  onApply: (filters: TransactionFilterValues) => void;
}

export function TransactionFilters({
  accounts,
  categories,
  isLoading,
  onApply,
}: TransactionFiltersProps) {
  const [type, setType] = useState<TransactionType | "">("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const matchingCategories = type
    ? categories.filter((category) => category.type === type)
    : categories;
  const hasFilters = Boolean(type || accountId || categoryId || from || to);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (from && to && from > to) {
      setDateError("The end date must be on or after the start date.");
      return;
    }

    setDateError(null);
    onApply({
      ...(type ? { type } : {}),
      ...(accountId ? { accountId } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    });
  }

  function reset() {
    setType("");
    setAccountId("");
    setCategoryId("");
    setFrom("");
    setTo("");
    setDateError(null);
    onApply({});
  }

  return (
    <Card className="p-5">
      <form onSubmit={apply}>
        <div className="flex items-center justify-between gap-5">
          <div className="flex rounded-xl bg-finhand-accent-soft p-1">
            {(["", ...transactionTypes] as const).map((candidate) => (
              <button
                className={cn(
                  "min-h-9 rounded-lg px-4 text-sm font-semibold transition",
                  type === candidate
                    ? "bg-white text-finhand-primary-strong shadow-finhand-card"
                    : "text-finhand-muted hover:text-finhand-ink",
                )}
                key={candidate || "all"}
                onClick={() => {
                  setType(candidate);
                  const selectedCategory = categories.find(
                    (category) => category.id === categoryId,
                  );

                  if (
                    selectedCategory &&
                    candidate &&
                    selectedCategory.type !== candidate
                  ) {
                    setCategoryId("");
                  }
                }}
                type="button"
              >
                {candidate ? transactionTypeLabels[candidate] : "All"}
              </button>
            ))}
          </div>

          <Button
            disabled={isLoading || !hasFilters}
            onClick={reset}
            size="sm"
            variant="ghost"
          >
            <FilterX aria-hidden="true" className="size-4" />
            Clear filters
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_1fr_1.4fr_auto] items-end gap-3">
          <label className="text-xs font-semibold text-finhand-muted">
            Account
            <Select
              ariaLabel="Filter by account"
              className="mt-1.5"
              menuLabel={`Accounts (${accounts.length})`}
              onValueChange={setAccountId}
              options={[
                { label: "All accounts", value: "" },
                ...accountOptions(accounts, { disableArchived: false }),
              ]}
              value={accountId}
            />
          </label>

          <label className="text-xs font-semibold text-finhand-muted">
            Category
            <Select
              ariaLabel="Filter by category"
              className="mt-1.5"
              menuLabel={`Categories (${matchingCategories.length})`}
              onValueChange={setCategoryId}
              options={[
                { label: "All categories", value: "" },
                ...categoryOptions(matchingCategories, {
                  disableArchived: false,
                }),
              ]}
              value={categoryId}
            />
          </label>

          <fieldset>
            <legend className="text-xs font-semibold text-finhand-muted">
              Date range
            </legend>
            <div className="mt-1.5 flex h-11 items-center gap-2 rounded-lg border border-finhand-border bg-finhand-canvas-muted px-3 focus-within:border-finhand-focus focus-within:bg-white focus-within:ring-2 focus-within:ring-finhand-focus/20">
              <CalendarDays
                aria-hidden="true"
                className="size-4 shrink-0 text-finhand-muted"
              />
              <input
                aria-label="Start date"
                className="min-w-0 bg-transparent text-sm text-finhand-ink outline-none"
                onChange={(event) => setFrom(event.target.value)}
                type="date"
                value={from}
              />
              <span className="text-finhand-subtle">–</span>
              <input
                aria-label="End date"
                className="min-w-0 bg-transparent text-sm text-finhand-ink outline-none"
                onChange={(event) => setTo(event.target.value)}
                type="date"
                value={to}
              />
            </div>
          </fieldset>

          <Button className="h-11" disabled={isLoading} type="submit">
            Apply filters
          </Button>
        </div>

        {dateError ? (
          <p className="mt-3 text-sm text-finhand-expense" role="alert">
            {dateError}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
