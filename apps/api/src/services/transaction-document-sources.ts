import { and, eq } from "drizzle-orm";

import type { Database } from "../db/index.js";
import {
  transactionCandidates,
  transactions,
  uploads,
} from "../db/schema/index.js";
import { NotFoundError } from "../errors/application-errors.js";
import type { DocumentStorage } from "../storage/document-storage.js";
import { documentPreviewUrlLifetimeSeconds } from "./document-previews.js";

export interface TransactionDocumentSource {
  contentType: string;
  expiresAt: string;
  fileName: string;
  url: string;
}

interface GetTransactionDocumentSourceInput {
  database: Database;
  documentStorage: DocumentStorage;
  now?: Date;
  transactionId: string;
  userId: string;
}

export async function getTransactionDocumentSourceForUser({
  database,
  documentStorage,
  now = new Date(),
  transactionId,
  userId,
}: GetTransactionDocumentSourceInput): Promise<TransactionDocumentSource> {
  const [source] = await database
    .select({
      fileName: uploads.originalFileName,
      contentType: uploads.mimeType,
      objectKey: uploads.s3ObjectKey,
    })
    .from(transactions)
    .innerJoin(
      transactionCandidates,
      and(
        eq(transactionCandidates.transactionId, transactions.id),
        eq(transactionCandidates.userId, transactions.userId),
      ),
    )
    .innerJoin(
      uploads,
      and(
        eq(uploads.id, transactionCandidates.uploadId),
        eq(uploads.userId, transactions.userId),
      ),
    )
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.userId, userId),
        eq(transactions.origin, "document"),
        eq(transactionCandidates.status, "confirmed"),
        eq(uploads.kind, "document"),
      ),
    )
    .limit(1);

  if (!source) {
    throw new NotFoundError("Transaction source document not found");
  }

  const url = await documentStorage.createDocumentPreviewUrl(
    source.objectKey,
    documentPreviewUrlLifetimeSeconds,
  );

  return {
    contentType: source.contentType,
    expiresAt: new Date(
      now.getTime() + documentPreviewUrlLifetimeSeconds * 1_000,
    ).toISOString(),
    fileName: source.fileName,
    url,
  };
}
