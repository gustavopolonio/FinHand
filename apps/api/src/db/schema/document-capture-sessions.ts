import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { uploads } from "./uploads.js";
import { users } from "./users.js";

export const documentCaptureSessionStatuses = [
  "pending",
  "consumed",
  "expired",
  "cancelled",
] as const;

export type DocumentCaptureSessionStatus =
  (typeof documentCaptureSessionStatuses)[number];

export const documentCaptureSessions = pgTable(
  "document_capture_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    status: text("status")
      .$type<DocumentCaptureSessionStatus>()
      .default("pending")
      .notNull(),
    uploadId: uuid("upload_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "document_capture_sessions_status_check",
      sql`${table.status} in ('pending', 'consumed', 'expired', 'cancelled')`,
    ),
    check(
      "document_capture_sessions_token_hash_format_check",
      sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "document_capture_sessions_expiration_check",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
    check(
      "document_capture_sessions_consumption_state_check",
      sql`(${table.status} = 'consumed' and ${table.uploadId} is not null and ${table.consumedAt} is not null) or (${table.status} <> 'consumed' and ${table.uploadId} is null and ${table.consumedAt} is null)`,
    ),
    foreignKey({
      name: "document_capture_sessions_upload_owner_fk",
      columns: [table.userId, table.uploadId],
      foreignColumns: [uploads.userId, uploads.id],
    }).onDelete("restrict"),
    uniqueIndex("document_capture_sessions_token_hash_unique").on(
      table.tokenHash,
    ),
    unique("document_capture_sessions_upload_id_unique").on(table.uploadId),
    index("document_capture_sessions_user_id_status_index").on(
      table.userId,
      table.status,
    ),
    index("document_capture_sessions_expires_at_index").on(table.expiresAt),
  ],
);
