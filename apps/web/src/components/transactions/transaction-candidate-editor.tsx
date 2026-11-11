"use client";

import { Save } from "lucide-react";
import { type FormEvent, useState } from "react";

import {
  accountOptions,
  categoryOptionsWithUncategorized,
} from "@/components/financial-select-options";
import type {
  Account,
  Category,
  TransactionCandidate,
  TransactionType,
  UpdateTransactionCandidateInput,
} from "@/lib/api";

import { Button } from "../ui/button";
import { Select, type SelectOption } from "../ui/select";
import {
  candidateInputFromForm,
  formValuesFromCandidate,
} from "./transaction-candidate-form";

interface TransactionCandidateEditorProps {
  accounts: Account[];
  candidate: TransactionCandidate;
  categories: Category[];
  error: string | null;
  onClose: () => void;
  onSave: (
    candidateId: string,
    input: UpdateTransactionCandidateInput,
  ) => Promise<TransactionCandidate | null>;
  onSaved: (candidate: TransactionCandidate) => void;
}

const controlClassName =
  "mt-1.5 min-h-12 w-full rounded-xl border border-finhand-border-strong bg-white px-4 text-sm text-finhand-ink outline-none transition placeholder:text-finhand-subtle focus:border-finhand-focus focus:ring-2 focus:ring-finhand-focus/20 disabled:bg-finhand-canvas-muted disabled:text-finhand-muted";
const labelClassName = "text-xs font-medium text-finhand-muted";
const typeOptions: SelectOption[] = [
  { label: "Not identified", value: "" },
  { badge: "Money out", label: "Expense", value: "expense" },
  { badge: "Money in", label: "Income", value: "income" },
];

