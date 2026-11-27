import {
  endOfMonth,
  endOfYear,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import type { DateRange } from "react-day-picker";

export interface DateRangeValue {
  from?: string;
  to?: string;
}

export interface DateRangePreset {
  id: string;
  label: string;
  range?: DateRange;
}

export function dateFromInputValue(value: string | undefined) {
  if (!value) return undefined;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) return undefined;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return undefined;
  }

  return parsed;
}

export function dateToInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function dateRangeFromValue(value: DateRangeValue): DateRange | undefined {
  const from = dateFromInputValue(value.from);
  const to = dateFromInputValue(value.to);

  return from && to ? { from, to } : undefined;
}

export function formatDateRangeLabel(value: DateRangeValue) {
  const range = dateRangeFromValue(value);

  if (!range?.from || !range.to) return "All time";

  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (dateToInputValue(range.from) === dateToInputValue(range.to)) {
    return formatter.format(range.from);
  }

  return `${formatter.format(range.from)} – ${formatter.format(range.to)}`;
}

export function buildDateRangePresets(todayValue: Date): DateRangePreset[] {
  const today = startOfDay(todayValue);
  const lastMonth = subMonths(today, 1);
  const lastYear = subYears(today, 1);

  return [
    { id: "today", label: "Today", range: { from: today, to: today } },
    {
      id: "yesterday",
      label: "Yesterday",
      range: { from: subDays(today, 1), to: subDays(today, 1) },
    },
    {
      id: "last-7-days",
      label: "Last 7 days",
      range: { from: subDays(today, 6), to: today },
    },
    {
      id: "last-30-days",
      label: "Last 30 days",
      range: { from: subDays(today, 29), to: today },
    },
    {
      id: "month-to-date",
      label: "Month to date",
      range: { from: startOfMonth(today), to: today },
    },
    {
      id: "last-month",
      label: "Last month",
      range: { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) },
    },
    {
      id: "year-to-date",
      label: "Year to date",
      range: { from: startOfYear(today), to: today },
    },
    {
      id: "last-year",
      label: "Last year",
      range: { from: startOfYear(lastYear), to: endOfYear(lastYear) },
    },
    { id: "all-time", label: "All time" },
  ];
}

export function rangesMatch(
  left: DateRange | undefined,
  right: DateRange | undefined,
) {
  if (!left?.from || !left.to || !right?.from || !right.to) return false;

  return (
    dateToInputValue(left.from) === dateToInputValue(right.from) &&
    dateToInputValue(left.to) === dateToInputValue(right.to)
  );
}
