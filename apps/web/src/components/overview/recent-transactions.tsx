import { ReceiptText } from "lucide-react";
import Link from "next/link";

import type { FinancialSummary, Transaction } from "@/lib/api";

import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { CurrencyAmount } from "../ui/currency-amount";
import { TransactionDescription } from "../transactions/transaction-description";
import { TransactionTypeIcon } from "../transactions/transaction-type-icon";
import { signedTransactionAmount } from "./overview-data";

interface RecentTransactionsProps {
  summary: FinancialSummary;
  transactions: Transaction[];
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function RecentTransactions({
  summary,
  transactions,
}: RecentTransactionsProps) {
  const accountNames = new Map(
    summary.accounts.map((account) => [account.accountId, account.name]),
  );
  const categoryNames = new Map(
    summary.categoryTotals
      .filter((category) => category.categoryId !== null)
      .map((category) => [category.categoryId as string, category.name]),
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-4 px-5 pt-5 pb-4 sm:items-center sm:justify-between sm:gap-6 sm:px-6 sm:pt-6 sm:pb-5">
        <h2 className="text-lg font-bold tracking-[-0.015em] text-finhand-ink">
          Recent transactions
        </h2>
        <Link
          className="w-fit text-sm font-semibold text-finhand-interactive underline-offset-4 hover:text-finhand-interactive-strong hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus"
          href="/dashboard/transactions"
        >
          View all
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="grid min-h-56 place-items-center border-t border-finhand-divider text-center">
          <div>
            <ReceiptText className="mx-auto size-7 text-finhand-subtle" />
            <p className="mt-3 font-semibold text-finhand-ink">
              No transactions in this period
            </p>
          </div>
        </div>
      ) : (
        <div className="border-t border-finhand-divider">
          <ul className="divide-y divide-finhand-divider md:hidden">
            {transactions.map((transaction) => {
              return (
                <li className="p-4" key={transaction.id}>
                  <div className="flex items-start gap-3">
                    <TransactionTypeIcon type={transaction.type} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-finhand-ink">
                            {transaction.description}
                          </p>
                          <p className="mt-0.5 text-xs text-finhand-muted">
                            {formatDate(transaction.occurredOn)} · {accountNames.get(transaction.accountId) ?? "Account"}
                          </p>
                        </div>
                        <CurrencyAmount
                          className={`block max-w-[50%] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-right font-bold ${
                            transaction.type === "income"
                              ? "text-finhand-income"
                              : "text-finhand-expense"
                          }`}
                          currencyCode={transaction.currencyCode}
                          value={signedTransactionAmount(transaction)}
                        />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge>
                          {transaction.categoryId
                            ? categoryNames.get(transaction.categoryId) ??
                              "Category"
                            : "Uncategorized"}
                        </Badge>
                        {transaction.counterparty ? (
                          <span className="truncate text-xs text-finhand-muted">
                            {transaction.counterparty}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <table className="hidden w-full table-fixed border-collapse text-left md:table">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[34%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="bg-finhand-canvas-muted">
              <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-finhand-muted">
                <th className="px-6 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => {
                const accountName =
                  accountNames.get(transaction.accountId) ?? "Account";

                return (
                  <tr
                    className="border-t border-finhand-divider first:border-t-0 hover:bg-finhand-canvas-muted"
                    key={transaction.id}
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-finhand-muted">
                      {formatDate(transaction.occurredOn)}
                    </td>
                    <td className="min-w-0 overflow-hidden px-4 py-4">
                      <TransactionDescription transaction={transaction} />
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
                      <span className="block truncate" title={accountName}>
                        {accountName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <CurrencyAmount
                        className={`font-bold ${
                          transaction.type === "income"
                            ? "text-finhand-income"
                            : "text-finhand-expense"
                        }`}
                        currencyCode={transaction.currencyCode}
                        value={signedTransactionAmount(transaction)}
                      />
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
