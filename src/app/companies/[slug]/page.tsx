import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { ReportCard } from "@/components/ReportCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { communityReports, parseSource, systemReports } from "@/lib/community";
import { periodLabels, periodOrder } from "@/lib/period";
import { reportPath } from "@/lib/reportPath";
import { SITE_URL } from "@/lib/site";
import { takeaway, truncate } from "@/lib/markdown";
import { formatFilingDate, upcomingFiling } from "@/lib/tracker";
import {
  metricsHeadline,
  metricsProfile,
  PROFILE_LAYOUT,
  readMetrics,
} from "@/lib/metrics";
import type { ReportPeriod } from "@/generated/prisma/client";
import { cleanCompanyName } from "@/lib/companyName";

export const dynamic = "force-dynamic";

const DESCRIPTION_MAX = 155;

const rank = (r: { year: number; period: ReportPeriod }) =>
  r.year * 10 + periodOrder.indexOf(r.period);

// System reports, most recent fiscal period first (not publish order: a
// backfilled 2024 annual shouldn't read as the "latest" results).
const getCompany = cache(async (slug: string) => {
  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      industries: true,
      reports: { where: systemReports },
    },
  });
  if (!company) return null;
  company.reports.sort((a, b) => rank(b) - rank(a));
  return company;
});

function displayName(company: { name: string; ticker: string | null }) {
  return company.ticker ? `${cleanCompanyName(company.name)} (${company.ticker})` : cleanCompanyName(company.name);
}

