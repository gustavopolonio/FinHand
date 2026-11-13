import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "../db/index.js";
import {
  uploads,
  type UploadStatus,
} from "../db/schema/index.js";
import {
  ConflictError,
  InputError,
  NotFoundError,
} from "../errors/application-errors.js";

const maximumFailureCodeLength = 100;
const failureCodePattern = /^[a-z][a-z0-9_]*$/;
const failableUploadStatuses = [
  "pending",
  "uploaded",
] as const satisfies readonly UploadStatus[];

interface UploadStateRecord {
  id: string;
  status: UploadStatus;
  failureCode: string | null;
  updatedAt: Date;
}

interface TransitionUploadInput {
  database: Database;
  failureCode?: string;
  fromStatuses: readonly UploadStatus[];
  toStatus: UploadStatus;
  uploadId: string;
  userId: string;
}

export interface UploadState {
  id: string;
  status: UploadStatus;
  failureCode: string | null;
  updatedAt: string;
}

function serializeUploadState(upload: UploadStateRecord): UploadState {
  return {
    id: upload.id,
    status: upload.status,
    failureCode: upload.failureCode,
    updatedAt: upload.updatedAt.toISOString(),
  };
}

function normalizeFailureCode(failureCode: string): string {
  const normalizedFailureCode = failureCode.trim();

  if (
    !failureCodePattern.test(normalizedFailureCode) ||
    normalizedFailureCode.length > maximumFailureCodeLength
  ) {
    throw new InputError(
      "Failure code must start with a lowercase letter and contain at most 100 lowercase letters, numbers, or underscores.",
    );
  }

  return normalizedFailureCode;
}

async function findUploadStateForUser(
  database: Database,
  userId: string,
  uploadId: string,
): Promise<UploadStateRecord | undefined> {
  return database.query.uploads.findFirst({
    columns: {
      id: true,
      status: true,
      failureCode: true,
      updatedAt: true,
    },
    where: (upload, { and, eq }) =>
      and(eq(upload.id, uploadId), eq(upload.userId, userId)),
  });
}

async function transitionUploadForUser({
  database,
  failureCode,
  fromStatuses,
  toStatus,
  uploadId,
  userId,
}: TransitionUploadInput): Promise<UploadState> {
  const updatedAt = new Date();
  const [updatedUpload] = await database
    .update(uploads)
    .set({
      status: toStatus,
      failureCode: failureCode ?? null,
      updatedAt,
    })
    .where(
      and(
        eq(uploads.id, uploadId),
        eq(uploads.userId, userId),
        inArray(uploads.status, fromStatuses),
      ),
    )
    .returning({
      id: uploads.id,
      status: uploads.status,
      failureCode: uploads.failureCode,
      updatedAt: uploads.updatedAt,
    });

  if (updatedUpload) {
    return serializeUploadState(updatedUpload);
  }

  const existingUpload = await findUploadStateForUser(
    database,
    userId,
    uploadId,
  );

  if (!existingUpload) {
    throw new NotFoundError("Upload not found");
  }

  throw new ConflictError(
    `Upload cannot transition from "${existingUpload.status}" to "${toStatus}".`,
  );
}

export async function markUploadAsUploaded(
  database: Database,
  userId: string,
  uploadId: string,
): Promise<UploadState> {
  return transitionUploadForUser({
    database,
    fromStatuses: ["pending"],
    toStatus: "uploaded",
    uploadId,
    userId,
  });
}

export async function markUploadAsFailed(
  database: Database,
  userId: string,
  uploadId: string,
  failureCode: string,
): Promise<UploadState> {
  return transitionUploadForUser({
    database,
    failureCode: normalizeFailureCode(failureCode),
    fromStatuses: failableUploadStatuses,
    toStatus: "failed",
    uploadId,
    userId,
  });
}
