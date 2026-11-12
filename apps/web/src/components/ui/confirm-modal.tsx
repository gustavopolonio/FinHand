"use client";

import { X } from "lucide-react";
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";

import { Button } from "./button";

interface ConfirmModalProps {
  cancelLabel: string;
  children: ReactNode;
  confirmIcon?: ReactNode;
  confirmLabel: string;
  confirmingLabel?: string;
  description: string;
  error?: string | null;
  eyebrow: string;
  icon: ReactNode;
  isConfirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
}

export function ConfirmModal({
  cancelLabel,
  children,
  confirmIcon,
  confirmLabel,
  confirmingLabel = "Deleting…",
  description,
  error,
  eyebrow,
  icon,
  isConfirming,
  onCancel,
  onConfirm,
  title,
}: ConfirmModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      event.preventDefault();
      event.stopPropagation();
      if (!isConfirming) onCancel();
    }

    document.addEventListener("keydown", closeOnEscape, true);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape, true);

      if (previouslyFocusedElement instanceof HTMLElement) {
        previouslyFocusedElement.focus();
      }
    };
  }, [isConfirming, onCancel]);

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !isConfirming) onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-finhand-ink/35 p-4 backdrop-blur-[2px]"
      onMouseDown={closeFromBackdrop}
    >
      <section
        aria-busy={isConfirming}
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-[540px] rounded-2xl bg-white p-8 shadow-[0_20px_25px_-5px_rgba(15,23,42,0.10),0_8px_10px_-6px_rgba(15,23,42,0.06)]"
        role="alertdialog"
      >
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-finhand-expense-soft text-finhand-expense">
              {icon}
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-finhand-expense">
                {eyebrow}
              </p>
              <h2
                className="mt-0.5 text-[22px] font-semibold leading-7 tracking-[-0.01em] text-finhand-ink"
                id={titleId}
              >
                {title}
              </h2>
            </div>
          </div>
          <button
            aria-label={`Close ${title.toLowerCase()}`}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-finhand-subtle transition hover:bg-finhand-canvas-muted hover:text-finhand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus"
            disabled={isConfirming}
            onClick={onCancel}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>

        <p
          className="mt-4 text-sm leading-6 text-finhand-muted"
          id={descriptionId}
        >
          {description}
        </p>

        <div className="mt-6">{children}</div>

        {error ? (
          <p
            className="mt-4 rounded-xl border border-finhand-expense/20 bg-finhand-expense-soft px-4 py-3 text-sm text-finhand-expense"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <footer className="mt-6 flex items-center justify-end gap-2">
          <Button
            disabled={isConfirming}
            onClick={onCancel}
            ref={cancelButtonRef}
            variant="ghost"
          >
            {cancelLabel}
          </Button>
          <Button
            disabled={isConfirming}
            onClick={onConfirm}
            variant="destructive"
          >
            {isConfirming ? (
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            ) : (
              confirmIcon
            )}
            {isConfirming ? confirmingLabel : confirmLabel}
          </Button>
        </footer>
      </section>
    </div>
  );
}
