"use client";

import { Camera, FileUp, PenLine, QrCode } from "lucide-react";

import { cn } from "@/lib/class-names";

export type TransactionCreationMode =
  | "manual"
  | "document"
  | "camera"
  | "qr";

interface TransactionMethodSelectorProps {
  disabled: boolean;
  onChange: (mode: TransactionCreationMode) => void;
  value: TransactionCreationMode;
}

const modes = [
  { value: "manual", label: "Manual", icon: PenLine },
  { value: "document", label: "Upload document", icon: FileUp },
  { value: "camera", label: "Take photo", icon: Camera },
  { value: "qr", label: "Use phone", icon: QrCode },
] as const;

export function TransactionMethodSelector({
  disabled,
  onChange,
  value,
}: TransactionMethodSelectorProps) {
  return (
    <div
      aria-label="Transaction creation method"
      className="grid grid-cols-3 gap-1 rounded-xl bg-finhand-canvas-muted p-1 md:grid-cols-3"
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
              "flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus disabled:cursor-not-allowed disabled:opacity-60 sm:gap-2 sm:px-4 sm:text-sm",
              mode.value === "camera" && "md:hidden",
              mode.value === "qr" && "hidden md:flex",
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
