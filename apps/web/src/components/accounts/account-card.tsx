import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Banknote,
  CreditCard,
  Landmark,
  Pencil,
  PiggyBank,
  RotateCcw,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import type { AccountType } from "@/lib/api";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { CurrencyAmount } from "../ui/currency-amount";
import type { AccountWithBalance } from "./account-data";
import { accountTypeLabels } from "./account-form";

interface AccountCardProps {
  account: AccountWithBalance;
  busyAccountId: string | null;
  onArchive: (account: AccountWithBalance) => void;
  onEdit: (account: AccountWithBalance) => void;
}

interface ArchivedAccountsProps {
  accounts: AccountWithBalance[];
  busyAccountId: string | null;
  onRestore: (account: AccountWithBalance) => void;
}

const accountIcons: Record<AccountType, LucideIcon> = {
  cash: Banknote,
  checking: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
  investment: TrendingUp,
  other: WalletCards,
};

export function AccountCard({
  account,
  busyAccountId,
  onArchive,
  onEdit,
}: AccountCardProps) {
  const Icon = accountIcons[account.type];
  const netMovement = (
    BigInt(account.balanceMinor) - BigInt(account.openingBalanceMinor)
  ).toString();
  const movement = BigInt(netMovement);
  const isBusy = busyAccountId === account.id;
  const isDisabled = busyAccountId !== null;

  return (
    <Card className="overflow-hidden">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-finhand-mint-soft text-finhand-primary">
            <Icon aria-hidden="true" className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-bold tracking-[-0.015em] text-finhand-ink">
                {account.name}
              </h3>
              <Badge>{accountTypeLabels[account.type]}</Badge>
            </div>
            <p className="mt-1 text-sm text-finhand-muted">
              {account.currencyCode} · Active account
            </p>
          </div>
          <Badge variant="income">Active</Badge>
        </div>

        <div className="mt-5 rounded-xl bg-finhand-mint-soft p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-finhand-muted">
            Current balance
          </p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <CurrencyAmount
              className="text-2xl font-bold tracking-[-0.025em] text-finhand-primary-strong"
              currencyCode={account.currencyCode}
              value={account.balanceMinor}
            />
            <div className="text-right text-xs text-finhand-muted">
              <p>
                Opening: {" "}
                <CurrencyAmount
                  currencyCode={account.currencyCode}
                  value={account.openingBalanceMinor}
                />
              </p>
              <p
                className={`mt-1 font-semibold ${
                  movement > 0n
                    ? "text-finhand-income"
                    : movement < 0n
                      ? "text-finhand-expense"
                      : "text-finhand-muted"
                }`}
              >
                Net: {" "}
                <CurrencyAmount
                  currencyCode={account.currencyCode}
                  value={netMovement}
                />
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-finhand-divider bg-finhand-canvas-muted px-5 py-3">
        <Button
          disabled={isDisabled}
          onClick={() => onEdit(account)}
          size="sm"
          variant="ghost"
        >
          <Pencil aria-hidden="true" className="size-4" />
          Edit
        </Button>
        <Button
          disabled={isDisabled}
          onClick={() => onArchive(account)}
          size="sm"
          variant="ghost"
        >
          {isBusy ? (
            <span className="size-4 animate-spin rounded-full border-2 border-finhand-muted/30 border-t-finhand-muted" />
          ) : (
            <Archive aria-hidden="true" className="size-4" />
          )}
          Archive
        </Button>
      </div>
    </Card>
  );
}

export function ArchivedAccounts({
  accounts,
  busyAccountId,
  onRestore,
}: ArchivedAccountsProps) {
  if (accounts.length === 0) return null;

  return (
    <section>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-finhand-ink">
            Archived accounts
          </h2>
          <Badge>{accounts.length}</Badge>
        </div>
        <p className="mt-1 text-sm text-finhand-muted">
          Historical accounts retained for your financial records.
        </p>
      </div>

      <Card className="overflow-hidden">
        <ul>
          {accounts.map((account) => {
            const Icon = accountIcons[account.type];
            const isBusy = busyAccountId === account.id;

            return (
              <li
                className="flex items-center gap-4 border-t border-finhand-divider px-6 py-4 first:border-t-0"
                key={account.id}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-finhand-canvas-muted text-finhand-muted">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold text-finhand-ink">
                      {account.name}
                    </p>
                    <Badge className="opacity-70">Archived</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-finhand-muted">
                    {accountTypeLabels[account.type]} · {account.currencyCode} ·
                    Opening {" "}
                    <CurrencyAmount
                      currencyCode={account.currencyCode}
                      value={account.openingBalanceMinor}
                    />
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-finhand-muted">
                    Final balance
                  </p>
                  <CurrencyAmount
                    className="mt-1 font-bold text-finhand-ink"
                    currencyCode={account.currencyCode}
                    value={account.balanceMinor}
                  />
                </div>
                <Button
                  disabled={busyAccountId !== null}
                  onClick={() => onRestore(account)}
                  size="sm"
                  variant="secondary"
                >
                  {isBusy ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-finhand-primary/30 border-t-finhand-primary" />
                  ) : (
                    <RotateCcw aria-hidden="true" className="size-4" />
                  )}
                  Restore
                </Button>
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
