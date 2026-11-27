import { ArrowDown, ArrowUpRight } from "lucide-react";

import type { Account, Category, TransactionType } from "@/lib/api";
import { transactionTypes } from "@/lib/api";
import { cn } from "@/lib/class-names";
import {
  accountOptions,
  categoryOptionsWithUncategorized,
} from "@/components/financial-select-options";

import { Select } from "../ui/select";
import { CurrencyInput } from "../ui/currency-input";
import { Input } from "../ui/input";
import {
  type TransactionFormValues,
  transactionTypeLabels,
} from "./transaction-form";

interface TransactionFieldsProps {
  accounts: Account[];
  categories: Category[];
  compactSelectors?: boolean;
  onChange: (values: TransactionFormValues) => void;
  values: TransactionFormValues;
}

const labelClassName = "text-xs font-medium text-finhand-muted";

export function TransactionFields({
  accounts,
  categories,
  compactSelectors = false,
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
    <div className="min-w-0 space-y-5">
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
        <CurrencyInput
          autoFocus
          className="mt-1.5"
          currencyCode={currencyCode}
          inputClassName="text-2xl font-bold tracking-[-0.02em]"
          onValueChange={(amount) => onChange({ ...values, amount })}
          placeholder="0,00"
          required
          value={values.amount}
        />
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
            options={accountOptions(accounts).map((option) =>
              compactSelectors ? { ...option, icon: undefined } : option,
            )}
            placeholder="Select an account"
            triggerClassName={compactSelectors ? "h-12" : undefined}
            value={values.accountId}
            variant={compactSelectors ? "compact" : "soft"}
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
            triggerClassName={compactSelectors ? "h-12" : undefined}
            value={values.categoryId}
            variant={compactSelectors ? "compact" : "soft"}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className={labelClassName}>
          Date
          <Input
            className="mt-1.5"
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
          <Input
            className="mt-1.5"
            maxLength={200}
            onChange={(event) =>
              onChange({ ...values, counterparty: event.target.value })
            }
            placeholder="e.g. market, landlord"
            value={values.counterparty}
          />
        </label>
      </div>

      <label className={`block min-w-0 ${labelClassName}`}>
        Description
        <Input
          className="mt-1.5"
          maxLength={200}
          onChange={(event) =>
            onChange({ ...values, description: event.target.value })
          }
          placeholder="What was this transaction for?"
          required
          value={values.description}
        />
      </label>

    </div>
  );
}
