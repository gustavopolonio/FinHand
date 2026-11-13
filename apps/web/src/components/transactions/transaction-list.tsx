"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Pencil,
  ReceiptText,
  Trash2,
} from "lucide-react";

import type { Account, Category, Transaction } from "@/lib/api";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { CurrencyAmount } from "../ui/currency-amount";

interface TransactionListProps {
  accounts: Account[];
  busyTransactionId: string | null;
  categories: Category[];
  isLoading: boolean;
  onDelete: (transaction: Transaction) => void;
  onEdit: (transaction: Transaction) => void;
  transactions: Transaction[];
}

function formatTransactionDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function signedAmount(transaction: Transaction) {
  return transaction.type === "expense"
    ? `-${transaction.amountMinor}`
    : transaction.amountMinor;
}

function TransactionTableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading transactions" className="p-5">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          className="mb-3 h-14 animate-pulse rounded-xl bg-finhand-canvas-muted last:mb-0"
          key={index}
        />
      ))}
    </div>
  );
}

export function TransactionList({
  accounts,
  busyTransactionId,
  categories,
  isLoading,
  onDelete,
  onEdit,
  transactions,
}: TransactionListProps) {
  const accountNames = new Map(
    accounts.map((account) => [account.id, account.name]),
  );
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const isBusy = busyTransactionId !== null;

  return (
    <Card className="overflow-hidden">
      {isLoading ? (
        <TransactionTableSkeleton />
      ) : transactions.length === 0 ? (
        <div className="grid min-h-72 place-items-center px-6 text-center">
          <div>
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-finhand-accent-soft text-finhand-primary">
              <ReceiptText aria-hidden="true" className="size-6" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-finhand-ink">
              No transactions found
            </h2>
            <p className="mt-1 text-sm text-finhand-muted">
              Change the filters or add your first transaction.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full border-collapse text-left">
            <thead className="bg-finhand-canvas-muted">
              <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-finhand-muted">
                <th className="px-6 py-4">Date</th>
                <th className="px-4 py-4">Description &amp; counterparty</th>
                <th className="px-4 py-4">Category</th>
                <th className="px-4 py-4">Account</th>
                <th className="px-4 py-4">Type</th>
                <th className="px-4 py-4 text-right">Amount</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const TypeIcon =
                  transaction.type === "income"
                    ? ArrowDownLeft
                    : ArrowUpRight;
                const isCurrentTransactionBusy =
                  busyTransactionId === transaction.id;

                return (
                  <tr
                    className="border-t border-finhand-divider transition hover:bg-finhand-canvas-muted"
                    key={transaction.id}
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-finhand-muted">
                      {formatTransactionDate(transaction.occurredOn)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-48 items-center gap-3">
                        <span
                          className={`grid size-9 shrink-0 place-items-center rounded-full ${
                            transaction.type === "income"
                              ? "bg-finhand-income-soft text-finhand-income"
                              : "bg-finhand-expense-soft text-finhand-expense"
                          }`}
                        >
                          <TypeIcon aria-hidden="true" className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-finhand-ink">
                            {transaction.description}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-finhand-muted">
                            {transaction.counterparty ?? "No counterparty"}
                          </p>
                          {transaction.origin === "document" ? (
                            <span
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-finhand-interactive"
                              title="Created from an uploaded document"
                            >
                              <FileText aria-hidden="true" className="size-3" />
                              Imported
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge>
                        {transaction.categoryId
                          ? categoryNames.get(transaction.categoryId) ??
                            "Category"
                          : "Uncategorized"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-finhand-muted">
                      <span className="mr-2 inline-block size-1.5 rounded-full bg-finhand-primary align-middle" />
                      {accountNames.get(transaction.accountId) ?? "Account"}
                    </td>
                    <td className="px-4 py-4">
                      <Badge
                        variant={
                          transaction.type === "income"
                            ? "income"
                            : "expense"
                        }
                      >
                        {transaction.type === "income" ? "Income" : "Expense"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      <CurrencyAmount
                        className={`font-bold ${
                          transaction.type === "income"
                            ? "text-finhand-income"
                            : "text-finhand-expense"
                        }`}
                        currencyCode={transaction.currencyCode}
                        value={signedAmount(transaction)}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        <Button
                          aria-label={`Edit ${transaction.description}`}
                          disabled={isBusy}
                          onClick={() => onEdit(transaction)}
                          size="sm"
                          title="Edit transaction"
                          variant="ghost"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                          aria-label={`Delete ${transaction.description}`}
                          disabled={isBusy}
                          onClick={() => onDelete(transaction)}
                          size="sm"
                          title="Delete transaction"
                          variant="ghost"
                        >
                          {isCurrentTransactionBusy ? (
                            <span className="size-4 animate-spin rounded-full border-2 border-finhand-expense/30 border-t-finhand-expense" />
                          ) : (
                            <Trash2
                              aria-hidden="true"
                              className="size-4 text-finhand-expense"
                            />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
