import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/class-names";
import {
  currencyValueFromInput,
  formatCurrencyInput,
} from "@/lib/currency-input";

const currencySymbols: Record<string, string> = {
  BRL: "R$",
  EUR: "€",
  GBP: "£",
  USD: "US$",
};

interface CurrencyInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "type" | "value"
  > {
  allowNegative?: boolean;
  currencyCode: string;
  inputClassName?: string;
  onValueChange: (value: string) => void;
  value: string;
}

export function CurrencyInput({
  allowNegative = false,
  className,
  currencyCode,
  inputClassName,
  onKeyDown,
  onFocus,
  onValueChange,
  value,
  ...props
}: CurrencyInputProps) {
  return (
    <span
      className={cn(
        "flex h-12 w-full min-w-0 items-center rounded-xl border border-finhand-border-strong bg-white px-4 transition hover:border-finhand-accent-border hover:bg-finhand-canvas-muted focus-within:border-finhand-focus focus-within:bg-white focus-within:ring-2 focus-within:ring-finhand-focus/20 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:bg-finhand-canvas-muted has-[input[aria-invalid=true]]:border-finhand-expense has-[input[aria-invalid=true]]:focus-within:ring-finhand-expense/20",
        className,
      )}
    >
      <span className="mr-2 shrink-0 text-base font-medium text-finhand-muted">
        {currencySymbols[currencyCode] ?? currencyCode}
      </span>
      <input
        className={cn(
          "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent text-sm text-finhand-ink outline-none placeholder:text-finhand-subtle disabled:cursor-not-allowed disabled:text-finhand-muted",
          inputClassName,
        )}
        inputMode="numeric"
        onChange={(event) =>
          onValueChange(
            currencyValueFromInput(event.target.value, allowNegative),
          )
        }
        onFocus={(event) => {
          event.currentTarget.select();
          onFocus?.(event);
        }}
        onKeyDown={(event) => {
          if (allowNegative && event.key === "-") {
            event.preventDefault();
            onValueChange(
              value.startsWith("-") ? value.slice(1) : `-${value}`,
            );
          }
          onKeyDown?.(event);
        }}
        type="text"
        value={formatCurrencyInput(value)}
        {...props}
      />
    </span>
  );
}
