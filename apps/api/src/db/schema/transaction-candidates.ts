import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { accounts } from "./accounts.js";
import { categories } from "./categories.js";
import { transactions, type TransactionType } from "./transactions.js";
import { uploads } from "./uploads.js";
import { users } from "./users.js";

export const transactionCandidateStatuses = [
  "pending",
  "confirmed",
  "rejected",
] as const;

export type TransactionCandidateStatus =
  (typeof transactionCandidateStatuses)[number];

export interface TransactionCandidateExtractionMetadata {
  confidence?: Record<string, number>;
  warnings?: string[];
}

export const transactionCandidates = pgTable(
  "transaction_candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    uploadId: uuid("upload_id").notNull(),
    position: integer("position").notNull(),
    accountId: uuid("account_id"),
    categoryId: uuid("category_id"),
    type: text("type").$type<TransactionType>(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }),
    currencyCode: varchar("currency_code", { length: 3 }),
    occurredOn: date("occurred_on", { mode: "string" }),
    description: text("description"),
    counterparty: text("counterparty"),
    notes: text("notes"),
    extractionMetadata: jsonb("extraction_metadata")
      .$type<TransactionCandidateExtractionMetadata>(),
    status: text("status")
      .$type<TransactionCandidateStatus>()
      .default("pending")
      .notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    transactionId: uuid("transaction_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "transaction_candidates_status_check",
      sql`${table.status} in ('pending', 'confirmed', 'rejected')`,
    ),
    check(
      "transaction_candidates_type_check",
      sql`${table.type} is null or ${table.type} in ('income', 'expense')`,
    ),
    check(
      "transaction_candidates_amount_minor_positive_check",
      sql`${table.amountMinor} is null or ${table.amountMinor} > 0`,
    ),
    check(
      "transaction_candidates_currency_code_format_check",
      sql`${table.currencyCode} is null or ${table.currencyCode} ~ '^[A-Z]{3}$'`,
    ),
    check(
      "transaction_candidates_position_nonnegative_check",
      sql`${table.position} >= 0`,
    ),
    check(
      "transaction_candidates_account_currency_check",
      sql`${table.accountId} is null or ${table.currencyCode} is not null`,
    ),
    check(
      "transaction_candidates_category_type_check",
      sql`${table.categoryId} is null or ${table.type} is not null`,
    ),
    check(
      "transaction_candidates_review_state_check",
      sql`(${table.status} = 'pending' and ${table.reviewedAt} is null and ${table.transactionId} is null) or (${table.status} = 'rejected' and ${table.reviewedAt} is not null and ${table.transactionId} is null) or (${table.status} = 'confirmed' and ${table.reviewedAt} is not null and ${table.transactionId} is not null)`,
    ),
    check(
      "transaction_candidates_confirmed_fields_check",
      sql`${table.status} <> 'confirmed' or (${table.accountId} is not null and ${table.type} is not null and ${table.amountMinor} is not null and ${table.currencyCode} is not null and ${table.occurredOn} is not null and ${table.description} is not null)`,
    ),
    foreignKey({
      name: "transaction_candidates_upload_owner_fk",
      columns: [table.userId, table.uploadId],
      foreignColumns: [uploads.userId, uploads.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "transaction_candidates_account_owner_currency_fk",
      columns: [table.userId, table.accountId, table.currencyCode],
      foreignColumns: [accounts.userId, accounts.id, accounts.currencyCode],
    }).onDelete("restrict"),
    foreignKey({
      name: "transaction_candidates_category_owner_type_fk",
      columns: [table.userId, table.categoryId, table.type],
      foreignColumns: [categories.userId, categories.id, categories.type],
    }).onDelete("restrict"),
    foreignKey({
      name: "transaction_candidates_transaction_owner_fk",
      columns: [table.userId, table.transactionId],
      foreignColumns: [transactions.userId, transactions.id],
    }).onDelete("restrict"),
    unique("transaction_candidates_upload_id_position_unique").on(
      table.uploadId,
      table.position,
    ),
    unique("transaction_candidates_transaction_id_unique").on(
      table.transactionId,
    ),
    index("transaction_candidates_user_id_status_created_at_index").on(
      table.userId,
      table.status,
      table.createdAt.desc(),
    ),
    index("transaction_candidates_upload_id_index").on(table.uploadId),
  ],
);
