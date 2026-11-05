import type { HTMLAttributes } from "react";

import { cn } from "@/lib/class-names";

type BadgeVariant = "neutral" | "income" | "expense" | "warning" | "inverse";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral:
    "border border-finhand-border bg-finhand-canvas-muted text-finhand-neutral",
  income:
    "border border-finhand-income-border bg-finhand-income-soft text-finhand-income",
  expense:
    "border border-finhand-expense-border bg-finhand-expense-soft text-finhand-expense",
  warning:
    "border border-amber-200 bg-finhand-warning-soft text-finhand-warning",
  inverse: "bg-white/12 text-white",
};

export function Badge({
  className,
  variant = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
