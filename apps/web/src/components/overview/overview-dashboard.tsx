"use client";

import { CalendarDays, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

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
import { Select } from "../ui/select";
import { CategoryBreakdown } from "./category-breakdown";
import {
  firstNameFromUser,
  getGreeting,
} from "./overview-data";
import { OverviewAccounts } from "./overview-accounts";
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
      <div className="h-32 animate-pulse rounded-2xl bg-finhand-accent-soft" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-52 animate-pulse rounded-2xl bg-white"
            key={index}
          />
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)] gap-6">
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
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

  function applyPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!from || !to) {
      setError("Choose both a start date and an end date.");
      return;
    }

    if (from > to) {
      setError("The end date must be on or after the start date.");
      return;
    }

    const nextFilters = { from, to };
    setFilters(nextFilters);
    void loadOverview(nextFilters);
  }

  function showAllTime() {
    setFrom("");
    setTo("");
    setFilters({});
    void loadOverview({});
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
  const greeting = getGreeting(new Date(), user.timeZone);
  const firstName = firstNameFromUser(user.displayName, user.email);

  return (
    <div className="space-y-6">
      <Card className="flex min-h-32 items-center justify-between gap-8 p-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-finhand-interactive">
            Financial overview
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-finhand-ink">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-finhand-muted">
            Here&apos;s how your finances are looking today.
          </p>
        </div>

        <div className="flex items-end gap-3">
          <form className="flex items-end gap-2" onSubmit={applyPeriod}>
            <label className="text-xs font-semibold text-finhand-muted">
              From
              <input
                className="mt-1 block h-10 rounded-lg border border-finhand-border bg-finhand-canvas-muted px-3 text-sm text-finhand-ink outline-none focus:border-finhand-focus focus:ring-2 focus:ring-finhand-focus/20"
                onChange={(event) => setFrom(event.target.value)}
                type="date"
                value={from}
              />
            </label>
            <label className="text-xs font-semibold text-finhand-muted">
              To
              <input
                className="mt-1 block h-10 rounded-lg border border-finhand-border bg-finhand-canvas-muted px-3 text-sm text-finhand-ink outline-none focus:border-finhand-focus focus:ring-2 focus:ring-finhand-focus/20"
                onChange={(event) => setTo(event.target.value)}
                type="date"
                value={to}
              />
            </label>
            <Button disabled={isLoading} type="submit">
              <CalendarDays aria-hidden="true" className="size-4" />
              Apply
            </Button>
          </form>
          <Button
            disabled={isLoading}
            onClick={showAllTime}
            variant="secondary"
          >
            All time
          </Button>
          <Button
            aria-label="Refresh overview"
            disabled={isLoading}
            onClick={() => void loadOverview(filters)}
            variant="ghost"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-4 ${isLoading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </Card>

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

          <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)] gap-6">
            <div className="space-y-6">
              <CategoryBreakdown
                currencyCode={currency.currencyCode}
                summary={data.summary}
              />
              <RecentTransactions
                summary={data.summary}
                transactions={data.transactions}
              />
            </div>
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
