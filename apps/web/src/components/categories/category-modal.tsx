"use client";

import { ArrowDown, ArrowUpRight, Check } from "lucide-react";
import { type FormEvent, useState } from "react";

import type { Category, CategoryType } from "@/lib/api";
import { categoryTypes } from "@/lib/api";
import { cn } from "@/lib/class-names";

import { Button } from "../ui/button";
import { WorkspaceModal } from "../ui/workspace-modal";
import {
  categoryTypeLabels,
  emptyCategoryForm,
  formValuesFromCategory,
  type CategoryFormValues,
} from "./category-form";

interface CategoryModalProps {
  category: Category | null;
  defaultType: CategoryType;
  error: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: CategoryFormValues) => Promise<boolean>;
}

export function CategoryModal({
  category,
  defaultType,
  error,
  isSubmitting,
  onClose,
  onSubmit,
}: CategoryModalProps) {
  const [values, setValues] = useState<CategoryFormValues>(() =>
    category
      ? formValuesFromCategory(category)
      : { ...emptyCategoryForm(), type: defaultType },
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (await onSubmit(values)) onClose();
  }

  return (
    <WorkspaceModal
      description={
        category
          ? "Rename this category while preserving its transaction history."
          : "Create a clear bucket for organizing related transactions."
      }
      isBusy={isSubmitting}
      onClose={onClose}
      title={category ? "Edit Category" : "Add Category"}
      widthClassName="max-w-[520px]"
    >
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => void submit(event)}
      >
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          <div>
            <p className="text-xs font-medium text-finhand-muted">Type</p>
            <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-finhand-mint-soft p-1">
              {categoryTypes.map((type) => {
                const Icon = type === "expense" ? ArrowUpRight : ArrowDown;

                return (
                  <button
                    aria-pressed={values.type === type}
                    className={cn(
                      "flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-65",
                      values.type === type
                        ? type === "expense"
                          ? "bg-white text-finhand-expense shadow-finhand-card"
                          : "bg-white text-finhand-income shadow-finhand-card"
                        : "text-finhand-muted hover:text-finhand-ink",
                    )}
                    disabled={Boolean(category)}
                    key={type}
                    onClick={() =>
                      setValues((current) => ({ ...current, type }))
                    }
                    type="button"
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {categoryTypeLabels[type]}
                  </button>
                );
              })}
            </div>
            {category ? (
              <p className="mt-2 text-xs text-finhand-muted">
                A category&apos;s type cannot be changed after creation.
              </p>
            ) : null}
          </div>

          <label className="block text-xs font-medium text-finhand-muted">
            Category name
            <input
              autoFocus
              className="mt-1.5 min-h-12 w-full rounded-xl border border-transparent bg-finhand-mint-soft px-4 text-sm text-finhand-ink outline-none transition placeholder:text-finhand-subtle focus:border-finhand-focus focus:bg-white focus:ring-2 focus:ring-finhand-focus/20"
              maxLength={100}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="For example, Housing"
              required
              value={values.name}
            />
          </label>

          <p className="rounded-xl bg-finhand-mint-soft p-4 text-sm leading-6 text-finhand-muted">
            {values.type === "expense"
              ? "Expense categories organize where your money goes."
              : "Income categories identify where your money comes from."}
          </p>

          {error ? (
            <p
              className="rounded-lg border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-finhand-divider bg-finhand-mint-soft/40 p-5">
          <Button
            className="rounded-xl!"
            disabled={isSubmitting}
            onClick={onClose}
            variant="ghost"
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl!"
            disabled={isSubmitting}
            type="submit"
          >
            {!isSubmitting ? (
              <Check aria-hidden="true" className="size-4" />
            ) : null}
            {isSubmitting
              ? "Saving…"
              : category
                ? "Save Changes"
                : "Save Category"}
          </Button>
        </div>
      </form>
    </WorkspaceModal>
  );
}
