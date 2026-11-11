import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type Account,
  type Category,
  type DocumentUpload,
  type DocumentReview,
  type TransactionCandidate,
  cancelDocumentCaptureSession,
  createDocumentCaptureSession,
  type Transaction,
  archiveAccount,
  archiveCategory,
  createAccount,
  createCategory,
  createTransaction,
  deleteTransaction,
  getAccounts,
  getCategories,
  getDocumentCaptureSession,
  getDocumentCaptureSessionProgress,
  getDocumentReviews,
  getFinancialSummary,
  getTransactionCandidateReview,
  getTransactions,
  renameCategory,
  restoreAccount,
  restoreCategory,
  updateAccount,
  updateTransaction,
  updateTransactionCandidate,
  uploadDocument,
  uploadCaptureDocument,
} from "./api";

const account: Account = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Checking",
  type: "checking",
  currencyCode: "BRL",
  openingBalanceMinor: "12345",
  archivedAt: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-02T12:00:00.000Z",
};

const category: Category = {
  id: "55555555-5555-4555-8555-555555555555",
  name: "Grocery",
  type: "expense",
  archivedAt: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-02T12:00:00.000Z",
};

const transaction: Transaction = {
  id: "66666666-6666-4666-8666-666666666666",
  accountId: account.id,
  categoryId: category.id,
  type: "expense",
  amountMinor: "2590",
  currencyCode: "BRL",
  occurredOn: "2026-11-03",
  description: "Weekly groceries",
  counterparty: "Supermarket",
  notes: null,
  origin: "manual",
  createdAt: "2026-11-03T15:00:00.000Z",
  updatedAt: "2026-11-03T15:00:00.000Z",
};

function successfulResponse(body: unknown) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("accounts API", () => {
  it("lists accounts with credentials", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ accounts: [account] }));
    vi.stubGlobal("fetch", fetch);

    await expect(getAccounts()).resolves.toEqual([account]);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/accounts",
      expect.objectContaining({
        credentials: "include",
      }),
    );
  });

  it("creates an account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ account }));
    vi.stubGlobal("fetch", fetch);
    const input = {
      name: "Checking",
      type: "checking" as const,
      openingBalanceMinor: "12345",
    };

    await expect(createAccount(input)).resolves.toEqual(account);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/accounts",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("updates an account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ account }));
    vi.stubGlobal("fetch", fetch);
    const input = {
      name: "Main checking",
      type: "checking" as const,
      openingBalanceMinor: "20000",
    };

    await expect(updateAccount(account.id, input)).resolves.toEqual(account);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/accounts/${account.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  });

  it("archives an account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ account }));
    vi.stubGlobal("fetch", fetch);

    await expect(archiveAccount(account.id)).resolves.toEqual(account);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/accounts/${account.id}/archive`,
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).has("Content-Type")).toBe(false);
  });

  it("restores an account", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ account }));
    vi.stubGlobal("fetch", fetch);

    await expect(restoreAccount(account.id)).resolves.toEqual(account);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/accounts/${account.id}/restore`,
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).has("Content-Type")).toBe(false);
  });
});

describe("categories API", () => {
  it("lists categories with credentials", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ categories: [category] }));
    vi.stubGlobal("fetch", fetch);

    await expect(getCategories()).resolves.toEqual([category]);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/categories",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("creates a category", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ category }));
    vi.stubGlobal("fetch", fetch);
    const input = { name: "Grocery", type: "expense" as const };

    await expect(createCategory(input)).resolves.toEqual(category);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/categories",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  });

  it("renames a category", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ category }));
    vi.stubGlobal("fetch", fetch);
    const input = { name: "Food" };

    await expect(renameCategory(category.id, input)).resolves.toEqual(category);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/categories/${category.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  });

  it("archives a category without declaring an empty JSON body", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ category }));
    vi.stubGlobal("fetch", fetch);

    await expect(archiveCategory(category.id)).resolves.toEqual(category);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/categories/${category.id}/archive`,
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).has("Content-Type")).toBe(false);
  });

  it("restores a category without declaring an empty JSON body", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ category }));
    vi.stubGlobal("fetch", fetch);

    await expect(restoreCategory(category.id)).resolves.toEqual(category);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/categories/${category.id}/restore`,
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).has("Content-Type")).toBe(false);
  });
});

