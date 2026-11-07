"use client";

import { FileUp, PenLine } from "lucide-react";

import { cn } from "@/lib/class-names";

export type TransactionCreationMode = "manual" | "document";

interface TransactionMethodSelectorProps {
  disabled: boolean;
  onChange: (mode: TransactionCreationMode) => void;
  value: TransactionCreationMode;
}

const modes = [
  { value: "manual", label: "Manual", icon: PenLine },
  { value: "document", label: "Upload document", icon: FileUp },
] as const;

export function TransactionMethodSelector({
  disabled,
  onChange,
  value,
}: TransactionMethodSelectorProps) {
  return (
    <div
      aria-label="Transaction creation method"
      className="grid grid-cols-2 gap-1 rounded-xl bg-finhand-canvas-muted p-1"
      role="group"
    >
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isSelected = value === mode.value;

        return (
          <button
            aria-controls={`transaction-${mode.value}-panel`}
            aria-pressed={isSelected}
            className={cn(
              "flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus disabled:cursor-not-allowed disabled:opacity-60",
              isSelected
                ? "bg-white text-finhand-primary shadow-finhand-card"
                : "text-finhand-muted hover:text-finhand-ink",
            )}
            disabled={disabled}
            id={`transaction-${mode.value}-tab`}
            key={mode.value}
            onClick={() => onChange(mode.value)}
            type="button"
          >
            <Icon aria-hidden="true" className="size-4" />
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
