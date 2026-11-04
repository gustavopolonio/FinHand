import type { Category, CategoryType } from "@/lib/api";

export const categoryTypeLabels: Record<CategoryType, string> = {
  income: "Income",
  expense: "Expense",
};

export interface CategoryFormValues {
  name: string;
  type: CategoryType;
}

export function emptyCategoryForm(): CategoryFormValues {
  return { name: "", type: "expense" };
}

export function formValuesFromCategory(
  category: Category,
): CategoryFormValues {
  return { name: category.name, type: category.type };
}
