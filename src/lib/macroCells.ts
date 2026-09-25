// Turns the raw data sets into one value per country and indicator for the
// /economy tables and map, for both views. Client-safe (no server imports).
import { INDICATORS, LIVE_INDICATORS, type Indicator, type MacroData } from "./macro";
import { periodEnd, type LiveData, type LiveMetricKey, type LiveSeries } from "./macroLive";

export type Cell = {
  value: number | null;
  prev: number | null;
  // Display label for the period the value covers, e.g. "Aug 2026".
  period: string | null;
  // True when a "Latest" column had to use the IMF annual figure instead.
  fallback?: boolean;
  source?: string;
  // Replaces the default "vs previous period" wording under the value.
  deltaNote?: string;
  // Extra detail for tooltips (e.g. "25,951 VND per $").
  detail?: string;
};

export type Metric = { ind: Indicator; get: (code: string) => Cell };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtPeriod(p: string): string {
  let m = p.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
  m = p.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
  m = p.match(/^(\d{4})-Q(\d)$/);
  if (m) return `Q${m[2]} ${m[1]}`;
  return p;
}

const LIVE_KEY: Record<string, LiveMetricKey> = {
  L_CPI: "cpi",
  L_GDPQ: "gdpq",
  L_UNEMP: "unemp",
  L_POLICY: "policy",
  L_BOND: "bond",
};
// Annual IMF indicator used when a country has no recent figure.
const FALLBACK: Record<string, string> = { L_CPI: "PCPIPCH", L_GDPQ: "NGDP_RPCH", L_UNEMP: "LUR" };

// A monthly figure older than ~9 months, or a quarterly one older than a
// year, no longer counts as "latest".
function isFresh(period: string, today: string, maxDays?: number): boolean {
  const end = periodEnd(period);
  const ageDays = (Date.parse(today) - Date.parse(end.slice(0, 7) + "-01")) / 86400_000;
  return ageDays <= (maxDays ?? (period.includes("Q") ? 400 : 290));
}

function annualCell(weo: MacroData, code: string, country: string, yi: number, projectionFrom: number): Cell {
  const row = weo.series[code]?.[country];
  const year = weo.years[yi];
  return {
    value: row?.[yi] ?? null,
    prev: row?.[yi - 1] ?? null,
    period: year >= projectionFrom ? `${year} IMF forecast` : String(year),
    source: "IMF World Economic Outlook",
  };
}

export function buildMetrics(opts: {
  view: "latest" | "annual";
  weo: MacroData;
  live: LiveData;
  yi: number;
  projectionFrom: number;
  today: string;
}): Metric[] {
  const { view, weo, live, yi, projectionFrom, today } = opts;
  if (view === "annual") {
    return INDICATORS.map((ind) => ({ ind, get: (c) => annualCell(weo, ind.code, c, yi, projectionFrom) }));
  }

  const fyi = weo.years.indexOf(projectionFrom);
  const fallback = (code: string, country: string): Cell => {
    const base = FALLBACK[code];
    if (!base) return { value: null, prev: null, period: null };
    const cell = annualCell(weo, base, country, fyi, projectionFrom);
    return { ...cell, fallback: cell.value != null, period: `${projectionFrom} IMF forecast` };
  };

  const seriesCell = (code: string, s: LiveSeries | undefined, country: string): Cell => {
    const last = s?.hist[s.hist.length - 1];
    if (!s || !last || !isFresh(last[0], today)) return fallback(code, country);
    const prev = s.hist[s.hist.length - 2];
    return {
      value: last[1],
      prev: prev?.[1] ?? null,
      period: fmtPeriod(last[0]),
      source: s.source,
      deltaNote: prev ? `vs ${fmtPeriod(prev[0])}` : undefined,
    };
  };

  const policyCell = (s: LiveSeries | undefined): Cell => {
    const last = s?.hist[s.hist.length - 1];
    if (!s || !last) return { value: null, prev: null, period: null };
    const latest = s.latest && s.latest[0] >= periodEnd(last[0]).slice(0, 7) ? s.latest : null;
    const at = latest ?? last;
    if (!isFresh(at[0].slice(0, 7), today)) return { value: null, prev: null, period: null };
    // Only a move in the past year counts as "the latest decision".
    const ch = s.lastChange && isFresh(s.lastChange.period.slice(0, 7), today, 365) ? s.lastChange : undefined;
    return {
      value: at[1],
      // The last move, so the arrow shows whether the latest decision was a hike or a cut.
      prev: ch ? ch.from : at[1],
      period: fmtPeriod(at[0]),
      source: s.source,
      deltaNote: ch ? `last move ${fmtPeriod(ch.period)}` : "no change in the past year",
    };
  };

  const fxCell = (country: string): Cell => {
    const fx = live.fx[country];
    if (!fx) return { value: null, prev: null, period: null };
    const year = Number(fx.spotDate.slice(0, 4));
    const dec = fx.hist.find(([p]) => p === `${year - 1}-12`)?.[1];
    const lastEop = fx.hist[fx.hist.length - 1];
    // Rates are local currency per dollar: fewer units per dollar = a stronger currency.
    const ytd = dec ? (dec / fx.spot - 1) * 100 : null;
    const ytdAtLastMonthEnd = dec && lastEop && lastEop[0] > `${year - 1}-12` ? (dec / lastEop[1] - 1) * 100 : null;
    const per = fx.spot >= 100 ? Math.round(fx.spot).toLocaleString("en-US") : fx.spot.toPrecision(4);
    return {
      value: ytd,
      prev: ytdAtLastMonthEnd,
      period: fmtPeriod(fx.spotDate),
      source: "ExchangeRate-API; IMF month-end rates",
      deltaNote: lastEop && ytdAtLastMonthEnd != null ? `since end-${fmtPeriod(lastEop[0]).split(" ")[0]}` : undefined,
      detail: `${per} ${fx.currency} per US$`,
    };
  };

  const liveMetrics: Metric[] = LIVE_INDICATORS.map((ind) => ({
    ind,
    get: (country: string) => {
      if (ind.code === "L_FX") return fxCell(country);
      const s = live.metrics[LIVE_KEY[ind.code]]?.[country];
      return ind.code === "L_POLICY" ? policyCell(s) : seriesCell(ind.code, s, country);
    },
  }));
  // Debt has no monthly source anywhere; show the IMF figure for context.
  const debt = INDICATORS.find((i) => i.code === "GGXWDG_NGDP")!;
  return [
    ...liveMetrics,
    { ind: debt, get: (c) => ({ ...annualCell(weo, debt.code, c, fyi, projectionFrom) }) },
  ];
}

// Monthly/quarterly history for the country panel in the "Latest" view.
export function liveHistory(code: string, country: string, live: LiveData): { labels: string[]; values: number[] } | null {
  if (code === "L_FX") {
    const fx = live.fx[country];
    if (!fx?.hist.length) return null;
    const pts = [...fx.hist, [fx.spotDate, fx.spot] as [string, number]];
    return { labels: pts.map(([p]) => fmtPeriod(p)), values: pts.map(([, v]) => v) };
  }
  const key = LIVE_KEY[code];
  const s = key ? live.metrics[key]?.[country] : undefined;
  if (!s?.hist.length) return null;
  const pts = [...s.hist];
  if (s.latest && s.latest[0] > periodEnd(pts[pts.length - 1][0]).slice(0, 7)) pts.push(s.latest);
  return { labels: pts.map(([p]) => fmtPeriod(p)), values: pts.map(([, v]) => v) };
}
