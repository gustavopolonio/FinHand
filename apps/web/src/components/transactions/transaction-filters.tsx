"use client";

import { type FormEvent, useState } from "react";

import type {
  Account,
  Category,
  TransactionFilters as TransactionFilterValues,
  TransactionType,
} from "@/lib/api";
import { transactionTypes } from "@/lib/api";

import { transactionTypeLabels } from "./transaction-form";

interface TransactionFiltersProps {
  accounts: Account[];
  categories: Category[];
  onApply: (filters: TransactionFilterValues) => void;
}

export function TransactionFilters({
  accounts,
  categories,
  onApply,
}: TransactionFiltersProps) {
  const [type, setType] = useState<TransactionType | "">("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const matchingCategories = type
    ? categories.filter((category) => category.type === type)
    : categories;

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    onApply({});
  }

  return (
    <form
      className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-3"
      onSubmit={apply}
    >
      <label className="text-sm font-medium text-slate-700">
        Type
        <select
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          onChange={(event) => {
            const nextType = event.target.value as TransactionType | "";
            const selectedCategory = categories.find(
              (category) => category.id === categoryId,
            );

            setType(nextType);
            if (selectedCategory && selectedCategory.type !== nextType) {
              setCategoryId("");
            }
          }}
          value={type}
        >
          <option value="">All types</option>
          {transactionTypes.map((transactionType) => (
            <option key={transactionType} value={transactionType}>
              {transactionTypeLabels[transactionType]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-slate-700">
        Account
        <select
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          onChange={(event) => setAccountId(event.target.value)}
          value={accountId}
        >
          <option value="">All accounts</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-slate-700">
        Category
        <select
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          onChange={(event) => setCategoryId(event.target.value)}
          value={categoryId}
        >
          <option value="">All categories</option>
          {matchingCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-slate-700">
        From
        <input
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          onChange={(event) => setFrom(event.target.value)}
          type="date"
          value={from}
        />
      </label>

      <label className="text-sm font-medium text-slate-700">
        To
        <input
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          onChange={(event) => setTo(event.target.value)}
          type="date"
          value={to}
        />
      </label>

      <div className="flex items-end gap-2">
        <button
          className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white"
          type="submit"
        >
          Apply filters
        </button>
        <button
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          onClick={reset}
          type="button"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
