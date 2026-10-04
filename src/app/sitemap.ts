import type { MetadataRoute } from "next";
import { prismaCached as prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { articlePath } from "@/lib/articles";
import { systemReports } from "@/lib/community";
import { isIndexableYear, reportUrl } from "@/lib/reportPath";
import { loadMacro } from "@/lib/macroStore";
import { buildRates } from "@/lib/rates";
import { availableScorecards } from "@/lib/scorecard";
import { scorecardPath } from "@/lib/scorecardPath";

// Sitemaps are built at request time, not baked into the build.
// Cached on the CDN (ISR); publishes purge it via invalidateDbCache().
export const revalidate = 3600;

const STATIC_PAGES = ["/economy", "/world-risks", "/about", "/corrections", "/privacy", "/terms", "/contact"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
        company: { select: { slug: true } },
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

  const companyYearEntries = companies.flatMap((company) => {
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
    ...companies.map((company) => ({
      url: `${SITE_URL}/companies/${company.slug}`,
      lastModified: companyLastMod.get(company.slug),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...companyYearEntries,
    ...reports.map((report) => ({
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
