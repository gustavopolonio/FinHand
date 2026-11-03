import type { Database } from "../db/index.js";
import {
  transactions,
  type TransactionOrigin,
  type TransactionType,
} from "../db/schema/index.js";
import {
  ConflictError,
  InputError,
  NotFoundError,
} from "../errors/application-errors.js";
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
} from "../validation/transaction-schemas.js";

const maximumPostgresBigInt = 9_223_372_036_854_775_807n;
const maximumDescriptionLength = 200;
const maximumCounterpartyLength = 200;
const maximumNotesLength = 2_000;

interface TransactionRecord {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  amountMinor: bigint;
  currencyCode: string;
  occurredOn: string;
  description: string;
  counterparty: string | null;
  notes: string | null;
  origin: TransactionOrigin;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionListItem {
  id: string;
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  amountMinor: string;
  currencyCode: string;
  occurredOn: string;
  description: string;
  counterparty: string | null;
  notes: string | null;
  origin: TransactionOrigin;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionPage {
  transactions: TransactionListItem[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

function serializeTransaction(
  transaction: TransactionRecord,
): TransactionListItem {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    categoryId: transaction.categoryId,
    type: transaction.type,
    amountMinor: transaction.amountMinor.toString(),
    currencyCode: transaction.currencyCode,
    occurredOn: transaction.occurredOn,
    description: transaction.description,
    counterparty: transaction.counterparty,
    notes: transaction.notes,
    origin: transaction.origin,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}

function parseAmountMinor(value: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new InputError(
      "Transaction amount must be a positive integer string in minor units.",
    );
  }

  const amountMinor = BigInt(value);

  if (amountMinor <= 0n) {
    throw new InputError("Transaction amount must be greater than zero.");
  }

  if (amountMinor > maximumPostgresBigInt) {
    throw new InputError(
      "Transaction amount is outside PostgreSQL BIGINT range.",
    );
  }

  return amountMinor;
}

function normalizeRequiredText(
  value: string,
  fieldName: string,
  maximumLength: number,
): string {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    throw new InputError(`${fieldName} is required.`);
  }

  if (normalizedValue.length > maximumLength) {
    throw new InputError(
      `${fieldName} must contain at most ${maximumLength} characters.`,
    );
  }

  return normalizedValue;
}

function normalizeOptionalText(
  value: string | null | undefined,
  fieldName: string,
  maximumLength: number,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.length > maximumLength) {
    throw new InputError(
      `${fieldName} must contain at most ${maximumLength} characters.`,
    );
  }

  return normalizedValue;
}

export async function listTransactionsForUser(
  database: Database,
  userId: string,
  query: ListTransactionsQuery,
): Promise<TransactionPage> {
  const records = await database.query.transactions.findMany({
    columns: {
      id: true,
      accountId: true,
      categoryId: true,
      type: true,
      amountMinor: true,
      currencyCode: true,
      occurredOn: true,
      description: true,
      counterparty: true,
      notes: true,
      origin: true,
      createdAt: true,
      updatedAt: true,
    },
    where: (transaction, { and, eq, gte, lte }) => {
      const conditions = [eq(transaction.userId, userId)];

      if (query.type !== undefined) {
        conditions.push(eq(transaction.type, query.type));
      }

      if (query.accountId !== undefined) {
        conditions.push(eq(transaction.accountId, query.accountId));
      }

      if (query.categoryId !== undefined) {
        conditions.push(eq(transaction.categoryId, query.categoryId));
      }

      if (query.from !== undefined) {
        conditions.push(gte(transaction.occurredOn, query.from));
      }

      if (query.to !== undefined) {
        conditions.push(lte(transaction.occurredOn, query.to));
      }

      return and(...conditions);
    },
    orderBy: (transaction, { desc }) => [
      desc(transaction.occurredOn),
      desc(transaction.createdAt),
      desc(transaction.id),
    ],
    limit: query.limit + 1,
    offset: query.offset,
  });
  const hasMore = records.length > query.limit;

  return {
    transactions: records.slice(0, query.limit).map(serializeTransaction),
    pagination: {
      limit: query.limit,
      offset: query.offset,
      hasMore,
    },
  };
}

export async function createTransactionForUser(
  database: Database,
  userId: string,
  input: CreateTransactionInput,
): Promise<TransactionListItem> {
  const amountMinor = parseAmountMinor(input.amountMinor);
  const description = normalizeRequiredText(
    input.description,
    "Transaction description",
    maximumDescriptionLength,
  );
  const counterparty = normalizeOptionalText(
    input.counterparty,
    "Transaction counterparty",
    maximumCounterpartyLength,
  );
  const notes = normalizeOptionalText(
    input.notes,
    "Transaction notes",
    maximumNotesLength,
  );
  const account = await database.query.accounts.findFirst({
    columns: {
      id: true,
      currencyCode: true,
      archivedAt: true,
    },
    where: (candidateAccount, { and, eq }) =>
      and(
        eq(candidateAccount.id, input.accountId),
        eq(candidateAccount.userId, userId),
      ),
  });

  if (!account) {
    throw new NotFoundError("Account not found");
  }

  if (account.archivedAt) {
    throw new ConflictError(
      "Archived accounts cannot receive new transactions.",
    );
  }

  const categoryId = input.categoryId ?? null;

  if (categoryId !== null) {
    const category = await database.query.categories.findFirst({
      columns: {
        id: true,
        type: true,
        archivedAt: true,
      },
      where: (candidateCategory, { and, eq }) =>
        and(
          eq(candidateCategory.id, categoryId),
          eq(candidateCategory.userId, userId),
        ),
    });

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    if (category.archivedAt) {
      throw new ConflictError(
        "Archived categories cannot receive new transactions.",
      );
    }

    if (category.type !== input.type) {
      throw new InputError(
        "Transaction type must match the selected category type.",
      );
    }
  }

  const [createdTransaction] = await database
    .insert(transactions)
    .values({
      userId,
      accountId: account.id,
      categoryId,
      type: input.type,
      amountMinor,
      currencyCode: account.currencyCode,
      occurredOn: input.occurredOn,
      description,
      counterparty,
      notes,
      origin: "manual",
    })
    .returning({
      id: transactions.id,
      accountId: transactions.accountId,
      categoryId: transactions.categoryId,
      type: transactions.type,
      amountMinor: transactions.amountMinor,
      currencyCode: transactions.currencyCode,
      occurredOn: transactions.occurredOn,
      description: transactions.description,
      counterparty: transactions.counterparty,
      notes: transactions.notes,
      origin: transactions.origin,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
    });

  if (!createdTransaction) {
    throw new Error("Transaction creation did not return a record.");
  }

  return serializeTransaction(createdTransaction);
}
