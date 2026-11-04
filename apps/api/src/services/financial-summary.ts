import { and, asc, eq, gte, lte, sql } from "drizzle-orm";

import type { Database } from "../db/index.js";
import {
  accounts,
  categories,
  transactions,
  type AccountType,
  type TransactionType,
} from "../db/schema/index.js";
import { UnauthorizedError } from "../errors/application-errors.js";
import type { FinancialSummaryQuery } from "../validation/financial-summary-schemas.js";

type SummaryDatabase = Pick<Database, "query" | "select">;

interface AccountBalanceRecord {
  id: string;
  name: string;
  type: AccountType;
  currencyCode: string;
  archivedAt: Date | null;
  balanceMinor: string;
}

interface PeriodTotalRecord {
  currencyCode: string;
  incomeMinor: string;
  expenseMinor: string;
  netFlowMinor: string;
}

interface CategoryTotalRecord {
  categoryId: string | null;
  categoryName: string | null;
  type: TransactionType;
  currencyCode: string;
  totalMinor: string;
  transactionCount: number;
}

export interface FinancialSummary {
  period: {
    from: string | null;
    to: string;
  };
  currencies: Array<{
    currencyCode: string;
    activeBalanceMinor: string;
    incomeMinor: string;
    expenseMinor: string;
    netFlowMinor: string;
  }>;
  accounts: Array<{
    accountId: string;
    name: string;
    type: AccountType;
    currencyCode: string;
    archivedAt: string | null;
    balanceMinor: string;
  }>;
  categoryTotals: Array<{
    categoryId: string | null;
    name: string;
    type: TransactionType;
    currencyCode: string;
    totalMinor: string;
    transactionCount: number;
  }>;
}

function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const partValues = new Map(parts.map((part) => [part.type, part.value]));
  const year = partValues.get("year");
  const month = partValues.get("month");
  const day = partValues.get("day");

  if (!year || !month || !day) {
    throw new Error("Unable to calculate the current date.");
  }

  return `${year}-${month}-${day}`;
}

async function getAccountBalances(
  database: SummaryDatabase,
  userId: string,
  today: string,
): Promise<AccountBalanceRecord[]> {
  const signedTransactionAmount = sql`
    case
      when ${transactions.type} = 'income' then ${transactions.amountMinor}
      else -${transactions.amountMinor}
    end
  `;

  return database
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      currencyCode: accounts.currencyCode,
      archivedAt: accounts.archivedAt,
      balanceMinor: sql<string>`(
        ${accounts.openingBalanceMinor}::numeric
        + coalesce(sum(${signedTransactionAmount}), 0)
      )::text`,
    })
    .from(accounts)
    .leftJoin(
      transactions,
      and(
        eq(transactions.userId, userId),
        eq(transactions.accountId, accounts.id),
        lte(transactions.occurredOn, today),
      ),
    )
    .where(eq(accounts.userId, userId))
    .groupBy(accounts.id)
    .orderBy(asc(accounts.name), asc(accounts.id));
}

async function getPeriodTotals(
  database: SummaryDatabase,
  userId: string,
  from: string | null,
  to: string,
): Promise<PeriodTotalRecord[]> {
  const conditions = [
    eq(transactions.userId, userId),
    lte(transactions.occurredOn, to),
  ];

  if (from !== null) {
    conditions.push(gte(transactions.occurredOn, from));
  }

  return database
    .select({
      currencyCode: transactions.currencyCode,
      incomeMinor: sql<string>`coalesce(sum(
        case when ${transactions.type} = 'income'
          then ${transactions.amountMinor} else 0 end
      ), 0)::text`,
      expenseMinor: sql<string>`coalesce(sum(
        case when ${transactions.type} = 'expense'
          then ${transactions.amountMinor} else 0 end
      ), 0)::text`,
      netFlowMinor: sql<string>`coalesce(sum(
        case when ${transactions.type} = 'income'
          then ${transactions.amountMinor}
          else -${transactions.amountMinor} end
      ), 0)::text`,
    })
    .from(transactions)
    .where(and(...conditions))
    .groupBy(transactions.currencyCode)
    .orderBy(asc(transactions.currencyCode));
}

