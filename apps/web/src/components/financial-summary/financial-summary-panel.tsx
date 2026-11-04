"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import {
  ApiError,
  type FinancialSummary,
  type FinancialSummaryFilters,
  getFinancialSummary,
} from "@/lib/api";

import { FinancialSummaryContent } from "./financial-summary-content";

export function FinancialSummaryPanel() {
  const router = useRouter();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [filters, setFilters] = useState<FinancialSummaryFilters>({});
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reportError = useCallback(
    (cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace("/");
        return;
      }

      setError(
        cause instanceof Error ? cause.message : "Something went wrong.",
      );
    },
    [router],
  );

  const loadSummary = useCallback(
    async (requestedFilters: FinancialSummaryFilters) => {
      setIsLoading(true);
      setError(null);

      try {
        setSummary(await getFinancialSummary(requestedFilters));
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

    void getFinancialSummary()
      .then((financialSummary) => {
        if (isActive) {
          setSummary(financialSummary);
        }
      })
      .catch((cause: unknown) => {
        if (isActive) {
          reportError(cause);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
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
    void loadSummary(nextFilters);
  }

  function showAllTime() {
    setFrom("");
    setTo("");
    setFilters({});
    void loadSummary({});
  }

  return (
    <div className="mt-10 border-t border-slate-200 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-emerald-950">
            Financial summary
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Current balances and transaction totals for a selected period.
          </p>
        </div>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          disabled={isLoading}
          onClick={() => void loadSummary(filters)}
          type="button"
        >
          {isLoading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <form
        className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-4"
        onSubmit={applyPeriod}
      >
        <label className="text-sm font-medium text-slate-700">
          From
          <input
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
            onChange={(event) => setFrom(event.target.value)}
            type="date"
            value={from}
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          To
          <input
            className="mt-1 block rounded-md border border-slate-300 px-3 py-2"
            onChange={(event) => setTo(event.target.value)}
            type="date"
            value={to}
          />
        </label>
        <button
          className="rounded-md bg-emerald-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={isLoading}
          type="submit"
        >
          Apply period
        </button>
        <button
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          disabled={isLoading}
          onClick={showAllTime}
          type="button"
        >
          All time
        </button>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading && !summary ? (
        <p className="mt-5 text-sm text-slate-600" role="status">
          Loading financial summary…
        </p>
      ) : summary ? (
        <FinancialSummaryContent summary={summary} />
      ) : null}
    </div>
  );
}
