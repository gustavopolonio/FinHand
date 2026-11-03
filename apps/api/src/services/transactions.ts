import type { Database } from "../db/index.js";
import type {
  TransactionOrigin,
  TransactionType,
} from "../db/schema/index.js";
import type { ListTransactionsQuery } from "../validation/transaction-schemas.js";

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
