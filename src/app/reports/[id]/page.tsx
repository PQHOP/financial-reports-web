import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { periodLabels, periodOrder } from "@/lib/period";
import { ReportContent } from "@/components/ReportContent";
import { ReportCard } from "@/components/ReportCard";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { realCoverImage } from "@/lib/reportMeta";
import {
  formatMoneyMillions,
  formatPct,
  readMetrics,
  type ReportMetrics,
} from "@/lib/metrics";

export const dynamic = "force-dynamic";

async function getReport(id: string) {
  return prisma.report.findUnique({
    where: { id },
    include: {
      company: { include: { industries: true } },
    },
  });
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

  return {
    title: report.title,
    description,
    alternates: {
      canonical: `/reports/${report.id}`,
    },
    openGraph: {
      type: "article",
      title: report.title,
      description,
      url,
      publishedTime: new Date(report.publishedAt).toISOString(),
      modifiedTime: new Date(report.updatedAt).toISOString(),
      authors: [report.author],
      ...(cover ? { images: [cover] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: report.title,
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
  const [companyReports, industryReports] = await Promise.all([
    prisma.report.findMany({
      where: { companyId: report.companyId, NOT: { id: report.id } },
      select: { id: true, year: true, period: true },
    }),
    // Skip the catch-all "Uncategorized" bucket so the "related" block doesn't
    // link unrelated tickers together.
    industryIds.length === 0
      ? Promise.resolve([])
      : prisma.report.findMany({
          where: {
            NOT: { companyId: report.companyId },
            company: { industries: { some: { id: { in: industryIds } } } },
          },
          orderBy: { publishedAt: "desc" },
          take: 3,
          include: { company: { select: { name: true, ticker: true } } },
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
        </p>
        <p className="mt-3 text-base text-zinc-700">{report.summary}</p>
      </div>

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
        <ReportContent markdown={report.contentMd} />
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
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
