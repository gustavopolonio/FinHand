"use client";

import {
  Pencil,
  ReceiptText,
  Trash2,
} from "lucide-react";

import type { Account, Category, Transaction } from "@/lib/api";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { CurrencyAmount } from "../ui/currency-amount";
import { TransactionDescription } from "./transaction-description";

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
    <Card className="@container min-w-0 overflow-hidden">
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
        <div className="min-w-0 overflow-hidden">
          <ul className="divide-y divide-finhand-divider @min-[64rem]:hidden">
            {transactions.map((transaction) => {
              const isCurrentTransactionBusy =
                busyTransactionId === transaction.id;
              const accountName =
                accountNames.get(transaction.accountId) ?? "Account";
              const categoryName = transaction.categoryId
                ? categoryNames.get(transaction.categoryId) ?? "Category"
                : "Uncategorized";

              return (
                <li className="p-4" key={transaction.id}>
                  <TransactionDescription
                    counterpartyFallback="No counterparty"
                    showDocumentOrigin
                    transaction={transaction}
                  />

                  <div className="mt-3 flex min-w-0 items-end justify-between gap-3">
                    <div className="min-w-0 text-xs text-finhand-muted">
                      <p>{formatTransactionDate(transaction.occurredOn)}</p>
                      <p className="mt-1 truncate" title={accountName}>
                        {accountName}
                      </p>
                      <Badge className="mt-2 max-w-full truncate">
                        {categoryName}
                      </Badge>
                    </div>
                    <CurrencyAmount
                      className={`block max-w-[50%] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-right text-sm font-bold ${
                        transaction.type === "income"
                          ? "text-finhand-income"
                          : "text-finhand-expense"
                      }`}
                      currencyCode={transaction.currencyCode}
                      value={signedAmount(transaction)}
                    />
                  </div>

                  <div className="mt-3 flex justify-end gap-1 border-t border-finhand-divider pt-2">
                    <Button
                      aria-label={`Edit ${transaction.description}`}
                      disabled={isBusy}
                      onClick={() => onEdit(transaction)}
                      size="sm"
                      title="Edit transaction"
                      variant="ghost"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                      Edit
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
                      Delete
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div
            aria-label="Transactions table"
            className="hidden max-w-full overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-finhand-focus @min-[64rem]:block"
            role="region"
            tabIndex={0}
          >
          <table className="w-full min-w-[64rem] table-fixed border-collapse text-left">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[28%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead className="bg-finhand-canvas-muted">
              <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-finhand-muted">
                <th className="px-6 py-4">Date</th>
                <th className="px-4 py-4">Description &amp; counterparty</th>
                <th className="px-4 py-4">Category</th>
                <th className="px-4 py-4">Account</th>
                <th className="px-4 py-4 text-right">Amount</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
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
                    <td className="min-w-0 overflow-hidden px-4 py-4">
                      <TransactionDescription
                        counterpartyFallback="No counterparty"
                        showDocumentOrigin
                        transaction={transaction}
                      />
                    </td>
                    <td className="min-w-0 overflow-hidden px-4 py-4">
                      <Badge className="max-w-full truncate">
                        {transaction.categoryId
                          ? categoryNames.get(transaction.categoryId) ??
                            "Category"
                          : "Uncategorized"}
                      </Badge>
                    </td>
                    <td className="min-w-0 overflow-hidden px-4 py-4 text-sm text-finhand-muted">
                      <span
                        className="block truncate"
                        title={
                          accountNames.get(transaction.accountId) ?? "Account"
                        }
                      >
                        {accountNames.get(transaction.accountId) ?? "Account"}
                      </span>
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
                    <td className="px-4 py-4">
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
        </div>
      )}
    </Card>
  );
}
