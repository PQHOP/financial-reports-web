// Charts built only from a report's stored `metrics` (and its peers'), drawn
// as plain HTML so they render on the server, need no chart library, and stay
// crisp at any width. Every chart repeats its figures as text, so nothing is
// conveyed by color or bar length alone.
import type { ReportPeriod } from "@/generated/prisma/client";
import { periodLabels, periodOrder } from "@/lib/period";
import {
  formatMoneyMillions,
  metricsProfile,
  type ReportMetrics,
} from "@/lib/metrics";
import { formatPeerValue, type PeerPosition } from "@/lib/peers";

// This company / this period (categorical slot 1) vs context marks (neutral).
const ACCENT = "#2a78d6";
const CONTEXT = "#a3a29b";

function formatPerShare(value: number, currency?: string): string {
  const prefix = currency && currency !== "USD" ? `${currency} ` : "$";
  return `${value < 0 ? "-" : ""}${prefix}${Math.abs(value).toFixed(2)}`;
}

type Figure = {
  label: string;
  value?: number;
  yoy?: number;
  format: (v: number) => string;
};

function comparableFigures(m: ReportMetrics): Figure[] {
  const money = (v: number) => formatMoneyMillions(v, m.currency);
  const perShare = (v: number) => formatPerShare(v, m.currency);
  const profile = metricsProfile(m);
  const lead: Figure =
    profile === "bank"
      ? { label: "Net interest income", value: m.netInterestIncome, yoy: m.netInterestIncomeYoyPct, format: money }
      : profile === "insurer"
        ? { label: "Net premiums written", value: m.netPremiumsWritten, yoy: m.netPremiumsWrittenYoyPct, format: money }
        : { label: "Revenue", value: m.revenue, yoy: m.revenueYoyPct, format: money };
  return [
    lead,
    { label: "Net income", value: m.netIncome, yoy: m.netIncomeYoyPct, format: money },
    { label: "Diluted EPS", value: m.epsDiluted, yoy: m.epsYoyPct, format: perShare },
    ...(profile === "insurer"
      ? [{ label: "Book value per share", value: m.bookValuePerShare, yoy: m.bookValuePerShareYoyPct, format: perShare }]
      : []),
  ];
}

