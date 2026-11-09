import { createHash, randomBytes } from "node:crypto";
import type { Readable } from "node:stream";

import { and, eq } from "drizzle-orm";

import type { Database } from "../db/index.js";
import {
  documentCaptureSessions,
  uploads,
  type UploadStatus,
} from "../db/schema/index.js";
import {
  ConflictError,
  GoneError,
  NotFoundError,
  UnauthorizedError,
} from "../errors/application-errors.js";
import type { DocumentStorage } from "../storage/document-storage.js";
import {
  discardStoredDocument,
  persistDocumentUpload,
  storeValidatedDocument,
  type UploadedDocument,
} from "./document-uploads.js";

export const documentCaptureSessionLifetimeMs = 5 * 60 * 1_000; // 5 min

const captureTokenPattern = /^[A-Za-z0-9_-]{43}$/;

interface CaptureSessionRecord {
  id: string;
  userId: string;
  status: "pending" | "consumed" | "expired" | "cancelled";
  expiresAt: Date;
}

export interface DocumentCaptureSession {
  id: string;
  status: "pending" | "cancelled";
  expiresAt: string;
}

export interface CreatedDocumentCaptureSession extends DocumentCaptureSession {
  token: string;
}

export interface DocumentCaptureSessionProgress {
  id: string;
  status: CaptureSessionRecord["status"];
  expiresAt: string;
  upload: {
    id: string;
    status: UploadStatus;
  } | null;
}

interface UploadForCaptureSessionInput {
  database: Database;
  documentStorage: DocumentStorage;
  fileName: string;
  mimeType: string;
  now?: () => Date;
  source: Readable;
  token: string;
  wasTruncated?: () => boolean;
}

function hashCaptureToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function serializeSession(
  session: Pick<CaptureSessionRecord, "id" | "status" | "expiresAt">,
): DocumentCaptureSession {
  if (session.status !== "pending" && session.status !== "cancelled") {
    throw new Error("Capture session cannot be exposed in its current state.");
  }

  return {
    id: session.id,
    status: session.status,
    expiresAt: session.expiresAt.toISOString(),
  };
}

function assertCaptureSessionAvailable(
  session: CaptureSessionRecord | undefined,
  now: Date,
): asserts session is CaptureSessionRecord & { status: "pending" } {
  if (!session) {
    throw new UnauthorizedError();
  }

  if (session.expiresAt.getTime() <= now.getTime()) {
    throw new GoneError("This capture session has expired.");
  }

  if (session.status !== "pending") {
    throw new ConflictError("This capture session is no longer available.");
  }
}

async function findCaptureSessionByHash(
  database: Pick<Database, "select">,
  tokenHash: string,
): Promise<CaptureSessionRecord | undefined> {
  const [session] = await database
    .select({
      id: documentCaptureSessions.id,
      userId: documentCaptureSessions.userId,
      status: documentCaptureSessions.status,
      expiresAt: documentCaptureSessions.expiresAt,
    })
    .from(documentCaptureSessions)
    .where(eq(documentCaptureSessions.tokenHash, tokenHash))
    .limit(1);

  return session;
}

export function captureTokenFromAuthorization(
  authorization: string | undefined,
): string {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization ?? "");

  if (!match?.[1]) {
    throw new UnauthorizedError();
  }

  return match[1];
}

export async function createDocumentCaptureSession(
  database: Database,
  userId: string,
  now = new Date(),
): Promise<CreatedDocumentCaptureSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    now.getTime() + documentCaptureSessionLifetimeMs,
  );
  const [createdSession] = await database
    .insert(documentCaptureSessions)
    .values({
      userId,
      tokenHash: hashCaptureToken(token),
      status: "pending",
      expiresAt,
    })
    .returning({
      id: documentCaptureSessions.id,
      status: documentCaptureSessions.status,
      expiresAt: documentCaptureSessions.expiresAt,
    });

  if (!createdSession || createdSession.status !== "pending") {
    throw new Error("Capture session creation did not return a record.");
  }

  return {
    ...serializeSession({ ...createdSession, status: "pending" }),
    token,
  };
}

export async function getAvailableDocumentCaptureSession(
  database: Database,
  token: string,
  now = new Date(),
): Promise<DocumentCaptureSession> {
  if (!captureTokenPattern.test(token)) {
    throw new UnauthorizedError();
  }

  const session = await findCaptureSessionByHash(
    database,
    hashCaptureToken(token),
  );
  assertCaptureSessionAvailable(session, now);

  return serializeSession(session);
}

