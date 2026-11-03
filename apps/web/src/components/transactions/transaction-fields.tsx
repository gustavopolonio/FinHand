import type { Account, Category, TransactionType } from "@/lib/api";
import { transactionTypes } from "@/lib/api";

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