// "This period vs the same period last year", one row per figure, each row on
// its own scale (revenue and EPS don't share units). The year-ago figure is
// implied by the reported growth rate, so a row is only drawn when both
// periods are positive; a swing from loss to profit has no meaningful bar.
export function YearOverYearChart({ metrics }: { metrics: ReportMetrics }) {
  const rows = comparableFigures(metrics).flatMap((f) => {
    if (f.value === undefined || f.yoy === undefined) return [];
    if (f.value <= 0 || f.yoy <= -100) return [];
    const prior = f.value / (1 + f.yoy / 100);
    if (!Number.isFinite(prior) || prior <= 0) return [];
    return [{ ...f, current: f.value, prior, yoy: f.yoy }];
  });
  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-medium">This period vs a year ago</h2>
        <ul className="flex gap-4 text-xs text-zinc-600">
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CONTEXT }} />
            Same period last year
          </li>
          <li className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT }} />
            This period
          </li>
        </ul>
      </div>
      <div className="flex flex-col gap-4">
        {rows.map((row) => {
          const max = Math.max(row.current, row.prior);
          const up = row.yoy >= 0;
          return (
            <div key={row.label} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-baseline justify-between gap-2 sm:w-44 sm:flex-col sm:items-start sm:gap-0">
                <span className="text-sm text-zinc-700">{row.label}</span>
                <span className="text-sm font-semibold tabular-nums text-zinc-900">
                  <span aria-hidden="true" className="mr-0.5 text-xs text-zinc-500">
                    {up ? "▲" : "▼"}
                  </span>
                  {up ? "+" : ""}
                  {row.yoy.toFixed(1)}%
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                {[
                  { key: "prior", value: row.prior, color: CONTEXT, text: "text-zinc-500", name: "Same period last year" },
                  { key: "current", value: row.current, color: ACCENT, text: "font-medium text-zinc-900", name: "This period" },
                ].map((bar) => (
                  <div
                    key={bar.key}
                    className="group flex items-center gap-2"
                    title={`${bar.name}: ${row.format(bar.value)}`}
                  >
                    <div className="h-3.5 flex-1">
                      <div
                        className="h-full rounded-r-[4px] transition-opacity group-hover:opacity-80"
                        style={{
                          width: `${Math.max((bar.value / max) * 100, 1)}%`,
                          background: bar.color,
                        }}
                      />
                    </div>
                    <span className={`w-20 text-right text-xs tabular-nums ${bar.text}`}>
                      {bar.key === "prior" ? "≈" : ""}
                      {row.format(bar.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-zinc-500">
        Year-ago figures (≈) are worked out from the growth rate the company
        reported. Each row has its own scale.
      </p>
    </section>
  );
}

function quantile(sorted: number[], q: number): number {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

// One peer figure as a dot strip: every peer a small gray dot, the median a
// dark tick, this company a larger blue dot. Extreme outliers (think +900%
// EPS growth off a tiny base) would squash everyone else into one pixel, so
// the axis spans the 5th-95th percentile plus this company and the median,
// and anything further out is pinned to the edge.
export function PeerStrip({ position, label }: { position: PeerPosition; label: string }) {
  const { metric, value, median } = position;
  const sorted = [...position.points.map((p) => p.value), value].sort((a, b) => a - b);
  let lo = Math.min(quantile(sorted, 0.05), value, median);
  let hi = Math.max(quantile(sorted, 0.95), value, median);
  if (metric.signed) {
    // Keep zero on the axis so gains and declines read at a glance.
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (hi === lo) {
    hi += 1;
    lo -= 1;
  }
  const pad = (hi - lo) * 0.04;
  lo -= pad;
  hi += pad;
  const x = (v: number) => ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * 100;
  const clippedLow = position.points.some((p) => p.value < lo);
  const clippedHigh = position.points.some((p) => p.value > hi);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative mx-1.5 h-7" role="img" aria-label={`${metric.label}: ${label} ${formatPeerValue(metric, value)}, peer median ${formatPeerValue(metric, median)}`}>
        <div className="absolute inset-x-0 top-1/2 h-px bg-zinc-200" />
        {metric.signed && lo < 0 && hi > 0 && (
          <div
            className="absolute top-1 bottom-1 w-px bg-zinc-300"
            style={{ left: `${x(0)}%` }}
            title="0%"
          />
        )}
        {position.points.map((p, i) => (
          <div
            key={`${p.label}-${i}`}
            className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 hover:z-10 hover:scale-150 hover:opacity-100"
            style={{ left: `${x(p.value)}%`, background: CONTEXT }}
            title={`${p.label}: ${formatPeerValue(metric, p.value)}`}
          />
        ))}
        <div
          className="absolute top-0.5 bottom-0.5 w-0.5 -translate-x-1/2 rounded-full bg-zinc-700"
          style={{ left: `${x(median)}%` }}
          title={`Peer median: ${formatPeerValue(metric, median)}`}
        />
        <div
          className="absolute top-1/2 z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
          style={{ left: `${x(value)}%`, background: ACCENT }}
          title={`${label}: ${formatPeerValue(metric, value)}`}
        />
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-zinc-400">
        <span>{clippedLow ? "≤ " : ""}{formatPeerValue(metric, lo + pad)}</span>
        <span>{clippedHigh ? "≥ " : ""}{formatPeerValue(metric, hi - pad)}</span>
      </div>
    </div>
  );
}

export function PeerStripLegend({ label }: { label: string }) {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-zinc-600">
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full" style={{ background: ACCENT }} />
        {label}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-0.5 rounded-full bg-zinc-700" />
        Peer median
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: CONTEXT }} />
        Each peer (hover for name)
      </li>
    </ul>
  );
}

type TrendRow = { year: number; period: ReportPeriod; metrics: ReportMetrics; href: string };

// A company's headline figure across the periods we've published. Quarters
// and full years aren't comparable in size, so quarters are used when there
// are at least two, otherwise full years; one period alone isn't a trend.
export function PeriodTrendChart({ rows }: { rows: TrendRow[] }) {
  if (rows.length === 0) return null;
  const profile = metricsProfile(rows[0].metrics);
  const pick = (m: ReportMetrics) =>
    profile === "bank" ? m.netInterestIncome : profile === "insurer" ? m.netPremiumsWritten : m.revenue;
  const title =
    profile === "bank" ? "Net interest income" : profile === "insurer" ? "Net premiums written" : "Revenue";

  const usable = rows.filter((r) => {
    const v = pick(r.metrics);
    return typeof v === "number" && v > 0;
  });
  const quarters = usable.filter((r) => r.period !== "ANNUAL");
  const annual = usable.filter((r) => r.period === "ANNUAL");
  const byYear = quarters.length < 2;
  const series = (byYear ? annual : quarters)
    .slice()
    .sort((a, b) => a.year - b.year || periodOrder.indexOf(a.period) - periodOrder.indexOf(b.period))
    .slice(-12);
  if (series.length < 2) return null;

  const currency = series[series.length - 1].metrics.currency;
  const max = Math.max(...series.map((r) => pick(r.metrics)!));

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4">
      <h2 className="text-base font-medium">
        {title} by {byYear ? "fiscal year" : "period"}
      </h2>
      <div className="flex h-44 items-end gap-2 border-b border-zinc-200 pt-5">
        {series.map((r, i) => {
          const v = pick(r.metrics)!;
          const last = i === series.length - 1;
          const name = `${r.period === "ANNUAL" ? "FY" : periodLabels[r.period]} ${r.year}`;
          return (
            <a
              key={`${r.year}-${r.period}`}
              href={r.href}
              className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              title={`${name}: ${formatMoneyMillions(v, currency)}`}
            >
              <span
                className={`mb-1 whitespace-nowrap text-[11px] tabular-nums ${last ? "font-medium text-zinc-900" : "text-zinc-500"}`}
              >
                {formatMoneyMillions(v, currency)}
              </span>
              <div
                className="w-full max-w-12 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                style={{ height: `${(v / max) * 82}%`, background: last ? ACCENT : CONTEXT, minHeight: 2 }}
              />
            </a>
          );
        })}
      </div>
      <div className="flex gap-2">
        {series.map((r) => (
          <span key={`${r.year}-${r.period}`} className="min-w-0 flex-1 truncate text-center text-[11px] text-zinc-500">
            {r.period === "ANNUAL" ? "FY" : r.period} {String(r.year).slice(2)}
          </span>
        ))}
      </div>
    </section>
  );
}
