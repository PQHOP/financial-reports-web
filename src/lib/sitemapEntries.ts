import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { articlePath } from "@/lib/articles";
import { systemReports } from "@/lib/community";
import { isIndexableYear, reportUrl } from "@/lib/reportPath";
import { loadMacro } from "@/lib/macroStore";
import { buildRates } from "@/lib/rates";
import { availableScorecards } from "@/lib/scorecard";
import { scorecardPath } from "@/lib/scorecardPath";
import hotList from "../../scripts/data/priority-tickers.json";
import sp500 from "../../scripts/data/sp500.json";

// Served by src/app/sitemap.xml/route.ts, a force-dynamic Route Handler
// cached on the CDN for 10 minutes (see the note there for why not ISR).
// It reads through the plain `prisma` client on purpose: the sitemap is
// generated a handful of times an hour at most, and going through
// `prismaCached` meant the entries could lag the 15-minute data cache on
// top of the route cache. History: this was src/app/sitemap.ts (the
// metadata-file convention) until 2026-10-14, which on Next 16 ignored its
// `revalidate` export and was baked into the build as a static file, so
// every report published after a deploy was missing until the next deploy.

// Company, year and report URLs only for the hot list and the S&P 500 (since
// 2026-10-26). Googlebot reads ~17 URLs a day and had 2,297 "Discovered –
// currently not indexed"; 1,704 of the ~3,000 URLs here were small us-listed
// companies nobody searches for, competing with the MSFT/GOOGL pages people
// do. Those pages stay live and indexable (linked from industry pages); they
// just aren't advertised. Revisit once crawl is well above 100/day.
const WELL_KNOWN = new Set<string>([...hotList.tickers, ...sp500.map((c) => c.ticker)]);
const isWellKnown = (ticker: string | null) => ticker !== null && WELL_KNOWN.has(ticker);

// /buybacks joins this list once it has data (it is noindex until then).
const STATIC_PAGES = ["/red-flags", "/economy", "/world-risks", "/about", "/corrections", "/privacy", "/terms", "/contact"];

export async function buildSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  // Only list what has real content: companies/industries with no published
  // analysis are near-empty directory pages (also `noindex`ed on the page).
  const [industries, companies, reports, articles, macro, scorecards] = await Promise.all([
    prisma.industry.findMany({
      // The catch-all "uncategorized" bucket is noindex'd on the page itself.
      where: {
        companies: { some: { reports: { some: systemReports } } },
        NOT: { slug: "uncategorized" },
      },
      select: { slug: true },
    }),
    prisma.company.findMany({
      where: { reports: { some: systemReports } },
      select: {
        slug: true,
        ticker: true,
        industries: { select: { slug: true } },
        reports: { where: systemReports, select: { year: true, publishedAt: true, updatedAt: true } },
      },
    }),
    prisma.report.findMany({
      where: systemReports,
      select: {
        id: true,
        year: true,
        period: true,
        publishedAt: true,
        updatedAt: true,
        company: { select: { slug: true, ticker: true } },
      },
    }),
    prisma.article.findMany({
      select: { slug: true, kind: true, updatedAt: true },
    }),
    loadMacro(),
    availableScorecards(),
  ]);
  const rates = buildRates(macro.weo, macro.live, new Date().toISOString().slice(0, 10));
  const ratesUpdated = new Date(macro.live.updatedAt);

  // lastmod for company/industry/year pages: the most recent report that
  // feeds them, so Google has a real freshness signal instead of none.
  const reportDate = (r: { updatedAt: Date | null; publishedAt: Date }) => new Date(r.updatedAt ?? r.publishedAt);
  const maxDate = (dates: Date[]) => new Date(Math.max(...dates.map((d) => d.getTime())));

  const companyLastMod = new Map<string, Date>();
  const industryLastMod = new Map<string, Date>();
  for (const company of companies) {
    if (!company.reports.length) continue;
    const lastMod = maxDate(company.reports.map(reportDate));
    companyLastMod.set(company.slug, lastMod);
    for (const industry of company.industries) {
      const current = industryLastMod.get(industry.slug);
      if (!current || lastMod > current) industryLastMod.set(industry.slug, lastMod);
    }
  }

  const listedCompanies = companies.filter((c) => isWellKnown(c.ticker));
  const listedReports = reports.filter((r) => isWellKnown(r.company.ticker));

  const companyYearEntries = listedCompanies.flatMap((company) => {
    const perYear = new Map<number, number>();
    for (const r of company.reports) perYear.set(r.year, (perYear.get(r.year) ?? 0) + 1);
    const years = [...perYear.keys()].filter((year) =>
      isIndexableYear(perYear.get(year)!, perYear.size)
    );
    return years.map((year) => ({
      url: `${SITE_URL}/companies/${company.slug}/${year}`,
      lastModified: maxDate(company.reports.filter((r) => r.year === year).map(reportDate)),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  });

  const latestReportDate = reports.length ? maxDate(reports.map(reportDate)) : undefined;

  return [
    {
      url: SITE_URL,
      lastModified: latestReportDate,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/reports`,
      lastModified: latestReportDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/earnings`,
      lastModified: latestReportDate,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/rates`,
      lastModified: ratesUpdated,
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...rates.map((row) => ({
      url: `${SITE_URL}/rates/${row.slug}`,
      lastModified: ratesUpdated,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
    {
      url: `${SITE_URL}/scorecards`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...scorecards.map((card) => ({
      url: `${SITE_URL}${scorecardPath(card.year, card.period)}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/insights`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/learn`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...STATIC_PAGES.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
    ...industries.map((industry) => ({
      url: `${SITE_URL}/industries/${industry.slug}`,
      lastModified: industryLastMod.get(industry.slug),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...listedCompanies.map((company) => ({
      url: `${SITE_URL}/companies/${company.slug}`,
      lastModified: companyLastMod.get(company.slug),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...companyYearEntries,
    ...listedReports.map((report) => ({
      url: reportUrl(report),
      lastModified: new Date(report.updatedAt ?? report.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...articles.map((article) => ({
      url: `${SITE_URL}${articlePath(article.kind, article.slug)}`,
      lastModified: new Date(article.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
