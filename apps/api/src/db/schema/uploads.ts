import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const uploadKinds = ["document", "audio"] as const;
export const uploadSources = ["direct", "qr_capture"] as const;
export const uploadStatuses = [
  "pending",
  "uploaded",
  "processing",
  "processed",
  "failed",
] as const;

export type UploadKind = (typeof uploadKinds)[number];
export type UploadSource = (typeof uploadSources)[number];
export type UploadStatus = (typeof uploadStatuses)[number];

export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    kind: text("kind").$type<UploadKind>().notNull(),
    source: text("source").$type<UploadSource>().notNull(),
    s3ObjectKey: text("s3_object_key").notNull(),
    originalFileName: text("original_file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "bigint" }).notNull(),
    checksumSha256: varchar("checksum_sha256", { length: 64 }),
    status: text("status").$type<UploadStatus>().default("pending").notNull(),
    failureCode: text("failure_code"),
    processingAttempts: integer("processing_attempts").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("uploads_kind_check", sql`${table.kind} in ('document', 'audio')`),
    check(
      "uploads_source_check",
      sql`${table.source} in ('direct', 'qr_capture')`,
    ),
    check(
      "uploads_qr_source_document_only_check",
      sql`${table.source} <> 'qr_capture' or ${table.kind} = 'document'`,
    ),
    check(
      "uploads_status_check",
      sql`${table.status} in ('pending', 'uploaded', 'processing', 'processed', 'failed')`,
    ),
    check("uploads_byte_size_positive_check", sql`${table.byteSize} > 0`),
    check(
      "uploads_processing_attempts_non_negative_check",
      sql`${table.processingAttempts} >= 0`,
    ),
    check(
      "uploads_checksum_sha256_format_check",
      sql`${table.checksumSha256} is null or ${table.checksumSha256} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "uploads_failure_state_check",
      sql`(${table.status} = 'failed' and ${table.failureCode} is not null) or (${table.status} <> 'failed' and ${table.failureCode} is null)`,
    ),
    unique("uploads_user_id_id_unique").on(table.userId, table.id),
    uniqueIndex("uploads_s3_object_key_unique").on(table.s3ObjectKey),
    index("uploads_user_id_created_at_index").on(
      table.userId,
      table.createdAt.desc(),
    ),
    index("uploads_user_id_status_index").on(table.userId, table.status),
    index("uploads_status_created_at_id_index").on(
      table.status,
      table.createdAt,
      table.id,
    ),
  ],
);
