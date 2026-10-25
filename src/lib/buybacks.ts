// /buybacks: who returned the most cash to shareholders in the current
// reporting period, and where a shrinking share count did the work in EPS
// growth. Built from Report.metrics only (shareRepurchases, dividendsPaid,
// dilutedSharesYoyPct, epsYoyPct) — no model calls.
import type { ReportPeriod } from "@/generated/prisma/client";
import { prismaCached as prisma } from "@/lib/prisma";
import { systemReports } from "@/lib/community";
import { readMetrics, type ReportMetrics } from "@/lib/metrics";
import { periodRank } from "@/lib/peers";

// The page only says something about a period once this many reports carry
// buyback figures; fewer and the "top 10" would just be everyone.
export const MIN_BUYBACK_ENTRIES = 5;
const LOOKBACK_DAYS = 120;
const LIST = 10;

export type BuybackEntry = {
  id: string;
  year: number;
  period: ReportPeriod;
  summary: string;
  company: { name: string; ticker: string | null; slug: string };
  m: ReportMetrics;
};

export type Buybacks = {
  year: number;
  period: ReportPeriod;
  count: number;
  totalRepurchases: number;
  totalDividends: number;
  countShrinking: number;
  topRepurchases: BuybackEntry[];
  topShrink: BuybackEntry[];
  // EPS grew while the share count shrank: how much of the growth the lower
  // count alone explains, biggest share first.
  epsFromBuybacks: { entry: BuybackEntry; sharePct: number }[];
};

const hasCapital = (m: ReportMetrics) =>
  m.shareRepurchases !== undefined || m.dividendsPaid !== undefined || m.dilutedSharesYoyPct !== undefined;

export async function buildBuybacks(): Promise<Buybacks | null> {
  const rows = await prisma.report.findMany({
    where: {
      ...systemReports,
      publishedAt: { gte: new Date(Date.now() - LOOKBACK_DAYS * 86_400_000) },
      metrics: { not: { equals: null } },
    },
    select: {
      id: true,
      year: true,
      period: true,
      summary: true,
      metrics: true,
      company: { select: { name: true, ticker: true, slug: true } },
    },
  });

  const byPeriod = new Map<string, BuybackEntry[]>();
  for (const r of rows) {
    const m = readMetrics(r.metrics);
    if (!m || !hasCapital(m)) continue;
    const key = `${r.year}:${r.period}`;
    const entry: BuybackEntry = { id: r.id, year: r.year, period: r.period, summary: r.summary, company: r.company, m };
    byPeriod.set(key, [...(byPeriod.get(key) ?? []), entry]);
  }
  // The newest period with enough entries; a company's odd fiscal calendar
  // shouldn't pull the page onto "Full Year 2026" in October.
  const candidates = [...byPeriod.values()]
    .filter((entries) => entries.length >= MIN_BUYBACK_ENTRIES)
    .sort((a, b) => b.length - a.length || periodRank(b[0]) - periodRank(a[0]));
  const entries = candidates[0];
  if (!entries) return null;

  const repurchasers = entries.filter((e) => (e.m.shareRepurchases ?? 0) > 0);
  const shrinking = entries.filter((e) => (e.m.dilutedSharesYoyPct ?? 0) < 0);
  const epsFromBuybacks = shrinking
    .flatMap((entry) => {
      const eps = entry.m.epsYoyPct;
      const shares = entry.m.dilutedSharesYoyPct!;
      if (eps === undefined || eps <= 0) return [];
      // With N% fewer shares, EPS rises by about N/(100-N)% before any change
      // in net income; that over EPS growth is the share buybacks explain.
      const lift = (-shares / (100 + shares)) * 100;
      return [{ entry, sharePct: Math.min(100, (lift / eps) * 100) }];
    })
    .sort((a, b) => b.sharePct - a.sharePct)
    .slice(0, LIST);

  return {
    year: entries[0].year,
    period: entries[0].period,
    count: entries.length,
    totalRepurchases: repurchasers.reduce((s, e) => s + e.m.shareRepurchases!, 0),
    totalDividends: entries.reduce((s, e) => s + (e.m.dividendsPaid ?? 0), 0),
    countShrinking: shrinking.length,
    topRepurchases: [...repurchasers]
      .sort((a, b) => b.m.shareRepurchases! - a.m.shareRepurchases!)
      .slice(0, LIST),
    topShrink: [...shrinking]
      .sort((a, b) => a.m.dilutedSharesYoyPct! - b.m.dilutedSharesYoyPct!)
      .slice(0, LIST),
    epsFromBuybacks,
  };
}
