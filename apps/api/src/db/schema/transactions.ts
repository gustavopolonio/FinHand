import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { accounts } from "./accounts.js";
import { categories } from "./categories.js";
import { users } from "./users.js";

export const transactionTypes = ["income", "expense"] as const;
export const transactionOrigins = ["manual", "document", "voice"] as const;

export type TransactionType = (typeof transactionTypes)[number];
export type TransactionOrigin = (typeof transactionOrigins)[number];

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    accountId: uuid("account_id").notNull(),
    categoryId: uuid("category_id"),
    type: text("type").$type<TransactionType>().notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
    currencyCode: varchar("currency_code", { length: 3 }).notNull(),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    description: text("description").notNull(),
    counterparty: text("counterparty"),
    notes: text("notes"),
    origin: text("origin").$type<TransactionOrigin>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "transactions_type_check",
      sql`${table.type} in ('income', 'expense')`,
    ),
    check(
      "transactions_origin_check",
      sql`${table.origin} in ('manual', 'document', 'voice')`,
    ),
    check(
      "transactions_amount_minor_positive_check",
      sql`${table.amountMinor} > 0`,
    ),
    check(
      "transactions_currency_code_format_check",
      sql`${table.currencyCode} ~ '^[A-Z]{3}$'`,
    ),
    foreignKey({
      name: "transactions_account_owner_currency_fk",
      columns: [table.userId, table.accountId, table.currencyCode],
      foreignColumns: [accounts.userId, accounts.id, accounts.currencyCode],
    }).onDelete("restrict"),
    foreignKey({
      name: "transactions_category_owner_type_fk",
      columns: [table.userId, table.categoryId, table.type],
      foreignColumns: [categories.userId, categories.id, categories.type],
    }).onDelete("restrict"),
    unique("transactions_user_id_id_unique").on(table.userId, table.id),
    index("transactions_user_id_occurred_on_index").on(
      table.userId,
      table.occurredOn.desc(),
    ),
    index("transactions_user_id_account_id_occurred_on_index").on(
      table.userId,
      table.accountId,
      table.occurredOn.desc(),
    ),
    index("transactions_user_id_category_id_occurred_on_index").on(
      table.userId,
      table.categoryId,
      table.occurredOn.desc(),
    ),
  ],
);
