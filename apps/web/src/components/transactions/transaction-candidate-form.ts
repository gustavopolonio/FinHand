import type {
  Account,
  ConfirmTransactionCandidateInput,
  TransactionCandidate,
  TransactionType,
  UpdateTransactionCandidateInput,
} from "@/lib/api";
import { majorToMinorUnits, minorToMajorUnits } from "@/lib/money";

export interface TransactionCandidateFormValues {
  accountId: string;
  categoryId: string;
  type: TransactionType | "";
  amount: string;
  currencyCode: string;
  occurredOn: string;
  description: string;
  counterparty: string;
  notes: string;
}

export type TransactionCandidateConfirmationField =
  | "accountId"
  | "type"
  | "amount"
  | "currencyCode"
  | "occurredOn"
  | "description";

export type TransactionCandidateConfirmationErrors = Partial<
  Record<TransactionCandidateConfirmationField, string>
>;

export type TransactionCandidateConfirmationValidation =
  | {
      isValid: true;
      input: ConfirmTransactionCandidateInput;
      errors: TransactionCandidateConfirmationErrors;
    }
  | {
      isValid: false;
      input: null;
      errors: TransactionCandidateConfirmationErrors;
    };

const maximumPostgresBigInt = 9_223_372_036_854_775_807n;

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function formValuesFromCandidate(
  candidate: TransactionCandidate,
): TransactionCandidateFormValues {
  return {
    accountId: candidate.accountId ?? "",
    categoryId: candidate.categoryId ?? "",
    type: candidate.type ?? "",
    amount:
      candidate.amountMinor === null
        ? ""
        : minorToMajorUnits(candidate.amountMinor),
    currencyCode: candidate.currencyCode ?? "",
    occurredOn: candidate.occurredOn ?? "",
    description: candidate.description ?? "",
    counterparty: candidate.counterparty ?? "",
    notes: candidate.notes ?? "",
  };
}

export function candidateInputFromForm(
  values: TransactionCandidateFormValues,
  accounts: Account[],
): UpdateTransactionCandidateInput {
  const selectedAccount = accounts.find(
    (account) => account.id === values.accountId,
  );
  const normalizedAmount = values.amount.trim();
  const amountMinor = normalizedAmount
    ? majorToMinorUnits(normalizedAmount)
    : null;

  if (amountMinor !== null && BigInt(amountMinor) <= 0n) {
    throw new Error("Transaction candidate amount must be greater than zero.");
  }

  return {
    accountId: values.accountId || null,
    categoryId: values.categoryId || null,
    type: values.type || null,
    amountMinor,
    currencyCode:
      selectedAccount?.currencyCode ??
      (values.currencyCode.trim().toUpperCase() || null),
    occurredOn: values.occurredOn || null,
    description: values.description || null,
    counterparty: values.counterparty || null,
    notes: values.notes || null,
  };
}

export function validateCandidateForConfirmation(
  values: TransactionCandidateFormValues,
  accounts: Account[],
): TransactionCandidateConfirmationValidation {
  const errors: TransactionCandidateConfirmationErrors = {};
  const selectedAccount = accounts.find(
    (account) => account.id === values.accountId,
  );

  if (!selectedAccount) {
    errors.accountId = "Select an account.";
  } else if (selectedAccount.archivedAt) {
    errors.accountId = "Select an active account.";
  }

  if (!values.type) {
    errors.type = "Select income or expense.";
  }

  let amountMinor: string | null = null;
  const amount = values.amount.trim();

  if (!amount) {
    errors.amount = "Enter an amount.";
  } else {
    try {
      amountMinor = majorToMinorUnits(amount);
      const parsedAmount = BigInt(amountMinor);

      if (parsedAmount <= 0n) {
        errors.amount = "Amount must be greater than zero.";
      } else if (parsedAmount > maximumPostgresBigInt) {
        errors.amount = "Amount is too large.";
      }
    } catch {
      errors.amount = "Enter a valid amount with up to two decimal places.";
    }
  }

  const currencyCode =
    selectedAccount?.currencyCode ?? values.currencyCode.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    errors.currencyCode = "Enter a valid three-letter currency.";
  }

  if (!values.occurredOn) {
    errors.occurredOn = "Select a date.";
  } else if (!isRealIsoDate(values.occurredOn)) {
    errors.occurredOn = "Select a valid date.";
  }

  const description = values.description.trim();

  if (!description) {
    errors.description = "Enter a description.";
  }

  if (
    Object.keys(errors).length > 0 ||
    !selectedAccount ||
    !values.type ||
    amountMinor === null
  ) {
    return { isValid: false, input: null, errors };
  }

  return {
    isValid: true,
    input: {
      accountId: selectedAccount.id,
      categoryId: values.categoryId || null,
      type: values.type,
      amountMinor,
      currencyCode,
      occurredOn: values.occurredOn,
      description,
      counterparty: values.counterparty.trim() || null,
      notes: values.notes.trim() || null,
    },
    errors,
  };
}
