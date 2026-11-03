"use client";

import { type FormEvent, useState } from "react";

import type { Account, Category } from "@/lib/api";

import { TransactionFields } from "./transaction-fields";
import {
  emptyTransactionForm,
  resolveCreateFormValues,
  type TransactionFormValues,
} from "./transaction-form";

interface NewTransactionFormProps {
  accounts: Account[];
  categories: Category[];
  isBusy: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  onSubmit: (values: TransactionFormValues) => Promise<boolean>;
}

export function NewTransactionForm({
  accounts,
  categories,
  isBusy,
  isLoading,
  isSubmitting,
  onSubmit,
}: NewTransactionFormProps) {
  const [values, setValues] = useState(emptyTransactionForm);
  const activeAccounts = accounts.filter((account) => !account.archivedAt);
  const activeCategories = categories.filter(
    (category) => !category.archivedAt,
  );
  const resolvedValues = resolveCreateFormValues(
    values,
    activeAccounts,
    activeCategories,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const succeeded = await onSubmit(resolvedValues);

    if (succeeded) {
      setValues(emptyTransactionForm());
    }
  }

  return (
    <form
      className="mt-5 rounded-xl border border-slate-200 p-4"
      onSubmit={(event) => void submit(event)}
    >
      <h3 className="font-semibold text-slate-900">New transaction</h3>
      <div className="mt-4">
        <TransactionFields
          accounts={activeAccounts}
          categories={activeCategories}
          onChange={setValues}
          values={resolvedValues}
        />
      </div>
      <button
        className="mt-4 rounded-md bg-emerald-900 px-4 py-2 font-medium text-white disabled:opacity-50"
        disabled={isBusy || activeAccounts.length === 0}
        type="submit"
      >
        {isSubmitting ? "Creating…" : "Create transaction"}
      </button>
      {!isLoading && activeAccounts.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">
          Create or restore an account before adding a transaction.
        </p>
      ) : null}
    </form>
  );
}
