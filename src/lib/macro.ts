// Indicator definitions for /economy, shared by the data script
// (scripts/fetch-macro.ts) and the page. Values come from the IMF World
// Economic Outlook via its DataMapper API.

// "up-good": a higher value is better (growth, budget surplus).
// "up-bad": a higher value is worse (debt, unemployment).
// "target": closer to `target` is better (inflation vs a ~2% goal).
// "neutral": direction carries no verdict (current account).
export type Polarity = "up-good" | "up-bad" | "target" | "neutral";

export type Indicator = {
  code: string;
  label: string;
  short: string;
  unit: string;
  polarity: Polarity;
  target?: number;
  // Year-over-year change is shown as a % change for dollar levels and as a
  // percentage-point difference for rates.
  changeAs: "pct" | "pp";
  format: "pct" | "pctSigned" | "usdBn" | "usd";
  // Map classes: `breaks.length + 1` colors, low to high.
  breaks: number[];
  colors: string[];
  legendNote: string;
};

// Diverging blue <-> red with a neutral gray midpoint (CVD-safe, unlike
// red <-> green). Blue = healthier, red = weaker, for every indicator.
const R4 = "#8f1f1e";
const R3 = "#c93836";
const R2 = "#ec7c79";
const R1 = "#f8c3c0";
const MID = "#e7e5df";
const DEFLATION = "#a8a69c";
const B1 = "#b7d3f6";
const B2 = "#6da7ec";
const B3 = "#2a78d6";
const B4 = "#104281";
// Sequential blue for pure size (no good/bad reading).
const SEQ = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#104281"];
const SEQ7 = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

export const DIVERGING = { R4, R3, R2, R1, MID, B1, B2, B3, B4 };
export const NO_DATA = "#f4f3ef";

export const INDICATORS: Indicator[] = [
  {
    code: "NGDP_RPCH",
    label: "Real GDP growth",
    short: "GDP growth",
    unit: "% per year",
    polarity: "up-good",
    changeAs: "pp",
    format: "pct",
    breaks: [-3, -1, 0, 1, 2.5, 4, 6],
    colors: [R4, R3, R2, R1, B1, B2, B3, B4],
    legendNote: "Growth after inflation. Red = shrinking or weak, blue = strong.",
  },
  {
    code: "PCPIPCH",
    label: "Inflation (consumer prices)",
    short: "Inflation",
    unit: "% per year",
    polarity: "target",
    target: 2,
    changeAs: "pp",
    format: "pct",
    breaks: [0, 1, 3, 5, 8, 15, 30],
    // Gray = falling prices; darkest blue = the 1-3% band around the ~2% most
    // central banks target; lighter blue on either side; red = high.
    colors: [DEFLATION, B1, B4, B2, R1, R2, R3, R4],
    legendNote: "Average price rise. Darkest blue = near the ~2% most central banks aim for; red = high inflation; gray = prices falling.",
  },
  {
    code: "GGXWDG_NGDP",
    label: "Government debt",
    short: "Gov. debt",
    unit: "% of GDP",
    polarity: "up-bad",
    changeAs: "pp",
    format: "pct",
    breaks: [30, 50, 70, 90, 120],
    colors: [B4, B2, B1, R1, R2, R4],
    legendNote: "Total government borrowing as a share of the economy's yearly output.",
  },
  {
    code: "GGXCNL_NGDP",
    label: "Government budget balance",
    short: "Budget balance",
    unit: "% of GDP",
    polarity: "up-good",
    changeAs: "pp",
    format: "pct",
    breaks: [-9, -6, -3, -1, 1, 3],
    colors: [R4, R3, R2, R1, MID, B2, B4],
    legendNote: "Revenue minus spending. Negative = deficit (red), positive = surplus (blue).",
  },
  {
    code: "LUR",
    label: "Unemployment rate",
    short: "Unemployment",
    unit: "% of labor force",
    polarity: "up-bad",
    changeAs: "pp",
    format: "pct",
    breaks: [3, 5, 7, 10, 15],
    colors: [B4, B2, B1, R1, R2, R4],
    legendNote: "Share of people looking for work who can't find it. IMF covers ~120 countries.",
  },
  {
    code: "BCA_NGDPD",
    label: "Current account balance",
    short: "Current account",
    unit: "% of GDP",
    polarity: "neutral",
    changeAs: "pp",
    format: "pct",
    breaks: [-8, -4, -1, 1, 4, 8],
    colors: [R3, R2, R1, MID, B1, B2, B3],
    legendNote: "Trade and income flows with the rest of the world. Negative = the country borrows from abroad.",
  },
  {
    code: "NGDPD",
    label: "GDP (size of the economy)",
    short: "GDP",
    unit: "US$ billions",
    polarity: "up-good",
    changeAs: "pct",
    format: "usdBn",
    breaks: [10, 50, 200, 1000, 5000],
    colors: SEQ,
    legendNote: "Total output in current US dollars — moves with exchange rates as well as real growth.",
  },
  {
    code: "NGDPDPC",
    label: "GDP per person",
    short: "GDP/person",
    unit: "US$",
    polarity: "up-good",
    changeAs: "pct",
    format: "usd",
    breaks: [2000, 5000, 12000, 25000, 50000],
    colors: SEQ,
    legendNote: "Output divided by population, in current US dollars — a rough gauge of living standards.",
  },
];

