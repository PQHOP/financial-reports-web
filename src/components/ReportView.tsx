import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { communityReports, systemReports } from "@/lib/community";
import { periodLabels, periodOrder } from "@/lib/period";
import { ReportContent } from "@/components/ReportContent";
import { ReportCard } from "@/components/ReportCard";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EDITORIAL_AUTHOR, SITE_NAME, SITE_URL, reportByline } from "@/lib/site";
import { realCoverImage, reportSearchTitle } from "@/lib/reportMeta";
import { reportPath, reportUrl } from "@/lib/reportPath";
import { articleKindLabels, articlePath } from "@/lib/articles";
import { tableOfContents } from "@/lib/markdown";
import { formatFilingDate, upcomingFiling } from "@/lib/tracker";
import type { FullReport } from "@/lib/reportData";
import {
  formatMoneyMillions,
  formatPct,
  readMetrics,
  type ReportMetrics,
} from "@/lib/metrics";

// Shared by the canonical /companies/<slug>/<year>/<period> route and by
// /reports/<id> (community reports, and the admin's view of any report).

const MIN_TOC_HEADINGS = 3;

export function reportMetadata(report: FullReport): Metadata {
  const description = report.summary;
  const path = reportPath(report);
  // With no explicit `images`, Next attaches the generated card from the
  // route's opengraph-image.tsx. Only a real (non-placeholder) cover overrides it.
  const cover = realCoverImage(report.coverImageUrl);
  // Community submissions keep the visitor's own title so they never read
  // as our analysis.
  const searchTitle =
    report.origin === "COMMUNITY"
      ? `${report.title} (community report)`
      : reportSearchTitle(
          report.company,
          report.year,
          report.period,
          readMetrics(report.metrics)
        );

  return {
    // Absolute: the " | Financial Report Insights" suffix would push the
    // figures past where Google truncates the title.
    title: { absolute: searchTitle },
    description,
    alternates: { canonical: path },
    // Visitor-written pages stay out of search results (and everything
    // pending is hidden anyway); only our own analyses are indexed.
    ...(report.origin === "COMMUNITY"
      ? { robots: { index: false, follow: false } }
      : {}),
    openGraph: {
      type: "article",
      title: searchTitle,
      description,
      url: `${SITE_URL}${path}`,
      publishedTime: new Date(report.publishedAt).toISOString(),
      modifiedTime: new Date(report.updatedAt).toISOString(),
      authors: [reportByline(report)],
      ...(cover ? { images: [cover] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: searchTitle,
      description,
      ...(cover ? { images: [cover] } : {}),
    },
  };
}

function MetricsSnapshot({ metrics }: { metrics: ReportMetrics }) {
  const items: { label: string; value: string; change?: string }[] = [];
  if (metrics.revenue !== undefined) {
    items.push({
      label: "Revenue",
      value: formatMoneyMillions(metrics.revenue, metrics.currency),
      change:
        metrics.revenueYoyPct !== undefined
          ? formatPct(metrics.revenueYoyPct)
          : undefined,
    });
  }
  if (metrics.netIncome !== undefined) {
    items.push({
      label: "Net income",
      value: formatMoneyMillions(metrics.netIncome, metrics.currency),
      change:
        metrics.netIncomeYoyPct !== undefined
          ? formatPct(metrics.netIncomeYoyPct)
          : undefined,
    });
  }
  if (metrics.epsDiluted !== undefined) {
    const prefix =
      metrics.currency && metrics.currency !== "USD" ? `${metrics.currency} ` : "$";
    items.push({
      label: "Diluted EPS",
      value: `${prefix}${metrics.epsDiluted.toFixed(2)}`,
      change:
        metrics.epsYoyPct !== undefined ? formatPct(metrics.epsYoyPct) : undefined,
    });
  }
  if (metrics.operatingMarginPct !== undefined) {
    items.push({
      label: "Operating margin",
      value: formatPct(metrics.operatingMarginPct, false),
    });
  }
  if (items.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-3"
        >
          <dt className="text-xs text-zinc-500">{item.label}</dt>
          <dd className="mt-0.5 text-lg font-semibold">{item.value}</dd>
          {item.change && (
            <dd className="text-xs text-zinc-500">{item.change} YoY</dd>
          )}
        </div>
      ))}
    </dl>
  );
}

