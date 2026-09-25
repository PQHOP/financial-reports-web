import { reportUrl } from "@/lib/reportPath";
import { prisma } from "@/lib/prisma";
import { periodLabels } from "@/lib/period";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { articlePath } from "@/lib/articles";
import { systemReports } from "@/lib/community";

export const dynamic = "force-dynamic";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const [reports, articles] = await Promise.all([
    prisma.report.findMany({
      where: systemReports,
      orderBy: { publishedAt: "desc" },
      take: 40,
      include: { company: { select: { name: true, ticker: true, slug: true } } },
    }),
    prisma.article.findMany({
      orderBy: { publishedAt: "desc" },
      take: 20,
    }),
  ]);

  const items = [
    ...reports.map((report) => ({
      title: report.title,
      link: reportUrl(report),
      description: report.summary,
      date: report.publishedAt,
      category: `${report.company.ticker ?? report.company.name} ${periodLabels[report.period]} ${report.year}`,
    })),
    ...articles.map((article) => ({
      title: article.title,
      link: `${SITE_URL}${articlePath(article.kind, article.slug)}`,
      description: article.summary,
      date: article.publishedAt,
      category: article.kind.toLowerCase(),
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 50);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>Earnings report analyses built from SEC filings, explained in plain English.</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.link}</guid>
      <pubDate>${item.date.toUTCString()}</pubDate>
      <category>${escapeXml(item.category)}</category>
      <description>${escapeXml(item.description)}</description>
    </item>`
  )
  .join("\n")}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
