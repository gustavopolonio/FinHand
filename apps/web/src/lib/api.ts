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

export const transactionTypes = ["income", "expense"] as const;

export type TransactionType = (typeof transactionTypes)[number];
export type TransactionOrigin = "manual" | "document" | "voice";

export interface Transaction {
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

export interface TransactionFilters {
  type?: TransactionType;
  accountId?: string;
  categoryId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface TransactionPage {
  transactions: Transaction[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface DocumentUpload {
  id: string;
  originalFileName: string;
  mimeType: string;
  byteSize: string;
  checksumSha256: string;
  status: "uploaded";
  createdAt: string;
  updatedAt: string;
}

export interface DocumentCaptureSession {
  id: string;
  status: "pending";
  expiresAt: string;
  captureUrl: string;
}

export type DocumentCaptureSessionStatus =
  | "pending"
  | "consumed"
  | "expired"
  | "cancelled";

export type DocumentProcessingStatus =
  | "pending"
  | "uploaded"
  | "processing"
  | "processed"
  | "failed";

export interface DocumentCaptureSessionProgress {
  id: string;
  status: DocumentCaptureSessionStatus;
  expiresAt: string;
  upload: {
    id: string;
    status: DocumentProcessingStatus;
  } | null;
}

export interface AvailableDocumentCaptureSession {
  status: "pending";
  expiresAt: string;
  acceptedMimeTypes: string[];
  maximumBytes: number;
}

export interface CreateTransactionInput {
  accountId: string;
  categoryId?: string | null;
  type: TransactionType;
  amountMinor: string;
  occurredOn: string;
  description: string;
  counterparty?: string | null;
  notes?: string | null;
}

export type UpdateTransactionInput = Partial<CreateTransactionInput>;

export interface FinancialSummaryFilters {
  from?: string;
  to?: string;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const isFormData =
    typeof FormData !== "undefined" && init?.body instanceof FormData;

  if (
    init?.body !== undefined &&
    init.body !== null &&
    !isFormData &&
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
      message?: string;
    } | null;
    throw new ApiError(
      response.status,
      body?.message ?? body?.error ?? "Request failed.",
    );
  }

  if (response.status === 204) {
    return undefined as T;
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

export function getTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionPage> {
  const query = new URLSearchParams();

  if (filters.type) query.set("type", filters.type);
  if (filters.accountId) query.set("accountId", filters.accountId);
  if (filters.categoryId) query.set("categoryId", filters.categoryId);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.limit !== undefined) query.set("limit", String(filters.limit));
  if (filters.offset !== undefined) {
    query.set("offset", String(filters.offset));
  }

  const queryString = query.toString();

  return request<TransactionPage>(
    `/api/transactions${queryString ? `?${queryString}` : ""}`,
  );
}

export async function createTransaction(input: CreateTransactionInput) {
  const response = await request<{ transaction: Transaction }>(
    "/api/transactions",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return response.transaction;
}

export async function updateTransaction(
  transactionId: string,
  input: UpdateTransactionInput,
) {
  const response = await request<{ transaction: Transaction }>(
    `/api/transactions/${transactionId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return response.transaction;
}

export function deleteTransaction(transactionId: string): Promise<void> {
  return request<void>(`/api/transactions/${transactionId}`, {
    method: "DELETE",
  });
}

export async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append("document", file);
  const response = await request<{ upload: DocumentUpload }>(
    "/api/uploads/documents",
    {
      method: "POST",
      body: formData,
    },
  );

  return response.upload;
}

export async function createDocumentCaptureSession() {
  const response = await request<{ session: DocumentCaptureSession }>(
    "/api/document-capture-sessions",
    { method: "POST" },
  );

  return response.session;
}

export async function cancelDocumentCaptureSession(sessionId: string) {
  const response = await request<{
    session: {
      id: string;
      status: "cancelled";
      expiresAt: string;
    };
  }>(`/api/document-capture-sessions/${sessionId}/cancel`, {
    method: "POST",
  });

  return response.session;
}

export async function getDocumentCaptureSessionProgress(sessionId: string) {
  const response = await request<{
    session: DocumentCaptureSessionProgress;
  }>(`/api/document-capture-sessions/${sessionId}`);

  return response.session;
}

export async function getDocumentCaptureSession(token: string) {
  const response = await request<{
    session: AvailableDocumentCaptureSession;
  }>("/api/document-capture-session", {
    headers: { Authorization: `Bearer ${token}` },
  });

  return response.session;
}

export async function uploadCaptureDocument(token: string, file: File) {
  const formData = new FormData();
  formData.append("document", file);
  const response = await request<{ upload: DocumentUpload }>(
    "/api/document-capture-session/document",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    },
  );

  return response.upload;
}

export function getFinancialSummary(
  filters: FinancialSummaryFilters = {},
): Promise<FinancialSummary> {
  const query = new URLSearchParams();

  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);

  const queryString = query.toString();

  return request<FinancialSummary>(
    `/api/financial-summary${queryString ? `?${queryString}` : ""}`,
  );
}
