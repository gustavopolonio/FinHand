"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ApiError,
  type Account,
  type Category,
  type Transaction,
  type TransactionFilters,
  type TransactionType,
  createTransaction,
  deleteTransaction,
  getAccounts,
  getCategories,
  getTransactions,
  transactionTypes,
  updateTransaction,
} from "@/lib/api";
import {
  formatMinorUnits,
  majorToMinorUnits,
  minorToMajorUnits,
} from "@/lib/money";

const pageSize = 10;

const transactionTypeLabels: Record<TransactionType, string> = {
  income: "Income",
  expense: "Expense",
};

interface TransactionFormValues {
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: string;
  occurredOn: string;
  description: string;
  counterparty: string;
  notes: string;
}

interface TransactionFieldsProps {
  accounts: Account[];
  categories: Category[];
  onChange: (values: TransactionFormValues) => void;
  values: TransactionFormValues;
}

function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function emptyTransactionForm(): TransactionFormValues {
  return {
    accountId: "",
    categoryId: "",
    type: "expense",
    amount: "0.00",
    occurredOn: localToday(),
    description: "",
    counterparty: "",
    notes: "",
  };
}

function formValuesFromTransaction(
  transaction: Transaction,
): TransactionFormValues {
  return {
    accountId: transaction.accountId,
    categoryId: transaction.categoryId ?? "",
    type: transaction.type,
    amount: minorToMajorUnits(transaction.amountMinor),
    occurredOn: transaction.occurredOn,
    description: transaction.description,
    counterparty: transaction.counterparty ?? "",
    notes: transaction.notes ?? "",
  };
}

function positiveMinorUnits(value: string): string {
  const amountMinor = majorToMinorUnits(value);

  if (BigInt(amountMinor) <= 0n) {
    throw new Error("Transaction amount must be greater than zero.");
  }

  return amountMinor;
}

