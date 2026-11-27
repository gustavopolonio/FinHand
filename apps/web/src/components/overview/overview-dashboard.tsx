"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useDashboardUser } from "@/components/dashboard-shell";
import { currencyOptions } from "@/components/financial-select-options";
import {
  ApiError,
  type FinancialSummary,
  type FinancialSummaryFilters,
  type Transaction,
  getFinancialSummary,
  getTransactions,
} from "@/lib/api";

import { Button } from "../ui/button";
import { Card } from "../ui/card";
import type { DateRangeValue } from "../ui/date-range-picker-data";
import { Select } from "../ui/select";
import { CategoryBreakdown } from "./category-breakdown";
import { OverviewAccounts } from "./overview-accounts";
import { OverviewPeriodCard } from "./overview-period-card";
import { OverviewSummaryCards } from "./overview-summary-cards";
import { RecentTransactions } from "./recent-transactions";

interface OverviewData {
  summary: FinancialSummary;
  transactions: Transaction[];
}

async function fetchOverviewData(
  filters: FinancialSummaryFilters,
): Promise<OverviewData> {
  const summary = await getFinancialSummary(filters);
  const transactionPage = await getTransactions({
    from: summary.period.from ?? undefined,
    to: summary.period.to,
    limit: 6,
    offset: 0,
  });

  return { summary, transactions: transactionPage.transactions };
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading overview" className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-finhand-accent-soft" />
        <div className="h-9 w-24 animate-pulse rounded-lg bg-white" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-44 animate-pulse rounded-2xl bg-white sm:h-48"
            key={index}
          />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)]">
        <div className="h-96 animate-pulse rounded-2xl bg-white" />
        <div className="h-96 animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  );
}

export function OverviewDashboard() {
  const router = useRouter();
  const user = useDashboardUser();
  const [data, setData] = useState<OverviewData | null>(null);
  const [filters, setFilters] = useState<FinancialSummaryFilters>({});
  const [selectedCurrency, setSelectedCurrency] = useState(
    user.defaultCurrency,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reportError = useCallback(
    (cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace("/");
        return;
      }

      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load your financial overview.",
      );
    },
    [router],
  );

  const loadOverview = useCallback(
    async (requestedFilters: FinancialSummaryFilters) => {
      setIsLoading(true);
      setError(null);

      try {
        setData(await fetchOverviewData(requestedFilters));
      } catch (cause) {
        reportError(cause);
      } finally {
        setIsLoading(false);
      }
    },
    [reportError],
  );

  useEffect(() => {
    let isActive = true;

    void fetchOverviewData({})
      .then((overviewData) => {
        if (isActive) setData(overviewData);
      })
      .catch((cause: unknown) => {
        if (isActive) reportError(cause);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [reportError]);

  function applyPeriod(value: DateRangeValue) {
    const nextFilters = value.from && value.to ? value : {};
    setFilters(nextFilters);
    void loadOverview(nextFilters);
  }

  if (isLoading && !data) {
    return <OverviewSkeleton />;
  }

  if (!data) {
    return (
      <Card className="grid min-h-80 place-items-center p-10 text-center">
        <div>
          <h1 className="text-2xl font-bold text-finhand-ink">
            We couldn&apos;t load your overview
          </h1>
          <p className="mt-2 text-sm text-finhand-muted">{error}</p>
          <Button className="mt-6" onClick={() => void loadOverview(filters)}>
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  const availableCurrencies = data.summary.currencies;
  const currency =
    availableCurrencies.find(
      (candidate) => candidate.currencyCode === selectedCurrency,
    ) ??
    availableCurrencies.find(
      (candidate) => candidate.currencyCode === user.defaultCurrency,
    ) ??
    availableCurrencies[0];
  return (
    <div aria-busy={isLoading} className="space-y-5 sm:space-y-6">
      <OverviewPeriodCard
        filters={filters}
        isLoading={isLoading}
        onApplyPeriod={applyPeriod}
      />

      {error ? (
        <div
          className="rounded-xl border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {availableCurrencies.length > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <label className="text-sm font-semibold text-finhand-muted">
            Currency
          </label>
          <Select
            ariaLabel="Overview currency"
            className="w-28"
            menuLabel="Currencies"
            onValueChange={setSelectedCurrency}
            options={currencyOptions(
              availableCurrencies.map((candidate) => candidate.currencyCode),
            )}
            value={currency?.currencyCode ?? selectedCurrency}
            variant="compact"
          />
        </div>
      ) : null}

      {currency ? (
        <>
          <OverviewSummaryCards currency={currency} summary={data.summary} />

          <RecentTransactions
            summary={data.summary}
            transactions={data.transactions}
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
            <CategoryBreakdown
              currencyCode={currency.currencyCode}
              summary={data.summary}
            />
            <OverviewAccounts
              currencyCode={currency.currencyCode}
              summary={data.summary}
            />
          </div>
        </>
      ) : (
        <Card className="grid min-h-80 place-items-center p-10 text-center">
          <div>
            <h2 className="text-xl font-bold text-finhand-ink">
              Your financial overview is ready for data
            </h2>
            <p className="mt-2 max-w-md text-sm text-finhand-muted">
              Create an account and record transactions to see balances,
              spending categories, and recent activity here.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
