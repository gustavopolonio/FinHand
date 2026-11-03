import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users.js";

export const categoryTypes = ["income", "expense"] as const;
export const activeCategoryNameUniqueIndexName =
  "categories_user_id_type_name_active_unique";

export type CategoryType = (typeof categoryTypes)[number];

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    type: text("type").$type<CategoryType>().notNull(),
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
      "categories_type_check",
      sql`${table.type} in ('income', 'expense')`,
    ),
    uniqueIndex(activeCategoryNameUniqueIndexName)
      .using(
        "btree",
        table.userId,
        table.type,
        sql`lower(${table.name})`,
      )
      .where(sql`${table.archivedAt} is null`),
    unique("categories_user_id_id_type_unique").on(
      table.userId,
      table.id,
      table.type,
    ),
    index("categories_user_id_index").on(table.userId),
  ],
);
