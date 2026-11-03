"use client";

import { type FormEvent, useState } from "react";

import type { Account, Category, Transaction } from "@/lib/api";
import { formatMinorUnits } from "@/lib/money";

import { TransactionFields } from "./transaction-fields";
import {
  type TransactionFormValues,
  formValuesFromTransaction,
  transactionTypeLabels,
} from "./transaction-form";

interface TransactionListProps {
  accounts: Account[];
  busyTransactionId: string | null;
  categories: Category[];
  isLoading: boolean;
  onDelete: (transaction: Transaction) => void;
  onUpdate: (
    transactionId: string,
    values: TransactionFormValues,
  ) => Promise<boolean>;
  transactions: Transaction[];
}

export function TransactionList({
  accounts,
  busyTransactionId,
  categories,
  isLoading,
  onDelete,
  onUpdate,
  transactions,
}: TransactionListProps) {
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);
  const [editValues, setEditValues] =
    useState<TransactionFormValues | null>(null);
  const isBusy = busyTransactionId !== null;

  function startEditing(transaction: Transaction) {
    setEditingTransactionId(transaction.id);
    setEditValues(formValuesFromTransaction(transaction));
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingTransactionId || !editValues) {
      return;
    }

    if (await onUpdate(editingTransactionId, editValues)) {
      setEditingTransactionId(null);
      setEditValues(null);
    }
  }

  function cancelEditing() {
    setEditingTransactionId(null);
    setEditValues(null);
  }

  if (isLoading) {
    return (
      <p className="mt-6 text-sm text-slate-600">Loading transactions…</p>
    );
  }

  if (transactions.length === 0) {
    return (
      <p className="mt-6 text-sm text-slate-600">No transactions found.</p>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {transactions.map((transaction) => {
        const account = accounts.find(
          (candidate) => candidate.id === transaction.accountId,
        );
        const category = categories.find(
          (candidate) => candidate.id === transaction.categoryId,
        );
        const editAccounts = accounts.filter(
          (candidate) =>
            !candidate.archivedAt || candidate.id === transaction.accountId,
        );
        const editCategories = categories.filter(
          (candidate) =>
            !candidate.archivedAt || candidate.id === transaction.categoryId,
        );
        const isEditing = editingTransactionId === transaction.id && editValues;

        return (
          <li
            className="rounded-xl border border-slate-200 p-4"
            key={transaction.id}
          >
            {isEditing ? (
              <form onSubmit={(event) => void submitEdit(event)}>
                <TransactionFields
                  accounts={editAccounts}
                  categories={editCategories}
                  onChange={setEditValues}
                  values={editValues}
                />
                <div className="mt-4 flex gap-2">
                  <button
                    className="rounded-md bg-emerald-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    disabled={isBusy}
                    type="submit"
                  >
                    {busyTransactionId === transaction.id
                      ? "Saving…"
                      : "Save"}
                  </button>
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                    disabled={isBusy}
                    onClick={cancelEditing}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">
                      {transaction.description}
                    </h3>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        transaction.type === "income"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {transactionTypeLabels[transaction.type]}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-slate-900">
                    {formatMinorUnits(
                      transaction.amountMinor,
                      transaction.currencyCode,
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {transaction.occurredOn} · {account?.name ?? "Unknown account"}
                    {category ? ` · ${category.name}` : " · Uncategorized"}
                  </p>
                  {transaction.counterparty || transaction.notes ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {[transaction.counterparty, transaction.notes]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                    disabled={isBusy}
                    onClick={() => startEditing(transaction)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700"
                    disabled={isBusy}
                    onClick={() => {
                      if (
                        window.confirm(`Delete “${transaction.description}”?`)
                      ) {
                        onDelete(transaction);
                      }
                    }}
                    type="button"
                  >
                    {busyTransactionId === transaction.id
                      ? "Deleting…"
                      : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
