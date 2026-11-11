import type {
  Account,
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
