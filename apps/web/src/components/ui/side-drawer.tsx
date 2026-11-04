"use client";

import { X } from "lucide-react";
import { type ReactNode, useId } from "react";

import { Button } from "./button";

interface SideDrawerProps {
  children: ReactNode;
  description: string;
  eyebrow: string;
  isBusy: boolean;
  onClose: () => void;
  title: string;
  widthClassName?: string;
}

export function SideDrawer({
  children,
  description,
  eyebrow,
  isBusy,
  onClose,
  title,
  widthClassName = "w-[540px]",
}: SideDrawerProps) {
  const titleId = useId();

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 flex justify-end bg-finhand-ink/30 backdrop-blur-[2px]"
      role="dialog"
    >
      <button
        aria-label={`Close ${title.toLowerCase()}`}
        className="flex-1 cursor-default"
        disabled={isBusy}
        onClick={onClose}
        type="button"
      />
      <aside
        className={`flex h-full ${widthClassName} flex-col border-l border-finhand-border bg-finhand-canvas shadow-2xl`}
      >
        <div className="flex items-start justify-between border-b border-finhand-border bg-white px-7 py-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-finhand-primary">
              {eyebrow}
            </p>
            <h2
              className="mt-1.5 text-2xl font-bold tracking-[-0.025em] text-finhand-ink"
              id={titleId}
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-finhand-muted">{description}</p>
          </div>
          <Button
            aria-label={`Close ${title.toLowerCase()}`}
            disabled={isBusy}
            onClick={onClose}
            size="sm"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>

        {children}
      </aside>
    </div>
  );
}
