import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ReportContent } from "@/components/ReportContent";
import { ReportCard } from "@/components/ReportCard";
import { systemReports } from "@/lib/community";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { articleKindLabels, articlePath } from "@/lib/articles";
import type { Article } from "@/generated/prisma/client";

export async function ArticleView({ article }: { article: Article }) {
  // Link the piece to the analyses of the companies it names.
  const related =
    article.tickers.length === 0
      ? []
      : await prisma.report.findMany({
          where: { ...systemReports, company: { ticker: { in: article.tickers } } },
          orderBy: { publishedAt: "desc" },
          take: 4,
          include: { company: { select: { name: true, ticker: true } } },
        });

  const url = `${SITE_URL}${articlePath(article.kind, article.slug)}`;
  const sectionPath = article.kind === "GUIDE" ? "/learn" : "/insights";
  const sectionName = article.kind === "GUIDE" ? "Learn" : "Insights";

  return (
    <article className="flex flex-col gap-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": article.kind === "NEWS" ? "NewsArticle" : "Article",
              headline: article.title,
              description: article.summary,
              ...(article.tickers.length > 0
                ? { keywords: article.tickers.join(", ") }
                : {}),
              datePublished: article.publishedAt.toISOString(),
              dateModified: article.updatedAt.toISOString(),
              author: { "@type": "Person", name: "Claude" },
              publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
              mainEntityOfPage: url,
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: sectionName, item: `${SITE_URL}${sectionPath}` },
                { "@type": "ListItem", position: 3, name: article.title, item: url },
              ],
            },
          ],
        }}
      />
      <div>
        <Link href={sectionPath} className="text-sm text-zinc-500 hover:underline">
          ← {sectionName}
        </Link>
        <p className="mt-2 text-sm font-medium text-zinc-500">
          {articleKindLabels[article.kind]}
        </p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight">{article.title}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Published{" "}
          {article.publishedAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })}
        </p>
        <p className="mt-3 text-base text-zinc-700">{article.summary}</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <ReportContent markdown={article.contentMd} />
      </div>

      {related.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Related analyses</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {related.map((report) => (
              <li key={report.id}>
                <ReportCard report={report} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-zinc-500">
        For information only; not investment advice.{" "}
        <Link href="/methodology" className="underline">Methodology</Link>
      </p>
    </article>
  );
}