describe("transactions API", () => {
  it("lists a filtered transaction page", async () => {
    const page = {
      transactions: [transaction],
      pagination: { limit: 10, offset: 20, hasMore: true },
    };
    const fetch = vi.fn().mockResolvedValue(successfulResponse(page));
    vi.stubGlobal("fetch", fetch);

    await expect(
      getTransactions({
        type: "expense",
        accountId: account.id,
        categoryId: category.id,
        from: "2026-11-01",
        to: "2026-11-30",
        limit: 10,
        offset: 20,
      }),
    ).resolves.toEqual(page);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/transactions" +
        `?type=expense&accountId=${account.id}&categoryId=${category.id}` +
        "&from=2026-11-01&to=2026-11-30&limit=10&offset=20",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("creates a transaction", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ transaction }));
    vi.stubGlobal("fetch", fetch);
    const input = {
      accountId: account.id,
      categoryId: category.id,
      type: "expense" as const,
      amountMinor: "2590",
      occurredOn: "2026-11-03",
      description: "Weekly groceries",
      counterparty: "Supermarket",
      notes: null,
    };

    await expect(createTransaction(input)).resolves.toEqual(transaction);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/transactions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  });

  it("updates a transaction", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ transaction }));
    vi.stubGlobal("fetch", fetch);
    const input = { description: "Updated groceries", categoryId: null };

    await expect(updateTransaction(transaction.id, input)).resolves.toEqual(
      transaction,
    );
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/transactions/${transaction.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  });

  it("deletes a transaction without parsing a 204 response body", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetch);

    await expect(deleteTransaction(transaction.id)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/transactions/${transaction.id}`,
      expect.objectContaining({ method: "DELETE" }),
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).has("Content-Type")).toBe(false);
  });
});

describe("document uploads API", () => {
  it("uploads one document as multipart form data without setting Content-Type", async () => {
    const upload: DocumentUpload = {
      id: "77777777-7777-4777-8777-777777777777",
      originalFileName: "receipt.pdf",
      mimeType: "application/pdf",
      byteSize: "12",
      checksumSha256: "a".repeat(64),
      status: "uploaded",
      createdAt: "2026-11-07T12:00:00.000Z",
      updatedAt: "2026-11-07T12:00:00.000Z",
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ upload }));
    vi.stubGlobal("fetch", fetch);
    const file = new File(["%PDF-1.7"], "receipt.pdf", {
      type: "application/pdf",
    });

    await expect(uploadDocument(file)).resolves.toEqual(upload);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/uploads/documents",
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: expect.any(FormData),
      }),
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    const body = request.body as FormData;
    expect(body.get("document")).toBe(file);
    expect(new Headers(request.headers).has("Content-Type")).toBe(false);
  });

  it("uses the server's detailed multipart error message", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 413,
      json: vi.fn().mockResolvedValue({
        error: "Payload Too Large",
        message: "Document must be at most 10 MB.",
      }),
    });
    vi.stubGlobal("fetch", fetch);
    const file = new File(["%PDF-1.7"], "receipt.pdf", {
      type: "application/pdf",
    });

    await expect(uploadDocument(file)).rejects.toMatchObject({
      status: 413,
      message: "Document must be at most 10 MB.",
    });
  });
});

describe("document capture sessions API", () => {
  const session = {
    id: "88888888-8888-4888-8888-888888888888",
    status: "pending" as const,
    expiresAt: "2026-11-08T12:05:00.000Z",
    captureUrl: `https://finhand.example/capture#token=${"a".repeat(43)}`,
  };
  const token = "a".repeat(43);

  it("creates an authenticated desktop capture session", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ session }));
    vi.stubGlobal("fetch", fetch);

    await expect(createDocumentCaptureSession()).resolves.toEqual(session);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/document-capture-sessions",
      expect.objectContaining({ credentials: "include", method: "POST" }),
    );
  });

  it("cancels an authenticated desktop capture session", async () => {
    const cancelledSession = {
      id: session.id,
      status: "cancelled" as const,
      expiresAt: session.expiresAt,
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ session: cancelledSession }));
    vi.stubGlobal("fetch", fetch);

    await expect(cancelDocumentCaptureSession(session.id)).resolves.toEqual(
      cancelledSession,
    );
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/document-capture-sessions/${session.id}/cancel`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("gets the authenticated desktop capture progress", async () => {
    const progress = {
      id: session.id,
      status: "consumed" as const,
      expiresAt: session.expiresAt,
      upload: {
        id: "99999999-9999-4999-8999-999999999999",
        status: "uploaded" as const,
      },
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ session: progress }));
    vi.stubGlobal("fetch", fetch);

    await expect(
      getDocumentCaptureSessionProgress(session.id),
    ).resolves.toEqual(progress);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/document-capture-sessions/${session.id}`,
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("validates a mobile session using the bearer token", async () => {
    const availableSession = {
      status: "pending" as const,
      expiresAt: session.expiresAt,
      acceptedMimeTypes: ["image/jpeg", "image/png"],
      maximumBytes: 10 * 1024 * 1024,
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ session: availableSession }));
    vi.stubGlobal("fetch", fetch);

    await expect(getDocumentCaptureSession(token)).resolves.toEqual(
      availableSession,
    );
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(request.headers).get("Authorization")).toBe(
      `Bearer ${token}`,
    );
  });

  it("uploads the mobile document with the token and multipart body", async () => {
    const upload: DocumentUpload = {
      id: "99999999-9999-4999-8999-999999999999",
      originalFileName: "receipt.jpg",
      mimeType: "image/jpeg",
      byteSize: "6",
      checksumSha256: "b".repeat(64),
      status: "uploaded",
      createdAt: "2026-11-08T12:00:00.000Z",
      updatedAt: "2026-11-08T12:00:00.000Z",
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ upload }));
    vi.stubGlobal("fetch", fetch);
    const file = new File(["receipt"], "receipt.jpg", {
      type: "image/jpeg",
    });

    await expect(uploadCaptureDocument(token, file)).resolves.toEqual(upload);
    const request = fetch.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(request.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${token}`);
    expect(headers.has("Content-Type")).toBe(false);
    expect((request.body as FormData).get("document")).toBe(file);
  });
});

describe("transaction candidates API", () => {
  const candidate: TransactionCandidate = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    uploadId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    position: 0,
    accountId: null,
    categoryId: null,
    type: "expense",
    amountMinor: "4290",
    currencyCode: "BRL",
    occurredOn: "2026-11-10",
    description: "Groceries",
    counterparty: "Market",
    notes: null,
    extractionMetadata: { confidence: { amountMinor: 0.9 } },
    status: "pending",
    createdAt: "2026-11-10T12:00:00.000Z",
    updatedAt: "2026-11-10T12:00:00.000Z",
  };

  it("gets review progress and candidates for one upload", async () => {
    const review = {
      upload: {
        id: candidate.uploadId,
        originalFileName: "receipt.pdf",
        status: "processed" as const,
        failureCode: null,
      },
      candidates: [candidate],
    };
    const fetch = vi.fn().mockResolvedValue(successfulResponse(review));
    vi.stubGlobal("fetch", fetch);

    await expect(
      getTransactionCandidateReview(candidate.uploadId),
    ).resolves.toEqual(review);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/transaction-candidates?uploadId=${candidate.uploadId}`,
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("updates a candidate draft", async () => {
    const input = {
      description: "Corrected groceries",
      accountId: account.id,
    };
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ candidate }));
    vi.stubGlobal("fetch", fetch);

    await expect(
      updateTransactionCandidate(candidate.id, input),
    ).resolves.toEqual(candidate);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:3001/api/transaction-candidates/${candidate.id}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  });
});

