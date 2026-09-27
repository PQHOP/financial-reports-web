// Quarterly earnings scorecards: every system report for one fiscal
// year/period label, grouped by sector, summarized from Report.metrics only.
// No model calls — every figure is one already published in a report.
import type { ReportPeriod } from "@/generated/prisma/client";
import { prismaCached as prisma } from "@/lib/prisma";
import { systemReports } from "@/lib/community";
import { readMetrics, type ReportMetrics } from "@/lib/metrics";
import { median, periodRank } from "@/lib/peers";

const UNCATEGORIZED_SLUG = "uncategorized";
// A scorecard page only exists once this many sector-classified companies
// have figures for the period (CLAUDE.md: "≥20 companies ... same quarter").
export const MIN_SCORECARD_COMPANIES = 20;
// Sectors with fewer companies still get a summary row, but no leaders list.
const MIN_SECTOR_FOR_MOVERS = 4;
const MOVERS = 3;

export type ScorecardEntry = {
  id: string;
  year: number;
  period: ReportPeriod;
  summary: string;
  company: { name: string; ticker: string | null; slug: string };
  m: ReportMetrics;
};

export type SectorScore = {
  name: string;
  slug: string;
  count: number;
  medianRevenueGrowth: number | null;
  medianOperatingMargin: number | null;
  medianEpsGrowth: number | null;
  shareGrowingRevenue: number | null; // 0..100
  top: ScorecardEntry[];
  bottom: ScorecardEntry[];
};

export type Scorecard = {
  year: number;
  period: ReportPeriod;
  count: number;
  overall: Omit<SectorScore, "name" | "slug" | "top" | "bottom">;
  sectors: SectorScore[];
  topOverall: ScorecardEntry[];
  bottomOverall: ScorecardEntry[];
};

function nums(entries: ScorecardEntry[], key: keyof ReportMetrics): number[] {
  return entries.map((e) => e.m[key]).filter((v): v is number => typeof v === "number");
}

function stats(entries: ScorecardEntry[]) {
  const growth = nums(entries, "revenueYoyPct");
  return {
    count: entries.length,
    medianRevenueGrowth: median(growth),
    // Banks report no operating margin, so this is over the companies that do.
    medianOperatingMargin: median(nums(entries, "operatingMarginPct")),
    medianEpsGrowth: median(nums(entries, "epsYoyPct")),
    shareGrowingRevenue:
      growth.length > 0 ? (growth.filter((g) => g > 0).length / growth.length) * 100 : null,
  };
}

function byRevenueGrowth(entries: ScorecardEntry[]): ScorecardEntry[] {
  return entries
    .filter((e) => typeof e.m.revenueYoyPct === "number")
    .sort((a, b) => b.m.revenueYoyPct! - a.m.revenueYoyPct!);
}

export async function buildScorecard(year: number, period: ReportPeriod): Promise<Scorecard | null> {
  const rows = await prisma.report.findMany({
    where: {
      ...systemReports,
      year,
      period,
      company: { industries: { some: { NOT: { slug: UNCATEGORIZED_SLUG } } } },
    },
    select: {
      id: true,
      year: true,
      period: true,
      summary: true,
      metrics: true,
      company: {
        select: {
          name: true,
          ticker: true,
          slug: true,
          industries: { select: { name: true, slug: true } },
        },
      },
    },
  });

  const bySector = new Map<string, { name: string; slug: string; entries: ScorecardEntry[] }>();
  const all: ScorecardEntry[] = [];
  for (const r of rows) {
    const m = readMetrics(r.metrics);
    const sector = r.company.industries.find((i) => i.slug !== UNCATEGORIZED_SLUG);
    if (!m || !sector) continue;
    const entry: ScorecardEntry = {
      id: r.id,
      year: r.year,
      period: r.period,
      summary: r.summary,
      company: { name: r.company.name, ticker: r.company.ticker, slug: r.company.slug },
      m,
    };
    all.push(entry);
    const bucket = bySector.get(sector.slug) ?? { ...sector, entries: [] };
    bucket.entries.push(entry);
    bySector.set(sector.slug, bucket);
  }
  if (all.length < MIN_SCORECARD_COMPANIES) return null;

  const sectors: SectorScore[] = [...bySector.values()]
    .map(({ name, slug, entries }) => {
      const ranked = byRevenueGrowth(entries);
      const showMovers = ranked.length >= MIN_SECTOR_FOR_MOVERS;
      return {
        name,
        slug,
        ...stats(entries),
        top: showMovers ? ranked.slice(0, MOVERS) : [],
        bottom: showMovers ? ranked.slice(-MOVERS).reverse() : [],
      };
    })
    .sort((a, b) => (b.medianRevenueGrowth ?? -Infinity) - (a.medianRevenueGrowth ?? -Infinity));

  const ranked = byRevenueGrowth(all);
  return {
    year,
    period,
    count: all.length,
    overall: stats(all),
    sectors,
    topOverall: ranked.slice(0, 10),
    bottomOverall: ranked.slice(-10).reverse(),
  };
}

// Year/period labels that have enough sector-classified reports for a page
// (counted before the metrics check, so buildScorecard can still say no).
export async function availableScorecards(): Promise<{ year: number; period: ReportPeriod; count: number }[]> {
  const groups = await prisma.report.groupBy({
    by: ["year", "period"],
    where: {
      ...systemReports,
      company: { industries: { some: { NOT: { slug: UNCATEGORIZED_SLUG } } } },
    },
    _count: { _all: true },
  });
  return groups
    .filter((g) => g._count._all >= MIN_SCORECARD_COMPANIES)
    .map((g) => ({ year: g.year, period: g.period, count: g._count._all }))
    .sort((a, b) => periodRank(b) - periodRank(a));
}
