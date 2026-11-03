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

export const categoryTypes = ["income", "expense"] as const;

export type CategoryType = (typeof categoryTypes)[number];

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCategoryInput {
  name: string;
  type: CategoryType;
}

export interface RenameCategoryInput {
  name: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (
    init?.body !== undefined &&
    init.body !== null &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers,
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

export async function getCategories() {
  const response = await request<{ categories: Category[] }>(
    "/api/categories",
  );

  return response.categories;
}

export async function createCategory(input: CreateCategoryInput) {
  const response = await request<{ category: Category }>("/api/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.category;
}

export async function renameCategory(
  categoryId: string,
  input: RenameCategoryInput,
) {
  const response = await request<{ category: Category }>(
    `/api/categories/${categoryId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return response.category;
}

export async function archiveCategory(categoryId: string) {
  const response = await request<{ category: Category }>(
    `/api/categories/${categoryId}/archive`,
    { method: "POST" },
  );

  return response.category;
}

export async function restoreCategory(categoryId: string) {
  const response = await request<{ category: Category }>(
    `/api/categories/${categoryId}/restore`,
    { method: "POST" },
  );

  return response.category;
}
