import { cn } from "@/lib/class-names";

interface FinHandBrandProps {
  compact?: boolean;
  className?: string;
}

export function FinHandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-9", className)}
      viewBox="0 0 40 40"
    >
      <rect fill="#2d6a4f" height="40" rx="13" width="40" />
      <path
        d="M11.5 24.5c4.1.1 6.9-1.3 8.5-4.4 1.7-3.3 4.5-4.8 8.5-4.6"
        fill="none"
        stroke="white"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
      <path
        d="M12 29V18m8 11v-6m8 6V11"
        fill="none"
        stroke="#d8f3dc"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}

export function FinHandBrand({
  className,
  compact = false,
}: FinHandBrandProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <FinHandMark />
      <div className="leading-tight">
        <p className="text-lg font-bold tracking-[-0.02em] text-finhand-ink">
          FinHand
        </p>
        {!compact ? (
          <p className="mt-0.5 text-xs text-finhand-muted">
            Personal Finance
          </p>
        ) : null}
      </div>
    </div>
  );
}
