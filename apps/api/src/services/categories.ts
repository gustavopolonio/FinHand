import type { Database } from "../db/index.js";
import { categories } from "../db/schema/index.js";

const defaultCategories = [
  { name: "Salary", type: "income" },
  { name: "Grocery", type: "expense" },
] as const;

export async function createDefaultCategoriesForUser(
  database: Database,
  userId: string,
): Promise<void> {
  await database
    .insert(categories)
    .values(
      defaultCategories.map((category) => ({
        userId,
        ...category,
      })),
    )
    .onConflictDoNothing();
}
