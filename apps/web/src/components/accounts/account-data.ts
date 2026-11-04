import type { Account, FinancialSummary } from "@/lib/api";

export interface AccountWithBalance extends Account {
  balanceMinor: string;
}

export interface AccountMetrics {
  activeBalanceMinor: string;
  activeCount: number;
  netMovementMinor: string;
  openingBalanceMinor: string;
}

export function accountsWithBalances(
  accounts: Account[],
  summary: FinancialSummary,
): AccountWithBalance[] {
  const balances = new Map(
    summary.accounts.map((account) => [
      account.accountId,
      account.balanceMinor,
    ]),
  );

  return accounts.map((account) => ({
    ...account,
    balanceMinor: balances.get(account.id) ?? account.openingBalanceMinor,
  }));
}

export function sortAccountsByBalance(accounts: AccountWithBalance[]) {
  return [...accounts].sort((left, right) => {
    const leftBalance = BigInt(left.balanceMinor);
    const rightBalance = BigInt(right.balanceMinor);

    if (leftBalance === rightBalance) {
      return left.name.localeCompare(right.name);
    }

    return leftBalance > rightBalance ? -1 : 1;
  });
}

export function calculateAccountMetrics(
  accounts: AccountWithBalance[],
  summary: FinancialSummary,
  currencyCode: string,
): AccountMetrics {
  const activeAccounts = accounts.filter(
    (account) =>
      account.currencyCode === currencyCode && account.archivedAt === null,
  );
  const openingBalance = activeAccounts.reduce(
    (total, account) => total + BigInt(account.openingBalanceMinor),
    0n,
  );
  const activeBalance = BigInt(
    summary.currencies.find(
      (currency) => currency.currencyCode === currencyCode,
    )?.activeBalanceMinor ?? "0",
  );

  return {
    activeBalanceMinor: activeBalance.toString(),
    activeCount: activeAccounts.length,
    netMovementMinor: (activeBalance - openingBalance).toString(),
    openingBalanceMinor: openingBalance.toString(),
  };
}