function TransactionFields({
  accounts,
  categories,
  onChange,
  values,
}: TransactionFieldsProps) {
  const matchingCategories = categories.filter(
    (category) => category.type === values.type,
  );
  const selectedAccount = accounts.find(
    (account) => account.id === values.accountId,
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-sm font-medium text-slate-700">
        Type
        <select
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          onChange={(event) => {
            const type = event.target.value as TransactionType;
            const selectedCategory = categories.find(
              (category) => category.id === values.categoryId,
            );

            onChange({
              ...values,
              type,
              categoryId:
                selectedCategory?.type === type ? values.categoryId : "",
            });
          }}
          value={values.type}
        >
          {transactionTypes.map((type) => (
            <option key={type} value={type}>
              {transactionTypeLabels[type]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-slate-700">
        Account
        <select
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          onChange={(event) =>
            onChange({ ...values, accountId: event.target.value })
          }
          required
          value={values.accountId}
        >
          <option value="">Select an account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currencyCode})
              {account.archivedAt ? " — archived" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-slate-700">
        Category
        <select
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          onChange={(event) =>
            onChange({ ...values, categoryId: event.target.value })
          }
          value={values.categoryId}
        >
          <option value="">Uncategorized</option>
          {matchingCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.archivedAt ? " — archived" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-slate-700">
        Amount ({selectedAccount?.currencyCode ?? "currency"})
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          inputMode="decimal"
          onChange={(event) =>
            onChange({ ...values, amount: event.target.value })
          }
          required
          value={values.amount}
        />
      </label>

      <label className="text-sm font-medium text-slate-700">
        Date
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          onChange={(event) =>
            onChange({ ...values, occurredOn: event.target.value })
          }
          required
          type="date"
          value={values.occurredOn}
        />
      </label>

      <label className="text-sm font-medium text-slate-700">
        Description
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          maxLength={200}
          onChange={(event) =>
            onChange({ ...values, description: event.target.value })
          }
          required
          value={values.description}
        />
      </label>

      <label className="text-sm font-medium text-slate-700">
        Counterparty (optional)
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          maxLength={200}
          onChange={(event) =>
            onChange({ ...values, counterparty: event.target.value })
          }
          value={values.counterparty}
        />
      </label>

      <label className="text-sm font-medium text-slate-700">
        Notes (optional)
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          maxLength={2000}
          onChange={(event) =>
            onChange({ ...values, notes: event.target.value })
          }
          value={values.notes}
        />
      </label>
    </div>
  );
}

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
  const [query, setQuery] = useState<TransactionFilters>({
    limit: pageSize,
    offset: 0,
  });
  const [filterType, setFilterType] = useState("");
  const [filterAccountId, setFilterAccountId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [createValues, setCreateValues] = useState(emptyTransactionForm);
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);
  const [editValues, setEditValues] =
    useState<TransactionFormValues | null>(null);
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
      Promise.all([
        getAccounts(),
        getCategories(),
      ])
        .then(([userAccounts, userCategories]) => {
          const activeAccounts = userAccounts.filter(
            (account) => !account.archivedAt,
          );
          const activeCategories = userCategories.filter(
            (category) => !category.archivedAt,
          );

          setAccounts(userAccounts);
          setCategories(userCategories);
          setCreateValues((currentValues) => ({
            ...currentValues,
            accountId:
              activeAccounts.some(
                (account) => account.id === currentValues.accountId,
              )
                ? currentValues.accountId
                : (activeAccounts[0]?.id ?? ""),
            categoryId: activeCategories.some(
              (category) =>
                category.id === currentValues.categoryId &&
                category.type === currentValues.type,
            )
              ? currentValues.categoryId
              : "",
          }));
        })
        .catch(reportError)
        .finally(() => setIsLoadingReferences(false)),
    [reportError],
  );

  const loadTransactions = useCallback(
    (filters: TransactionFilters) =>
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

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoadingTransactions(true);
    setQuery({
      ...(filterType ? { type: filterType as TransactionType } : {}),
      ...(filterAccountId ? { accountId: filterAccountId } : {}),
      ...(filterCategoryId ? { categoryId: filterCategoryId } : {}),
      ...(filterFrom ? { from: filterFrom } : {}),
      ...(filterTo ? { to: filterTo } : {}),
      limit: pageSize,
      offset: 0,
    });
  }

  function resetFilters() {
    setFilterType("");
    setFilterAccountId("");
    setFilterCategoryId("");
    setFilterFrom("");
    setFilterTo("");
    setIsLoadingTransactions(true);
    setQuery({ limit: pageSize, offset: 0 });
  }

  async function refreshAfterChange() {
    setIsLoadingTransactions(true);

    if ((query.offset ?? 0) === 0) {
      await loadTransactions(query);
    } else {
      setQuery((currentQuery) => ({ ...currentQuery, offset: 0 }));
    }
  }

  async function submitNewTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyTransactionId("new");
    setError(null);

    try {
      await createTransaction({
        accountId: createValues.accountId,
        categoryId: createValues.categoryId || null,
        type: createValues.type,
        amountMinor: positiveMinorUnits(createValues.amount),
        occurredOn: createValues.occurredOn,
        description: createValues.description,
        counterparty: createValues.counterparty || null,
        notes: createValues.notes || null,
      });
      const activeAccountId = accounts.find(
        (account) => !account.archivedAt,
      )?.id;

      setCreateValues({
        ...emptyTransactionForm(),
        accountId: activeAccountId ?? "",
      });
      await refreshAfterChange();
    } catch (cause) {
      reportError(cause);
    } finally {
      setBusyTransactionId(null);
    }
  }

  function startEditing(transaction: Transaction) {
    setEditingTransactionId(transaction.id);
    setEditValues(formValuesFromTransaction(transaction));
    setError(null);
  }

  async function submitTransactionEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingTransactionId || !editValues) {
      return;
    }

    setBusyTransactionId(editingTransactionId);
    setError(null);

    try {
      await updateTransaction(editingTransactionId, {
        accountId: editValues.accountId,
        categoryId: editValues.categoryId || null,
        type: editValues.type,
        amountMinor: positiveMinorUnits(editValues.amount),
        occurredOn: editValues.occurredOn,
        description: editValues.description,
        counterparty: editValues.counterparty || null,
        notes: editValues.notes || null,
      });
      setEditingTransactionId(null);
      setEditValues(null);
      await refreshAfterChange();
    } catch (cause) {
      reportError(cause);
    } finally {
      setBusyTransactionId(null);
    }
  }

  async function removeTransaction(transaction: Transaction) {
    if (!window.confirm(`Delete “${transaction.description}”?`)) {
      return;
    }

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

  const activeAccounts = accounts.filter((account) => !account.archivedAt);
  const activeCategories = categories.filter(
    (category) => !category.archivedAt,
  );
  const filterCategories = filterType
    ? categories.filter((category) => category.type === filterType)
    : categories;
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

      <form
        className="mt-5 rounded-xl border border-slate-200 p-4"
        onSubmit={(event) => void submitNewTransaction(event)}
      >
        <h3 className="font-semibold text-slate-900">New transaction</h3>
        <div className="mt-4">
          <TransactionFields
            accounts={activeAccounts}
            categories={activeCategories}
            onChange={setCreateValues}
            values={createValues}
          />
        </div>
        <button
          className="mt-4 rounded-md bg-emerald-900 px-4 py-2 font-medium text-white disabled:opacity-50"
          disabled={isBusy || activeAccounts.length === 0}
          type="submit"
        >
          {busyTransactionId === "new" ? "Creating…" : "Create transaction"}
        </button>
        {!isLoadingReferences && activeAccounts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            Create or restore an account before adding a transaction.
          </p>
        ) : null}
      </form>

      <form
        className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-3"
        onSubmit={applyFilters}
      >
        <label className="text-sm font-medium text-slate-700">
          Type
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            onChange={(event) => {
              const nextType = event.target.value;
              const selectedCategory = categories.find(
                (category) => category.id === filterCategoryId,
              );

              setFilterType(nextType);
              if (selectedCategory && selectedCategory.type !== nextType) {
                setFilterCategoryId("");
              }
            }}
            value={filterType}
          >
            <option value="">All types</option>
            {transactionTypes.map((type) => (
              <option key={type} value={type}>
                {transactionTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Account
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            onChange={(event) => setFilterAccountId(event.target.value)}
            value={filterAccountId}
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Category
          <select
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            onChange={(event) => setFilterCategoryId(event.target.value)}
            value={filterCategoryId}
          >
            <option value="">All categories</option>
            {filterCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          From
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            onChange={(event) => setFilterFrom(event.target.value)}
            type="date"
            value={filterFrom}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          To
          <input
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            onChange={(event) => setFilterTo(event.target.value)}
            type="date"
            value={filterTo}
          />
        </label>

        <div className="flex items-end gap-2">
          <button
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-white"
            type="submit"
          >
            Apply filters
          </button>
          <button
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
            onClick={resetFilters}
            type="button"
          >
            Reset
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {isLoadingTransactions ? (
        <p className="mt-6 text-sm text-slate-600">Loading transactions…</p>
      ) : transactions.length === 0 ? (
        <p className="mt-6 text-sm text-slate-600">
          No transactions found.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {transactions.map((transaction) => {
            const account = accounts.find(
              (candidate) => candidate.id === transaction.accountId,
            );
            const category = categories.find(
              (candidate) => candidate.id === transaction.categoryId,
            );
            const editAccounts = accounts.filter(
              (candidate) =>
                !candidate.archivedAt || candidate.id === transaction.accountId,
            );
            const editCategories = categories.filter(
              (candidate) =>
                !candidate.archivedAt || candidate.id === transaction.categoryId,
            );

            return (
              <li
                className="rounded-xl border border-slate-200 p-4"
                key={transaction.id}
              >
                {editingTransactionId === transaction.id && editValues ? (
                  <form
                    onSubmit={(event) => void submitTransactionEdit(event)}
                  >
                    <TransactionFields
                      accounts={editAccounts}
                      categories={editCategories}
                      onChange={setEditValues}
                      values={editValues}
                    />
                    <div className="mt-4 flex gap-2">
                      <button
                        className="rounded-md bg-emerald-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        disabled={isBusy}
                        type="submit"
                      >
                        {busyTransactionId === transaction.id
                          ? "Saving…"
                          : "Save"}
                      </button>
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                        disabled={isBusy}
                        onClick={() => {
                          setEditingTransactionId(null);
                          setEditValues(null);
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">
                          {transaction.description}
                        </h3>
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${
                            transaction.type === "income"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {transactionTypeLabels[transaction.type]}
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-slate-900">
                        {formatMinorUnits(
                          transaction.amountMinor,
                          transaction.currencyCode,
                        )}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {transaction.occurredOn} · {account?.name ?? "Unknown account"}
                        {category ? ` · ${category.name}` : " · Uncategorized"}
                      </p>
                      {transaction.counterparty || transaction.notes ? (
                        <p className="mt-1 text-sm text-slate-600">
                          {[transaction.counterparty, transaction.notes]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                        disabled={isBusy}
                        onClick={() => startEditing(transaction)}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700"
                        disabled={isBusy}
                        onClick={() => void removeTransaction(transaction)}
                        type="button"
                      >
                        {busyTransactionId === transaction.id
                          ? "Deleting…"
                          : "Delete"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5 flex items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          {transactions.length > 0
            ? `Showing ${pagination.offset + 1}–${pagination.offset + transactions.length}`
            : "No results on this page"}
        </p>
        <div className="flex gap-2">
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            disabled={isLoadingTransactions || pagination.offset === 0}
            onClick={() => {
              setIsLoadingTransactions(true);
              setQuery((currentQuery) => ({
                ...currentQuery,
                offset: Math.max(0, pagination.offset - pagination.limit),
              }));
            }}
            type="button"
          >
            Previous
          </button>
          <button
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            disabled={isLoadingTransactions || !pagination.hasMore}
            onClick={() => {
              setIsLoadingTransactions(true);
              setQuery((currentQuery) => ({
                ...currentQuery,
                offset: pagination.offset + pagination.limit,
              }));
            }}
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
