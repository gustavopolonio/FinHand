import { apiUrl } from "./config";

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string | null;
  imageUrl: string | null;
  defaultCurrency: string;
  timeZone: string;
}

export const accountTypes = [
  "cash",
  "checking",
  "savings",
  "credit",
  "investment",
  "other",
] as const;

export type AccountType = (typeof accountTypes)[number];

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currencyCode: string;
  openingBalanceMinor: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  openingBalanceMinor: string;
}

export interface UpdateAccountInput {
  name: string;
  type: AccountType;
  openingBalanceMinor: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(response.status, body?.error ?? "Request failed.");
  }

  return (await response.json()) as T;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getCurrentUser() {
  return request<CurrentUser>("/api/me");
}

export async function getAccounts() {
  const response = await request<{ accounts: Account[] }>("/api/accounts");

  return response.accounts;
}

export async function createAccount(input: CreateAccountInput) {
  const response = await request<{ account: Account }>("/api/accounts", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.account;
}

export async function updateAccount(
  accountId: string,
  input: UpdateAccountInput,
) {
  const response = await request<{ account: Account }>(
    `/api/accounts/${accountId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return response.account;
}

export async function archiveAccount(accountId: string) {
  const response = await request<{ account: Account }>(
    `/api/accounts/${accountId}/archive`,
    { method: "POST" },
  );

  return response.account;
}

export async function restoreAccount(accountId: string) {
  const response = await request<{ account: Account }>(
    `/api/accounts/${accountId}/restore`,
    { method: "POST" },
  );

  return response.account;
}
