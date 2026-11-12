import { and, eq } from "drizzle-orm";

import type { Database } from "../db/index.js";
import {
  transactionCandidates,
  transactions,
  type TransactionCandidateExtractionMetadata,
  type TransactionCandidateStatus,
  type TransactionOrigin,
  type TransactionType,
  type UploadStatus,
} from "../db/schema/index.js";
import {
  ConflictError,
  InputError,
  NotFoundError,
} from "../errors/application-errors.js";
import type {
  ConfirmTransactionCandidateInput,
  UpdateTransactionCandidateInput,
} from "../validation/transaction-candidate-schemas.js";

const maximumPostgresBigInt = 9_223_372_036_854_775_807n;
const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));

interface TransactionCandidateRecord {
  id: string;
  uploadId: string;
  position: number;
  accountId: string | null;
  categoryId: string | null;
  type: TransactionType | null;
  amountMinor: bigint | null;
  currencyCode: string | null;
  occurredOn: string | null;
  description: string | null;
  counterparty: string | null;
  notes: string | null;
  extractionMetadata: TransactionCandidateExtractionMetadata | null;
  status: TransactionCandidateStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthoritativeTransactionRecord {
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

export interface TransactionCandidateListItem {
  id: string;
  uploadId: string;
  position: number;
  accountId: string | null;
  categoryId: string | null;
  type: TransactionType | null;
  amountMinor: string | null;
  currencyCode: string | null;
  occurredOn: string | null;
  description: string | null;
  counterparty: string | null;
  notes: string | null;
  extractionMetadata: TransactionCandidateExtractionMetadata | null;
  status: TransactionCandidateStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionCandidateReview {
  upload: {
    id: string;
    originalFileName: string;
    status: UploadStatus;
    failureCode: string | null;
  };
  candidates: TransactionCandidateListItem[];
}

export interface ConfirmedTransaction {
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

export interface ConfirmTransactionCandidateResult {
  candidate: TransactionCandidateListItem;
  transaction: ConfirmedTransaction;
  created: boolean;
}

export interface RejectTransactionCandidateResult {
  candidate: TransactionCandidateListItem;
  changed: boolean;
}

function serializeCandidate(
  candidate: TransactionCandidateRecord,
): TransactionCandidateListItem {
  return {
    ...candidate,
    amountMinor: candidate.amountMinor?.toString() ?? null,
    createdAt: candidate.createdAt.toISOString(),
    updatedAt: candidate.updatedAt.toISOString(),
  };
}

function serializeTransaction(
  transaction: AuthoritativeTransactionRecord,
): ConfirmedTransaction {
  return {
    ...transaction,
    amountMinor: transaction.amountMinor.toString(),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}

function parseCandidateAmount(value: string | null): bigint | null {
  if (value === null) return null;

  if (!/^\d+$/.test(value)) {
    throw new InputError(
      "Transaction candidate amount must be a positive integer string in minor units.",
    );
  }

  const amount = BigInt(value);

  if (amount <= 0n) {
    throw new InputError(
      "Transaction candidate amount must be greater than zero.",
    );
  }

  if (amount > maximumPostgresBigInt) {
    throw new InputError(
      "Transaction candidate amount is outside PostgreSQL BIGINT range.",
    );
  }

  return amount;
}

function normalizeCandidateCurrency(value: string | null): string | null {
  if (value === null) return null;

  const currencyCode = value.trim().toUpperCase();

  if (!supportedCurrencies.has(currencyCode)) {
    throw new InputError("Transaction candidate currency is invalid.");
  }

  return currencyCode;
}

function normalizeCandidateText(value: string | null): string | null {
  if (value === null) return null;

  const normalizedValue = value.trim().replace(/\s+/gu, " ");
  return normalizedValue || null;
}

export async function getTransactionCandidateReviewForUser(
  database: Database,
  userId: string,
  uploadId: string,
): Promise<TransactionCandidateReview> {
  const upload = await database.query.uploads.findFirst({
    columns: {
      id: true,
      originalFileName: true,
      status: true,
      failureCode: true,
    },
    where: (candidateUpload, { and, eq }) =>
      and(
        eq(candidateUpload.id, uploadId),
        eq(candidateUpload.userId, userId),
      ),
  });

  if (!upload) {
    throw new NotFoundError("Upload not found");
  }

  const candidates =
    await database.query.transactionCandidates.findMany({
      columns: {
        id: true,
        uploadId: true,
        position: true,
        accountId: true,
        categoryId: true,
        type: true,
        amountMinor: true,
        currencyCode: true,
        occurredOn: true,
        description: true,
        counterparty: true,
        notes: true,
        extractionMetadata: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      where: (candidate, { and, eq }) =>
        and(
          eq(candidate.uploadId, uploadId),
          eq(candidate.userId, userId),
          eq(candidate.status, "pending"),
        ),
      orderBy: (candidate, { asc }) => [
        asc(candidate.position),
        asc(candidate.id),
      ],
    });

  return {
    upload,
    candidates: candidates.map(serializeCandidate),
  };
}

export async function updateTransactionCandidateForUser(
  database: Database,
  userId: string,
  candidateId: string,
  input: UpdateTransactionCandidateInput,
): Promise<TransactionCandidateListItem> {
  const existingCandidate =
    await database.query.transactionCandidates.findFirst({
      columns: {
        id: true,
        uploadId: true,
        position: true,
        accountId: true,
        categoryId: true,
        type: true,
        amountMinor: true,
        currencyCode: true,
        occurredOn: true,
        description: true,
        counterparty: true,
        notes: true,
        extractionMetadata: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      where: (candidate, { and, eq }) =>
        and(eq(candidate.id, candidateId), eq(candidate.userId, userId)),
    });

  if (!existingCandidate) {
    throw new NotFoundError("Transaction candidate not found");
  }

  if (existingCandidate.status !== "pending") {
    throw new ConflictError(
      "Only pending transaction candidates can be edited.",
    );
  }

  const updates: {
    accountId?: string | null;
    categoryId?: string | null;
    type?: TransactionType | null;
    amountMinor?: bigint | null;
    currencyCode?: string | null;
    occurredOn?: string | null;
    description?: string | null;
    counterparty?: string | null;
    notes?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  const nextAccountId =
    input.accountId === undefined
      ? existingCandidate.accountId
      : input.accountId;
  let nextCurrencyCode =
    input.currencyCode === undefined
      ? existingCandidate.currencyCode
      : normalizeCandidateCurrency(input.currencyCode);

  if (
    nextAccountId !== null &&
    (input.accountId !== undefined || input.currencyCode !== undefined)
  ) {
    const account = await database.query.accounts.findFirst({
      columns: { id: true, currencyCode: true, archivedAt: true },
      where: (candidateAccount, { and, eq }) =>
        and(
          eq(candidateAccount.id, nextAccountId),
          eq(candidateAccount.userId, userId),
        ),
    });

    if (!account) {
      throw new NotFoundError("Account not found");
    }

    if (account.archivedAt) {
      throw new ConflictError(
        "Archived accounts cannot be selected for a transaction candidate.",
      );
    }

    if (
      input.currencyCode !== undefined &&
      nextCurrencyCode !== account.currencyCode
    ) {
      throw new InputError(
        "Transaction candidate currency must match the selected account currency.",
      );
    }

    nextCurrencyCode = account.currencyCode;
  }

  const nextType =
    input.type === undefined ? existingCandidate.type : input.type;
  const nextCategoryId =
    input.categoryId === undefined
      ? existingCandidate.categoryId
      : input.categoryId;

  if (
    nextCategoryId !== null &&
    (input.categoryId !== undefined || input.type !== undefined)
  ) {
    const category = await database.query.categories.findFirst({
      columns: { id: true, type: true, archivedAt: true },
      where: (candidateCategory, { and, eq }) =>
        and(
          eq(candidateCategory.id, nextCategoryId),
          eq(candidateCategory.userId, userId),
        ),
    });

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    if (category.archivedAt) {
      throw new ConflictError(
        "Archived categories cannot be selected for a transaction candidate.",
      );
    }

    if (nextType === null || category.type !== nextType) {
      throw new InputError(
        "Transaction candidate type must match the selected category type.",
      );
    }
  }

  if (input.accountId !== undefined) {
    updates.accountId = input.accountId;
  }

  if (
    input.currencyCode !== undefined ||
    (input.accountId !== undefined && input.accountId !== null)
  ) {
    updates.currencyCode = nextCurrencyCode;
  }

  if (input.categoryId !== undefined) {
    updates.categoryId = input.categoryId;
  }

  if (input.type !== undefined) updates.type = input.type;
  if (input.amountMinor !== undefined) {
    updates.amountMinor = parseCandidateAmount(input.amountMinor);
  }
  if (input.occurredOn !== undefined) updates.occurredOn = input.occurredOn;
  if (input.description !== undefined) {
    updates.description = normalizeCandidateText(input.description);
  }
  if (input.counterparty !== undefined) {
    updates.counterparty = normalizeCandidateText(input.counterparty);
  }
  if (input.notes !== undefined) {
    updates.notes = normalizeCandidateText(input.notes);
  }

  const [updatedCandidate] = await database
    .update(transactionCandidates)
    .set(updates)
    .where(
      and(
        eq(transactionCandidates.id, candidateId),
        eq(transactionCandidates.userId, userId),
        eq(transactionCandidates.status, "pending"),
      ),
    )
    .returning({
      id: transactionCandidates.id,
      uploadId: transactionCandidates.uploadId,
      position: transactionCandidates.position,
      accountId: transactionCandidates.accountId,
      categoryId: transactionCandidates.categoryId,
      type: transactionCandidates.type,
      amountMinor: transactionCandidates.amountMinor,
      currencyCode: transactionCandidates.currencyCode,
      occurredOn: transactionCandidates.occurredOn,
      description: transactionCandidates.description,
      counterparty: transactionCandidates.counterparty,
      notes: transactionCandidates.notes,
      extractionMetadata: transactionCandidates.extractionMetadata,
      status: transactionCandidates.status,
      createdAt: transactionCandidates.createdAt,
      updatedAt: transactionCandidates.updatedAt,
    });

  if (!updatedCandidate) {
    throw new ConflictError(
      "Transaction candidate is no longer available for editing.",
    );
  }

  return serializeCandidate(updatedCandidate);
}

export async function confirmTransactionCandidateForUser(
  database: Database,
  userId: string,
  candidateId: string,
  input: ConfirmTransactionCandidateInput,
  now: () => Date = () => new Date(),
): Promise<ConfirmTransactionCandidateResult> {
  return database.transaction(async (transaction) => {
    const [candidate] = await transaction
      .select({
        id: transactionCandidates.id,
        uploadId: transactionCandidates.uploadId,
        position: transactionCandidates.position,
        accountId: transactionCandidates.accountId,
        categoryId: transactionCandidates.categoryId,
        type: transactionCandidates.type,
        amountMinor: transactionCandidates.amountMinor,
        currencyCode: transactionCandidates.currencyCode,
        occurredOn: transactionCandidates.occurredOn,
        description: transactionCandidates.description,
        counterparty: transactionCandidates.counterparty,
        notes: transactionCandidates.notes,
        extractionMetadata: transactionCandidates.extractionMetadata,
        status: transactionCandidates.status,
        transactionId: transactionCandidates.transactionId,
        createdAt: transactionCandidates.createdAt,
        updatedAt: transactionCandidates.updatedAt,
      })
      .from(transactionCandidates)
      .where(
        and(
          eq(transactionCandidates.id, candidateId),
          eq(transactionCandidates.userId, userId),
        ),
      )
      .limit(1)
      .for("update");

    if (!candidate) {
      throw new NotFoundError("Transaction candidate not found");
    }

    if (candidate.status === "confirmed") {
      if (!candidate.transactionId) {
        throw new Error(
          "Confirmed transaction candidate has no transaction reference.",
        );
      }

      const existingTransaction =
        await transaction.query.transactions.findFirst({
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
          where: (candidateTransaction, { and, eq }) =>
            and(
              eq(candidateTransaction.id, candidate.transactionId!),
              eq(candidateTransaction.userId, userId),
            ),
        });

      if (!existingTransaction) {
        throw new Error(
          "Confirmed transaction candidate references a missing transaction.",
        );
      }

      return {
        candidate: serializeCandidate(candidate),
        transaction: serializeTransaction(existingTransaction),
        created: false,
      };
    }

    if (candidate.status === "rejected") {
      throw new ConflictError(
        "Rejected transaction candidates cannot be confirmed.",
      );
    }

    const amountMinor = parseCandidateAmount(input.amountMinor);
    const currencyCode = normalizeCandidateCurrency(input.currencyCode);
    const description = normalizeCandidateText(input.description);
    const counterparty = normalizeCandidateText(input.counterparty ?? null);
    const notes = normalizeCandidateText(input.notes ?? null);

    if (amountMinor === null) {
      throw new InputError("Transaction candidate amount is required.");
    }

    if (currencyCode === null) {
      throw new InputError("Transaction candidate currency is required.");
    }

    if (description === null) {
      throw new InputError("Transaction candidate description is required.");
    }

    const account = await transaction.query.accounts.findFirst({
      columns: { id: true, currencyCode: true, archivedAt: true },
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

    if (currencyCode !== account.currencyCode) {
      throw new InputError(
        "Transaction candidate currency must match the selected account currency.",
      );
    }

    const categoryId = input.categoryId ?? null;

    if (categoryId !== null) {
      const category = await transaction.query.categories.findFirst({
        columns: { id: true, type: true, archivedAt: true },
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
          "Transaction candidate type must match the selected category type.",
        );
      }
    }

    const reviewedAt = now();
    const [createdTransaction] = await transaction
      .insert(transactions)
      .values({
        userId,
        accountId: account.id,
        categoryId,
        type: input.type,
        amountMinor,
        currencyCode,
        occurredOn: input.occurredOn,
        description,
        counterparty,
        notes,
        origin: "document",
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
      throw new Error("Transaction confirmation did not return a record.");
    }

    const [confirmedCandidate] = await transaction
      .update(transactionCandidates)
      .set({
        accountId: account.id,
        categoryId,
        type: input.type,
        amountMinor,
        currencyCode,
        occurredOn: input.occurredOn,
        description,
        counterparty,
        notes,
        status: "confirmed",
        reviewedAt,
        transactionId: createdTransaction.id,
        updatedAt: reviewedAt,
      })
      .where(
        and(
          eq(transactionCandidates.id, candidateId),
          eq(transactionCandidates.userId, userId),
          eq(transactionCandidates.status, "pending"),
        ),
      )
      .returning({
        id: transactionCandidates.id,
        uploadId: transactionCandidates.uploadId,
        position: transactionCandidates.position,
        accountId: transactionCandidates.accountId,
        categoryId: transactionCandidates.categoryId,
        type: transactionCandidates.type,
        amountMinor: transactionCandidates.amountMinor,
        currencyCode: transactionCandidates.currencyCode,
        occurredOn: transactionCandidates.occurredOn,
        description: transactionCandidates.description,
        counterparty: transactionCandidates.counterparty,
        notes: transactionCandidates.notes,
        extractionMetadata: transactionCandidates.extractionMetadata,
        status: transactionCandidates.status,
        createdAt: transactionCandidates.createdAt,
        updatedAt: transactionCandidates.updatedAt,
      });

    if (!confirmedCandidate) {
      throw new ConflictError(
        "Transaction candidate is no longer available for confirmation.",
      );
    }

    return {
      candidate: serializeCandidate(confirmedCandidate),
      transaction: serializeTransaction(createdTransaction),
      created: true,
    };
  });
}

export async function rejectTransactionCandidateForUser(
  database: Database,
  userId: string,
  candidateId: string,
  now: () => Date = () => new Date(),
): Promise<RejectTransactionCandidateResult> {
  return database.transaction(async (transaction) => {
    const [candidate] = await transaction
      .select({
        id: transactionCandidates.id,
        uploadId: transactionCandidates.uploadId,
        position: transactionCandidates.position,
        accountId: transactionCandidates.accountId,
        categoryId: transactionCandidates.categoryId,
        type: transactionCandidates.type,
        amountMinor: transactionCandidates.amountMinor,
        currencyCode: transactionCandidates.currencyCode,
        occurredOn: transactionCandidates.occurredOn,
        description: transactionCandidates.description,
        counterparty: transactionCandidates.counterparty,
        notes: transactionCandidates.notes,
        extractionMetadata: transactionCandidates.extractionMetadata,
        status: transactionCandidates.status,
        createdAt: transactionCandidates.createdAt,
        updatedAt: transactionCandidates.updatedAt,
      })
      .from(transactionCandidates)
      .where(
        and(
          eq(transactionCandidates.id, candidateId),
          eq(transactionCandidates.userId, userId),
        ),
      )
      .limit(1)
      .for("update");

    if (!candidate) {
      throw new NotFoundError("Transaction candidate not found");
    }

    if (candidate.status === "confirmed") {
      throw new ConflictError(
        "Confirmed transaction candidates cannot be discarded.",
      );
    }

    if (candidate.status === "rejected") {
      return { candidate: serializeCandidate(candidate), changed: false };
    }

    const reviewedAt = now();
    const [rejectedCandidate] = await transaction
      .update(transactionCandidates)
      .set({
        status: "rejected",
        reviewedAt,
        updatedAt: reviewedAt,
      })
      .where(
        and(
          eq(transactionCandidates.id, candidateId),
          eq(transactionCandidates.userId, userId),
          eq(transactionCandidates.status, "pending"),
        ),
      )
      .returning({
        id: transactionCandidates.id,
        uploadId: transactionCandidates.uploadId,
        position: transactionCandidates.position,
        accountId: transactionCandidates.accountId,
        categoryId: transactionCandidates.categoryId,
        type: transactionCandidates.type,
        amountMinor: transactionCandidates.amountMinor,
        currencyCode: transactionCandidates.currencyCode,
        occurredOn: transactionCandidates.occurredOn,
        description: transactionCandidates.description,
        counterparty: transactionCandidates.counterparty,
        notes: transactionCandidates.notes,
        extractionMetadata: transactionCandidates.extractionMetadata,
        status: transactionCandidates.status,
        createdAt: transactionCandidates.createdAt,
        updatedAt: transactionCandidates.updatedAt,
      });

    if (!rejectedCandidate) {
      throw new ConflictError(
        "Transaction candidate is no longer available for rejection.",
      );
    }

    return {
      candidate: serializeCandidate(rejectedCandidate),
      changed: true,
    };
  });
}
