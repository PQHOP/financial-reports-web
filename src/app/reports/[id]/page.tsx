import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getIsAdmin } from "@/lib/adminAuth";
import { communityReports, systemReports } from "@/lib/community";
import { periodLabels, periodOrder } from "@/lib/period";
import { ReportContent } from "@/components/ReportContent";
import { ReportCard } from "@/components/ReportCard";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { realCoverImage, reportSearchTitle } from "@/lib/reportMeta";
import {
  formatMoneyMillions,
  formatPct,
  readMetrics,
  type ReportMetrics,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

// A PENDING community submission is only visible to the admin reviewing it.
async function getReport(id: string) {
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      company: { include: { industries: true } },
    },
  });
  if (!report) return null;
  if (report.status !== "PUBLISHED" && !(await getIsAdmin())) return null;
  return report;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) return {};

  const description = report.summary;
  const url = `${SITE_URL}/reports/${report.id}`;
  // With no explicit `images`, Next attaches the generated card from
  // ./opengraph-image.tsx. Only a real (non-placeholder) cover overrides it.
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
    alternates: {
      canonical: `/reports/${report.id}`,
    },
    // Visitor-written pages stay out of search results (and everything
    // pending is hidden anyway); only our own analyses are indexed.
    ...(report.origin === "COMMUNITY"
      ? { robots: { index: false, follow: false } }
      : {}),
    openGraph: {
      type: "article",
      title: searchTitle,
      description,
      url,
      publishedTime: new Date(report.publishedAt).toISOString(),
      modifiedTime: new Date(report.updatedAt).toISOString(),
      authors: [report.author],
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

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const report = await getReport(id);
  if (!report) notFound();

  const industryIds = report.company.industries
    .filter((i) => i.slug !== "uncategorized")
    .map((i) => i.id);
  const isCommunity = report.origin === "COMMUNITY";
  const [companyReports, industryReports, communityCount] = await Promise.all([
    // Sibling periods come from the same side (ours or community) as this one.
    prisma.report.findMany({
      where: {
        companyId: report.companyId,
        NOT: { id: report.id },
        ...(isCommunity ? communityReports : systemReports),
      },
      select: { id: true, year: true, period: true, author: true },
    }),
    // Skip the catch-all "Uncategorized" bucket so the "related" block doesn't
    // link unrelated tickers together.
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
          include: { company: { select: { name: true, ticker: true } } },
        }),
    prisma.report.count({
      where: { companyId: report.companyId, ...communityReports },
    }),
  ]);

  const otherPeriods = [...companyReports].sort(
    (a, b) =>
      b.year - a.year ||
      periodOrder.indexOf(b.period) - periodOrder.indexOf(a.period)
  );

  const metrics = readMetrics(report.metrics);
  const cover = realCoverImage(report.coverImageUrl);
  const reportUrl = `${SITE_URL}/reports/${report.id}`;
  const primaryIndustry = report.company.industries.find(
    (i) => i.slug !== "uncategorized"
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: report.title,
        description: report.summary,
        datePublished: new Date(report.publishedAt).toISOString(),
        dateModified: new Date(report.updatedAt).toISOString(),
        author: { "@type": "Person", name: report.author },
        publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        ...(cover ? { image: [cover] } : {}),
        about: {
          "@type": "Corporation",
          name: report.company.name,
          ...(report.company.ticker ? { tickerSymbol: report.company.ticker } : {}),
        },
        ...(report.sourceUrl ? { citation: report.sourceUrl } : {}),
        mainEntityOfPage: reportUrl,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: report.company.name,
            item: `${SITE_URL}/companies/${report.company.slug}`,
          },
          { "@type": "ListItem", position: 3, name: report.title, item: reportUrl },
        ],
      },
    ],
  };

  return (
    <article className="flex flex-col gap-6">
      <JsonLd data={jsonLd} />
      <div>
        <nav className="text-sm text-zinc-500">
          <Link
            href={`/companies/${report.company.slug}`}
            className="hover:underline"
          >
            {report.company.name}
          </Link>
          {" · "}
          <Link
            href={`/companies/${report.company.slug}/${report.year}`}
            className="hover:underline"
          >
            {report.year}
          </Link>
          {primaryIndustry && (
            <>
              {" · "}
              <Link
                href={`/industries/${primaryIndustry.slug}`}
                className="hover:underline"
              >
                {primaryIndustry.name}
              </Link>
            </>
          )}
        </nav>
        <h1 className="mt-2 text-2xl font-semibold leading-tight">
          {report.title}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {periodLabels[report.period]} · Fiscal year {report.year} · Published{" "}
          {new Date(report.publishedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })}{" "}
          by {report.author}
          {isCommunity && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
              Community
            </span>
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
          <Link
            href={`/companies/${report.company.slug}`}
            className="underline"
          >
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

      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <ReportContent markdown={report.contentMd} untrusted={isCommunity} />
      </div>

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
                report.company.ticker ?? report.company.name
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

      {otherPeriods.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">
            More {report.company.name} reports
          </h2>
          <ul className="flex flex-wrap gap-2">
            {otherPeriods.map((other) => (
              <li key={other.id}>
                <Link
                  href={`/reports/${other.id}`}
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
          <Link
            href={`/companies/${report.company.slug}?source=community`}
            className="underline"
          >
            Community reports
          </Link>
        )}
        <Link
          href={`/companies/${report.company.slug}/write`}
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