function periodShort(r: { year: number; period: ReportPeriod }) {
  return r.period === "ANNUAL" ? `FY${r.year}` : `${r.period} ${r.year}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) return {};

  const name = displayName(company);
  const latest = company.reports[0];
  const next = await upcomingFiling(company.ticker);
  // What people search is "<company> earnings" and "<company> earnings date";
  // the title answers both when we have a confirmed date. An estimated date
  // stays on the page, labelled, but out of the search snippet.
  const nextPart =
    next?.confidence === "confirmed"
      ? `, Next Report ${formatFilingDate(next.estimate).replace(/, \d{4}$/, "")}`
      : "";
  const title = latest
    ? `${name} Earnings: ${periodShort(latest)} Results${nextPart || " & Analysis"}`
    : `${name} Earnings & Financial Report Analysis`;
  // Lead with the latest report's own one-line finding: a concrete sentence
  // earns more clicks than a generic "browse reports" blurb.
  const description = latest
    ? truncate(`${name} ${periodShort(latest)}: ${latest.summary}`, DESCRIPTION_MAX)
    : `Financial report analysis for ${name}, ${company.country}${
        company.exchange ? ` · ${company.exchange}` : ""
      }.`;

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: `/companies/${company.slug}`,
    },
    openGraph: { title, description },
    // ~5,500 directory pages have no analysis yet; keeping them out of the
    // index avoids thousands of near-empty pages diluting the site.
    ...(company.reports.length === 0
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ source?: string }>;
}) {
  const { slug } = await params;
  const source = parseSource((await searchParams).source);

  const company = await getCompany(slug);
  if (!company) notFound();

  const [community, next] = await Promise.all([
    prisma.report.findMany({
      where: { companyId: company.id, ...communityReports },
      orderBy: [{ year: "desc" }, { publishedAt: "desc" }],
    }),
    upcomingFiling(company.ticker),
  ]);
  const system = company.reports;
  const shown = source === "community" ? community : system;
  const sourceQuery = source === "community" ? "?source=community" : "";
  const companyHref = `/companies/${company.slug}`;
  const primaryIndustry = company.industries.find((i) => i.slug !== "uncategorized");

  const latest = system[0];
  const latestMetrics = latest ? readMetrics(latest.metrics) : null;
  const latestTakeaway = latest ? takeaway(latest.contentMd) : null;
  const history = system
    .map((r) => ({ report: r, metrics: readMetrics(r.metrics) }))
    .filter((row) => row.metrics);
  // A bank's or insurer's table uses its industry's figures; the latest
  // period decides, so an older report without them just shows dashes.
  const historyLayout =
    PROFILE_LAYOUT[history.length > 0 ? metricsProfile(history[0].metrics!) : "general"];

  const years = Array.from(new Set(shown.map((r) => r.year))).sort((a, b) => b - a);

  return (
    <div className="flex flex-col gap-6">
      {system.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Corporation",
            name: cleanCompanyName(company.name),
            url: `${SITE_URL}${companyHref}`,
            ...(company.ticker ? { tickerSymbol: company.ticker } : {}),
            address: { "@type": "PostalAddress", addressCountry: company.country },
          }}
        />
      )}

      <div>
        <Breadcrumbs
          items={[
            ...(primaryIndustry
              ? [{ name: primaryIndustry.name, href: `/industries/${primaryIndustry.slug}` }]
              : []),
            { name: cleanCompanyName(company.name), href: companyHref },
          ]}
        />
        <h1 className="mt-2 text-2xl font-semibold">
          {cleanCompanyName(company.name)}
          {company.ticker && (
            <span className="ml-2 text-lg text-zinc-500">({company.ticker})</span>
          )}{" "}
          earnings
        </h1>
        <p className="text-sm text-zinc-500">
          {company.country}
          {company.exchange ? ` · ${company.exchange}` : ""}
          {company.industries
            .filter((i) => i.slug !== "uncategorized")
            .map((industry) => (
              <span key={industry.id}>
                {" · "}
                <Link href={`/industries/${industry.slug}`} className="hover:underline">
                  {industry.name}
                </Link>
              </span>
            ))}
        </p>
      </div>

      {source === "system" && (latest || next) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {latest && (
            <Link
              href={reportPath({ ...latest, company })}
              className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 sm:col-span-2"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Latest results · {periodLabels[latest.period]} {latest.year}
              </span>
              {latestMetrics && (
                <span className="font-semibold">{metricsHeadline(latestMetrics)}</span>
              )}
              <span className="line-clamp-4 text-sm text-zinc-700 sm:line-clamp-none">
                {latestTakeaway ?? latest.summary}
              </span>
              <span className="mt-1 text-sm font-medium text-blue-700">
                Read the full analysis →
              </span>
            </Link>
          )}
          {next && (
            <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950">
              <span className="text-xs font-medium uppercase tracking-wide text-blue-800">
                Next earnings report
              </span>
              <span className="text-lg font-semibold">
                {formatFilingDate(next.estimate)}
              </span>
              <span className="text-sm">
                {next.type}
                {" · "}
                {next.confidence === "confirmed"
                  ? "Confirmed date"
                  : "Estimated from past filing dates"}
              </span>
              <Link href="/earnings" className="mt-1 text-sm underline">
                Earnings calendar
              </Link>
            </div>
          )}
        </div>
      )}

      {source === "system" && history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">{cleanCompanyName(company.name)} results by period</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Period</th>
                  {historyLayout.history.map((col) => (
                    <th key={col.label} className="px-3 py-2 text-right font-semibold">
                      {col.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(({ report, metrics: m }) => (
                  <tr key={report.id} className="border-t border-zinc-100">
                    <td className="whitespace-nowrap px-3 py-2">
                      <Link
                        href={reportPath({ ...report, company })}
                        className="text-blue-700 hover:underline"
                      >
                        {periodLabels[report.period]} {report.year}
                      </Link>
                    </td>
                    {historyLayout.history.map((col) => (
                      <td key={col.label} className="px-3 py-2 text-right tabular-nums">
                        {col.value(m!) ?? "–"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500">
            Figures as reported in each period&apos;s filing; YoY compares with
            the same period a year earlier. Money in the reporting currency.
            {historyLayout.glossary ? ` ${historyLayout.glossary}` : ""}
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Report source" className="flex gap-2 text-sm">
          <Link
            href={companyHref}
            aria-current={source === "system" ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 ${
              source === "system"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white hover:border-zinc-400"
            }`}
          >
            Our analysis ({system.length})
          </Link>
          <Link
            href={`${companyHref}?source=community`}
            aria-current={source === "community" ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 ${
              source === "community"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white hover:border-zinc-400"
            }`}
          >
            Community ({community.length})
          </Link>
        </nav>
        <Link
          href={`${companyHref}/write`}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Write your own report
        </Link>
      </div>

      {source === "community" && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          These reports are written by visitors, not by us. We review
          submissions before they appear but do not verify their figures. Check
          the linked filing and see{" "}
          <Link href="/methodology" className="underline">
            how we produce our own analyses
          </Link>
          .
        </p>
      )}

      {shown.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-medium">
            {source === "community"
              ? `Community reports on ${cleanCompanyName(company.name)}`
              : `${cleanCompanyName(company.name)} earnings analyses`}
          </h2>
          <ul className="flex flex-col gap-3">
            {shown.map((report) => (
              <li key={report.id}>
                <ReportCard report={{ ...report, company }} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-zinc-500">
          {source === "community"
            ? "No community reports for this company yet. Be the first to write one."
            : "No analysis for this company yet."}
        </p>
      )}

      {years.length > 1 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-zinc-600">By fiscal year</h2>
          <ul className="flex flex-wrap gap-2">
            {years.map((year) => (
              <li key={year}>
                <Link
                  href={`${companyHref}/${year}${sourceQuery}`}
                  className="block rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm hover:border-zinc-400"
                >
                  {year}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
