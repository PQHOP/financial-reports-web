// Quarterly earnings scorecards: every system report for one fiscal
// year/period label, grouped by sector, summarized from Report.metrics only.
// No model calls — every figure is one already published in a report.
import type { ReportPeriod } from "@/generated/prisma/client";
import { prismaCached as prisma } from "@/lib/prisma";
import { systemReports } from "@/lib/community";
import { readMetrics, type EarningsQuality, type ReportMetrics } from "@/lib/metrics";
import { median, periodRank } from "@/lib/peers";

// The "reported vs underlying" section needs this many labelled reports
// before it says anything about the season.
export const MIN_QUALITY_ENTRIES = 5;
const QUALITY_LIST = 8;
const GAP_LIST = 10;

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

// Earnings-quality verdicts across the period's labelled reports, plus the
// reports where GAAP and adjusted EPS differ most (gap as % of adjusted EPS;
// positive = GAAP above adjusted, i.e. one-off gains in the reported figure).
export type QualitySummary = {
  total: number;
  counts: Record<EarningsQuality, number>;
  flattered: ScorecardEntry[];
  understated: ScorecardEntry[];
  gaps: { entry: ScorecardEntry; gapPct: number }[];
};

export type Scorecard = {
  year: number;
  period: ReportPeriod;
  count: number;
  overall: Omit<SectorScore, "name" | "slug" | "top" | "bottom">;
  sectors: SectorScore[];
  topOverall: ScorecardEntry[];
  bottomOverall: ScorecardEntry[];
  quality: QualitySummary;
  // When the newest report in this scorecard was published: the page says
  // so, since the table is rebuilt from every new report through the season.
  updatedAt: Date | null;
};

function qualitySummary(entries: ScorecardEntry[]): QualitySummary {
  const counts: Record<EarningsQuality, number> = { clean: 0, flattered: 0, understated: 0 };
  const labelled = entries.filter((e) => e.m.earningsQuality);
  for (const e of labelled) counts[e.m.earningsQuality!] += 1;
  const gaps = entries
    .flatMap((entry) => {
      const { epsDiluted, epsAdjusted } = entry.m;
      if (epsDiluted === undefined || epsAdjusted === undefined || epsAdjusted === 0) return [];
      return [{ entry, gapPct: ((epsDiluted - epsAdjusted) / Math.abs(epsAdjusted)) * 100 }];
    })
    .sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct))
    .slice(0, GAP_LIST);
  return {
    total: labelled.length,
    counts,
    flattered: labelled.filter((e) => e.m.earningsQuality === "flattered").slice(0, QUALITY_LIST),
    understated: labelled.filter((e) => e.m.earningsQuality === "understated").slice(0, QUALITY_LIST),
    gaps,
  };
}

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
      publishedAt: true,
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
  let updatedAt: Date | null = null;
  for (const r of rows) {
    const m = readMetrics(r.metrics);
    const sector = r.company.industries.find((i) => i.slug !== UNCATEGORIZED_SLUG);
    if (!m || !sector) continue;
    if (!updatedAt || r.publishedAt > updatedAt) updatedAt = r.publishedAt;
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
    quality: qualitySummary(all),
    updatedAt,
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

// The scorecard for the reporting period the newest result from one of the
// given companies belongs to (hot list / S&P 500: the season's bellwethers),
// falling back to the newest scorecard. `availableScorecards()[0]` alone
// would pick "Full Year 2026" (odd-fiscal-year companies) in October.
export async function seasonScorecard(
  tickers: string[]
): Promise<{ year: number; period: ReportPeriod; count: number } | null> {
  const [cards, newest] = await Promise.all([
    availableScorecards(),
    prisma.report.findFirst({
      where: { ...systemReports, company: { ticker: { in: tickers } } },
      orderBy: { publishedAt: "desc" },
      select: { year: true, period: true },
    }),
  ]);
  return (
    (newest && cards.find((c) => c.year === newest.year && c.period === newest.period)) ??
    cards[0] ??
    null
  );
}
