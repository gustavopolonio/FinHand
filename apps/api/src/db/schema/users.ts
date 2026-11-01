import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    emailVerified: boolean("email_verified").default(false).notNull(),
    imageUrl: text("image_url"),
    defaultCurrency: varchar("default_currency", { length: 3 })
      .default("BRL")
      .notNull(),
    timeZone: text("time_zone").default("UTC").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_email_unique").using(
      "btree",
      sql`lower(${table.email})`,
    ),
    check(
      "users_default_currency_format_check",
      sql`${table.defaultCurrency} ~ '^[A-Z]{3}$'`,
    ),
  ],
);
