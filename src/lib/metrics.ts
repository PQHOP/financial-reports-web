// Structured headline figures stored on Report.metrics. Everything is optional
// so a report can carry whatever the filing actually reports (a bank has no
// meaningful "operating margin", a pre-revenue company has no revenue growth).
// Money amounts are in millions of `currency`; percentages are plain numbers
// (12.5 means 12.5%).
export type ReportMetrics = {
  currency?: string;
  revenue?: number;
  revenueYoyPct?: number;
  netIncome?: number;
  netIncomeYoyPct?: number;
  epsDiluted?: number;
  epsYoyPct?: number;
  operatingMarginPct?: number;
};

const NUMERIC_KEYS = [
  "revenue",
  "revenueYoyPct",
  "netIncome",
  "netIncomeYoyPct",
  "epsDiluted",
  "epsYoyPct",
  "operatingMarginPct",
] as const;

// Returns the cleaned metrics, null for "no metrics", or an error string.
export function parseMetricsInput(
  raw: string
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
  const result = parseMetricsInput(JSON.stringify(value));
  return "metrics" in result ? result.metrics : null;
}

export function formatMoneyMillions(millions: number, currency = "USD"): string {
  const symbol = currency === "USD" ? "$" : `${currency} `;
  const abs = Math.abs(millions);
  const sign = millions < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}T`;
  if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}B`;
  return `${sign}${symbol}${abs.toFixed(0)}M`;
}

export function formatPct(value: number, withSign = true): string {
  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

// One-line "Revenue $94.9B (+6.0%) · EPS $1.65" style string for cards/social.
export function metricsHeadline(m: ReportMetrics): string {
  const parts: string[] = [];
  if (m.revenue !== undefined) {
    parts.push(
      `Revenue ${formatMoneyMillions(m.revenue, m.currency)}${
        m.revenueYoyPct !== undefined ? ` (${formatPct(m.revenueYoyPct)})` : ""
      }`
    );
  }
  if (m.epsDiluted !== undefined) {
    parts.push(
      `EPS ${m.currency && m.currency !== "USD" ? m.currency + " " : "$"}${m.epsDiluted.toFixed(2)}${
        m.epsYoyPct !== undefined ? ` (${formatPct(m.epsYoyPct)})` : ""
      }`
    );
  }
  return parts.join(" · ");
}
