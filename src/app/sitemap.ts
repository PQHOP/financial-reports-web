import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { articlePath } from "@/lib/articles";
import { systemReports } from "@/lib/community";

// Sitemaps are built at request time, not baked into the build.
export const dynamic = "force-dynamic";

const STATIC_PAGES = ["/about", "/methodology", "/corrections", "/privacy", "/contact"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only list what has real content: companies/industries with no published
  // analysis are near-empty directory pages (also `noindex`ed on the page).
  const [industries, companies, reports, articles] = await Promise.all([
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
        reports: { where: systemReports, select: { year: true } },
      },
    }),
    prisma.report.findMany({
      where: systemReports,
      select: { id: true, publishedAt: true, updatedAt: true },
    }),
    prisma.article.findMany({
      select: { slug: true, kind: true, updatedAt: true },
    }),
  ]);

  const companyYearEntries = companies.flatMap((company) => {
    const years = Array.from(new Set(company.reports.map((r) => r.year)));
    return years.map((year) => ({
      url: `${SITE_URL}/companies/${company.slug}/${year}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  });

  return [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/reports`,
      changeFrequency: "daily",
      priority: 0.9,
    },
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
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...companies.map((company) => ({
      url: `${SITE_URL}/companies/${company.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...companyYearEntries,
    ...reports.map((report) => ({
      url: `${SITE_URL}/reports/${report.id}`,
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