describe("document reviews API", () => {
  it("lists the authenticated user's open document reviews", async () => {
    const reviews: DocumentReview[] = [
      {
        uploadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        originalFileName: "receipt.pdf",
        status: "processed",
        failureCode: null,
        pendingCandidateCount: 1,
        createdAt: "2026-11-10T12:00:00.000Z",
        updatedAt: "2026-11-10T12:01:00.000Z",
      },
    ];
    const fetch = vi
      .fn()
      .mockResolvedValue(successfulResponse({ reviews }));
    vi.stubGlobal("fetch", fetch);

    await expect(getDocumentReviews()).resolves.toEqual(reviews);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/document-reviews",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});

describe("financial summary API", () => {
  const summary = {
    period: { from: null, to: "2026-11-04" },
    currencies: [],
    accounts: [],
    categoryTotals: [],
  };

  it("gets an all-time summary without query parameters", async () => {
    const fetch = vi.fn().mockResolvedValue(successfulResponse(summary));
    vi.stubGlobal("fetch", fetch);

    await expect(getFinancialSummary()).resolves.toEqual(summary);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/financial-summary",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("gets a summary for an explicit period", async () => {
    const fetch = vi.fn().mockResolvedValue(successfulResponse(summary));
    vi.stubGlobal("fetch", fetch);

    await expect(
      getFinancialSummary({ from: "2026-11-01", to: "2026-11-30" }),
    ).resolves.toEqual(summary);
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:3001/api/financial-summary?from=2026-11-01&to=2026-11-30",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
