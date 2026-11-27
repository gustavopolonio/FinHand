export type DollarTrend = "down" | "flat" | "up";

export interface DollarQuotation {
  date: string;
  rateTenThousandths: number;
}
export interface DollarMarketSnapshot {
  changeBasisPoints: number;
  current: DollarQuotation;
  history: DollarQuotation[];
  previous: DollarQuotation | null;
  trend: DollarTrend;
}

interface DollarMarketRequestOptions {
  now?: Date;
  signal?: AbortSignal;
}

const DOLLAR_SERIES_URL =
  "https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados";
const MARKET_DAYS_TO_DISPLAY = 7;
const REQUEST_LOOKBACK_DAYS = 21;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseProviderDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);

  if (!match) {
    throw new Error("The exchange-rate provider returned an invalid date.");
  }

  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    throw new Error("The exchange-rate provider returned an invalid date.");
  }

  return `${year}-${month}-${day}`;
}

function parseProviderRate(value: string) {
  const match = /^(\d+)[.,](\d{1,4})$/.exec(value);

  if (!match) {
    throw new Error("The exchange-rate provider returned an invalid rate.");
  }

  const [, whole, fraction] = match;
  const rate = Number(whole) * 10_000 + Number(fraction.padEnd(4, "0"));

  if (!Number.isSafeInteger(rate) || rate <= 0) {
    throw new Error("The exchange-rate provider returned an invalid rate.");
  }

  return rate;
}

export function parseDollarQuotationHistory(
  value: unknown,
): DollarQuotation[] {
  if (!Array.isArray(value)) {
    throw new Error("The exchange-rate provider returned an invalid history.");
  }

  const quotations = value.map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.data !== "string" ||
      typeof entry.valor !== "string"
    ) {
      throw new Error("The exchange-rate provider returned an invalid history.");
    }

    return {
      date: parseProviderDate(entry.data),
      rateTenThousandths: parseProviderRate(entry.valor),
    };
  });

  return [...new Map(quotations.map((quote) => [quote.date, quote])).values()].sort(
    (left, right) => left.date.localeCompare(right.date),
  );
}

function roundedPercentageBasisPoints(
  current: number,
  previous: number,
) {
  const difference = current - previous;

  if (difference === 0) return 0;

  const absoluteDifference = BigInt(Math.abs(difference));
  const previousValue = BigInt(previous);
  const rounded =
    (absoluteDifference * 10_000n + previousValue / 2n) / previousValue;

  return Number(difference < 0 ? -rounded : rounded);
}

export function buildDollarMarketSnapshot(
  quotations: DollarQuotation[],
): DollarMarketSnapshot {
  if (quotations.length === 0) {
    throw new Error("No dollar quotations are currently available.");
  }

  const history = quotations.slice(-MARKET_DAYS_TO_DISPLAY);
  const current = history.at(-1)!;
  const previous = history.at(-2) ?? null;
  const changeBasisPoints = previous
    ? roundedPercentageBasisPoints(
        current.rateTenThousandths,
        previous.rateTenThousandths,
      )
    : 0;

  return {
    changeBasisPoints,
    current,
    history,
    previous,
    trend:
      changeBasisPoints > 0
        ? "up"
        : changeBasisPoints < 0
          ? "down"
          : "flat",
  };
}

function formatProviderDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export async function getDollarMarketSnapshot({
  now = new Date(),
  signal,
}: DollarMarketRequestOptions = {}) {
  const start = new Date(now);
  start.setDate(start.getDate() - REQUEST_LOOKBACK_DAYS);

  const url = new URL(DOLLAR_SERIES_URL);
  url.searchParams.set("formato", "json");
  url.searchParams.set("dataInicial", formatProviderDate(start));
  url.searchParams.set("dataFinal", formatProviderDate(now));

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error("Dollar quotations are temporarily unavailable.");
  }

  return buildDollarMarketSnapshot(
    parseDollarQuotationHistory(await response.json()),
  );
}
