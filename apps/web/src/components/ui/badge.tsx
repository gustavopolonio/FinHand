import type { HTMLAttributes } from "react";

import { cn } from "@/lib/class-names";

type BadgeVariant = "neutral" | "income" | "expense" | "warning";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-finhand-mint-soft text-finhand-primary-strong",
  income: "bg-finhand-income-soft text-finhand-income",
  expense: "bg-finhand-expense-soft text-finhand-expense",
  warning: "bg-finhand-warning-soft text-finhand-warning",
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
