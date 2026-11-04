import type { HTMLAttributes } from "react";

import { cn } from "@/lib/class-names";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-finhand-border bg-white shadow-finhand-card",
        className,
      )}
      {...props}
    />
  );
}
