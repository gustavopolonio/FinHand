"use client";

import { CheckCircle2, X } from "lucide-react";

interface TransactionConfirmationToastProps {
  description: string | null;
  onDismiss: () => void;
}

export function TransactionConfirmationToast({
  description,
  onDismiss,
}: TransactionConfirmationToastProps) {
  if (!description) return null;

  return (
    <div
      aria-live="polite"
      className="fixed right-6 bottom-6 z-70 w-96 max-w-[calc(100vw-3rem)] rounded-2xl border border-finhand-income-border bg-white p-4 shadow-finhand-modal"
      role="status"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-finhand-income-soft text-finhand-income">
          <CheckCircle2 aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-finhand-ink">
            Transaction created
          </p>
          <p className="mt-1 truncate text-xs text-finhand-muted">
            {description} was added to your transactions.
          </p>
        </div>
        <button
          aria-label="Dismiss transaction confirmation"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-finhand-muted transition hover:bg-finhand-canvas-muted hover:text-finhand-ink"
          onClick={onDismiss}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
