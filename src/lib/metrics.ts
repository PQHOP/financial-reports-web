// Structured headline figures stored on Report.metrics. Everything is optional
// so a report can carry whatever the filing actually reports (a bank has no
// meaningful "operating margin", a pre-revenue company has no revenue growth).
// Money amounts are in millions of `currency`; percentages are plain numbers
// (12.5 means 12.5%).
//
// Banks and insurers are judged on different figures than other companies,
// so they get their own optional fields. Which ones a report carries decides
// its `metricsProfile`, and with it the columns shown in the company history
// table and the industry peer tables.
export type ReportMetrics = {
  currency?: string;
  revenue?: number;
  revenueYoyPct?: number;
  netIncome?: number;
  netIncomeYoyPct?: number;
  epsDiluted?: number;
  epsYoyPct?: number;
  operatingMarginPct?: number;

  // Banks
  netInterestIncome?: number;
  netInterestIncomeYoyPct?: number;
  netInterestMarginPct?: number;
  totalLoans?: number;
  totalDeposits?: number;
  efficiencyRatioPct?: number;
  netChargeOffRatioPct?: number;
  cet1RatioPct?: number;
  rotcePct?: number;

  // Insurers
  netPremiumsWritten?: number;
  netPremiumsWrittenYoyPct?: number;
  combinedRatioPct?: number;
  lossRatioPct?: number;
  catastropheLosses?: number;
  bookValuePerShare?: number;
  bookValuePerShareYoyPct?: number;
};

const NUMERIC_KEYS = [
  "revenue",
  "revenueYoyPct",
  "netIncome",
  "netIncomeYoyPct",
  "epsDiluted",
  "epsYoyPct",
  "operatingMarginPct",
  "netInterestIncome",
  "netInterestIncomeYoyPct",
  "netInterestMarginPct",
  "totalLoans",
  "totalDeposits",
  "efficiencyRatioPct",
  "netChargeOffRatioPct",
  "cet1RatioPct",
  "rotcePct",
  "netPremiumsWritten",
  "netPremiumsWrittenYoyPct",
  "combinedRatioPct",
  "lossRatioPct",
  "catastropheLosses",
  "bookValuePerShare",
  "bookValuePerShareYoyPct",
] as const;

// Returns the cleaned metrics, null for "no metrics", or an error string.
export function parseMetricsInput(
  raw: string,
  strict = true
): { metrics: ReportMetrics | null } | { error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { metrics: null };

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { error: "Metrics must be valid JSON (or left empty)." };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { error: "Metrics must be a JSON object." };
  }

  const source = data as Record<string, unknown>;
  // Reject unknown keys on input: a typo ("nimPct") would otherwise be
  // dropped silently and the figure would never show up anywhere.
  if (strict) {
    const known = new Set<string>([...NUMERIC_KEYS, "currency"]);
    const unknown = Object.keys(source).filter((key) => !known.has(key));
    if (unknown.length > 0) {
      return { error: `Unknown metrics field(s): ${unknown.join(", ")}.` };
    }
  }
  const out: ReportMetrics = {};
  for (const key of NUMERIC_KEYS) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { error: `Metrics field "${key}" must be a number.` };
    }
    out[key] = value;
  }
  if (typeof source.currency === "string" && /^[A-Z]{3}$/.test(source.currency)) {
    out.currency = source.currency;
  }
  return { metrics: Object.keys(out).length > 0 ? out : null };
}

// Read-side: Report.metrics comes back as JsonValue, so re-validate shape.
export function readMetrics(value: unknown): ReportMetrics | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const result = parseMetricsInput(JSON.stringify(value), false);
  return "metrics" in result ? result.metrics : null;
}

export function formatMoneyMillions(millions: number, currency = "USD"): string {
  const symbol = currency === "USD" ? "$" : `${currency} `;
  const abs = Math.abs(millions);
  const sign = millions < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}T`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}B`;
  // Small companies: "$365K" / "$2.9M" rather than rounding to "$0M" / "$3M".
  if (abs < 1) return `${sign}${symbol}${Math.round(abs * 1_000)}K`;
  if (abs < 10) return `${sign}${symbol}${abs.toFixed(1)}M`;
  return `${sign}${symbol}${abs.toFixed(0)}M`;
}

export function formatPct(value: number, withSign = true): string {
  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}


