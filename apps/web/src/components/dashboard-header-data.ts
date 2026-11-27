export function firstNameFromUser(
  displayName: string | null,
  email: string,
) {
  return displayName?.trim().split(/\s+/)[0] || email.split("@")[0];
}

export function getGreeting(date: Date, timeZone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone,
    }).format(date),
  );

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function getHeaderDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone,
    weekday: "long",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return {
    date: `${values.get("month")} ${values.get("day")}`,
    weekday: values.get("weekday") ?? "Today",
  };
}
