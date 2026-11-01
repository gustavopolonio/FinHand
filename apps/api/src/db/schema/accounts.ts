import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const accountTypes = [
  "cash",
  "checking",
  "savings",
  "credit",
  "investment",
  "other",
] as const;

export type AccountType = (typeof accountTypes)[number];

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    type: text("type").$type<AccountType>().notNull(),
    currencyCode: varchar("currency_code", { length: 3 }).notNull(),
    openingBalanceMinor: bigint("opening_balance_minor", { mode: "bigint" })
      .default(sql`0`)
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "accounts_type_check",
      sql`${table.type} in ('cash', 'checking', 'savings', 'credit', 'investment', 'other')`,
    ),
    check(
      "accounts_currency_code_format_check",
      sql`${table.currencyCode} ~ '^[A-Z]{3}$'`,
    ),
    index("accounts_user_id_index").on(table.userId),
    unique("accounts_user_id_id_currency_code_unique").on(
      table.userId,
      table.id,
      table.currencyCode,
    ),
  ],
);