export type MetricsProfile = "general" | "bank" | "insurer";

export function metricsProfile(m: ReportMetrics): MetricsProfile {
  if (m.netInterestMarginPct !== undefined || m.netInterestIncome !== undefined) {
    return "bank";
  }
  if (m.combinedRatioPct !== undefined || m.netPremiumsWritten !== undefined) {
    return "insurer";
  }
  return "general";
}

function formatPerShare(value: number, currency?: string): string {
  const prefix = currency && currency !== "USD" ? `${currency} ` : "$";
  return `${prefix}${value.toFixed(2)}`;
}

// One figure as rendered in tables and the figures strip; `change` is its
// year-over-year change when the report carries one.
export type MetricColumn = {
  label: string;
  short: string;
  value: (m: ReportMetrics) => string | undefined;
  change?: (m: ReportMetrics) => string | undefined;
};

type NumericKey = (typeof NUMERIC_KEYS)[number];

function yoy(key: NumericKey) {
  return (m: ReportMetrics) => (m[key] !== undefined ? formatPct(m[key]) : undefined);
}

function money(key: NumericKey, label: string, short: string, change?: NumericKey): MetricColumn {
  return {
    label,
    short,
    value: (m) => (m[key] !== undefined ? formatMoneyMillions(m[key], m.currency) : undefined),
    change: change ? yoy(change) : undefined,
  };
}

function perShare(key: NumericKey, label: string, short: string, change?: NumericKey): MetricColumn {
  return {
    label,
    short,
    value: (m) => (m[key] !== undefined ? formatPerShare(m[key], m.currency) : undefined),
    change: change ? yoy(change) : undefined,
  };
}

