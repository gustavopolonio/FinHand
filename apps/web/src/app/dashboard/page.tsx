"use client";

import { AccountsPanel } from "@/components/accounts-panel";
import { CategoriesPanel } from "@/components/categories-panel";
import { FinancialSummaryPanel } from "@/components/financial-summary/financial-summary-panel";
import { useDashboardUser } from "@/components/dashboard-shell";
import { TransactionsPanel } from "@/components/transactions/transactions-panel";

export default function DashboardPage() {
  const user = useDashboardUser();

  return (
    <section className="rounded-2xl border border-finhand-border bg-white p-8 shadow-finhand-card">
      <h1 className="text-3xl font-bold tracking-[-0.02em] text-finhand-ink">
        {`Welcome, ${user.displayName ?? user.email}`}
      </h1>
      <p className="mt-2 text-finhand-muted">
        Your redesigned financial workspace is being prepared.
      </p>

      <FinancialSummaryPanel />
      <AccountsPanel defaultCurrency={user.defaultCurrency} />
      <CategoriesPanel />
      <TransactionsPanel />
    </section>
  );
}
