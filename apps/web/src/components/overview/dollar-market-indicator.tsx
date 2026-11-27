"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  type DollarMarketSnapshot,
  type DollarQuotation,
  type DollarTrend,
  getDollarMarketSnapshot,
} from "@/lib/dollar-market";

type DollarMarketState =
  | { status: "error" }
  | { status: "loading" }
  | { snapshot: DollarMarketSnapshot; status: "ready" };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const trendDetails: Record<
  DollarTrend,
  { Icon: LucideIcon; label: string; tone: string; toneSoft: string }
> = {
  down: {
    Icon: ArrowDownRight,
    label: "fell",
    tone: "text-finhand-expense",
    toneSoft: "bg-finhand-expense-soft",
  },
  flat: {
    Icon: ArrowRight,
    label: "was unchanged",
    tone: "text-finhand-neutral",
    toneSoft: "bg-finhand-canvas-muted",
  },
  up: {
    Icon: ArrowUpRight,
    label: "rose",
    tone: "text-finhand-income",
    toneSoft: "bg-finhand-income-soft",
  },
};

function formatRate(rateTenThousandths: number) {
  const whole = Math.floor(rateTenThousandths / 10_000);
  const fraction = String(rateTenThousandths % 10_000).padStart(4, "0");
  return `R$ ${whole}.${fraction}`;
}
function formatChange(changeBasisPoints: number) {
  const absolute = Math.abs(changeBasisPoints);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  const sign = changeBasisPoints > 0 ? "+" : changeBasisPoints < 0 ? "−" : "";
  return `${sign}${whole}.${fraction}%`;
}

function formatQuoteDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

function chartPoints(history: DollarQuotation[]) {
  const values = history.map(({ rateTenThousandths }) => rateTenThousandths);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = maximum - minimum;
  const width = 300;
  const height = 68;
  const inset = 6;
  const usableWidth = width - inset * 2;
  const usableHeight = height - inset * 2;

  return history.map((quote, index) => ({
    ...quote,
    x:
      history.length === 1
        ? width / 2
        : inset + (index * usableWidth) / (history.length - 1),
    y:
      spread === 0
        ? height / 2
        : inset +
          ((maximum - quote.rateTenThousandths) * usableHeight) / spread,
  }));
}

function DollarHistoryChart({
  history,
  trend,
}: {
  history: DollarQuotation[];
  trend: DollarTrend;
}) {
  const points = chartPoints(history);
  const tone = trendDetails[trend].tone;

  return (
    <div className="mt-4">
      <svg
        aria-hidden="true"
        className={`h-[4.25rem] w-full overflow-visible ${tone}`}
        preserveAspectRatio="none"
        viewBox="0 0 300 68"
      >
        <path
          className="stroke-finhand-border"
          d="M 0 34 H 300"
          fill="none"
          strokeDasharray="3 5"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          fill="none"
          points={points.map(({ x, y }) => `${x},${y}`).join(" ")}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
        {points.map(({ date, x, y }) => (
          <circle
            className="fill-white stroke-current"
            cx={x}
            cy={y}
            key={date}
            r="3"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div className="mt-2 grid grid-cols-7 gap-1" aria-hidden="true">
        {history.map((quote) => (
          <div className="min-w-0 text-center" key={quote.date}>
            <p className="truncate text-[0.6rem] font-semibold uppercase text-finhand-subtle">
              {formatQuoteDate(quote.date)}
            </p>
            <p className="mt-0.5 truncate text-[0.62rem] font-bold tabular-nums text-finhand-neutral">
              {formatRate(quote.rateTenThousandths).replace("R$ ", "")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DollarMarketIndicatorView({
  snapshot,
}: {
  snapshot: DollarMarketSnapshot;
}) {
  const { Icon, label, tone, toneSoft } = trendDetails[snapshot.trend];
  const movement = `${formatChange(snapshot.changeBasisPoints)} from the previous quotation`;
  const accessibleLabel = `USD to BRL selling rate ${formatRate(snapshot.current.rateTenThousandths)}, ${label} ${movement}`;

  return (
    <div className="group relative ml-auto">
      <button
        aria-label={`${accessibleLabel}. Focus or hover to see the last seven quotations.`}
        className="flex min-h-10 items-center gap-2.5 rounded-lg border border-finhand-border bg-white px-3 py-1.5 text-left shadow-finhand-card transition hover:border-finhand-accent-border hover:bg-finhand-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finhand-focus focus-visible:ring-offset-2"
        type="button"
      >
        <CircleDollarSign
          aria-hidden="true"
          className="size-4 text-finhand-interactive"
        />
        <span>
          <span className="block text-[0.6rem] font-bold uppercase tracking-[0.08em] text-finhand-subtle">
            USD / BRL
          </span>
          <span className="block text-sm font-bold tabular-nums text-finhand-ink">
            {formatRate(snapshot.current.rateTenThousandths)}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`grid size-7 place-items-center rounded-lg ${toneSoft} ${tone}`}
        >
          <Icon className="size-4" />
        </span>
      </button>

      <div
        className="invisible absolute right-0 top-full z-50 mt-2 w-[min(23rem,calc(100vw-2rem))] translate-y-1 rounded-2xl border border-finhand-border bg-white p-4 opacity-0 shadow-xl shadow-slate-950/10 transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 motion-reduce:transform-none motion-reduce:transition-none"
        role="tooltip"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-finhand-subtle">
              Last 7 market days
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-finhand-ink">
              {formatRate(snapshot.current.rateTenThousandths)}
            </p>
            <p className="mt-0.5 text-xs text-finhand-muted">
              BCB selling rate · {formatQuoteDate(snapshot.current.date)}
            </p>
          </div>
          <div className={`flex items-center gap-1 rounded-lg px-2 py-1 ${toneSoft} ${tone}`}>
            <Icon aria-hidden="true" className="size-3.5" />
            <span className="text-xs font-bold tabular-nums">
              {formatChange(snapshot.changeBasisPoints)}
            </span>
          </div>
        </div>

        <DollarHistoryChart history={snapshot.history} trend={snapshot.trend} />

        <ul className="sr-only">
          {snapshot.history.map((quote) => (
            <li key={quote.date}>
              {formatQuoteDate(quote.date)}: {formatRate(quote.rateTenThousandths)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function DollarMarketIndicator() {
  const [state, setState] = useState<DollarMarketState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    getDollarMarketSnapshot({ signal: controller.signal })
      .then((snapshot) => setState({ snapshot, status: "ready" }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error" });
      });

    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return (
      <div
        aria-label="Loading USD to BRL quotation"
        className="ml-auto h-12 w-40 animate-pulse rounded-lg bg-finhand-canvas-muted"
      />
    );
  }

  if (state.status === "error") {
    return (
      <div className="ml-auto flex h-10 items-center gap-2 text-xs font-semibold text-finhand-subtle">
        <CircleDollarSign aria-hidden="true" className="size-4" />
        USD quotation unavailable
      </div>
    );
  }

  return <DollarMarketIndicatorView snapshot={state.snapshot} />;
}
