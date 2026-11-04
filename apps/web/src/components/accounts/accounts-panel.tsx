"use client";

import { Calculator, Plus, RefreshCw, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useDashboardUser } from "@/components/dashboard-shell";
import {
  ApiError,
  type Account,
  type FinancialSummary,
  archiveAccount,
  createAccount,
  getAccounts,
  getFinancialSummary,
  restoreAccount,
  updateAccount,
} from "@/lib/api";

import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { AccountCard, ArchivedAccounts } from "./account-card";
import {
  accountsWithBalances,
  sortAccountsByBalance,
} from "./account-data";
import { AccountDrawer } from "./account-drawer";
import {
  accountInputFromForm,
  type AccountFormValues,
} from "./account-form";
import { AccountSummary } from "./account-summary";

type AccountEditor =
  | { kind: "create" }
  | { account: Account; kind: "edit" };

function AccountsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading accounts" className="space-y-6">
      <div className="h-24 animate-pulse rounded-2xl bg-finhand-mint-soft" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-44 animate-pulse rounded-2xl bg-white"
            key={index}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="h-72 animate-pulse rounded-2xl bg-white" />
        <div className="h-72 animate-pulse rounded-2xl bg-white" />
      </div>
    </div>
  );
}

export function AccountsPanel() {
  const router = useRouter();
  const user = useDashboardUser();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState(
    user.defaultCurrency,
  );
  const [editor, setEditor] = useState<AccountEditor | null>(null);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
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

  const loadAccountData = useCallback(async () => {
    try {
      const [userAccounts, financialSummary] = await Promise.all([
        getAccounts(),
        getFinancialSummary(),
      ]);
      setAccounts(userAccounts);
      setSummary(financialSummary);
    } catch (cause) {
      reportError(cause);
    } finally {
      setIsLoading(false);
    }
  }, [reportError]);

  useEffect(() => {
    let isActive = true;

    void Promise.all([getAccounts(), getFinancialSummary()])
      .then(([userAccounts, financialSummary]) => {
        if (!isActive) return;

        setAccounts(userAccounts);
        setSummary(financialSummary);
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

  async function submitEditor(values: AccountFormValues): Promise<boolean> {
    if (!editor) return false;

    const accountId = editor.kind === "edit" ? editor.account.id : "new";
    setBusyAccountId(accountId);
    setError(null);

    try {
      const input = accountInputFromForm(values);

      if (editor.kind === "create") {
        await createAccount(input);
      } else {
        await updateAccount(editor.account.id, input);
      }

      await loadAccountData();
      return true;
    } catch (cause) {
      reportError(cause);
      return false;
    } finally {
      setBusyAccountId(null);
    }
  }

  async function changeArchiveState(account: Account) {
    setBusyAccountId(account.id);
    setError(null);

    try {
      if (account.archivedAt) {
        await restoreAccount(account.id);
      } else {
        await archiveAccount(account.id);
      }

      await loadAccountData();
    } catch (cause) {
      reportError(cause);
    } finally {
      setBusyAccountId(null);
    }
  }

  if (isLoading && !summary) {
    return <AccountsSkeleton />;
  }

  if (!summary) {
    return (
      <Card className="grid min-h-80 place-items-center p-10 text-center">
        <div>
          <h1 className="text-2xl font-bold text-finhand-ink">
            We couldn&apos;t load your accounts
          </h1>
          <p className="mt-2 text-sm text-finhand-muted">{error}</p>
          <Button
            className="mt-6"
            onClick={() => {
              setError(null);
              setIsLoading(true);
              void loadAccountData();
            }}
          >
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  const accountData = accountsWithBalances(accounts, summary);
  const availableCurrencies = Array.from(
    new Set(accountData.map((account) => account.currencyCode)),
  ).sort();
  const currencyCode = availableCurrencies.includes(selectedCurrency)
    ? selectedCurrency
    : availableCurrencies.includes(user.defaultCurrency)
      ? user.defaultCurrency
      : (availableCurrencies[0] ?? user.defaultCurrency);
  const currencyAccounts = accountData.filter(
    (account) => account.currencyCode === currencyCode,
  );
  const activeAccounts = sortAccountsByBalance(
    currencyAccounts.filter((account) => !account.archivedAt),
  );
  const archivedAccounts = sortAccountsByBalance(
    currencyAccounts.filter((account) => account.archivedAt),
  );
  const editedAccount = editor?.kind === "edit" ? editor.account : null;

  return (
    <div className="space-y-7">
      <header className="flex items-end justify-between gap-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-finhand-primary">
            Portfolio structure
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-finhand-ink">
            Accounts
          </h1>
          <p className="mt-1.5 text-sm text-finhand-muted">
            Manage starting balances and monitor calculated balances in real
            time.
          </p>
        </div>
        <div className="flex items-end gap-2">
          {availableCurrencies.length > 1 ? (
            <label className="mr-1 text-xs font-semibold text-finhand-muted">
              Currency
              <select
                className="mt-1 block h-10 rounded-lg border border-finhand-border bg-white px-3 text-sm font-semibold text-finhand-ink outline-none focus:border-finhand-focus focus:ring-2 focus:ring-finhand-focus/20"
                onChange={(event) => setSelectedCurrency(event.target.value)}
                value={currencyCode}
              >
                {availableCurrencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Button
            aria-label="Refresh account data"
            disabled={isLoading || busyAccountId !== null}
            onClick={() => {
              setError(null);
              setIsLoading(true);
              void loadAccountData();
            }}
            variant="secondary"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            disabled={isLoading}
            onClick={() => {
              setError(null);
              setEditor({ kind: "create" });
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add account
          </Button>
        </div>
      </header>

      <div className="flex items-center gap-4 rounded-2xl bg-finhand-mint-soft px-5 py-4 text-finhand-primary-strong">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-finhand-primary shadow-finhand-card">
          <Calculator aria-hidden="true" className="size-5" />
        </span>
        <div>
          <p className="font-bold">Balance calculation</p>
          <p className="mt-0.5 text-sm text-finhand-muted">
            Current balance equals the opening balance plus income and minus
            expenses registered for each account.
          </p>
        </div>
      </div>

      <AccountSummary
        accounts={accountData}
        currencyCode={currencyCode}
        summary={summary}
      />

      {error ? (
        <div
          className="rounded-xl border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-finhand-ink">
              Active accounts ({activeAccounts.length})
            </h2>
            <p className="mt-1 text-sm text-finhand-muted">
              Sorted by current balance, highest first.
            </p>
          </div>
        </div>

        {activeAccounts.length === 0 ? (
          <Card className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <WalletCards className="mx-auto size-8 text-finhand-subtle" />
              <h3 className="mt-4 text-lg font-bold text-finhand-ink">
                No active {currencyCode} accounts
              </h3>
              <p className="mt-1 text-sm text-finhand-muted">
                Add an account or restore one from the archive.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {activeAccounts.map((account) => (
              <AccountCard
                account={account}
                busyAccountId={busyAccountId}
                key={account.id}
                onArchive={(selectedAccount) =>
                  void changeArchiveState(selectedAccount)
                }
                onEdit={(selectedAccount) => {
                  setError(null);
                  setEditor({ account: selectedAccount, kind: "edit" });
                }}
              />
            ))}
          </div>
        )}
      </section>

      <ArchivedAccounts
        accounts={archivedAccounts}
        busyAccountId={busyAccountId}
        onRestore={(account) => void changeArchiveState(account)}
      />

      {editor ? (
        <AccountDrawer
          account={editedAccount}
          defaultCurrency={user.defaultCurrency}
          error={error}
          isSubmitting={busyAccountId !== null}
          key={editor.kind === "create" ? "create" : editor.account.id}
          onClose={() => setEditor(null)}
          onSubmit={submitEditor}
        />
      ) : null}
    </div>
  );
}
