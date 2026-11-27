import { majorToMinorUnits, minorToMajorUnits } from "./money";

const maximumAmountInputDigits = 17;

export function currencyValueFromInput(
  value: string,
  allowNegative = false,
): string {
  const isNegative = allowNegative && value.trim().startsWith("-");
  const digits = value
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, maximumAmountInputDigits);

  const normalizedValue = minorToMajorUnits(digits || "0");

  return isNegative && normalizedValue !== "0.00"
    ? `-${normalizedValue}`
    : normalizedValue;
}

export function formatCurrencyInput(value: string): string {
  let minorUnits: string;

  try {
    minorUnits = majorToMinorUnits(value || "0");
  } catch {
    minorUnits = "0";
  }

  const isNegative = minorUnits.startsWith("-") && minorUnits !== "0";
  const paddedDigits = minorUnits.replace("-", "").padStart(3, "0");
  const wholeUnits = paddedDigits
    .slice(0, -2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `${isNegative ? "-" : ""}${wholeUnits},${paddedDigits.slice(-2)}`;
}
