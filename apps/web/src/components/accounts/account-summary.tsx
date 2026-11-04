import { ArrowLeftRight, Landmark, Layers3, WalletCards } from "lucide-react";

import type { FinancialSummary } from "@/lib/api";

import { Card } from "../ui/card";
import { CurrencyAmount } from "../ui/currency-amount";
import type { AccountWithBalance } from "./account-data";
import { calculateAccountMetrics } from "./account-data";

interface AccountSummaryProps {
  accounts: AccountWithBalance[];
  currencyCode: string;
  summary: FinancialSummary;
}

export function AccountSummary({
  accounts,
  currencyCode,
  summary,
}: AccountSummaryProps) {
  const metrics = calculateAccountMetrics(accounts, summary, currencyCode);
  const movement = BigInt(metrics.netMovementMinor);

  return (
    <div className="grid grid-cols-4 gap-4">
      <Card
        className="flex min-h-44 flex-col justify-between p-6"
        variant="primary"
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/75">
            Active balance
          </p>
          <span className="grid size-10 place-items-center rounded-full bg-white/12">
            <Landmark aria-hidden="true" className="size-5" />
          </span>
        </div>
        <CurrencyAmount
          className="mt-7 text-[1.75rem] font-bold tracking-[-0.03em]"
          currencyCode={currencyCode}
          value={metrics.activeBalanceMinor}
        />
        <p className="mt-3 text-sm text-white/75">
          Across all active {currencyCode} accounts
        </p>
      </Card>

      <Card className="flex min-h-44 flex-col justify-between p-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-finhand-muted">
            Active accounts
          </p>
          <span className="grid size-10 place-items-center rounded-full bg-finhand-mint-soft text-finhand-primary">
            <Layers3 aria-hidden="true" className="size-5" />
          </span>
        </div>
        <p className="mt-7 text-[1.75rem] font-bold tracking-[-0.03em] text-finhand-ink">
          {metrics.activeCount}
        </p>
        <p className="mt-3 text-sm text-finhand-muted">
          Included in the active balance
        </p>
      </Card>

      <Card className="flex min-h-44 flex-col justify-between p-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-finhand-muted">
            Opening balances
          </p>
          <span className="grid size-10 place-items-center rounded-full bg-finhand-mint-soft text-finhand-primary">
            <WalletCards aria-hidden="true" className="size-5" />
          </span>
        </div>
        <CurrencyAmount
          className="mt-7 text-[1.75rem] font-bold tracking-[-0.03em] text-finhand-ink"
          currencyCode={currencyCode}
          value={metrics.openingBalanceMinor}
        />
        <p className="mt-3 text-sm text-finhand-muted">
          Starting point for active accounts
        </p>
      </Card>

      <Card className="flex min-h-44 flex-col justify-between p-6">
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-finhand-muted">
            Net movement
          </p>
          <span className="grid size-10 place-items-center rounded-full bg-finhand-mint-soft text-finhand-primary">
            <ArrowLeftRight aria-hidden="true" className="size-5" />
          </span>
        </div>
        <CurrencyAmount
          className={`mt-7 text-[1.75rem] font-bold tracking-[-0.03em] ${
            movement > 0n
              ? "text-finhand-income"
              : movement < 0n
                ? "text-finhand-expense"
                : "text-finhand-ink"
          }`}
          currencyCode={currencyCode}
          value={metrics.netMovementMinor}
        />
        <p className="mt-3 text-sm text-finhand-muted">
          Current minus opening balances
        </p>
      </Card>
    </div>
  );
}
