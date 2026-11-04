import { ArrowDownLeft, ArrowUpRight, ReceiptText } from "lucide-react";

import type { FinancialSummary, Transaction } from "@/lib/api";

import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { CurrencyAmount } from "../ui/currency-amount";
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
      <div className="flex items-start justify-between gap-6 px-6 pt-6 pb-5">
        <div>
          <h2 className="text-lg font-bold tracking-[-0.015em] text-finhand-ink">
            Recent transactions
          </h2>
          <p className="mt-1 text-sm text-finhand-muted">
            Latest activity in the selected period
          </p>
        </div>
        <span className="text-xs font-semibold text-finhand-muted">
          Full transaction management is coming next
        </span>
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
        <div className="overflow-hidden border-t border-finhand-divider">
          <table className="w-full border-collapse text-left">
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
                const Icon =
                  transaction.type === "income" ? ArrowDownLeft : ArrowUpRight;

                return (
                  <tr
                    className="border-t border-finhand-divider first:border-t-0 hover:bg-finhand-canvas-muted"
                    key={transaction.id}
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-finhand-muted">
                      {formatDate(transaction.occurredOn)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid size-9 place-items-center rounded-full ${
                            transaction.type === "income"
                              ? "bg-finhand-income-soft text-finhand-income"
                              : "bg-finhand-expense-soft text-finhand-expense"
                          }`}
                        >
                          <Icon aria-hidden="true" className="size-4" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-finhand-ink">
                            {transaction.description}
                          </p>
                          {transaction.counterparty ? (
                            <p className="mt-0.5 text-xs text-finhand-muted">
                              {transaction.counterparty}
                            </p>
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
                    <td className="px-4 py-4 text-sm text-finhand-muted">
                      {accountNames.get(transaction.accountId) ?? "Account"}
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