export async function getDocumentCaptureSessionProgress(
  database: Database,
  userId: string,
  sessionId: string,
  now = new Date(),
): Promise<DocumentCaptureSessionProgress> {
  const [session] = await database
    .select({
      id: documentCaptureSessions.id,
      status: documentCaptureSessions.status,
      expiresAt: documentCaptureSessions.expiresAt,
      uploadId: uploads.id,
      uploadStatus: uploads.status,
    })
    .from(documentCaptureSessions)
    .leftJoin(uploads, eq(documentCaptureSessions.uploadId, uploads.id))
    .where(
      and(
        eq(documentCaptureSessions.id, sessionId),
        eq(documentCaptureSessions.userId, userId),
      ),
    )
    .limit(1);

  if (!session) {
    throw new NotFoundError("Capture session not found.");
  }

  const status =
    session.status === "pending" &&
    session.expiresAt.getTime() <= now.getTime()
      ? "expired"
      : session.status;

  return {
    id: session.id,
    status,
    expiresAt: session.expiresAt.toISOString(),
    upload:
      session.uploadId && session.uploadStatus
        ? { id: session.uploadId, status: session.uploadStatus }
        : null,
  };
}

export async function cancelDocumentCaptureSession(
  database: Database,
  userId: string,
  sessionId: string,
  now = new Date(),
): Promise<DocumentCaptureSession> {
  const [cancelledSession] = await database
    .update(documentCaptureSessions)
    .set({ status: "cancelled", updatedAt: now })
    .where(
      and(
        eq(documentCaptureSessions.id, sessionId),
        eq(documentCaptureSessions.userId, userId),
        eq(documentCaptureSessions.status, "pending"),
      ),
    )
    .returning({
      id: documentCaptureSessions.id,
      status: documentCaptureSessions.status,
      expiresAt: documentCaptureSessions.expiresAt,
    });

  if (cancelledSession?.status === "cancelled") {
    return serializeSession({ ...cancelledSession, status: "cancelled" });
  }

  const [existingSession] = await database
    .select({
      id: documentCaptureSessions.id,
      status: documentCaptureSessions.status,
      expiresAt: documentCaptureSessions.expiresAt,
    })
    .from(documentCaptureSessions)
    .where(
      and(
        eq(documentCaptureSessions.id, sessionId),
        eq(documentCaptureSessions.userId, userId),
      ),
    )
    .limit(1);

  if (!existingSession) {
    throw new NotFoundError("Capture session not found.");
  }

  if (existingSession.status === "cancelled") {
    return serializeSession({ ...existingSession, status: "cancelled" });
  }

  throw new ConflictError("This capture session can no longer be cancelled.");
}

export async function uploadDocumentForCaptureSession({
  database,
  documentStorage,
  fileName,
  mimeType,
  now = () => new Date(),
  source,
  token,
  wasTruncated,
}: UploadForCaptureSessionInput): Promise<UploadedDocument> {
  if (!captureTokenPattern.test(token)) {
    throw new UnauthorizedError();
  }

  const tokenHash = hashCaptureToken(token);
  const preliminarySession = await findCaptureSessionByHash(
    database,
    tokenHash,
  );
  assertCaptureSessionAvailable(preliminarySession, now());

  const storedDocument = await storeValidatedDocument({
    documentStorage,
    fileName,
    mimeType,
    source,
    wasTruncated,
    userId: preliminarySession.userId,
  });

  try {
    return await database.transaction(async (transaction) => {
      const [lockedSession] = await transaction
        .select({
          id: documentCaptureSessions.id,
          userId: documentCaptureSessions.userId,
          status: documentCaptureSessions.status,
          expiresAt: documentCaptureSessions.expiresAt,
        })
        .from(documentCaptureSessions)
        .where(eq(documentCaptureSessions.tokenHash, tokenHash))
        .limit(1)
        .for("update");

      assertCaptureSessionAvailable(lockedSession, now());

      const upload = await persistDocumentUpload(
        transaction,
        storedDocument,
        "qr_capture",
      );
      const consumedAt = now();
      const [consumedSession] = await transaction
        .update(documentCaptureSessions)
        .set({
          status: "consumed",
          uploadId: storedDocument.id,
          consumedAt,
          updatedAt: consumedAt,
        })
        .where(
          and(
            eq(documentCaptureSessions.id, lockedSession.id),
            eq(documentCaptureSessions.status, "pending"),
          ),
        )
        .returning({ id: documentCaptureSessions.id });

      if (!consumedSession) {
        throw new ConflictError(
          "This capture session is no longer available.",
        );
      }

      return upload;
    });
  } catch (error) {
    return discardStoredDocument(documentStorage, storedDocument, error);
  }
}
