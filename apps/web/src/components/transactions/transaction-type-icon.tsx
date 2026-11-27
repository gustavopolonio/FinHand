import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import type { TransactionType } from "@/lib/api";
import { cn } from "@/lib/class-names";

interface TransactionTypeIconProps {
  className?: string;
  type: TransactionType;
}

export function TransactionTypeIcon({
  className,
  type,
}: TransactionTypeIconProps) {
  const Icon = type === "income" ? ArrowDownLeft : ArrowUpRight;

  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full",
        type === "income"
          ? "bg-finhand-income-soft text-finhand-income"
          : "bg-finhand-expense-soft text-finhand-expense",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
    </span>
  );
}

