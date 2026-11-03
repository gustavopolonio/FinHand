"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import {
  ApiError,
  type Account,
  type AccountType,
  accountTypes,
  archiveAccount,
  createAccount,
  getAccounts,
  restoreAccount,
  updateAccount,
} from "@/lib/api";
import {
  formatMinorUnits,
  majorToMinorUnits,
  minorToMajorUnits,
} from "@/lib/money";

const accountTypeLabels: Record<AccountType, string> = {
  cash: "Cash",
  checking: "Checking",
  savings: "Savings",
  credit: "Credit",
  investment: "Investment",
  other: "Other",
};

interface AccountsPanelProps {
  defaultCurrency: string;
}

function sortAccounts(accounts: Account[]) {
  return [...accounts].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
}

export function AccountsPanel({ defaultCurrency }: AccountsPanelProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [openingBalance, setOpeningBalance] = useState("0.00");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<AccountType>("checking");
  const [editOpeningBalance, setEditOpeningBalance] = useState("0.00");

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

  useEffect(() => {
    let isActive = true;

    void getAccounts()
      .then((userAccounts) => {
        if (isActive) {
          setAccounts(userAccounts);
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

  function replaceAccount(updatedAccount: Account) {
    setAccounts((currentAccounts) =>
      sortAccounts(
        currentAccounts.map((account) =>
          account.id === updatedAccount.id ? updatedAccount : account,
        ),
      ),
    );
  }

  async function submitNewAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAccountId("new");
    setError(null);

    try {
      const account = await createAccount({
        name,
        type,
        openingBalanceMinor: majorToMinorUnits(openingBalance),
      });

      setAccounts((currentAccounts) =>
        sortAccounts([...currentAccounts, account]),
      );
      setName("");
      setType("checking");
      setOpeningBalance("0.00");
    } catch (cause) {
      reportError(cause);
    } finally {
      setBusyAccountId(null);
    }
  }

  function startEditing(account: Account) {
    setEditingAccountId(account.id);
    setEditName(account.name);
    setEditType(account.type);
    setEditOpeningBalance(minorToMajorUnits(account.openingBalanceMinor));
    setError(null);
  }

  async function submitAccountEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingAccountId) {
      return;
    }

    setBusyAccountId(editingAccountId);
    setError(null);

    try {
      const account = await updateAccount(editingAccountId, {
        name: editName,
        type: editType,
        openingBalanceMinor: majorToMinorUnits(editOpeningBalance),
      });

      replaceAccount(account);
      setEditingAccountId(null);
    } catch (cause) {
      reportError(cause);
    } finally {
      setBusyAccountId(null);
    }
  }

  async function changeArchiveState(account: Account) {
    setBusyAccountId(account.id);
    setError(null);

    try {
      const updatedAccount = account.archivedAt
        ? await restoreAccount(account.id)
        : await archiveAccount(account.id);

      replaceAccount(updatedAccount);
    } catch (cause) {
      reportError(cause);
    } finally {
      setBusyAccountId(null);
    }
  }

  const isBusy = busyAccountId !== null;

  return (
    <div className="mt-10 border-t border-slate-200 pt-8">
      <h2 className="text-2xl font-semibold text-emerald-950">Accounts</h2>

      <form
        className="mt-5 grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-4"
        onSubmit={(event) => void submitNewAccount(event)}
      >
        <label className="text-sm font-medium text-slate-700">
          Name
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Type
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            onChange={(event) => setType(event.target.value as AccountType)}
            value={type}
          >
            {accountTypes.map((accountType) => (
              <option key={accountType} value={accountType}>
                {accountTypeLabels[accountType]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Opening balance ({defaultCurrency})
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            inputMode="decimal"
            onChange={(event) => setOpeningBalance(event.target.value)}
            required
            value={openingBalance}
          />
        </label>

        <button
          className="self-end rounded-md bg-emerald-900 px-4 py-2 font-medium text-white disabled:opacity-50"
          disabled={isBusy}
          type="submit"
        >
          {busyAccountId === "new" ? "Creating…" : "Create account"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-600">Loading accounts…</p>
      ) : accounts.length === 0 ? (
        <p className="mt-6 text-sm text-slate-600">No accounts yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {accounts.map((account) => (
            <li className="rounded-xl border border-slate-200 p-4" key={account.id}>
              {editingAccountId === account.id ? (
                <form
                  className="grid gap-3 md:grid-cols-4"
                  onSubmit={(event) => void submitAccountEdit(event)}
                >
                  <label className="text-sm font-medium text-slate-700">
                    Name
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                      maxLength={100}
                      onChange={(event) => setEditName(event.target.value)}
                      required
                      value={editName}
                    />
                  </label>

                  <label className="text-sm font-medium text-slate-700">
                    Type
                    <select
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                      onChange={(event) =>
                        setEditType(event.target.value as AccountType)
                      }
                      value={editType}
                    >
                      {accountTypes.map((accountType) => (
                        <option key={accountType} value={accountType}>
                          {accountTypeLabels[accountType]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-medium text-slate-700">
                    Opening balance ({account.currencyCode})
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                      inputMode="decimal"
                      onChange={(event) =>
                        setEditOpeningBalance(event.target.value)
                      }
                      required
                      value={editOpeningBalance}
                    />
                  </label>

                  <div className="flex items-end gap-2">
                    <button
                      className="rounded-md bg-emerald-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      disabled={isBusy}
                      type="submit"
                    >
                      Save
                    </button>
                    <button
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                      disabled={isBusy}
                      onClick={() => setEditingAccountId(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {account.name}
                      </h3>
                      {account.archivedAt ? (
                        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                          Archived
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {accountTypeLabels[account.type]} · Opening balance:{" "}
                      {formatMinorUnits(
                        account.openingBalanceMinor,
                        account.currencyCode,
                      )}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                      disabled={isBusy}
                      onClick={() => startEditing(account)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                      disabled={isBusy}
                      onClick={() => void changeArchiveState(account)}
                      type="button"
                    >
                      {busyAccountId === account.id
                        ? "Saving…"
                        : account.archivedAt
                          ? "Restore"
                          : "Archive"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
