"use client";

import { Save, Trash2 } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import {
  accountOptions,
  categoryOptionsWithUncategorized,
} from "@/components/financial-select-options";
import type {
  Account,
  Category,
  ConfirmTransactionCandidateInput,
  ConfirmTransactionCandidateResult,
  RejectTransactionCandidateResult,
  TransactionCandidate,
  TransactionType,
  UpdateTransactionCandidateInput,
} from "@/lib/api";

import { Button } from "../ui/button";
import { Select, type SelectOption } from "../ui/select";
import { HoldToConfirmButton } from "./hold-to-confirm-button";
import { TransactionCandidateRejectModal } from "./transaction-candidate-reject-modal";
import {
  candidateInputFromForm,
  formValuesFromCandidate,
  type TransactionCandidateConfirmationErrors,
  type TransactionCandidateConfirmationField,
  validateCandidateForConfirmation,
} from "./transaction-candidate-form";

interface TransactionCandidateEditorProps {
  accounts: Account[];
  candidate: TransactionCandidate;
  categories: Category[];
  error: string | null;
  onConfirm: (
    candidateId: string,
    input: ConfirmTransactionCandidateInput,
  ) => Promise<ConfirmTransactionCandidateResult | null>;
  onConfirmed: (result: ConfirmTransactionCandidateResult) => void;
  onClose: () => void;
  onReject: (
    candidateId: string,
  ) => Promise<RejectTransactionCandidateResult | null>;
  onRejected: (result: RejectTransactionCandidateResult) => void;
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
  onConfirm,
  onConfirmed,
  onClose,
  onReject,
  onRejected,
  onSave,
  onSaved,
}: TransactionCandidateEditorProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const confirmationInputRef =
    useRef<ConfirmTransactionCandidateInput | null>(null);
  const [values, setValues] = useState(() =>
    formValuesFromCandidate(candidate),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [wasSaved, setWasSaved] = useState(false);
  const [fieldErrors, setFieldErrors] =
    useState<TransactionCandidateConfirmationErrors>({});
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

  function clearFieldError(field: TransactionCandidateConfirmationField) {
    setFieldErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  }

  function fieldError(field: TransactionCandidateConfirmationField) {
    const message = fieldErrors[field];
    if (!message) return null;

    return (
      <span
        className="mt-1.5 block text-xs font-medium text-finhand-expense"
        id={`candidate-${candidate.id}-${field}-error`}
      >
        {message}
      </span>
    );
  }

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
    clearFieldError("type");
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

  function prepareConfirmation(): boolean {
    setLocalError(null);
    setWasSaved(false);
    const validation = validateCandidateForConfirmation(
      values,
      activeAccounts,
    );
    setFieldErrors(validation.errors);

    if (!validation.isValid) {
      confirmationInputRef.current = null;
      const fieldOrder: TransactionCandidateConfirmationField[] = [
        "type",
        "accountId",
        "amount",
        "currencyCode",
        "occurredOn",
        "description",
      ];
      const firstInvalidField = fieldOrder.find(
        (field) => validation.errors[field],
      );

      if (firstInvalidField) {
        setTimeout(() => {
          const field = formRef.current?.querySelector<HTMLElement>(
            `[data-candidate-field="${firstInvalidField}"]`,
          );
          field
            ?.querySelector<HTMLElement>("button, input, textarea")
            ?.focus();
        }, 0);
      }

      return false;
    }

    confirmationInputRef.current = validation.input;
    return true;
  }

  async function confirmCandidate() {
    const input = confirmationInputRef.current;
    if (!input) return;

    setIsConfirming(true);
    const result = await onConfirm(candidate.id, input);
    setIsConfirming(false);
    confirmationInputRef.current = null;

    if (result) onConfirmed(result);
  }

  async function rejectCandidate() {
    setIsRejecting(true);
    const result = await onReject(candidate.id);
    setIsRejecting(false);

    if (result) {
      setIsRejectModalOpen(false);
      onRejected(result);
    }
  }

  const isBusy = isSaving || isConfirming || isRejecting;

  return (
    <>
      <form
        aria-busy={isBusy}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        onSubmit={(event) => void submit(event)}
        ref={formRef}
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
          <label className={labelClassName} data-candidate-field="type">
            Type
            <Select
              ariaDescribedBy={
                fieldErrors.type
                  ? `candidate-${candidate.id}-type-error`
                  : undefined
              }
              ariaInvalid={Boolean(fieldErrors.type)}
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
            {fieldError("type")}
          </label>

          <label className={labelClassName} data-candidate-field="accountId">
            Account
            <Select
              ariaDescribedBy={
                fieldErrors.accountId
                  ? `candidate-${candidate.id}-accountId-error`
                  : undefined
              }
              ariaInvalid={Boolean(fieldErrors.accountId)}
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
                clearFieldError("accountId");
                clearFieldError("currencyCode");
              }}
              options={[
                { label: "Not selected", value: "" },
                ...accountOptions(activeAccounts),
              ]}
              placeholder="Select an account"
              value={values.accountId}
              variant="soft"
            />
            {fieldError("accountId")}
          </label>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-4">
          <label className={labelClassName} data-candidate-field="amount">
            Amount
            <input
              aria-describedby={
                fieldErrors.amount
                  ? `candidate-${candidate.id}-amount-error`
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.amount)}
              className={`${controlClassName} ${fieldErrors.amount ? "border-finhand-expense" : ""}`}
              inputMode="decimal"
              onChange={(event) => {
                setValues({ ...values, amount: event.target.value });
                clearFieldError("amount");
              }}
              placeholder="0.00"
              value={values.amount}
            />
            {fieldError("amount")}
          </label>

          <label className={labelClassName} data-candidate-field="currencyCode">
            Currency
            <input
              aria-describedby={
                fieldErrors.currencyCode
                  ? `candidate-${candidate.id}-currencyCode-error`
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.currencyCode)}
              className={`${controlClassName} uppercase ${fieldErrors.currencyCode ? "border-finhand-expense" : ""}`}
              disabled={Boolean(selectedAccount)}
              maxLength={3}
              onChange={(event) => {
                setValues({
                  ...values,
                  currencyCode: event.target.value.toUpperCase(),
                });
                clearFieldError("currencyCode");
              }}
              placeholder="BRL"
              value={selectedAccount?.currencyCode ?? values.currencyCode}
            />
            {fieldError("currencyCode")}
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

          <label className={labelClassName} data-candidate-field="occurredOn">
            Date
            <input
              aria-describedby={
                fieldErrors.occurredOn
                  ? `candidate-${candidate.id}-occurredOn-error`
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.occurredOn)}
              className={`${controlClassName} ${fieldErrors.occurredOn ? "border-finhand-expense" : ""}`}
              onChange={(event) => {
                setValues({ ...values, occurredOn: event.target.value });
                clearFieldError("occurredOn");
              }}
              type="date"
              value={values.occurredOn}
            />
            {fieldError("occurredOn")}
          </label>
        </div>

        <label
          className={`block ${labelClassName}`}
          data-candidate-field="description"
        >
          Description
          <input
            aria-describedby={
              fieldErrors.description
                ? `candidate-${candidate.id}-description-error`
                : undefined
            }
            aria-invalid={Boolean(fieldErrors.description)}
            className={`${controlClassName} ${fieldErrors.description ? "border-finhand-expense" : ""}`}
            maxLength={200}
            onChange={(event) => {
              setValues({ ...values, description: event.target.value });
              clearFieldError("description");
            }}
            placeholder="What was this transaction for?"
            value={values.description}
          />
          {fieldError("description")}
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
          className="mr-auto rounded-xl!"
          disabled={isBusy}
          onClick={() => setIsRejectModalOpen(true)}
          variant="danger"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Discard candidate
        </Button>
        <Button
          className="rounded-xl!"
          disabled={isBusy}
          onClick={onClose}
          variant="ghost"
        >
          Close
        </Button>
        <Button className="rounded-xl!" disabled={isBusy} type="submit">
          <Save aria-hidden="true" className="size-4" />
          {isSaving ? "Saving…" : "Save draft"}
        </Button>
        <HoldToConfirmButton
          disabled={isSaving}
          isConfirming={isConfirming}
          onBeforeStart={prepareConfirmation}
          onConfirm={confirmCandidate}
        />
      </div>
      </form>

      {isRejectModalOpen ? (
        <TransactionCandidateRejectModal
          candidate={candidate}
          error={error}
          isRejecting={isRejecting}
          onCancel={() => setIsRejectModalOpen(false)}
          onConfirm={() => void rejectCandidate()}
        />
      ) : null}
    </>
  );
}
