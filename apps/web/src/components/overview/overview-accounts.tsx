import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import type { AccountType, FinancialSummary } from "@/lib/api";

import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { CurrencyAmount } from "../ui/currency-amount";

interface OverviewAccountsProps {
  currencyCode: string;
  summary: FinancialSummary;
}

const accountIcons: Record<AccountType, LucideIcon> = {
  cash: Banknote,
  checking: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
  other: WalletCards,
};

const accountTypeLabels: Record<AccountType, string> = {
  cash: "Cash",
  checking: "Checking",
  savings: "Savings",
  credit: "Credit",
  investment: "Investment",
  other: "Other",
};

export function OverviewAccounts({
  currencyCode,
  summary,
}: OverviewAccountsProps) {
  const accounts = summary.accounts
    .filter((account) => account.currencyCode === currencyCode)
    .sort((left, right) => {
      if (Boolean(left.archivedAt) !== Boolean(right.archivedAt)) {
        return left.archivedAt ? 1 : -1;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, 5);

  return (
    <Card className="p-6">
      <div>
        <h2 className="text-lg font-bold tracking-[-0.015em] text-finhand-ink">
          Accounts
        </h2>
        <p className="mt-1 text-sm text-finhand-muted">
          Current calculated balances
        </p>
      </div>

      {accounts.length === 0 ? (
        <div className="grid min-h-64 place-items-center text-center">
          <div>
            <WalletCards className="mx-auto size-7 text-finhand-subtle" />
            <p className="mt-3 font-semibold text-finhand-ink">
              No accounts in {currencyCode}
            </p>
          </div>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {accounts.map((account) => {
            const Icon = accountIcons[account.type];

            return (
              <li
                className="flex items-center gap-3 rounded-xl bg-finhand-mint-soft p-3.5"
                key={account.accountId}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-finhand-primary shadow-finhand-card">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-finhand-ink">
                      {account.name}
                    </p>
                    <Badge
                      className={account.archivedAt ? "opacity-70" : undefined}
                    >
                      {account.archivedAt ? "Archived" : "Active"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-finhand-muted">
                    {accountTypeLabels[account.type]} · {account.currencyCode}
                  </p>
                </div>
                <CurrencyAmount
                  className="font-bold text-finhand-ink"
                  currencyCode={account.currencyCode}
                  value={account.balanceMinor}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
