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

const controlClassName =
  "mt-1.5 min-h-11 w-full rounded-lg border border-finhand-border bg-white px-3 text-sm text-finhand-ink outline-none transition placeholder:text-finhand-subtle focus:border-finhand-focus focus:ring-2 focus:ring-finhand-focus/20";
const labelClassName = "text-sm font-semibold text-finhand-ink";

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
    <div className="grid grid-cols-2 gap-4">
      <label className={labelClassName}>
        Type
        <select
          className={controlClassName}
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

      <label className="col-span-2 text-sm font-semibold text-finhand-ink">
        Account
        <select
          className={controlClassName}
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

      <label className={labelClassName}>
        Category
        <select
          className={controlClassName}
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

      <label className={labelClassName}>
        Amount ({selectedAccount?.currencyCode ?? "currency"})
        <input
          className={controlClassName}
          inputMode="decimal"
          onChange={(event) =>
            onChange({ ...values, amount: event.target.value })
          }
          placeholder="0.00"
          required
          value={values.amount}
        />
      </label>

      <label className="col-span-2 text-sm font-semibold text-finhand-ink">
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

      <label className="col-span-2 text-sm font-semibold text-finhand-ink">
        Counterparty{" "}
        <span className="font-normal text-finhand-muted">(optional)</span>
        <input
          className={controlClassName}
          maxLength={200}
          onChange={(event) =>
            onChange({ ...values, counterparty: event.target.value })
          }
          placeholder="Store, employer, or person"
          value={values.counterparty}
        />
      </label>

      <label className="col-span-2 text-sm font-semibold text-finhand-ink">
        Notes <span className="font-normal text-finhand-muted">(optional)</span>
        <textarea
          className={`${controlClassName} min-h-24 resize-y py-3`}
          maxLength={2000}
          onChange={(event) =>
            onChange({ ...values, notes: event.target.value })
          }
          placeholder="Add any useful details"
          value={values.notes}
        />
      </label>
    </div>
  );
}
