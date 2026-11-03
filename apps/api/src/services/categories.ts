import type { Database } from "../db/index.js";
import {
  categories,
  type CategoryType,
} from "../db/schema/index.js";

const defaultCategories = [
  { name: "Salary", type: "income" },
  { name: "Grocery", type: "expense" },
] as const;

interface CategoryRecord {
  id: string;
  name: string;
  type: CategoryType;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryListItem {
  id: string;
  name: string;
  type: CategoryType;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function serializeCategory(category: CategoryRecord): CategoryListItem {
  return {
    id: category.id,
    name: category.name,
    type: category.type,
    archivedAt: category.archivedAt?.toISOString() ?? null,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export async function listCategoriesForUser(
  database: Database,
  userId: string,
): Promise<CategoryListItem[]> {
  const userCategories = await database.query.categories.findMany({
    columns: {
      id: true,
      name: true,
      type: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    where: (category, { eq }) => eq(category.userId, userId),
    orderBy: (category, { asc }) => [
      asc(category.type),
      asc(category.name),
      asc(category.id),
    ],
  });

  return userCategories.map(serializeCategory);
}

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
