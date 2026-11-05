import { ArrowDown, ArrowUpRight } from "lucide-react";

import type { Account, Category, TransactionType } from "@/lib/api";
import { transactionTypes } from "@/lib/api";
import { cn } from "@/lib/class-names";
import {
  accountOptions,
  categoryOptionsWithUncategorized,
} from "@/components/financial-select-options";

import { Select } from "../ui/select";
import {
  type TransactionFormValues,
  transactionTypeLabels,
} from "./transaction-form";

interface TransactionFieldsProps {
  accounts: Account[];
  categories: Category[];
  onChange: (values: TransactionFormValues) => void;
  values: TransactionFormValues;
}

const controlClassName =
  "mt-1.5 min-h-12 w-full rounded-xl border border-finhand-border-strong bg-white px-4 text-sm text-finhand-ink outline-none transition placeholder:text-finhand-subtle focus:border-finhand-focus focus:ring-2 focus:ring-finhand-focus/20";
const labelClassName = "text-xs font-medium text-finhand-muted";

const currencySymbols: Record<string, string> = {
  BRL: "R$",
  EUR: "€",
  GBP: "£",
  USD: "US$",
};

export function TransactionFields({
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
  const currencyCode = selectedAccount?.currencyCode ?? "BRL";

  function changeType(type: TransactionType) {
    const selectedCategory = categories.find(
      (category) => category.id === values.categoryId,
    );

    onChange({
      ...values,
      type,
      categoryId: selectedCategory?.type === type ? values.categoryId : "",
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-finhand-canvas-muted p-1">
        {transactionTypes.map((type) => {
          const Icon = type === "expense" ? ArrowUpRight : ArrowDown;

          return (
            <button
              aria-pressed={values.type === type}
              className={cn(
                "flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition",
                values.type === type
                  ? type === "expense"
                    ? "bg-white text-finhand-expense shadow-finhand-card"
                    : "bg-white text-finhand-income shadow-finhand-card"
                  : "text-finhand-muted hover:text-finhand-ink",
              )}
              key={type}
              onClick={() => changeType(type)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-4" />
              {transactionTypeLabels[type]}
            </button>
          );
        })}
      </div>

      <label className={`block ${labelClassName}`}>
        Amount
        <span className="mt-1.5 flex min-h-14 items-center rounded-xl border border-finhand-border-strong bg-white px-4 transition focus-within:border-finhand-focus focus-within:ring-2 focus-within:ring-finhand-focus/20">
          <span className="mr-2 text-base font-medium text-finhand-muted">
            {currencySymbols[currencyCode] ?? currencyCode}
          </span>
          <input
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-2xl font-bold tracking-[-0.02em] text-finhand-ink outline-none placeholder:text-finhand-subtle"
            inputMode="decimal"
            onChange={(event) =>
              onChange({ ...values, amount: event.target.value })
            }
            placeholder="0.00"
            required
            value={values.amount}
          />
        </span>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className={labelClassName}>
          Account
          <Select
            ariaLabel="Account"
            className="mt-1.5"
            menuLabel={`Available accounts (${accounts.length})`}
            onValueChange={(accountId) =>
              onChange({ ...values, accountId })
            }
            options={accountOptions(accounts)}
            placeholder="Select an account"
            value={values.accountId}
            variant="soft"
          />
        </label>

        <label className={labelClassName}>
          Category
          <Select
            ariaLabel="Category"
            className="mt-1.5"
            menuLabel={`Available categories (${matchingCategories.length})`}
            onValueChange={(categoryId) =>
              onChange({ ...values, categoryId })
            }
            options={categoryOptionsWithUncategorized(matchingCategories)}
            placeholder="Uncategorized"
            value={values.categoryId}
            variant="soft"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className={labelClassName}>
          Date
          <input
            className={controlClassName}
            onChange={(event) =>
              onChange({ ...values, occurredOn: event.target.value })
            }
            required
            type="date"
            value={values.occurredOn}
          />
        </label>

        <label className={labelClassName}>
          Payee / Counterparty
          <input
            className={controlClassName}
            maxLength={200}
            onChange={(event) =>
              onChange({ ...values, counterparty: event.target.value })
            }
            placeholder="e.g. market, landlord"
            value={values.counterparty}
          />
        </label>
      </div>

      <label className={`block ${labelClassName}`}>
        Description
        <input
          className={controlClassName}
          maxLength={200}
          onChange={(event) =>
            onChange({ ...values, description: event.target.value })
          }
          placeholder="What was this transaction for?"
          required
          value={values.description}
        />
      </label>

      <label className={`block ${labelClassName}`}>
        Notes (Optional)
        <textarea
          className={`${controlClassName} min-h-20 resize-none py-3`}
          maxLength={2000}
          onChange={(event) =>
            onChange({ ...values, notes: event.target.value })
          }
          placeholder="Add any extra context or receipt reference..."
          rows={2}
          value={values.notes}
        />
      </label>
    </div>
  );
}
