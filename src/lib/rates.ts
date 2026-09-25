// Central bank rates by country, for /rates and /rates/<slug>. Built from the
// same daily snapshot as /economy (src/lib/macroLive.ts): BIS policy rates
// (daily, ~38 central banks), IMF monthly policy rates for the rest, CPI
// inflation, and 10-year government bond yields. No figure here is typed in
// by hand; only the central bank names are.
import type { MacroData } from "./macro";
import { EURO_AREA, periodEnd, type LiveData, type LiveSeries, type Point } from "./macroLive";
import { fmtPeriod } from "./macroCells";

export const EURO_SLUG = "euro-area";

// Names for the banks with a well-known English name; others fall back to
// "the central bank".
const CENTRAL_BANKS: Record<string, string> = {
  EURO: "European Central Bank",
  USA: "Federal Reserve",
  GBR: "Bank of England",
  JPN: "Bank of Japan",
  CAN: "Bank of Canada",
  AUS: "Reserve Bank of Australia",
  NZL: "Reserve Bank of New Zealand",
  CHE: "Swiss National Bank",
  SWE: "Sveriges Riksbank",
  NOR: "Norges Bank",
  DNK: "Danmarks Nationalbank",
  ISL: "Central Bank of Iceland",
  CHN: "People's Bank of China",
  HKG: "Hong Kong Monetary Authority",
  KOR: "Bank of Korea",
  IND: "Reserve Bank of India",
  IDN: "Bank Indonesia",
  MYS: "Bank Negara Malaysia",
  PHL: "Bangko Sentral ng Pilipinas",
  THA: "Bank of Thailand",
  BRA: "Central Bank of Brazil",
  ARG: "Central Bank of Argentina",
  MEX: "Bank of Mexico",
  CHL: "Central Bank of Chile",
  COL: "Central Bank of Colombia",
  PER: "Central Reserve Bank of Peru",
  CZE: "Czech National Bank",
  HUN: "Hungarian National Bank",
  POL: "National Bank of Poland",
  ROU: "National Bank of Romania",
  SRB: "National Bank of Serbia",
  MKD: "National Bank of North Macedonia",
  RUS: "Bank of Russia",
  TUR: "Central Bank of the Republic of Türkiye",
  ISR: "Bank of Israel",
  SAU: "Saudi Central Bank",
  KWT: "Central Bank of Kuwait",
  QAT: "Qatar Central Bank",
  JOR: "Central Bank of Jordan",
  MAR: "Bank Al-Maghrib",
  ZAF: "South African Reserve Bank",
  EGY: "Central Bank of Egypt",
  NGA: "Central Bank of Nigeria",
  KEN: "Central Bank of Kenya",
  GHA: "Bank of Ghana",
  AGO: "National Bank of Angola",
  BGD: "Bangladesh Bank",
  NPL: "Nepal Rastra Bank",
  UZB: "Central Bank of Uzbekistan",
  GEO: "National Bank of Georgia",
  ARM: "Central Bank of Armenia",
  AZE: "Central Bank of Azerbaijan",
  MDA: "National Bank of Moldova",
  BLR: "National Bank of the Republic of Belarus",
  ALB: "Bank of Albania",
};

export type RateMove = { period: string; from: number; to: number };

export type RateRow = {
  slug: string;
  // ISO3 country code, or "EURO" for the euro area.
  code: string;
  name: string;
  bank: string | null;
  region: string;
  rate: number;
  // Date ("2026-09-22") for daily sources, month ("2026-08") otherwise.
  asOf: string;
  source: string;
  // The most recent move within the past year.
  lastMove: RateMove | null;
  // Rate now minus the month-end rate a year earlier, in percentage points.
  change12m: number | null;
  cpi: { value: number; period: string } | null;
  // Policy rate minus the latest 12-month inflation rate.
  realRate: number | null;
  bond: { value: number; period: string } | null;
  // Month-end history, plus the latest daily figure when it's newer.
  hist: Point[];
  // Every month-to-month change in `hist`, newest first.
  moves: RateMove[];
  gdpUsdBn: number | null;
  members?: string[];
};

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ageDays(period: string, today: string): number {
  const start = period.length === 7 ? `${period}-01` : period;
  return (Date.parse(today) - Date.parse(start)) / 86400_000;
}

// Same freshness rule as /economy: a rate last reported ~9 months ago is no
// longer "the current rate".
function isFresh(period: string, today: string, maxDays = 290): boolean {
  return ageDays(period.slice(0, 7), today) <= maxDays;
}

function moves(hist: Point[]): RateMove[] {
  const out: RateMove[] = [];
  for (let i = 1; i < hist.length; i++) {
    if (Math.abs(hist[i][1] - hist[i - 1][1]) >= 0.01) {
      out.push({ period: hist[i][0], from: hist[i - 1][1], to: hist[i][1] });
    }
  }
  return out.reverse();
}

function latestPoint(s: LiveSeries | undefined, today: string): { value: number; period: string } | null {
  const last = s?.hist[s.hist.length - 1];
  if (!last || !isFresh(last[0], today)) return null;
  return { value: last[1], period: last[0] };
}

