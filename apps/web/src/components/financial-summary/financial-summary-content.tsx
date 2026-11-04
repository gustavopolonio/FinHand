import type { FinancialSummary } from "@/lib/api";
import { formatMinorUnits } from "@/lib/money";

interface FinancialSummaryContentProps {
  summary: FinancialSummary;
}

function periodLabel(summary: FinancialSummary) {
  return summary.period.from
    ? `${summary.period.from} to ${summary.period.to}`
    : `All transactions through ${summary.period.to}`;
}

export function FinancialSummaryContent({
  summary,
}: FinancialSummaryContentProps) {
  const hasData =
    summary.currencies.length > 0 ||
    summary.accounts.length > 0 ||
    summary.categoryTotals.length > 0;

  if (!hasData) {
    return (
      <p className="mt-5 text-sm text-slate-600">
        No financial data is available for this period.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-7">
      <p className="text-sm text-slate-600">{periodLabel(summary)}</p>

      {summary.currencies.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {summary.currencies.map((currency) => (
            <article
              className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
              key={currency.currencyCode}
            >
              <h3 className="font-semibold text-emerald-950">
                {currency.currencyCode}
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-slate-600">Active balance</dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {formatMinorUnits(
                      currency.activeBalanceMinor,
                      currency.currencyCode,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">Net flow</dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {formatMinorUnits(
                      currency.netFlowMinor,
                      currency.currencyCode,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">Income</dt>
                  <dd className="mt-1 text-slate-900">
                    {formatMinorUnits(
                      currency.incomeMinor,
                      currency.currencyCode,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600">Expenses</dt>
                  <dd className="mt-1 text-slate-900">
                    {formatMinorUnits(
                      currency.expenseMinor,
                      currency.currencyCode,
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : null}

      <div>
        <h3 className="font-semibold text-emerald-950">Account balances</h3>
        {summary.accounts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No accounts yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200">
            {summary.accounts.map((account) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 p-3"
                key={account.accountId}
              >
                <div>
                  <span className="font-medium text-slate-900">
                    {account.name}
                  </span>
                  {account.archivedAt ? (
                    <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                      Archived
                    </span>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    {account.type}
                  </p>
                </div>
                <span className="font-medium text-slate-900">
                  {formatMinorUnits(
                    account.balanceMinor,
                    account.currencyCode,
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-emerald-950">Category totals</h3>
        {summary.categoryTotals.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No categorized transactions in this period.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200">
            {summary.categoryTotals.map((category) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 p-3"
                key={`${category.categoryId ?? "uncategorized"}-${category.type}-${category.currencyCode}`}
              >
                <div>
                  <span className="font-medium text-slate-900">
                    {category.name}
                  </span>
                  <p className="mt-1 text-xs text-slate-500">
                    {category.type} · {category.transactionCount}{" "}
                    {category.transactionCount === 1
                      ? "transaction"
                      : "transactions"}
                  </p>
                </div>
                <span className="font-medium text-slate-900">
                  {formatMinorUnits(
                    category.totalMinor,
                    category.currencyCode,
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
