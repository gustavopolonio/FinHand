const monthValuePattern = /^(\d{4})-(\d{2})$/;

export interface ParsedMonthValue {
  monthIndex: number;
  year: number;
}

export function parseMonthValue(value: string): ParsedMonthValue | null {
  const match = monthValuePattern.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;

  if (monthIndex < 0 || monthIndex > 11) return null;

  return { monthIndex, year };
}

export function createMonthValue(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function formatMonthValue(value: string) {
  const parsed = parseMonthValue(value);
  if (!parsed) return "All time";

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(parsed.year, parsed.monthIndex, 1)));
}

