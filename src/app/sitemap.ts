import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [industries, companies, reports] = await Promise.all([
    prisma.industry.findMany({ select: { slug: true } }),
    prisma.company.findMany({
      select: {
        slug: true,
        reports: { select: { year: true } },
      },
    }),
    prisma.report.findMany({
      select: { id: true, publishedAt: true },
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
      changeFrequency: "weekly",
      priority: 1,
    },
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
      lastModified: new Date(report.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