function pct(key: NumericKey, label: string, short: string, signed = false, digits = 1): MetricColumn {
  return {
    label,
    short,
    value: (m) => {
      const v = m[key];
      if (v === undefined) return undefined;
      return `${signed && v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
    },
  };
}

export const METRIC_COLUMNS = {
  revenue: money("revenue", "Revenue", "Revenue", "revenueYoyPct"),
  revenueYoy: pct("revenueYoyPct", "Revenue YoY", "Rev. YoY", true),
  netIncome: money("netIncome", "Net income", "Net income", "netIncomeYoyPct"),
  eps: perShare("epsDiluted", "Diluted EPS", "Diluted EPS", "epsYoyPct"),
  epsYoy: pct("epsYoyPct", "EPS YoY", "EPS YoY", true),
  operatingMargin: pct("operatingMarginPct", "Operating margin", "Op. margin"),

  netInterestIncome: money("netInterestIncome", "Net interest income", "NII", "netInterestIncomeYoyPct"),
  netInterestIncomeYoy: pct("netInterestIncomeYoyPct", "Net interest income YoY", "NII YoY", true),
  netInterestMargin: pct("netInterestMarginPct", "Net interest margin", "NIM", false, 2),
  totalLoans: money("totalLoans", "Total loans", "Loans"),
  totalDeposits: money("totalDeposits", "Total deposits", "Deposits"),
  efficiencyRatio: pct("efficiencyRatioPct", "Efficiency ratio", "Efficiency"),
  // Charge-off ratios are small; two decimals keep 0.45% from reading 0.5%.
  netChargeOffRatio: pct("netChargeOffRatioPct", "Net charge-off ratio", "NCO ratio", false, 2),
  cet1Ratio: pct("cet1RatioPct", "CET1 capital ratio", "CET1"),
  rotce: pct("rotcePct", "Return on tangible common equity", "ROTCE"),

  netPremiumsWritten: money("netPremiumsWritten", "Net premiums written", "NPW", "netPremiumsWrittenYoyPct"),
  netPremiumsWrittenYoy: pct("netPremiumsWrittenYoyPct", "Net premiums written YoY", "NPW YoY", true),
  combinedRatio: pct("combinedRatioPct", "Combined ratio", "Combined ratio"),
  lossRatio: pct("lossRatioPct", "Loss ratio", "Loss ratio"),
  catastropheLosses: money("catastropheLosses", "Catastrophe losses", "Cat losses"),
  bookValuePerShare: perShare("bookValuePerShare", "Book value per share", "BVPS", "bookValuePerShareYoyPct"),
} satisfies Record<string, MetricColumn>;

const C = METRIC_COLUMNS;

// Per profile: the report page's figures strip, a company's results-by-period
// table, the industry peer table and its sort order, and a plain-language
// note on the industry-specific figures.
export const PROFILE_LAYOUT: Record<
  MetricsProfile,
  {
    snapshot: MetricColumn[];
    history: MetricColumn[];
    peers: MetricColumn[];
    peerSort: (a: ReportMetrics, b: ReportMetrics) => number;
    peerTitle: string;
    peerSortNote: string;
    glossary?: string;
  }
> = {
  general: {
    snapshot: [C.revenue, C.netIncome, C.eps, C.operatingMargin],
    history: [C.revenue, C.revenueYoy, C.netIncome, C.eps, C.operatingMargin],
    peers: [C.revenue, C.revenueYoy, C.operatingMargin, C.epsYoy],
    peerSort: (a, b) => (b.revenueYoyPct ?? -Infinity) - (a.revenueYoyPct ?? -Infinity),
    peerTitle: "latest results side by side",
    peerSortNote: "sorted by revenue growth",
  },
  bank: {
    snapshot: [
      C.netInterestIncome,
      C.netInterestMargin,
      C.netIncome,
      C.eps,
      C.efficiencyRatio,
      C.netChargeOffRatio,
      C.cet1Ratio,
      C.rotce,
    ],
    history: [C.netInterestIncome, C.netInterestMargin, C.netIncome, C.eps, C.cet1Ratio],
    peers: [
      C.netInterestIncomeYoy,
      C.netInterestMargin,
      C.efficiencyRatio,
      C.netChargeOffRatio,
      C.cet1Ratio,
      C.epsYoy,
    ],
    peerSort: (a, b) =>
      (b.netInterestMarginPct ?? -Infinity) - (a.netInterestMarginPct ?? -Infinity),
    peerTitle: "banks compared",
    peerSortNote: "sorted by net interest margin",
    glossary:
      "Net interest margin (NIM): what a bank earns on its loans and securities minus what it pays for deposits and borrowing, as a share of those assets. Efficiency ratio: operating costs per dollar of revenue (lower is better). Net charge-off (NCO) ratio: loans written off as unrecoverable, net of recoveries, as a share of average loans. CET1: the bank's core capital cushion against losses, as a share of risk-weighted assets.",
  },
  insurer: {
    snapshot: [
      C.netPremiumsWritten,
      C.combinedRatio,
      C.netIncome,
      C.eps,
      C.lossRatio,
      C.catastropheLosses,
      C.bookValuePerShare,
    ],
    history: [C.netPremiumsWritten, C.combinedRatio, C.netIncome, C.eps, C.bookValuePerShare],
    peers: [C.netPremiumsWrittenYoy, C.combinedRatio, C.lossRatio, C.epsYoy],
    // A lower combined ratio means more profitable underwriting.
    peerSort: (a, b) => (a.combinedRatioPct ?? Infinity) - (b.combinedRatioPct ?? Infinity),
    peerTitle: "insurers compared",
    peerSortNote: "sorted by combined ratio, most profitable underwriting first",
    glossary:
      "Net premiums written (NPW): insurance sold in the period, after the share passed on to reinsurers. Combined ratio: claims plus expenses per dollar of premium earned; below 100% means the insurance business itself made money before investment income. Loss ratio: the claims part alone.",
  },
};

// One-line "Revenue $94.9B (+6.0%) · EPS $1.65" style string for cards/social.
// Banks lead with net interest income and margin, insurers with premiums and
// the combined ratio, since those are what their results are judged on.
export function metricsHeadline(m: ReportMetrics): string {
  const parts: string[] = [];
  const add = (col: MetricColumn, label = col.label) => {
    const value = col.value(m);
    if (value === undefined) return;
    const change = col.change?.(m);
    parts.push(`${label} ${value}${change ? ` (${change})` : ""}`);
  };
  const profile = metricsProfile(m);
  if (profile === "bank") {
    add(C.netInterestIncome);
    add(C.netInterestMargin, "NIM");
  } else if (profile === "insurer") {
    add(C.netPremiumsWritten, "Premiums written");
    add(C.combinedRatio);
  } else {
    add(C.revenue);
  }
  add(C.eps, "EPS");
  return parts.join(" · ");
}
