import {
  ArrowDownLeft,
  ArrowUpRight,
  Landmark,
  Scale,
} from "lucide-react";

import type { FinancialSummary } from "@/lib/api";
import { cn } from "@/lib/class-names";

import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { CurrencyAmount } from "../ui/currency-amount";

interface OverviewSummaryCardsProps {
  currency: FinancialSummary["currencies"][number];
  summary: FinancialSummary;
}

interface SummaryCardProps {
  accent?: "income" | "expense" | "primary";
  icon: typeof Landmark;
  label: string;
  note: string;
  value: string;
  currencyCode: string;
}

function SummaryCard({
  accent = "primary",
  currencyCode,
  icon: Icon,
  label,
  note,
  value,
}: SummaryCardProps) {
  return (
    <Card className="flex min-h-52 flex-col justify-between p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-finhand-muted">
          {label}
        </p>
        <span
          className={cn(
            "grid size-10 place-items-center rounded-full",
            accent === "income" &&
              "bg-finhand-income-soft text-finhand-income",
            accent === "expense" &&
              "bg-finhand-expense-soft text-finhand-expense",
            accent === "primary" &&
              "bg-finhand-accent-soft text-finhand-interactive",
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
        </span>
      </div>

      <CurrencyAmount
        className={cn(
          "mt-7 text-[1.75rem] font-bold tracking-[-0.03em] text-finhand-ink",
          accent === "expense" && "text-finhand-expense",
          accent === "income" && "text-finhand-income",
        )}
        currencyCode={currencyCode}
        value={value}
      />

      <p className="mt-5 text-sm text-finhand-muted">{note}</p>
    </Card>
  );
}

export function OverviewSummaryCards({
  currency,
  summary,
}: OverviewSummaryCardsProps) {
  const activeAccounts = summary.accounts.filter(
    (account) =>
      account.currencyCode === currency.currencyCode && !account.archivedAt,
  ).length;
  const incomeTransactions = summary.categoryTotals
    .filter(
      (category) =>
        category.currencyCode === currency.currencyCode &&
        category.type === "income",
    )
    .reduce((total, category) => total + category.transactionCount, 0);
  const expenseTransactions = summary.categoryTotals
    .filter(
      (category) =>
        category.currencyCode === currency.currencyCode &&
        category.type === "expense",
    )
    .reduce((total, category) => total + category.transactionCount, 0);
  const netFlow = BigInt(currency.netFlowMinor);

  return (
    <div className="grid grid-cols-4 gap-4">
      <Card
        className="flex min-h-52 flex-col justify-between p-6"
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
          className="mt-7 text-[2rem] font-bold tracking-[-0.03em]"
          currencyCode={currency.currencyCode}
          value={currency.activeBalanceMinor}
        />
        <Badge className="mt-5 w-fit" variant="inverse">
          {activeAccounts} active {activeAccounts === 1 ? "account" : "accounts"}
        </Badge>
      </Card>

      <SummaryCard
        accent="income"
        currencyCode={currency.currencyCode}
        icon={ArrowDownLeft}
        label="Period income"
        note={`${incomeTransactions} income ${incomeTransactions === 1 ? "transaction" : "transactions"}`}
        value={currency.incomeMinor}
      />
      <SummaryCard
        accent="expense"
        currencyCode={currency.currencyCode}
        icon={ArrowUpRight}
        label="Period expenses"
        note={`${expenseTransactions} expense ${expenseTransactions === 1 ? "transaction" : "transactions"}`}
        value={currency.expenseMinor}
      />
      <SummaryCard
        accent={
          netFlow > 0n
            ? "income"
            : netFlow < 0n
              ? "expense"
              : "primary"
        }
        currencyCode={currency.currencyCode}
        icon={Scale}
        label="Net cash flow"
        note={
          netFlow > 0n
            ? "Positive cash flow"
            : netFlow < 0n
              ? "Negative cash flow"
              : "Balanced cash flow"
        }
        value={currency.netFlowMinor}
      />
    </div>
  );
}
