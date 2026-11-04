import type { HTMLAttributes } from "react";

import { cn } from "@/lib/class-names";

interface CurrencyAmountProps extends HTMLAttributes<HTMLSpanElement> {
  currencyCode: string;
  value: string;
}

const currencySymbols: Record<string, string> = {
  BRL: "R$",
  EUR: "€",
  GBP: "£",
  USD: "US$",
};

export function formatCurrencyAmount(value: string, currencyCode: string) {
  if (!/^-?\d+$/.test(value)) {
    throw new Error("Money values must be integer strings in minor units.");
  }

  const amount = BigInt(value);
  const absoluteAmount = amount < 0n ? -amount : amount;
  const wholeUnits = absoluteAmount / 100n;
  const fraction = (absoluteAmount % 100n).toString().padStart(2, "0");
  const symbol = currencySymbols[currencyCode] ?? currencyCode;

  return `${amount < 0n ? "-" : ""}${symbol} ${wholeUnits.toLocaleString("en-US")}.${fraction}`;
}

export function CurrencyAmount({
  className,
  currencyCode,
  value,
  ...props
}: CurrencyAmountProps) {
  return (
    <span
      className={cn("tabular-nums", className)}
      data-currency={currencyCode}
      data-minor-units={value}
      {...props}
    >
      {formatCurrencyAmount(value, currencyCode)}
    </span>
  );
}
