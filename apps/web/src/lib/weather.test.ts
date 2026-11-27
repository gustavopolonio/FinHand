import { describe, expect, it } from "vitest";

import {
  parseWeatherForecast,
  type WeatherPoint,
  weatherVisualFor,
} from "./weather";

function point(overrides: Partial<WeatherPoint>): WeatherPoint {
  return {
    apparentTemperatureCelsius: 24,
    isDay: true,
    label: "Now",
    temperatureCelsius: 24,
    weatherCode: 0,
    ...overrides,
  };
}

describe("weather helpers", () => {
  it("maps forecast codes to a consistent visual vocabulary", () => {
    expect(weatherVisualFor(point({ weatherCode: 0 }))).toBe("clear");
    expect(
      weatherVisualFor(point({ apparentTemperatureCelsius: 34 })),
    ).toBe("hot");
    expect(weatherVisualFor(point({ weatherCode: 3 }))).toBe("cloudy");
    expect(weatherVisualFor(point({ weatherCode: 53 }))).toBe("drizzle");
    expect(weatherVisualFor(point({ weatherCode: 63 }))).toBe("rain");
    expect(weatherVisualFor(point({ weatherCode: 65 }))).toBe("heavy-rain");
  });

  it("selects the current, 12-hour, and 24-hour forecasts", () => {
    const hourlyValues = Array.from({ length: 25 }, (_, index) => index);
    const forecast = parseWeatherForecast({
      current: {
        apparent_temperature: 26,
        is_day: 1,
        temperature_2m: 25,
        weather_code: 2,
      },
      hourly: {
        apparent_temperature: hourlyValues,
        is_day: hourlyValues.map(() => 1),
        temperature_2m: hourlyValues,
        weather_code: hourlyValues.map(() => 3),
      },
    });

    expect(forecast.points.map(({ label }) => label)).toEqual([
      "Now",
      "+12h",
      "+24h",
    ]);
    expect(forecast.points.map(({ temperatureCelsius }) => temperatureCelsius)).toEqual([
      25, 12, 24,
    ]);
  });

  it("rejects incomplete provider responses", () => {
    expect(() => parseWeatherForecast({ current: {}, hourly: {} })).toThrow(
      "invalid forecast",
    );
  });
});
