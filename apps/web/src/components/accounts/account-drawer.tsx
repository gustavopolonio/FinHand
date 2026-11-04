"use client";

import { type FormEvent, useState } from "react";

import type { Account, AccountType } from "@/lib/api";
import { accountTypes } from "@/lib/api";

import { Button } from "../ui/button";
import { SideDrawer } from "../ui/side-drawer";
import {
  accountTypeLabels,
  emptyAccountForm,
  formValuesFromAccount,
  type AccountFormValues,
} from "./account-form";

interface AccountDrawerProps {
  account: Account | null;
  defaultCurrency: string;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: AccountFormValues) => Promise<boolean>;
}

const controlClassName =
  "mt-1.5 min-h-11 w-full rounded-lg border border-finhand-border bg-white px-3 text-sm text-finhand-ink outline-none transition placeholder:text-finhand-subtle focus:border-finhand-focus focus:ring-2 focus:ring-finhand-focus/20";

export function AccountDrawer({
  account,
  defaultCurrency,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: AccountDrawerProps) {
  const [values, setValues] = useState<AccountFormValues>(() =>
    account ? formValuesFromAccount(account) : emptyAccountForm(),
  );
  const currencyCode = account?.currencyCode ?? defaultCurrency;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (await onSubmit(values)) {
      onClose();
    }
  }

  return (
    <SideDrawer
      description={
        account
          ? "Update the account name, type, or starting balance."
          : "Add an account to start tracking its financial activity."
      }
      eyebrow={account ? "Update account" : "Portfolio structure"}
      isBusy={isSubmitting}
      onClose={onClose}
      title={account ? "Edit account" : "Add account"}
      widthClassName="w-[480px]"
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => void submit(event)}
      >
        <div className="flex-1 space-y-5 overflow-y-auto px-7 py-6">
          <label className="block text-sm font-semibold text-finhand-ink">
            Account name
            <input
              autoFocus
              className={controlClassName}
              maxLength={100}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="For example, Main checking"
              required
              value={values.name}
            />
          </label>

          <label className="block text-sm font-semibold text-finhand-ink">
            Account type
            <select
              className={controlClassName}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  type: event.target.value as AccountType,
                }))
              }
              value={values.type}
            >
              {accountTypes.map((accountType) => (
                <option key={accountType} value={accountType}>
                  {accountTypeLabels[accountType]}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-finhand-ink">
            Opening balance ({currencyCode})
            <input
              className={controlClassName}
              inputMode="decimal"
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  openingBalance: event.target.value,
                }))
              }
              required
              value={values.openingBalance}
            />
          </label>

          <p className="rounded-xl bg-finhand-mint-soft p-4 text-sm leading-6 text-finhand-muted">
            The current balance is calculated from this opening balance plus
            all transactions registered for the account. New accounts use your
            current default currency.
          </p>

          {error ? (
            <p
              className="rounded-lg border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-finhand-border bg-white px-7 py-5">
          <Button
            disabled={isSubmitting}
            onClick={onClose}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting
              ? "Saving…"
              : account
                ? "Save changes"
                : "Add account"}
          </Button>
        </div>
      </form>
    </SideDrawer>
  );
}