async function getCategoryTotals(
  database: SummaryDatabase,
  userId: string,
  from: string | null,
  to: string,
): Promise<CategoryTotalRecord[]> {
  const conditions = [
    eq(transactions.userId, userId),
    lte(transactions.occurredOn, to),
  ];

  if (from !== null) {
    conditions.push(gte(transactions.occurredOn, from));
  }

  return database
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      type: transactions.type,
      currencyCode: transactions.currencyCode,
      totalMinor: sql<string>`sum(${transactions.amountMinor})::text`,
      transactionCount: sql<number>`count(*)::integer`,
    })
    .from(transactions)
    .leftJoin(
      categories,
      and(
        eq(categories.userId, transactions.userId),
        eq(categories.id, transactions.categoryId),
      ),
    )
    .where(and(...conditions))
    .groupBy(
      transactions.categoryId,
      categories.name,
      transactions.type,
      transactions.currencyCode,
    )
    .orderBy(
      asc(transactions.currencyCode),
      asc(transactions.type),
      asc(categories.name),
      asc(transactions.categoryId),
    );
}

async function calculateFinancialSummary(
  database: SummaryDatabase,
  userId: string,
  query: FinancialSummaryQuery,
  now: Date,
): Promise<FinancialSummary> {
  const owner = await database.query.users.findFirst({
    columns: { timeZone: true },
    where: (user, { eq }) => eq(user.id, userId),
  });

  if (!owner) {
    throw new UnauthorizedError();
  }

  const today = dateInTimeZone(now, owner.timeZone);
  const periodFrom = query.from ?? null;
  const periodTo = query.to ?? today;
  const [accountBalances, periodTotals, categoryTotals] = await Promise.all([
    getAccountBalances(database, userId, today),
    getPeriodTotals(database, userId, periodFrom, periodTo),
    getCategoryTotals(database, userId, periodFrom, periodTo),
  ]);
  const activeBalances = new Map<string, bigint>();

  for (const account of accountBalances) {
    if (account.archivedAt === null) {
      const currentBalance = activeBalances.get(account.currencyCode) ?? 0n;
      activeBalances.set(
        account.currencyCode,
        currentBalance + BigInt(account.balanceMinor),
      );
    }
  }

  const periodTotalsByCurrency = new Map(
    periodTotals.map((total) => [total.currencyCode, total]),
  );
  const currencyCodes = new Set([
    ...activeBalances.keys(),
    ...periodTotalsByCurrency.keys(),
  ]);

  return {
    period: {
      from: periodFrom,
      to: periodTo,
    },
    currencies: [...currencyCodes]
      .sort((left, right) => left.localeCompare(right))
      .map((currencyCode) => {
        const periodTotal = periodTotalsByCurrency.get(currencyCode);

        return {
          currencyCode,
          activeBalanceMinor: (
            activeBalances.get(currencyCode) ?? 0n
          ).toString(),
          incomeMinor: periodTotal?.incomeMinor ?? "0",
          expenseMinor: periodTotal?.expenseMinor ?? "0",
          netFlowMinor: periodTotal?.netFlowMinor ?? "0",
        };
      }),
    accounts: accountBalances.map((account) => ({
      accountId: account.id,
      name: account.name,
      type: account.type,
      currencyCode: account.currencyCode,
      archivedAt: account.archivedAt?.toISOString() ?? null,
      balanceMinor: account.balanceMinor,
    })),
    categoryTotals: categoryTotals.map((total) => ({
      categoryId: total.categoryId,
      name: total.categoryName ?? "Uncategorized",
      type: total.type,
      currencyCode: total.currencyCode,
      totalMinor: total.totalMinor,
      transactionCount: total.transactionCount,
    })),
  };
}

export async function getFinancialSummaryForUser(
  database: Database,
  userId: string,
  query: FinancialSummaryQuery,
  now = new Date(),
): Promise<FinancialSummary> {
  return database.transaction(
    (transaction) =>
      calculateFinancialSummary(transaction, userId, query, now),
    {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    },
  );
}