export async function ReportView({ report }: { report: FullReport }) {
  const primaryIndustry = report.company.industries.find(
    (i) => i.slug !== "uncategorized"
  );
  const industryIds = report.company.industries
    .filter((i) => i.slug !== "uncategorized")
    .map((i) => i.id);
  const isCommunity = report.origin === "COMMUNITY";
  const ticker = report.company.ticker;
  const [companyReports, industryReports, communityCount, related, nextFiling] =
    await Promise.all([
      // Sibling periods come from the same side (ours or community) as this one.
      prisma.report.findMany({
        where: {
          companyId: report.companyId,
          NOT: { id: report.id },
          ...(isCommunity ? communityReports : systemReports),
        },
        select: { id: true, year: true, period: true, author: true, origin: true },
      }),
      // Skip the catch-all "Uncategorized" bucket so the "related" block
      // doesn't link unrelated tickers together.
      industryIds.length === 0
        ? Promise.resolve([])
        : prisma.report.findMany({
            where: {
              ...systemReports,
              NOT: { companyId: report.companyId },
              company: { industries: { some: { id: { in: industryIds } } } },
            },
            orderBy: { publishedAt: "desc" },
            take: 3,
            include: { company: { select: { name: true, ticker: true, slug: true } } },
          }),
      prisma.report.count({
        where: { companyId: report.companyId, ...communityReports },
      }),
      // Previews, comparisons and scorecards that cover this company.
      ticker && !isCommunity
        ? prisma.article.findMany({
            where: { tickers: { has: ticker }, kind: { not: "GUIDE" } },
            orderBy: { publishedAt: "desc" },
            take: 4,
            select: { slug: true, kind: true, title: true },
          })
        : Promise.resolve([]),
      isCommunity ? Promise.resolve(null) : upcomingFiling(ticker),
    ]);

  const rank = (r: { year: number; period: FullReport["period"] }) =>
    r.year * 10 + periodOrder.indexOf(r.period);
  const otherPeriods = [...companyReports].sort((a, b) => rank(b) - rank(a));
  // "Next report" only makes sense under the company's most recent period.
  const isLatest = otherPeriods.every((other) => rank(other) < rank(report));

  const metrics = readMetrics(report.metrics);
  const cover = realCoverImage(report.coverImageUrl);
  const canonicalUrl = reportUrl(report);
  const toc = tableOfContents(report.contentMd);
  const companyHref = `/companies/${report.company.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: report.title,
    description: report.summary,
    datePublished: new Date(report.publishedAt).toISOString(),
    dateModified: new Date(report.updatedAt).toISOString(),
    author: {
      "@type": "Person",
      name: isCommunity ? report.author : EDITORIAL_AUTHOR,
      ...(isCommunity ? {} : { url: `${SITE_URL}/about` }),
    },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    ...(cover ? { image: [cover] } : {}),
    about: {
      "@type": "Corporation",
      name: report.company.name,
      url: `${SITE_URL}${companyHref}`,
      ...(ticker ? { tickerSymbol: ticker } : {}),
    },
    ...(report.sourceUrl ? { citation: report.sourceUrl } : {}),
    mainEntityOfPage: canonicalUrl,
  };

  const periodName = `${periodLabels[report.period]} ${report.year}`;

  return (
    <article className="flex flex-col gap-6">
      <JsonLd data={jsonLd} />
      <div>
        <Breadcrumbs
          items={[
            ...(primaryIndustry
              ? [{ name: primaryIndustry.name, href: `/industries/${primaryIndustry.slug}` }]
              : []),
            { name: report.company.name, href: companyHref },
            { name: String(report.year), href: `${companyHref}/${report.year}` },
            {
              name: isCommunity ? `${periodName} (community)` : periodName,
              href: reportPath(report),
            },
          ]}
        />
        <h1 className="mt-2 text-2xl font-semibold leading-tight">
          {report.title}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {periodLabels[report.period]} · Fiscal year {report.year} · Published{" "}
          <time dateTime={new Date(report.publishedAt).toISOString()}>
            {new Date(report.publishedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </time>{" "}
          by {reportByline(report)}
          {isCommunity ? (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
              Community
            </span>
          ) : (
            <>
              {" · "}
              <Link href="/methodology" className="underline">
                AI-drafted from the SEC filing
              </Link>
            </>
          )}
        </p>
        <p className="mt-3 text-base text-zinc-700">{report.summary}</p>
      </div>

      {report.status === "PENDING" && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          Pending review: visible to admins only.
        </p>
      )}

      {isCommunity && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Community report by {report.author}. Written by a visitor, not by{" "}
          {SITE_NAME}; we review submissions before they appear but do not
          verify the figures. Check them against the source filing.{" "}
          <Link href={companyHref} className="underline">
            See our own analysis of {report.company.name}
          </Link>
          .
        </p>
      )}

      {metrics && <MetricsSnapshot metrics={metrics} />}

      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt={report.title}
          className="w-full rounded-lg border border-zinc-200"
        />
      )}

      {toc.length >= MIN_TOC_HEADINGS && (
        <nav
          aria-label="In this report"
          className="rounded-lg border border-zinc-200 bg-white px-5 py-4 text-sm"
        >
          <div className="font-medium text-zinc-800">In this report</div>
          <ul className="mt-2 flex flex-col gap-1 text-zinc-600">
            {toc.map((item) => (
              <li key={item.id} className={item.level === 3 ? "pl-4" : ""}>
                <a href={`#${item.id}`} className="hover:text-zinc-900 hover:underline">
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
        <ReportContent markdown={report.contentMd} untrusted={isCommunity} />
      </div>

      {nextFiling && isLatest && (
        <aside className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <span className="font-medium">Next report: </span>
          {report.company.name}&apos;s {nextFiling.type ?? "next filing"} is{" "}
          {nextFiling.confidence === "confirmed" ? "scheduled for" : "expected around"}{" "}
          {formatFilingDate(nextFiling.estimate)}
          {nextFiling.confidence === "confirmed" ? "" : " (our estimate from past filing dates)"}.
          We analyze it after it&apos;s filed.{" "}
          <Link href="/earnings" className="underline">
            Earnings calendar
          </Link>
        </aside>
      )}

      <aside className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
        {report.sourceUrl ? (
          <p>
            <span className="font-medium text-zinc-800">Source filing: </span>
            <a
              href={report.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-blue-700 underline"
            >
              {report.sourceUrl}
            </a>
          </p>
        ) : (
          <p>
            Figures come from the company&apos;s own filings with the U.S. SEC
            (search{" "}
            <a
              href={`https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(
                ticker ?? report.company.name
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline"
            >
              EDGAR
            </a>
            ).
          </p>
        )}
        <p className="mt-2 text-xs text-zinc-500">
          This analysis is for information only and is not investment advice.{" "}
          <Link href="/methodology" className="underline">
            How we produce these reports
          </Link>{" "}
          ·{" "}
          <Link href="/corrections" className="underline">
            Report an error
          </Link>
        </p>
      </aside>

      {related.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">
            More on {report.company.name}
          </h2>
          <ul className="flex flex-col gap-2">
            {related.map((article) => (
              <li key={article.slug}>
                <Link
                  href={articlePath(article.kind, article.slug)}
                  className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm hover:border-zinc-400"
                >
                  <span className="text-xs text-zinc-500">
                    {articleKindLabels[article.kind]}
                  </span>
                  <div className="font-medium">{article.title}</div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {otherPeriods.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">
            More {report.company.name} reports
          </h2>
          <ul className="flex flex-wrap gap-2">
            {otherPeriods.map((other) => (
              <li key={other.id}>
                <Link
                  href={reportPath({ ...other, company: report.company })}
                  className="block rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm hover:border-zinc-400"
                >
                  {periodLabels[other.period]} {other.year}
                  {isCommunity && ` · ${other.author}`}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
        <span className="text-zinc-600">
          {isCommunity
            ? "Have your own take on this company?"
            : `Read ${communityCount} community ${communityCount === 1 ? "report" : "reports"} on ${report.company.name}, or write your own.`}
        </span>
        {!isCommunity && communityCount > 0 && (
          <Link href={`${companyHref}?source=community`} className="underline">
            Community reports
          </Link>
        )}
        <Link
          href={`${companyHref}/write`}
          className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white"
        >
          Write a report
        </Link>
      </section>

      {industryReports.length > 0 && primaryIndustry && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">
            Recent in {primaryIndustry.name}
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {industryReports.map((other) => (
              <li key={other.id}>
                <ReportCard report={other} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
