// Peer statistics built only from figures we have already published
// (Report.metrics): where one report sits among its industry, and the
// per-sector medians/leaders behind the quarterly scorecard pages.
import type { ReportPeriod } from "@/generated/prisma/client";
import { periodOrder } from "@/lib/period";
import { metricsProfile, type MetricsProfile, type ReportMetrics } from "@/lib/metrics";

// A comparable figure: which field, how it reads, and which direction is better.
export type PeerMetric = {
  key: keyof ReportMetrics;
  label: string;
  higherIsBetter: boolean;
  // Plain-English ordinal phrase: "fastest revenue growth", "lowest efficiency ratio".
  best: string;
  digits: number;
  signed: boolean;
};

export const PEER_METRICS: Record<MetricsProfile, PeerMetric[]> = {
  general: [
    { key: "revenueYoyPct", label: "Revenue growth (YoY)", higherIsBetter: true, best: "fastest revenue growth", digits: 1, signed: true },
    { key: "operatingMarginPct", label: "Operating margin", higherIsBetter: true, best: "highest operating margin", digits: 1, signed: false },
    { key: "epsYoyPct", label: "EPS growth (YoY)", higherIsBetter: true, best: "fastest EPS growth", digits: 1, signed: true },
  ],
  bank: [
    { key: "netInterestMarginPct", label: "Net interest margin", higherIsBetter: true, best: "highest net interest margin", digits: 2, signed: false },
    { key: "efficiencyRatioPct", label: "Efficiency ratio (lower is better)", higherIsBetter: false, best: "lowest efficiency ratio", digits: 1, signed: false },
    { key: "netChargeOffRatioPct", label: "Net charge-off ratio (lower is better)", higherIsBetter: false, best: "lowest charge-off ratio", digits: 2, signed: false },
    { key: "cet1RatioPct", label: "CET1 capital ratio", higherIsBetter: true, best: "highest CET1 ratio", digits: 1, signed: false },
    { key: "epsYoyPct", label: "EPS growth (YoY)", higherIsBetter: true, best: "fastest EPS growth", digits: 1, signed: true },
  ],
  insurer: [
    { key: "combinedRatioPct", label: "Combined ratio (lower is better)", higherIsBetter: false, best: "lowest combined ratio", digits: 1, signed: false },
    { key: "netPremiumsWrittenYoyPct", label: "Premiums written growth", higherIsBetter: true, best: "fastest premium growth", digits: 1, signed: true },
    { key: "epsYoyPct", label: "EPS growth (YoY)", higherIsBetter: true, best: "fastest EPS growth", digits: 1, signed: true },
  ],
};

// Fewer peers than this and a "median" or a rank says nothing.
export const MIN_PEERS = 4;

export function formatPeerValue(metric: PeerMetric, value: number): string {
  const sign = metric.signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(metric.digits)}%`;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

export function periodRank(r: { year: number; period: ReportPeriod }): number {
  return r.year * 10 + periodOrder.indexOf(r.period);
}

type WithCompany = { companyId: string; year: number; period: ReportPeriod; metrics: ReportMetrics };

// Each company's most recent report among `rows` (callers pre-filter by year).
export function latestPerCompany<T extends WithCompany>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  for (const r of rows) {
    const current = latest.get(r.companyId);
    if (!current || periodRank(r) > periodRank(current)) latest.set(r.companyId, r);
  }
  return [...latest.values()];
}

export type PeerPoint = { value: number; label: string };

export type PeerPosition = {
  metric: PeerMetric;
  value: number;
  median: number;
  rank: number; // 1 = best
  of: number;
  // Every peer's figure (self excluded), for the distribution chart.
  points: PeerPoint[];
};

// Where `self` sits among `peers` (self included in the count) for each of its
// profile's figures. Only peers of the same profile are compared, since a
// bank's "revenue growth" and an industrial's are not like for like.
export function peerPositions(
  self: ReportMetrics,
  peers: { metrics: ReportMetrics; label: string }[]
): PeerPosition[] {
  const profile = metricsProfile(self);
  const sameProfile = peers.filter((p) => metricsProfile(p.metrics) === profile);
  return PEER_METRICS[profile].flatMap((metric) => {
    const value = self[metric.key];
    if (typeof value !== "number") return [];
    const points = sameProfile.flatMap((p) => {
      const v = p.metrics[metric.key];
      return typeof v === "number" ? [{ value: v, label: p.label }] : [];
    });
    const others = points.map((p) => p.value);
    const all = [...others, value];
    if (all.length < MIN_PEERS) return [];
    const better = others.filter((v) => (metric.higherIsBetter ? v > value : v < value)).length;
    return [{ metric, value, median: median(all)!, rank: better + 1, of: all.length, points }];
  });
}
