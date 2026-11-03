import type { Database } from "../db/index.js";
import {
  activeCategoryNameUniqueIndexName,
  categories,
  type CategoryType,
} from "../db/schema/index.js";
import { ConflictError, InputError } from "../errors/application-errors.js";
import { isPostgresUniqueConstraintError } from "../errors/postgres-errors.js";
import type { CreateCategoryInput } from "../validation/category-schemas.js";

const maximumCategoryNameLength = 100;
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

function normalizeCategoryName(name: string): string {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new InputError("Category name is required.");
  }

  if (normalizedName.length > maximumCategoryNameLength) {
    throw new InputError(
      `Category name must contain at most ${maximumCategoryNameLength} characters.`,
    );
  }

  return normalizedName;
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

export async function createCategoryForUser(
  database: Database,
  userId: string,
  input: CreateCategoryInput,
): Promise<CategoryListItem> {
  const name = normalizeCategoryName(input.name);

  try {
    const [createdCategory] = await database
      .insert(categories)
      .values({
        userId,
        name,
        type: input.type,
      })
      .returning({
        id: categories.id,
        name: categories.name,
        type: categories.type,
        archivedAt: categories.archivedAt,
        createdAt: categories.createdAt,
        updatedAt: categories.updatedAt,
      });

    if (!createdCategory) {
      throw new Error("Category creation did not return a record.");
    }

    return serializeCategory(createdCategory);
  } catch (error) {
    if (
      isPostgresUniqueConstraintError(
        error,
        activeCategoryNameUniqueIndexName,
      )
    ) {
      throw new ConflictError(
        "An active category with this name and type already exists.",
      );
    }

    throw error;
  }
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
