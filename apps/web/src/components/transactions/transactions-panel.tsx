"use client";

import { Plus, RefreshCw } from "lucide-react";
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

import { Button } from "../ui/button";
import { TransactionDrawer } from "./transaction-drawer";
import { TransactionFilters } from "./transaction-filters";
import { TransactionList } from "./transaction-list";
import { TransactionPagination } from "./transaction-pagination";
import {
  type TransactionFormValues,
  transactionInputFromForm,
} from "./transaction-form";

const pageSize = 10;

type TransactionEditor =
  | { kind: "create" }
  | { kind: "edit"; transaction: Transaction };

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
  const [editor, setEditor] = useState<TransactionEditor | null>(null);
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

  const loadReferences = useCallback(async () => {
    try {
      const [userAccounts, userCategories] = await Promise.all([
        getAccounts(),
        getCategories(),
      ]);
      setAccounts(userAccounts);
      setCategories(userCategories);
    } catch (cause) {
      reportError(cause);
    } finally {
      setIsLoadingReferences(false);
    }
  }, [reportError]);

  const loadTransactions = useCallback(
    async (filters: TransactionFilterValues) => {
      try {
        const page = await getTransactions(filters);
        setTransactions(page.transactions);
        setPagination(page.pagination);
      } catch (cause) {
        reportError(cause);
      } finally {
        setIsLoadingTransactions(false);
      }
    },
    [reportError],
  );

  useEffect(() => {
    let isActive = true;

    void Promise.all([getAccounts(), getCategories()])
      .then(([userAccounts, userCategories]) => {
        if (!isActive) return;

        setAccounts(userAccounts);
        setCategories(userCategories);
      })
      .catch((cause: unknown) => {
        if (isActive) reportError(cause);
      })
      .finally(() => {
        if (isActive) setIsLoadingReferences(false);
      });

    return () => {
      isActive = false;
    };
  }, [reportError]);

  useEffect(() => {
    let isActive = true;

    void getTransactions(query)
      .then((page) => {
        if (!isActive) return;

        setTransactions(page.transactions);
        setPagination(page.pagination);
      })
      .catch((cause: unknown) => {
        if (isActive) reportError(cause);
      })
      .finally(() => {
        if (isActive) setIsLoadingTransactions(false);
      });

    return () => {
      isActive = false;
    };
  }, [query, reportError]);

  function applyFilters(filters: TransactionFilterValues) {
    setError(null);
    setIsLoadingTransactions(true);
    setQuery({ ...filters, limit: pageSize, offset: 0 });
  }

  async function refreshAfterChange() {
    if ((query.offset ?? 0) === 0) {
      setIsLoadingTransactions(true);
      await loadTransactions(query);
    } else {
      setIsLoadingTransactions(true);
      setQuery((currentQuery) => ({ ...currentQuery, offset: 0 }));
    }
  }

  async function submitEditor(
    values: TransactionFormValues,
  ): Promise<boolean> {
    if (!editor) return false;

    const transactionId =
      editor.kind === "edit" ? editor.transaction.id : "new";
    setBusyTransactionId(transactionId);
    setError(null);

    try {
      if (editor.kind === "create") {
        await createTransaction(transactionInputFromForm(values));
      } else {
        await updateTransaction(
          editor.transaction.id,
          transactionInputFromForm(values),
        );
      }

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

  const editedTransaction =
    editor?.kind === "edit" ? editor.transaction : null;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-finhand-primary">
            Ledger records
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-finhand-ink">
            Transactions
          </h1>
          <p className="mt-1.5 text-sm text-finhand-muted">
            Track and organize income and expenses across your accounts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            aria-label="Refresh transaction data"
            disabled={isLoadingReferences || isLoadingTransactions}
            onClick={() => {
              setError(null);
              setIsLoadingReferences(true);
              setIsLoadingTransactions(true);
              void Promise.all([loadReferences(), loadTransactions(query)]);
            }}
            variant="secondary"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-4 ${
                isLoadingReferences || isLoadingTransactions
                  ? "animate-spin"
                  : ""
              }`}
            />
            Refresh
          </Button>
          <Button
            disabled={isLoadingReferences}
            onClick={() => setEditor({ kind: "create" })}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add transaction
          </Button>
        </div>
      </header>

      <TransactionFilters
        accounts={accounts}
        categories={categories}
        isLoading={isLoadingTransactions}
        onApply={applyFilters}
      />

      {error ? (
        <div
          className="rounded-xl border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <TransactionList
        accounts={accounts}
        busyTransactionId={busyTransactionId}
        categories={categories}
        isLoading={isLoadingTransactions}
        onDelete={(transaction) => void removeTransaction(transaction)}
        onEdit={(transaction) =>
          setEditor({ kind: "edit", transaction })
        }
        transactions={transactions}
      />

      <TransactionPagination
        hasMore={pagination.hasMore}
        isLoading={isLoadingTransactions}
        itemCount={transactions.length}
        limit={pagination.limit}
        offset={pagination.offset}
        onNext={showNextPage}
        onPrevious={showPreviousPage}
      />

      {editor ? (
        <TransactionDrawer
          accounts={accounts}
          categories={categories}
          error={error}
          isSubmitting={busyTransactionId !== null}
          key={
            editor.kind === "create" ? "create" : editor.transaction.id
          }
          onClose={() => setEditor(null)}
          onSubmit={submitEditor}
          transaction={editedTransaction}
        />
      ) : null}
    </div>
  );
}
