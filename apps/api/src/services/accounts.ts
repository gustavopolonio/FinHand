import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../db/index.js";
import {
  accounts,
  accountTypes,
  type AccountType,
} from "../db/schema/index.js";

const maximumAccountNameLength = 100;
const minimumPostgresBigInt = -9_223_372_036_854_775_808n;
const maximumPostgresBigInt = 9_223_372_036_854_775_807n;
const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));

interface AccountRecord {
  id: string;
  name: string;
  type: AccountType;
  currencyCode: string;
  openingBalanceMinor: bigint;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAccountInput {
  name: string;
  type: string;
  currencyCode?: string;
  openingBalanceMinor?: string;
}

export interface UpdateAccountInput {
  name?: string;
  type?: string;
  openingBalanceMinor?: string;
}

export class AccountInputError extends Error {}

export class AccountOwnerNotFoundError extends Error {}

export class AccountNotFoundError extends Error {}

export interface AccountListItem {
  id: string;
  name: string;
  type: AccountType;
  currencyCode: string;
  openingBalanceMinor: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function serializeAccount(account: AccountRecord): AccountListItem {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    currencyCode: account.currencyCode,
    openingBalanceMinor: account.openingBalanceMinor.toString(),
    archivedAt: account.archivedAt?.toISOString() ?? null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function normalizeAccountName(name: string): string {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new AccountInputError("Account name is required.");
  }

  if (normalizedName.length > maximumAccountNameLength) {
    throw new AccountInputError(
      `Account name must contain at most ${maximumAccountNameLength} characters.`,
    );
  }

  return normalizedName;
}

function normalizeAccountType(type: string): AccountType {
  if (!accountTypes.includes(type as AccountType)) {
    throw new AccountInputError("Account type is invalid.");
  }

  return type as AccountType;
}

function normalizeCurrencyCode(currencyCode: string): string {
  const normalizedCurrencyCode = currencyCode.trim().toUpperCase();

  if (!supportedCurrencies.has(normalizedCurrencyCode)) {
    throw new AccountInputError(
      "Currency code must be a supported three-letter ISO 4217 code.",
    );
  }

  return normalizedCurrencyCode;
}

function parseOpeningBalanceMinor(value: string | undefined): bigint {
  const normalizedValue = value?.trim() || "0";

  if (!/^-?\d+$/.test(normalizedValue)) {
    throw new AccountInputError(
      "Opening balance must be a signed integer string in minor units.",
    );
  }

  const openingBalanceMinor = BigInt(normalizedValue);

  if (
    openingBalanceMinor < minimumPostgresBigInt ||
    openingBalanceMinor > maximumPostgresBigInt
  ) {
    throw new AccountInputError(
      "Opening balance is outside PostgreSQL BIGINT range.",
    );
  }

  return openingBalanceMinor;
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

  return userAccounts.map(serializeAccount);
}

export async function createAccountForUser(
  database: Database,
  userId: string,
  input: CreateAccountInput,
): Promise<AccountListItem> {
  const name = normalizeAccountName(input.name);
  const type = normalizeAccountType(input.type);
  const openingBalanceMinor = parseOpeningBalanceMinor(
    input.openingBalanceMinor,
  );
  const requestedCurrencyCode = input.currencyCode
    ? normalizeCurrencyCode(input.currencyCode)
    : null;
  const owner = await database.query.users.findFirst({
    columns: { defaultCurrency: true },
    where: (user, { eq }) => eq(user.id, userId),
  });

  if (!owner) {
    throw new AccountOwnerNotFoundError("Authenticated user no longer exists.");
  }

  const currencyCode =
    requestedCurrencyCode ?? normalizeCurrencyCode(owner.defaultCurrency);
  const [createdAccount] = await database
    .insert(accounts)
    .values({
      userId,
      name,
      type,
      currencyCode,
      openingBalanceMinor,
    })
    .returning({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      currencyCode: accounts.currencyCode,
      openingBalanceMinor: accounts.openingBalanceMinor,
      archivedAt: accounts.archivedAt,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
    });

  if (!createdAccount) {
    throw new Error("Account creation did not return a record.");
  }

  return serializeAccount(createdAccount);
}

export async function updateAccountForUser(
  database: Database,
  userId: string,
  accountId: string,
  input: UpdateAccountInput,
): Promise<AccountListItem> {
  const updates: {
    name?: string;
    type?: AccountType;
    openingBalanceMinor?: bigint;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (input.name !== undefined) {
    updates.name = normalizeAccountName(input.name);
  }

  if (input.type !== undefined) {
    updates.type = normalizeAccountType(input.type);
  }

  if (input.openingBalanceMinor !== undefined) {
    updates.openingBalanceMinor = parseOpeningBalanceMinor(
      input.openingBalanceMinor,
    );
  }

  if (
    updates.name === undefined &&
    updates.type === undefined &&
    updates.openingBalanceMinor === undefined
  ) {
    throw new AccountInputError("At least one account field is required.");
  }

  const [updatedAccount] = await database
    .update(accounts)
    .set(updates)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)))
    .returning({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      currencyCode: accounts.currencyCode,
      openingBalanceMinor: accounts.openingBalanceMinor,
      archivedAt: accounts.archivedAt,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
    });

  if (!updatedAccount) {
    throw new AccountNotFoundError("Account not found.");
  }

  return serializeAccount(updatedAccount);
}

export async function archiveAccountForUser(
  database: Database,
  userId: string,
  accountId: string,
): Promise<AccountListItem> {
  const archivedAt = new Date();
  const [archivedAccount] = await database
    .update(accounts)
    .set({ archivedAt, updatedAt: archivedAt })
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.userId, userId),
        isNull(accounts.archivedAt),
      ),
    )
    .returning({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      currencyCode: accounts.currencyCode,
      openingBalanceMinor: accounts.openingBalanceMinor,
      archivedAt: accounts.archivedAt,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
    });

  if (archivedAccount) {
    return serializeAccount(archivedAccount);
  }

  const existingAccount = await database.query.accounts.findFirst({
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
    where: (account, { and, eq }) =>
      and(eq(account.id, accountId), eq(account.userId, userId)),
  });

  if (!existingAccount) {
    throw new AccountNotFoundError("Account not found.");
  }

  return serializeAccount(existingAccount);
}
