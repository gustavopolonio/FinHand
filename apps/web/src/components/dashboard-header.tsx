"use client";

import {
  ChevronRight,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  MoonStar,
  SunMedium,
  ThermometerSun,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { CurrentUser } from "@/lib/api";
import { getLocationLabel } from "@/lib/location";
import {
  getLocalWeatherForecast,
  type LocalWeatherForecast,
  type WeatherPoint,
  type WeatherVisual,
  weatherVisualFor,
} from "@/lib/weather";

import {
  firstNameFromUser,
  getGreeting,
  getHeaderDateParts,
} from "./dashboard-header-data";
import { UserSettingsMenu } from "./user-settings-menu";

interface DashboardHeaderProps {
  isOverview: boolean;
  onSignOut: () => void;
  user: CurrentUser;
}

type WeatherState =
  | { status: "denied" | "error" | "idle" | "loading" | "unsupported" }
  | { forecast: LocalWeatherForecast; status: "ready" };

const weatherIcons: Record<WeatherVisual, LucideIcon> = {
  clear: SunMedium,
  cloudy: Cloud,
  drizzle: CloudDrizzle,
  fog: CloudFog,
  "heavy-rain": CloudRainWind,
  hot: ThermometerSun,
  "partly-cloudy": CloudSun,
  rain: CloudRain,
  snow: CloudSnow,
  thunder: CloudLightning,
};

const weatherDescriptions: Record<WeatherVisual, string> = {
  clear: "Clear",
  cloudy: "Cloudy",
  drizzle: "Drizzle",
  fog: "Fog",
  "heavy-rain": "Heavy rain",
  hot: "Very sunny and hot",
  "partly-cloudy": "Partly cloudy",
  rain: "Rain",
  snow: "Snow",
  thunder: "Thunderstorms",
};

function WeatherGlyph({ point }: { point: WeatherPoint }) {
  const visual = weatherVisualFor(point);
  const Icon =
    visual === "clear" && !point.isDay
      ? MoonStar
      : visual === "partly-cloudy" && !point.isDay
        ? CloudMoon
        : weatherIcons[visual];
  const tone =
    visual === "clear" || visual === "hot"
      ? "text-finhand-warning"
      : visual === "rain" || visual === "heavy-rain" || visual === "drizzle"
        ? "text-finhand-interactive"
        : "text-finhand-neutral";

  return (
    <span
      aria-label={weatherDescriptions[visual]}
      title={weatherDescriptions[visual]}
      className={`grid size-7 place-items-center ${tone}`}
      role="img"
    >
      <Icon aria-hidden="true" className="size-5" />
    </span>
  );
}

function WeatherTimeline({ forecast }: { forecast: LocalWeatherForecast }) {
  return (
    <div
      aria-label="Local weather forecast"
      className="flex items-center gap-1"
    >
      {forecast.points.map((point, index) => (
        <div
          className={index === 0 ? "contents" : "hidden min-[430px]:contents"}
          key={point.label}
        >
          {index > 0 ? (
            <ChevronRight
              aria-hidden="true"
              className="size-3.5 shrink-0 text-finhand-subtle"
            />
          ) : null}
          <div
            aria-label={`${point.label}: ${weatherDescriptions[weatherVisualFor(point)]}, ${Math.round(point.temperatureCelsius)} degrees Celsius`}
            className="flex min-w-10 flex-col items-center"
          >
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.06em] text-finhand-subtle">
              {point.label}
            </span>
            <span className="mt-0.5 flex items-center gap-0.5">
              <WeatherGlyph point={point} />
              <span className="text-xs font-bold text-finhand-ink">
                {Math.round(point.temperatureCelsius)}°
              </span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function WeatherControl({
  state,
}: {
  state: WeatherState;
}) {
  if (state.status === "ready") {
    return <WeatherTimeline forecast={state.forecast} />;
  }

  if (state.status === "loading") {
    return (
      <div
        aria-label="Loading local weather"
        className="flex h-10 w-36 animate-pulse items-center justify-center rounded-lg bg-finhand-canvas-muted"
      />
    );
  }

  return null;
}

export function DashboardHeader({
  isOverview,
  onSignOut,
  user,
}: DashboardHeaderProps) {
  const now = new Date();
  const greeting = getGreeting(now, user.timeZone);
  const firstName = firstNameFromUser(user.displayName, user.email);
  const date = getHeaderDateParts(now, user.timeZone);
  const abortController = useRef<AbortController | null>(null);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [weatherState, setWeatherState] = useState<WeatherState>({
    status: "idle",
  });

  const requestWeather = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setWeatherState({ status: "unsupported" });
      return;
    }

    setWeatherState({ status: "loading" });
    setLocationLabel(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        abortController.current?.abort();
        const controller = new AbortController();
        abortController.current = controller;

        void getLocationLabel(
          position.coords.latitude,
          position.coords.longitude,
          controller.signal,
        )
          .then(setLocationLabel)
          .catch((cause: unknown) => {
            if (cause instanceof DOMException && cause.name === "AbortError") {
              return;
            }

            setLocationLabel(null);
          });

        void getLocalWeatherForecast(
          position.coords.latitude,
          position.coords.longitude,
          controller.signal,
        )
          .then((forecast) => {
            setWeatherState({ forecast, status: "ready" });
          })
          .catch((cause: unknown) => {
            if (cause instanceof DOMException && cause.name === "AbortError") {
              return;
            }

            setWeatherState({ status: "error" });
          });
      },
      (error) => {
        setWeatherState({
          status: error.code === error.PERMISSION_DENIED ? "denied" : "error",
        });
      },
      {
        enableHighAccuracy: false,
        maximumAge: 15 * 60 * 1_000,
        timeout: 10_000,
      },
    );
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      return;
    }

    const requestId = window.setTimeout(requestWeather, 0);

    return () => {
      window.clearTimeout(requestId);
      abortController.current?.abort();
    };
  }, [requestWeather]);

  return (
    <header className="z-30 border-b border-finhand-border bg-finhand-canvas/95 px-4 py-3 backdrop-blur-sm sm:px-6 md:sticky md:top-0 lg:px-10">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {isOverview ? (
          <h1 className="text-lg font-bold tracking-[-0.02em] text-finhand-ink sm:text-xl">
            {greeting}, {firstName}
          </h1>
        ) : (
          <p className="text-lg font-bold tracking-[-0.02em] text-finhand-ink sm:text-xl">
            {greeting}, {firstName}
          </p>
        )}

        <div className="order-3 flex w-full min-w-0 items-center justify-between gap-2 border-t border-finhand-border pt-2 sm:order-none sm:w-auto sm:gap-3 sm:border-0 sm:pt-0">
          <div className="min-w-0 flex-1 text-left sm:min-w-28 sm:flex-none sm:text-right">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-finhand-subtle">
              {date.weekday}
            </p>
            <p className="text-sm font-semibold text-finhand-ink">{date.date}</p>
            <p
              className="mt-0.5 min-h-4 max-w-36 truncate text-[0.68rem] font-medium text-finhand-muted"
              title={locationLabel ?? undefined}
            >
              {locationLabel ?? <span aria-hidden="true">&nbsp;</span>}
            </p>
          </div>

          {weatherState.status === "loading" ||
          weatherState.status === "ready" ? (
            <>
              <span
                aria-hidden="true"
                className="h-8 w-px shrink-0 bg-finhand-border"
              />
              <WeatherControl state={weatherState} />
            </>
          ) : null}

          <div className="lg:hidden">
            <UserSettingsMenu
              onSignOut={onSignOut}
              triggerClassName="size-10"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
