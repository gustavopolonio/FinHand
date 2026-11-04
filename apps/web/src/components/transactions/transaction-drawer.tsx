"use client";

import { X } from "lucide-react";
import { type FormEvent, useState } from "react";

import type { Account, Category, Transaction } from "@/lib/api";

import { Button } from "../ui/button";
import { TransactionFields } from "./transaction-fields";
import {
  emptyTransactionForm,
  formValuesFromTransaction,
  resolveCreateFormValues,
  type TransactionFormValues,
} from "./transaction-form";

interface TransactionDrawerProps {
  accounts: Account[];
  categories: Category[];
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: TransactionFormValues) => Promise<boolean>;
  transaction: Transaction | null;
}

export function TransactionDrawer({
  accounts,
  categories,
  error,
  isSubmitting,
  onClose,
  onSubmit,
  transaction,
}: TransactionDrawerProps) {
  const [values, setValues] = useState(() =>
    transaction
      ? formValuesFromTransaction(transaction)
      : emptyTransactionForm(),
  );
  const availableAccounts = accounts.filter(
    (account) => !account.archivedAt || account.id === transaction?.accountId,
  );
  const availableCategories = categories.filter(
    (category) =>
      !category.archivedAt || category.id === transaction?.categoryId,
  );
  const resolvedValues = transaction
    ? values
    : resolveCreateFormValues(
        values,
        availableAccounts,
        availableCategories,
      );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (await onSubmit(resolvedValues)) {
      onClose();
    }
  }

  return (
    <div
      aria-labelledby="transaction-drawer-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end bg-finhand-ink/30 backdrop-blur-[2px]"
      role="dialog"
    >
      <button
        aria-label="Close transaction form"
        className="flex-1 cursor-default"
        disabled={isSubmitting}
        onClick={onClose}
        type="button"
      />
      <aside className="flex h-full w-[540px] flex-col border-l border-finhand-border bg-finhand-canvas shadow-2xl">
        <div className="flex items-start justify-between border-b border-finhand-border bg-white px-7 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-finhand-primary">
              {transaction ? "Update record" : "New ledger record"}
            </p>
            <h2
              className="mt-1.5 text-2xl font-bold tracking-[-0.025em] text-finhand-ink"
              id="transaction-drawer-title"
            >
              {transaction ? "Edit transaction" : "Add transaction"}
            </h2>
            <p className="mt-1 text-sm text-finhand-muted">
              {transaction
                ? "Adjust the details saved for this transaction."
                : "Record an income or expense in one of your accounts."}
            </p>
          </div>
          <Button
            aria-label="Close transaction form"
            disabled={isSubmitting}
            onClick={onClose}
            size="sm"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => void submit(event)}
        >
          <div className="flex-1 overflow-y-auto px-7 py-6">
            <TransactionFields
              accounts={availableAccounts}
              categories={availableCategories}
              onChange={setValues}
              values={resolvedValues}
            />

            {error ? (
              <p
                className="mt-4 rounded-lg border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            {!transaction && availableAccounts.length === 0 ? (
              <p className="mt-4 rounded-lg bg-finhand-warning-soft px-4 py-3 text-sm text-finhand-warning">
                Create or restore an account before adding a transaction.
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-3 border-t border-finhand-border bg-white px-7 py-5">
            <Button
              disabled={isSubmitting}
              onClick={onClose}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={isSubmitting || availableAccounts.length === 0}
              type="submit"
            >
              {isSubmitting
                ? "Saving…"
                : transaction
                  ? "Save changes"
                  : "Add transaction"}
            </Button>
          </div>
        </form>
      </aside>
    </div>
  );
}
