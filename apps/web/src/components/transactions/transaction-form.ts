import type {
  Account,
  Category,
  CreateTransactionInput,
  Transaction,
  TransactionType,
} from "@/lib/api";
import { majorToMinorUnits, minorToMajorUnits } from "@/lib/money";

export const transactionTypeLabels: Record<TransactionType, string> = {
  income: "Income",
  expense: "Expense",
};

export interface TransactionFormValues {
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: string;
  occurredOn: string;
  description: string;
  counterparty: string;
  notes: string;
}

function localToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function emptyTransactionForm(): TransactionFormValues {
  return {
    accountId: "",
    categoryId: "",
    type: "expense",
    amount: "0.00",
    occurredOn: localToday(),
    description: "",
    counterparty: "",
    notes: "",
  };
}

export function formValuesFromTransaction(
  transaction: Transaction,
): TransactionFormValues {
  return {
    accountId: transaction.accountId,
    categoryId: transaction.categoryId ?? "",
    type: transaction.type,
    amount: minorToMajorUnits(transaction.amountMinor),
    occurredOn: transaction.occurredOn,
    description: transaction.description,
    counterparty: transaction.counterparty ?? "",
    notes: transaction.notes ?? "",
  };
}

export function resolveCreateFormValues(
  values: TransactionFormValues,
  accounts: Account[],
  categories: Category[],
): TransactionFormValues {
  const accountId = accounts.some(
    (account) => account.id === values.accountId,
  )
    ? values.accountId
    : (accounts[0]?.id ?? "");
  const categoryId = categories.some(
    (category) =>
      category.id === values.categoryId && category.type === values.type,
  )
    ? values.categoryId
    : "";

  return { ...values, accountId, categoryId };
}

export function transactionInputFromForm(
  values: TransactionFormValues,
): CreateTransactionInput {
  const amountMinor = majorToMinorUnits(values.amount);

  if (BigInt(amountMinor) <= 0n) {
    throw new Error("Transaction amount must be greater than zero.");
  }

  return {
    accountId: values.accountId,
    categoryId: values.categoryId || null,
    type: values.type,
    amountMinor,
    occurredOn: values.occurredOn,
    description: values.description,
    counterparty: values.counterparty || null,
    notes: values.notes || null,
  };
}