export function TransactionCandidateEditor({
  accounts,
  candidate,
  categories,
  error,
  onClose,
  onSave,
  onSaved,
}: TransactionCandidateEditorProps) {
  const [values, setValues] = useState(() =>
    formValuesFromCandidate(candidate),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [wasSaved, setWasSaved] = useState(false);
  const activeAccounts = accounts.filter(
    (account) => !account.archivedAt || account.id === values.accountId,
  );
  const matchingCategories = categories.filter(
    (category) =>
      (!category.archivedAt || category.id === values.categoryId) &&
      (values.type === "" || category.type === values.type),
  );
  const selectedAccount = activeAccounts.find(
    (account) => account.id === values.accountId,
  );
  const warnings = candidate.extractionMetadata?.warnings ?? [];

  function changeType(type: TransactionType | "") {
    const selectedCategory = categories.find(
      (category) => category.id === values.categoryId,
    );

    setValues({
      ...values,
      type,
      categoryId:
        type && selectedCategory?.type === type ? values.categoryId : "",
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    setWasSaved(false);

    let input: UpdateTransactionCandidateInput;

    try {
      input = candidateInputFromForm(values, activeAccounts);
    } catch (cause) {
      setLocalError(
        cause instanceof Error ? cause.message : "Review the candidate values.",
      );
      return;
    }

    setIsSaving(true);
    const updatedCandidate = await onSave(candidate.id, input);
    setIsSaving(false);

    if (updatedCandidate) {
      onSaved(updatedCandidate);
      setWasSaved(true);
    }
  }

  return (
    <form
      aria-busy={isSaving}
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => void submit(event)}
    >
      <div className="flex-1 space-y-5 overflow-y-auto p-6">
        {warnings.length > 0 ? (
          <div className="rounded-xl border border-finhand-warning/20 bg-finhand-warning-soft px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-finhand-warning">
              Extraction notes
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-5 text-finhand-neutral">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <label className={labelClassName}>
            Type
            <Select
              ariaLabel="Candidate type"
              className="mt-1.5"
              onValueChange={(type) =>
                changeType(type as TransactionType | "")
              }
              options={typeOptions}
              placeholder="Not identified"
              value={values.type}
              variant="soft"
            />
          </label>

          <label className={labelClassName}>
            Account
            <Select
              ariaLabel="Candidate account"
              className="mt-1.5"
              onValueChange={(accountId) => {
                const account = activeAccounts.find(
                  (item) => item.id === accountId,
                );
                setValues({
                  ...values,
                  accountId,
                  currencyCode: account?.currencyCode ?? values.currencyCode,
                });
              }}
              options={[
                { label: "Not selected", value: "" },
                ...accountOptions(activeAccounts),
              ]}
              placeholder="Select an account"
              value={values.accountId}
              variant="soft"
            />
          </label>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-4">
          <label className={labelClassName}>
            Amount
            <input
              className={controlClassName}
              inputMode="decimal"
              onChange={(event) =>
                setValues({ ...values, amount: event.target.value })
              }
              placeholder="0.00"
              value={values.amount}
            />
          </label>

          <label className={labelClassName}>
            Currency
            <input
              className={`${controlClassName} uppercase`}
              disabled={Boolean(selectedAccount)}
              maxLength={3}
              onChange={(event) =>
                setValues({
                  ...values,
                  currencyCode: event.target.value.toUpperCase(),
                })
              }
              placeholder="BRL"
              value={selectedAccount?.currencyCode ?? values.currencyCode}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className={labelClassName}>
            Category
            <Select
              ariaLabel="Candidate category"
              className="mt-1.5"
              onValueChange={(categoryId) =>
                setValues({ ...values, categoryId })
              }
              options={categoryOptionsWithUncategorized(matchingCategories)}
              placeholder="Uncategorized"
              value={values.categoryId}
              variant="soft"
            />
          </label>

          <label className={labelClassName}>
            Date
            <input
              className={controlClassName}
              onChange={(event) =>
                setValues({ ...values, occurredOn: event.target.value })
              }
              type="date"
              value={values.occurredOn}
            />
          </label>
        </div>

        <label className={`block ${labelClassName}`}>
          Description
          <input
            className={controlClassName}
            maxLength={200}
            onChange={(event) =>
              setValues({ ...values, description: event.target.value })
            }
            placeholder="What was this transaction for?"
            value={values.description}
          />
        </label>

        <label className={`block ${labelClassName}`}>
          Payee / Counterparty
          <input
            className={controlClassName}
            maxLength={200}
            onChange={(event) =>
              setValues({ ...values, counterparty: event.target.value })
            }
            placeholder="e.g. market, landlord"
            value={values.counterparty}
          />
        </label>

        <label className={`block ${labelClassName}`}>
          Notes (Optional)
          <textarea
            className={`${controlClassName} min-h-20 resize-none py-3`}
            maxLength={2_000}
            onChange={(event) =>
              setValues({ ...values, notes: event.target.value })
            }
            rows={2}
            value={values.notes}
          />
        </label>

        <p className="rounded-xl bg-finhand-accent-soft px-4 py-3 text-xs leading-5 text-finhand-interactive">
          This is still a draft. Saving these corrections does not create a
          transaction or change your balances.
        </p>

        {wasSaved ? (
          <p
            className="rounded-lg border border-finhand-income-border bg-finhand-income-soft px-4 py-3 text-sm text-finhand-income"
            role="status"
          >
            Draft changes saved.
          </p>
        ) : null}

        {localError ?? error ? (
          <p
            className="rounded-lg border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
            role="alert"
          >
            {localError ?? error}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-3 border-t border-finhand-divider bg-finhand-canvas-muted p-5">
        <Button
          className="rounded-xl!"
          disabled={isSaving}
          onClick={onClose}
          variant="ghost"
        >
          Close
        </Button>
        <Button className="rounded-xl!" disabled={isSaving} type="submit">
          <Save aria-hidden="true" className="size-4" />
          {isSaving ? "Saving…" : "Save draft"}
        </Button>
      </div>
    </form>
  );
}
