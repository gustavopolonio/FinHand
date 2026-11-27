import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/class-names";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      className={cn(
        "h-12 w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-xl border border-finhand-border-strong bg-white px-4 text-sm text-finhand-ink outline-none transition placeholder:text-finhand-subtle hover:border-finhand-accent-border hover:bg-finhand-canvas-muted focus:border-finhand-focus focus:bg-white focus:ring-2 focus:ring-finhand-focus/20 disabled:cursor-not-allowed disabled:bg-finhand-canvas-muted disabled:text-finhand-muted aria-invalid:border-finhand-expense aria-invalid:focus:ring-finhand-expense/20",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
