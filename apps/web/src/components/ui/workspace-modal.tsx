"use client";

import { X } from "lucide-react";
import { type MouseEvent, type ReactNode, useEffect, useId } from "react";

interface WorkspaceModalProps {
  children: ReactNode;
  description: string;
  isBusy: boolean;
  onClose: () => void;
  title: string;
  widthClassName?: string;
}

export function WorkspaceModal({
  children,
  description,
  isBusy,
  onClose,
  title,
  widthClassName = "max-w-[620px]",
}: WorkspaceModalProps) {
  const titleId = useId();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) onClose();
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isBusy, onClose]);

  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !isBusy) onClose();
  }

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-finhand-ink/40 p-4 backdrop-blur-sm"
      onMouseDown={closeFromBackdrop}
      role="dialog"
    >
      <section
        className={`flex max-h-[90vh] w-full ${widthClassName} flex-col overflow-hidden rounded-2xl border border-finhand-border bg-white shadow-[0_20px_60px_rgba(25,40,35,0.18)]`}
      >
        <header className="flex items-start justify-between border-b border-finhand-divider p-6">
          <div>
            <h2
              className="text-lg font-bold tracking-[-0.015em] text-finhand-ink"
              id={titleId}
            >
              {title}
            </h2>
            <p className="mt-1 text-xs text-finhand-muted">{description}</p>
          </div>
          <button
            aria-label={`Close ${title.toLowerCase()}`}
            className="grid size-8 shrink-0 place-items-center rounded-full text-finhand-muted transition hover:bg-finhand-mint-soft hover:text-finhand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus"
            disabled={isBusy}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>

        {children}
      </section>
    </div>
  );
}
