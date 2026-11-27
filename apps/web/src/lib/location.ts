const REVERSE_GEOCODING_URL =
  "https://api.bigdatacloud.net/data/reverse-geocode-client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalText(record: Record<string, unknown>, key: string) {
  const value = record[key];

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function approximateCoordinate(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

function isMetropolitanArea(value: string) {
  return (
    /^(?:regi[aã]o|[aá]rea) metropolitana (?:de|da|do) /i.test(value) ||
    /^metropolitan area of /i.test(value) ||
    / metropolitan area$/i.test(value)
  );
}

export function parseLocationLabel(value: unknown) {
  if (!isRecord(value)) {
    throw new Error("The location provider returned an invalid response.");
  }

  const reportedCity = optionalText(value, "city");
  const locality = optionalText(value, "locality");
  const city =
    reportedCity && !isMetropolitanArea(reportedCity)
      ? reportedCity
      : (locality ?? reportedCity);
  const countryCode = optionalText(value, "countryCode");

  if (!city || !countryCode || !/^[a-z]{2}$/i.test(countryCode)) {
    throw new Error("The location provider returned an incomplete location.");
  }

  return `${city}, ${countryCode.toUpperCase()}`;
}

export async function getLocationLabel(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
) {
  const url = new URL(REVERSE_GEOCODING_URL);
  url.searchParams.set("latitude", String(approximateCoordinate(latitude)));
  url.searchParams.set("longitude", String(approximateCoordinate(longitude)));
  url.searchParams.set("localityLanguage", "default");

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error("Your city is temporarily unavailable.");
  }

  return parseLocationLabel(await response.json());
}
