"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  ApiError,
  type Account,
  type Category,
  type Transaction,
  type TransactionFilters as TransactionFilterValues,
  createTransaction,
  deleteTransaction,
  getAccounts,
  getCategories,
  getTransactions,
  updateTransaction,
} from "@/lib/api";

import { NewTransactionForm } from "./new-transaction-form";
import { TransactionFilters } from "./transaction-filters";
import { TransactionList } from "./transaction-list";
import { TransactionPagination } from "./transaction-pagination";
import {
  type TransactionFormValues,
  transactionInputFromForm,
} from "./transaction-form";

const pageSize = 10;

export function TransactionsPanel() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState({
    limit: pageSize,
    offset: 0,
    hasMore: false,
  });
  const [query, setQuery] = useState<TransactionFilterValues>({
    limit: pageSize,
    offset: 0,
  });
  const [busyTransactionId, setBusyTransactionId] = useState<string | null>(
    null,
  );
  const [isLoadingReferences, setIsLoadingReferences] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
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

  const loadReferences = useCallback(
    () =>
      Promise.all([getAccounts(), getCategories()])
        .then(([userAccounts, userCategories]) => {
          setAccounts(userAccounts);
          setCategories(userCategories);
        })
        .catch(reportError)
        .finally(() => setIsLoadingReferences(false)),
    [reportError],
  );

  const loadTransactions = useCallback(
    (filters: TransactionFilterValues) =>
      getTransactions(filters)
        .then((page) => {
          setTransactions(page.transactions);
          setPagination(page.pagination);
        })
        .catch(reportError)
        .finally(() => setIsLoadingTransactions(false)),
    [reportError],
  );

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  useEffect(() => {
    void loadTransactions(query);
  }, [loadTransactions, query]);

  function applyFilters(filters: TransactionFilterValues) {
    setError(null);
    setIsLoadingTransactions(true);
    setQuery({ ...filters, limit: pageSize, offset: 0 });
  }

  async function refreshAfterChange() {
    setIsLoadingTransactions(true);

    if ((query.offset ?? 0) === 0) {
      await loadTransactions(query);
    } else {
      setQuery((currentQuery) => ({ ...currentQuery, offset: 0 }));
    }
  }

  async function submitNewTransaction(
    values: TransactionFormValues,
  ): Promise<boolean> {
    setBusyTransactionId("new");
    setError(null);

    try {
      await createTransaction(transactionInputFromForm(values));
      await refreshAfterChange();
      return true;
    } catch (cause) {
      reportError(cause);
      return false;
    } finally {
      setBusyTransactionId(null);
    }
  }

  async function submitTransactionEdit(
    transactionId: string,
    values: TransactionFormValues,
  ): Promise<boolean> {
    setBusyTransactionId(transactionId);
    setError(null);

    try {
      await updateTransaction(
        transactionId,
        transactionInputFromForm(values),
      );
      await refreshAfterChange();
      return true;
    } catch (cause) {
      reportError(cause);
      return false;
    } finally {
      setBusyTransactionId(null);
    }
  }

  async function removeTransaction(transaction: Transaction) {
    setBusyTransactionId(transaction.id);
    setError(null);

    try {
      await deleteTransaction(transaction.id);

      if (transactions.length === 1 && pagination.offset > 0) {
        setIsLoadingTransactions(true);
        setQuery((currentQuery) => ({
          ...currentQuery,
          offset: Math.max(0, pagination.offset - pagination.limit),
        }));
      } else {
        setIsLoadingTransactions(true);
        await loadTransactions(query);
      }
    } catch (cause) {
      reportError(cause);
    } finally {
      setBusyTransactionId(null);
    }
  }

  function showPreviousPage() {
    setIsLoadingTransactions(true);
    setQuery((currentQuery) => ({
      ...currentQuery,
      offset: Math.max(0, pagination.offset - pagination.limit),
    }));
  }

  function showNextPage() {
    setIsLoadingTransactions(true);
    setQuery((currentQuery) => ({
      ...currentQuery,
      offset: pagination.offset + pagination.limit,
    }));
  }

  const isBusy = busyTransactionId !== null;

  return (
    <div className="mt-10 border-t border-slate-200 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-emerald-950">
          Transactions
        </h2>
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          disabled={isLoadingReferences}
          onClick={() => {
            setIsLoadingReferences(true);
            void loadReferences();
          }}
          type="button"
        >
          {isLoadingReferences ? "Refreshing…" : "Refresh options"}
        </button>
      </div>

      <NewTransactionForm
        accounts={accounts}
        categories={categories}
        isBusy={isBusy}
        isLoading={isLoadingReferences}
        isSubmitting={busyTransactionId === "new"}
        onSubmit={submitNewTransaction}
      />

      <TransactionFilters
        accounts={accounts}
        categories={categories}
        onApply={applyFilters}
      />

      {error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <TransactionList
        accounts={accounts}
        busyTransactionId={busyTransactionId}
        categories={categories}
        isLoading={isLoadingTransactions}
        onDelete={(transaction) => void removeTransaction(transaction)}
        onUpdate={submitTransactionEdit}
        transactions={transactions}
      />

      <TransactionPagination
        hasMore={pagination.hasMore}
        isLoading={isLoadingTransactions}
        itemCount={transactions.length}
        offset={pagination.offset}
        onNext={showNextPage}
        onPrevious={showPreviousPage}
      />
    </div>
  );
}
