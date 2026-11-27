"use client";

import { Calculator, Plus, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useDashboardUser } from "@/components/dashboard-shell";
import { currencyOptions } from "@/components/financial-select-options";
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
import { Select } from "../ui/select";
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
      <div className="h-24 animate-pulse rounded-2xl bg-finhand-accent-soft" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            className="h-44 animate-pulse rounded-2xl bg-white"
            key={index}
          />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
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
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-finhand-accent-soft px-4 py-4 text-finhand-primary-strong sm:px-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-finhand-interactive shadow-finhand-card">
          <Calculator aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-finhand-interactive">
            Balance calculation
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-finhand-ink">
            <span>Current balance</span>
            <span aria-hidden="true" className="text-finhand-subtle">
              =
            </span>
            <span>Opening balance</span>
            <span className="text-finhand-income">+ Income</span>
            <span className="text-finhand-expense">− Expenses</span>
          </p>
        </div>
        {availableCurrencies.length > 1 ? (
          <label className="w-full text-xs font-semibold text-finhand-muted sm:w-auto sm:shrink-0">
            Currency
            <Select
              ariaLabel="Accounts currency"
              className="mt-1 w-full sm:w-28"
              menuLabel="Currencies"
              onValueChange={setSelectedCurrency}
              options={currencyOptions(availableCurrencies)}
              value={currencyCode}
              variant="compact"
            />
          </label>
        ) : null}
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
        <div className="mb-4 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-finhand-ink">
              Active accounts ({activeAccounts.length})
            </h2>
            <p className="mt-1 text-sm text-finhand-muted">
              Sorted by current balance, highest first.
            </p>
          </div>
          <Button
            className="w-full shrink-0 sm:w-auto"
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
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
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