// The "Latest" view: the most recent monthly/quarterly/daily figure per
// country (src/lib/macroLive.ts), falling back to the IMF annual number
// where a country publishes nothing more recent.
export const LIVE_INDICATORS: Indicator[] = [
  {
    ...INDICATORS[1],
    code: "L_CPI",
    label: "Inflation, latest month",
    unit: "% vs a year earlier",
    legendNote:
      "How much prices rose over the past 12 months, as of each country's latest release. Darkest blue = near the ~2% most central banks aim for; red = high inflation; gray = prices falling.",
  },
  {
    ...INDICATORS[0],
    code: "L_GDPQ",
    label: "GDP growth, latest quarter",
    unit: "% vs the same quarter a year earlier",
    legendNote: "Growth after inflation in the latest reported quarter, compared with a year before. Red = shrinking or weak, blue = strong.",
  },
  {
    ...INDICATORS[4],
    code: "L_UNEMP",
    label: "Unemployment, latest",
    legendNote: "Share of people looking for work who can't find it, latest month or quarter.",
  },
  {
    code: "L_POLICY",
    label: "Central bank policy rate",
    short: "Policy rate",
    unit: "% per year",
    polarity: "neutral",
    changeAs: "pp",
    format: "pct",
    breaks: [1, 2.5, 4, 6, 10, 20],
    colors: SEQ7,
    legendNote:
      "The interest rate the central bank sets, which steers borrowing costs across the economy. Higher = tighter money. Euro area countries share the ECB's rate.",
  },
  {
    code: "L_BOND",
    label: "10-year government bond yield",
    short: "10Y yield",
    unit: "% per year",
    polarity: "neutral",
    changeAs: "pp",
    format: "pct",
    breaks: [2, 3, 4, 5, 7, 10],
    colors: SEQ7,
    legendNote: "What the government pays to borrow for about ten years, monthly average. Higher = markets want more to lend to it.",
  },
  {
    code: "L_FX",
    label: "Currency vs US dollar, this year",
    short: "Currency YTD",
    unit: "% change since Dec 31",
    polarity: "up-good",
    changeAs: "pp",
    format: "pctSigned",
    breaks: [-20, -10, -4, -1, 1, 4, 10],
    colors: [R4, R3, R2, R1, MID, B1, B3, B4],
    legendNote: "How much the local currency has gained (blue) or lost (red) against the dollar since the start of the year, at today's rate.",
  },
];

export const AGGREGATES: { code: string; label: string }[] = [
  { code: "WEOWORLD", label: "World" },
  { code: "ADVEC", label: "Advanced economies" },
  { code: "MAE", label: "G7" },
  { code: "OEMDC", label: "Emerging & developing" },
  { code: "EURO", label: "Euro area" },
  { code: "EU", label: "European Union" },
  { code: "DA", label: "Emerging & developing Asia" },
  { code: "AS5", label: "ASEAN-5" },
  { code: "EDE", label: "Emerging & developing Europe" },
  { code: "WE", label: "Latin America & Caribbean" },
  { code: "MECA", label: "Middle East & Central Asia" },
  { code: "SSA", label: "Sub-Saharan Africa" },
];

