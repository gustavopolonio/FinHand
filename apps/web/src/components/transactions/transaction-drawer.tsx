"use client";

import { Check } from "lucide-react";
import { type FormEvent, useState } from "react";

import type { Account, Category, Transaction } from "@/lib/api";

import { Button } from "../ui/button";
import { WorkspaceModal } from "../ui/workspace-modal";
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
    <WorkspaceModal
      description={
        transaction
          ? "Adjust the details saved for this transaction."
          : "Record a new expense or income to your ledger."
      }
      isBusy={isSubmitting}
      onClose={onClose}
      title={transaction ? "Edit Transaction" : "Add Transaction"}
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => void submit(event)}
      >
        <div className="flex-1 overflow-y-auto p-6">
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

        <div className="flex justify-end gap-3 border-t border-finhand-divider bg-finhand-mint-soft/40 p-5">
          <Button
            className="rounded-xl!"
            disabled={isSubmitting}
            onClick={onClose}
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl!"
            disabled={isSubmitting || availableAccounts.length === 0}
            type="submit"
          >
            {!isSubmitting ? (
              <Check aria-hidden="true" className="size-4" />
            ) : null}
            {isSubmitting
              ? "Saving…"
              : transaction
                ? "Save Changes"
                : "Save Transaction"}
          </Button>
        </div>
      </form>
    </WorkspaceModal>
  );
}
