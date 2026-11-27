export type WeatherVisual =
  | "clear"
  | "cloudy"
  | "drizzle"
  | "fog"
  | "heavy-rain"
  | "hot"
  | "partly-cloudy"
  | "rain"
  | "snow"
  | "thunder";

export interface WeatherPoint {
  apparentTemperatureCelsius: number;
  isDay: boolean;
  label: "Now" | "+12h" | "+24h";
  temperatureCelsius: number;
  weatherCode: number;
}

export interface LocalWeatherForecast {
  points: [WeatherPoint, WeatherPoint, WeatherPoint];
}

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("The weather provider returned an invalid forecast.");
  }

  return value;
}

function numberArray(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "number" || !Number.isFinite(entry))
  ) {
    throw new Error("The weather provider returned an invalid forecast.");
  }

  return value as number[];
}

function futurePoint(
  hourly: Record<string, unknown>,
  index: number,
  label: WeatherPoint["label"],
): WeatherPoint {
  const temperatures = numberArray(hourly, "temperature_2m");
  const apparentTemperatures = numberArray(hourly, "apparent_temperature");
  const weatherCodes = numberArray(hourly, "weather_code");
  const daylight = numberArray(hourly, "is_day");
  const temperatureCelsius = temperatures[index];
  const apparentTemperatureCelsius = apparentTemperatures[index];
  const weatherCode = weatherCodes[index];
  const isDay = daylight[index];

  if (
    temperatureCelsius === undefined ||
    apparentTemperatureCelsius === undefined ||
    weatherCode === undefined ||
    isDay === undefined
  ) {
    throw new Error("The weather provider returned an incomplete forecast.");
  }

  return {
    apparentTemperatureCelsius,
    isDay: isDay === 1,
    label,
    temperatureCelsius,
    weatherCode,
  };
}

export function parseWeatherForecast(value: unknown): LocalWeatherForecast {
  if (!isRecord(value) || !isRecord(value.current) || !isRecord(value.hourly)) {
    throw new Error("The weather provider returned an invalid forecast.");
  }

  const current: WeatherPoint = {
    apparentTemperatureCelsius: numberField(
      value.current,
      "apparent_temperature",
    ),
    isDay: numberField(value.current, "is_day") === 1,
    label: "Now",
    temperatureCelsius: numberField(value.current, "temperature_2m"),
    weatherCode: numberField(value.current, "weather_code"),
  };

  return {
    points: [
      current,
      futurePoint(value.hourly, 12, "+12h"),
      futurePoint(value.hourly, 24, "+24h"),
    ],
  };
}

function approximateCoordinate(value: number) {
  return Math.round(value * 100) / 100;
}

export async function getLocalWeatherForecast(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
) {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(approximateCoordinate(latitude)));
  url.searchParams.set("longitude", String(approximateCoordinate(longitude)));
  url.searchParams.set(
    "current",
    "temperature_2m,apparent_temperature,weather_code,is_day",
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,apparent_temperature,weather_code,is_day",
  );
  url.searchParams.set("forecast_hours", "25");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error("Local weather is temporarily unavailable.");
  }

  return parseWeatherForecast(await response.json());
}

export function weatherVisualFor(point: WeatherPoint): WeatherVisual {
  const code = point.weatherCode;

  if (code <= 1) {
    return point.isDay && point.apparentTemperatureCelsius >= 32
      ? "hot"
      : "clear";
  }
  if (code === 2) return "partly-cloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 65 || code === 67 || code === 82) return "heavy-rain";
  if ((code >= 61 && code <= 66) || (code >= 80 && code <= 81)) {
    return "rain";
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return "snow";
  }
  if (code >= 95) return "thunder";
  return "cloudy";
}
