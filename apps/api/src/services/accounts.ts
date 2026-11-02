import type { Database } from "../db/index.js";

export interface AccountListItem {
  id: string;
  name: string;
  type: "cash" | "checking" | "savings" | "credit" | "investment" | "other";
  currencyCode: string;
  openingBalanceMinor: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listAccountsForUser(
  database: Database,
  userId: string,
): Promise<AccountListItem[]> {
  const userAccounts = await database.query.accounts.findMany({
    columns: {
      id: true,
      name: true,
      type: true,
      currencyCode: true,
      openingBalanceMinor: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    where: (account, { eq }) => eq(account.userId, userId),
    orderBy: (account, { asc }) => [asc(account.name), asc(account.id)],
  });

  return userAccounts.map((account) => ({
    ...account,
    openingBalanceMinor: account.openingBalanceMinor.toString(),
    archivedAt: account.archivedAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }));
}
