import type { HTMLAttributes } from "react";

import { cn } from "@/lib/class-names";

type CardVariant = "default" | "primary";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantClasses: Record<CardVariant, string> = {
  default: "border-finhand-border bg-white",
  primary: "border-finhand-mint-strong bg-finhand-primary text-white",
};

export function Card({
  className,
  variant = "default",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border shadow-finhand-card",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
