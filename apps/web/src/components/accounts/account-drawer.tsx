"use client";

import { Check } from "lucide-react";
import { type FormEvent, useState } from "react";

import type { Account, AccountType } from "@/lib/api";
import { accountTypeOptions } from "@/components/financial-select-options";

import { Button } from "../ui/button";
import { Select } from "../ui/select";
import { WorkspaceModal } from "../ui/workspace-modal";
import {
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
  "mt-1.5 min-h-12 w-full rounded-xl border border-finhand-border-strong bg-white px-4 text-sm text-finhand-ink outline-none transition placeholder:text-finhand-subtle focus:border-finhand-focus focus:ring-2 focus:ring-finhand-focus/20";

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
    <WorkspaceModal
      description={
        account
          ? "Update the account name, type, or starting balance."
          : "Add an account to start tracking its financial activity."
      }
      isBusy={isSubmitting}
      onClose={onClose}
      title={account ? "Edit Account" : "Add Account"}
      widthClassName="max-w-[520px]"
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => void submit(event)}
      >
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <label className="block text-xs font-medium text-finhand-muted">
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

          <label className="block text-xs font-medium text-finhand-muted">
            Account type
            <Select
              ariaLabel="Account type"
              className="mt-1.5"
              menuLabel="Account types"
              onValueChange={(type) =>
                setValues((current) => ({
                  ...current,
                  type: type as AccountType,
                }))
              }
              options={accountTypeOptions()}
              value={values.type}
              variant="soft"
            />
          </label>

          <label className="block text-xs font-medium text-finhand-muted">
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

          <p className="rounded-xl bg-finhand-accent-soft p-4 text-sm leading-6 text-finhand-muted">
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

        <div className="flex justify-end gap-3 border-t border-finhand-divider bg-finhand-canvas-muted p-5">
          <Button
            className="rounded-xl!"
            disabled={isSubmitting}
            onClick={onClose}
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl!"
            disabled={isSubmitting}
            type="submit"
          >
            {!isSubmitting ? (
              <Check aria-hidden="true" className="size-4" />
            ) : null}
            {isSubmitting
              ? "Saving…"
              : account
                ? "Save Changes"
                : "Save Account"}
          </Button>
        </div>
      </form>
    </WorkspaceModal>
  );
}