function buildRow(opts: {
  code: string;
  name: string;
  region: string;
  series: LiveSeries;
  cpi: LiveSeries | undefined;
  bond: LiveSeries | undefined;
  gdp: number | null;
  today: string;
  members?: string[];
}): RateRow | null {
  const { series: s, today } = opts;
  const lastMonth = s.hist[s.hist.length - 1];
  if (!lastMonth) return null;
  const daily = s.latest && s.latest[0] >= periodEnd(lastMonth[0]).slice(0, 7) ? s.latest : null;
  const at = daily ?? lastMonth;
  if (!isFresh(at[0], today)) return null;

  const hist = daily && daily[0].slice(0, 7) > lastMonth[0] ? [...s.hist, daily] : [...s.hist];
  const lastMove =
    s.lastChange && isFresh(s.lastChange.period, today, 365) ? s.lastChange : null;
  // Compare with the month-end rate twelve months before today, so a move
  // counted here also falls inside `lastMove`'s one-year window; fall back
  // to a year before the last reported month.
  const monthBack = (p: string) => `${Number(p.slice(0, 4)) - 1}${p.slice(4, 7)}`;
  const base =
    s.hist.find(([p]) => p === monthBack(today.slice(0, 7)))?.[1] ??
    s.hist.find(([p]) => p === monthBack(lastMonth[0]))?.[1];
  const cpi = latestPoint(opts.cpi, today);

  return {
    slug: opts.code === "EURO" ? EURO_SLUG : slugify(opts.name),
    code: opts.code,
    name: opts.name,
    bank: CENTRAL_BANKS[opts.code] ?? null,
    region: opts.region,
    rate: at[1],
    asOf: at[0],
    source: s.source,
    lastMove,
    change12m: base !== undefined ? at[1] - base : null,
    cpi,
    realRate: cpi ? at[1] - cpi.value : null,
    bond: latestPoint(opts.bond, today),
    hist,
    moves: moves(hist),
    gdpUsdBn: opts.gdp,
    members: opts.members,
  };
}

// One row per central bank: euro members share the ECB's row. Largest
// economies first, since that's the order most readers look for.
export function buildRates(weo: MacroData, live: LiveData, today: string): RateRow[] {
  const policy = live.metrics.policy ?? {};
  const gdpIndex = weo.years.indexOf(Number(today.slice(0, 4)));
  const gdp = (code: string) => weo.series.NGDPD?.[code]?.[gdpIndex] ?? null;
  const euro = new Set(EURO_AREA);
  const rows: RateRow[] = [];

  for (const c of weo.countries) {
    const s = policy[c.code];
    if (!s || euro.has(c.code)) continue;
    const row = buildRow({
      code: c.code,
      name: c.name,
      region: c.region,
      series: s,
      cpi: live.metrics.cpi?.[c.code],
      bond: live.metrics.bond?.[c.code],
      gdp: gdp(c.code),
      today,
    });
    if (row) rows.push(row);
  }

  const ecb = EURO_AREA.map((c) => policy[c]).find(Boolean);
  if (ecb) {
    const members = EURO_AREA.filter((c) => weo.countries.some((x) => x.code === c));
    const euroGdp = members.reduce((sum, c) => sum + (gdp(c) ?? 0), 0);
    const row = buildRow({
      code: "EURO",
      name: "Euro area",
      region: "Europe",
      series: ecb,
      // No euro-area aggregate in the monthly data; members are shown on
      // the euro area page instead.
      cpi: undefined,
      bond: undefined,
      gdp: euroGdp || null,
      today,
      members,
    });
    if (row) rows.push(row);
  }

  return rows.sort((a, b) => (b.gdpUsdBn ?? 0) - (a.gdpUsdBn ?? 0) || a.name.localeCompare(b.name));
}

// Proper names that read without "the" ("Norges Bank raised...").
const NO_ARTICLE = new Set([
  "NOR", "SWE", "DNK", "IDN", "MYS", "PHL", "MAR", "BGD", "NPL",
]);

// For use mid-sentence: "the Federal Reserve", "Norges Bank",
// "the central bank of Ghana".
export function bankName(row: RateRow): string {
  if (!row.bank) return `the central bank of ${row.name}`;
  return NO_ARTICLE.has(row.code) ? row.bank : `the ${row.bank}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// The Fed sets a 0.25-point target range; BIS reports its midpoint.
export function rateAt(row: RateRow, v: number): string {
  return row.code === "USA" ? `${fmtRate(v - 0.125)}–${fmtRate(v + 0.125)}` : fmtRate(v);
}

export function rateLabel(row: RateRow): string {
  return rateAt(row, row.rate);
}

// Two decimals, or three for eighth-point rates like 3.875%.
export function fmtRate(v: number): string {
  const three = v.toFixed(3);
  return `${three.endsWith("0") ? v.toFixed(2) : three}%`;
}

export function fmtYield(v: number): string {
  return `${v.toFixed(2)}%`;
}

export function fmtPp(v: number): string {
  if (Math.abs(v) < 0.005) return "±0.00 pt";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(2)} pt`;
}

export function moveKind(m: RateMove): "hike" | "cut" {
  return m.to > m.from ? "hike" : "cut";
}

export function fmtAsOf(period: string): string {
  return fmtPeriod(period);
}

// "raised its target range to 3.75%–4.00%" / "cut its rate to 5.25%".
export function describeMove(row: RateRow, m: RateMove): string {
  const verb = moveKind(m) === "hike" ? "raised" : "cut";
  if (row.code === "USA") return `${verb} its target range to ${rateAt(row, m.to)}`;
  return `${verb} its rate from ${fmtRate(m.from)} to ${fmtRate(m.to)}`;
}

export function isRecent(period: string, today: string, days: number): boolean {
  return ageDays(period.slice(0, period.length === 7 ? 7 : 10), today) <= days;
}
