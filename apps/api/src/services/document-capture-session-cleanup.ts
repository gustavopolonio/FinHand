import { and, eq, lte } from "drizzle-orm";

import type { Database } from "../db/index.js";
import { documentCaptureSessions } from "../db/schema/index.js";

type CleanupDatabase = Pick<Database, "update">;

export async function expirePendingDocumentCaptureSessions(
  database: CleanupDatabase,
  now = new Date(),
): Promise<number> {
  const expiredSessions = await database
    .update(documentCaptureSessions)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(documentCaptureSessions.status, "pending"),
        lte(documentCaptureSessions.expiresAt, now),
      ),
    )
    .returning({ id: documentCaptureSessions.id });

  return expiredSessions.length;
}
