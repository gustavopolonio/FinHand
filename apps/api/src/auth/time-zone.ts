const fallbackTimeZone = "UTC";

export function normalizeBrowserTimeZone(value: unknown): string {
  if (typeof value !== "string") {
    return fallbackTimeZone;
  }

  const timeZone = value.trim();

  if (!timeZone) {
    return fallbackTimeZone;
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
    return timeZone;
  } catch {
    return fallbackTimeZone;
  }
}
