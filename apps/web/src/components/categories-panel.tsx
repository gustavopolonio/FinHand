"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import {
  ApiError,
  type Category,
  type CategoryType,
  archiveCategory,
  categoryTypes,
  createCategory,
  getCategories,
  renameCategory,
  restoreCategory,
} from "@/lib/api";

const categoryTypeLabels: Record<CategoryType, string> = {
  income: "Income",
  expense: "Expense",
};

function sortCategories(categories: Category[]) {
  return [...categories].sort(
    (first, second) =>
      first.type.localeCompare(second.type) ||
      first.name.localeCompare(second.name),
  );
}

export function CategoriesPanel() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null,
  );
  const [editName, setEditName] = useState("");

  const reportError = useCallback(
    (cause: unknown) => {
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace("/");
        return;
      }

      setError(
        cause instanceof Error ? cause.message : "Something went wrong.",
      );
    },
    [router],
  );

  useEffect(() => {
    let isActive = true;

    void getCategories()
      .then((userCategories) => {
        if (isActive) {
          setCategories(userCategories);
        }
      })
      .catch((cause: unknown) => {
        if (isActive) {
          reportError(cause);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [reportError]);

  function replaceCategory(updatedCategory: Category) {
    setCategories((currentCategories) =>
      sortCategories(
        currentCategories.map((category) =>
          category.id === updatedCategory.id ? updatedCategory : category,
        ),
      ),
    );
  }

  async function submitNewCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyCategoryId("new");
    setError(null);

    try {
      const category = await createCategory({ name, type });

      setCategories((currentCategories) =>
        sortCategories([...currentCategories, category]),
      );
      setName("");
      setType("expense");
    } catch (cause) {
      reportError(cause);
    } finally {
      setBusyCategoryId(null);
    }
  }

  function startEditing(category: Category) {
    setEditingCategoryId(category.id);
    setEditName(category.name);
    setError(null);
  }

  async function submitCategoryEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCategoryId) {
      return;
    }

    setBusyCategoryId(editingCategoryId);
    setError(null);

    try {
      const category = await renameCategory(editingCategoryId, {
        name: editName,
      });

      replaceCategory(category);
      setEditingCategoryId(null);
    } catch (cause) {
      reportError(cause);
    } finally {
      setBusyCategoryId(null);
    }
  }

  async function changeArchiveState(category: Category) {
    setBusyCategoryId(category.id);
    setError(null);

    try {
      const updatedCategory = category.archivedAt
        ? await restoreCategory(category.id)
        : await archiveCategory(category.id);

      replaceCategory(updatedCategory);
    } catch (cause) {
      reportError(cause);
    } finally {
      setBusyCategoryId(null);
    }
  }

  const isBusy = busyCategoryId !== null;

  return (
    <div className="mt-10 border-t border-slate-200 pt-8">
      <h2 className="text-2xl font-semibold text-emerald-950">Categories</h2>

      <form
        className="mt-5 grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-3"
        onSubmit={(event) => void submitNewCategory(event)}
      >
        <label className="text-sm font-medium text-slate-700">
          Name
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Type
          <select
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            onChange={(event) => setType(event.target.value as CategoryType)}
            value={type}
          >
            {categoryTypes.map((categoryType) => (
              <option key={categoryType} value={categoryType}>
                {categoryTypeLabels[categoryType]}
              </option>
            ))}
          </select>
        </label>

        <button
          className="self-end rounded-md bg-emerald-900 px-4 py-2 font-medium text-white disabled:opacity-50"
          disabled={isBusy}
          type="submit"
        >
          {busyCategoryId === "new" ? "Creating…" : "Create category"}
        </button>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-600">Loading categories…</p>
      ) : categories.length === 0 ? (
        <p className="mt-6 text-sm text-slate-600">No categories yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {categories.map((category) => (
            <li className="rounded-xl border border-slate-200 p-4" key={category.id}>
              {editingCategoryId === category.id ? (
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => void submitCategoryEdit(event)}
                >
                  <label className="min-w-64 flex-1 text-sm font-medium text-slate-700">
                    Name
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                      maxLength={100}
                      onChange={(event) => setEditName(event.target.value)}
                      required
                      value={editName}
                    />
                  </label>
                  <button
                    className="rounded-md bg-emerald-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    disabled={isBusy}
                    type="submit"
                  >
                    Save
                  </button>
                  <button
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                    disabled={isBusy}
                    onClick={() => setEditingCategoryId(null)}
                    type="button"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {category.name}
                      </h3>
                      {category.archivedAt ? (
                        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                          Archived
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {categoryTypeLabels[category.type]}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                      disabled={isBusy}
                      onClick={() => startEditing(category)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                      disabled={isBusy}
                      onClick={() => void changeArchiveState(category)}
                      type="button"
                    >
                      {busyCategoryId === category.id
                        ? "Saving…"
                        : category.archivedAt
                          ? "Restore"
                          : "Archive"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