export type MacroData = {
  source: string;
  fetchedAt: string;
  years: number[];
  countries: { code: string; name: string; region: string; iso2?: string; currency?: string }[];
  aggregates: string[];
  series: Record<string, Record<string, (number | null)[]>>;
};

export type MapData = {
  width: number;
  height: number;
  shapes: { code: string; name: string; d: string }[];
};

export function formatValue(v: number | null | undefined, ind: Indicator): string {
  if (v == null) return "–";
  if (ind.format === "usdBn") {
    if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 1 : 2)}T`;
    return `$${v >= 100 ? v.toFixed(0) : v.toFixed(1)}B`;
  }
  if (ind.format === "usd") return `${Math.round(v).toLocaleString("en-US")}`;
  if (ind.format === "pctSigned") return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
  if (ind.code === "L_POLICY" || ind.code === "L_BOND") return `${v.toFixed(2)}%`;
  return `${v.toFixed(1)}%`;
}

// Change between two values in the indicator's own terms.
export function change(cur: number | null, prev: number | null, ind: Indicator): number | null {
  if (cur == null || prev == null) return null;
  if (ind.changeAs === "pct") return prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;
  return cur - prev;
}

// Interest rates move in quarter points, so they keep two decimals.
export function changeDecimals(ind: Indicator): number {
  return ind.code === "L_POLICY" || ind.code === "L_BOND" ? 2 : 1;
}

export function formatChange(delta: number | null, ind: Indicator): string {
  if (delta == null) return "–";
  const abs = Math.abs(delta).toFixed(changeDecimals(ind));
  const sign = Number(abs) === 0 ? "±" : delta > 0 ? "+" : "−";
  return ind.changeAs === "pct" ? `${sign}${abs}%` : `${sign}${abs} pt`;
}

// +1 = the move is an improvement, -1 = a deterioration, 0 = no verdict.
export function verdict(cur: number | null, prev: number | null, ind: Indicator): -1 | 0 | 1 {
  if (cur == null || prev == null) return 0;
  const eps = ind.changeAs === "pct" ? Math.abs(prev) * 0.005 : 0.05;
  if (Math.abs(cur - prev) < eps) return 0;
  switch (ind.polarity) {
    case "up-good":
      return cur > prev ? 1 : -1;
    case "up-bad":
      return cur < prev ? 1 : -1;
    case "target": {
      const t = ind.target ?? 0;
      const d = Math.abs(prev - t) - Math.abs(cur - t);
      return Math.abs(d) < 0.05 ? 0 : d > 0 ? 1 : -1;
    }
    default:
      return 0;
  }
}

export function levelColor(v: number | null | undefined, ind: Indicator): string {
  if (v == null) return NO_DATA;
  let i = 0;
  while (i < ind.breaks.length && v >= ind.breaks[i]) i++;
  return ind.colors[i];
}

// Map color in "change" mode: blue = improved, red = worsened, scaled by size.
export function changeColor(cur: number | null, prev: number | null, ind: Indicator): string {
  const delta = change(cur, prev, ind);
  if (delta == null) return NO_DATA;
  const v = verdict(cur, prev, ind);
  const size = Math.abs(ind.polarity === "target" ? Math.abs(prev! - ind.target!) - Math.abs(cur! - ind.target!) : delta);
  const steps = ind.changeAs === "pct" ? [2, 5, 10] : [0.5, 1.5, 3];
  const level = steps.filter((s) => size >= s).length; // 0..3
  if (v === 0 && ind.polarity !== "neutral") return MID;
  // Neutral indicators: blue = rose, red = fell, no verdict implied.
  const up = ind.polarity === "neutral" ? delta > 0 : v > 0;
  if (ind.polarity === "neutral" && Math.abs(delta) < 0.05) return MID;
  return (up ? [B1, B2, B3, B4] : [R1, R2, R3, R4])[level];
}

export const CHANGE_LEGEND = [R4, R3, R2, R1, MID, B1, B2, B3, B4];
