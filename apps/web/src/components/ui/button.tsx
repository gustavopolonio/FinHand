import type { ComponentPropsWithRef } from "react";

import { cn } from "@/lib/class-names";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "destructive";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ComponentPropsWithRef<"button"> {
  size?: ButtonSize;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-finhand-primary bg-finhand-primary text-white hover:border-finhand-primary-strong hover:bg-finhand-primary-strong",
  secondary:
    "border border-finhand-border bg-white text-finhand-ink hover:border-finhand-mint-strong hover:bg-finhand-canvas-muted",
  ghost:
    "border border-transparent bg-transparent text-finhand-muted hover:bg-finhand-mint-soft hover:text-finhand-ink",
  danger:
    "border border-finhand-expense-soft bg-finhand-expense-soft text-finhand-expense hover:border-finhand-expense/20 hover:bg-finhand-expense/10",
  destructive:
    "border border-[#a83931] bg-[#a83931] text-white shadow-sm hover:border-[#88211c] hover:bg-[#88211c]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm",
  md: "min-h-10 px-4 text-sm",
};

export function Button({
  className,
  size = "md",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
