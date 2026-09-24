import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ReportCard } from "@/components/ReportCard";
import { communityReports, parseSource, systemReports } from "@/lib/community";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      industries: true,
      _count: { select: { reports: { where: systemReports } } },
      reports: {
        where: systemReports,
        orderBy: { publishedAt: "desc" },
        take: 1,
        select: { summary: true },
      },
    },
  });
  if (!company) return {};

  const name = company.ticker
    ? `${company.name} (${company.ticker})`
    : company.name;
  const title = `${name} Earnings & Financial Report Analysis`;
  // Lead with the latest report's own one-line finding: a concrete sentence
  // earns more clicks than a generic "browse reports" blurb.
  const latest = company.reports[0];
  const description = latest
    ? `Latest ${name} results: ${latest.summary}`
    : `Financial report analysis for ${name}, ${company.country}${
        company.exchange ? ` · ${company.exchange}` : ""
      }.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/companies/${company.slug}`,
    },
    openGraph: { title, description },
    // ~5,500 directory pages have no analysis yet; keeping them out of the
    // index avoids thousands of near-empty pages diluting the site.
    ...(company._count.reports === 0
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

  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      industries: true,
      reports: {
        where: source === "community" ? communityReports : systemReports,
        orderBy: [{ year: "desc" }, { publishedAt: "desc" }],
      },
    },
  });

  if (!company) notFound();

  // The other view's count, for the tab label.
  const otherCount = await prisma.report.count({
    where: {
      companyId: company.id,
      ...(source === "community" ? systemReports : communityReports),
    },
  });
  const systemCount = source === "system" ? company.reports.length : otherCount;
  const communityCount =
    source === "community" ? company.reports.length : otherCount;
  const sourceQuery = source === "community" ? "?source=community" : "";

  const years = Array.from(new Set(company.reports.map((r) => r.year))).sort(
    (a, b) => b - a
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← Industries
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {company.name}
          {company.ticker && (
            <span className="ml-2 text-lg text-zinc-500">
              ({company.ticker})
            </span>
          )}
        </h1>
        <p className="text-sm text-zinc-500">
          {company.country}
          {company.exchange ? ` · ${company.exchange}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {company.industries.map((industry) => (
            <Link
              key={industry.id}
              href={`/industries/${industry.slug}`}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600 hover:border-zinc-400"
            >
              {industry.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Report source" className="flex gap-2 text-sm">
          <Link
            href={`/companies/${company.slug}`}
            aria-current={source === "system" ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 ${
              source === "system"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white hover:border-zinc-400"
            }`}
          >
            Our analysis ({systemCount})
          </Link>
          <Link
            href={`/companies/${company.slug}?source=community`}
            aria-current={source === "community" ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 ${
              source === "community"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white hover:border-zinc-400"
            }`}
          >
            Community ({communityCount})
          </Link>
        </nav>
        <Link
          href={`/companies/${company.slug}/write`}
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

      {company.reports.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-medium">
            {source === "community"
              ? `Community reports on ${company.name}`
              : `${company.name} earnings analyses`}
          </h2>
          <ul className="flex flex-col gap-3">
            {company.reports.map((report) => (
              <li key={report.id}>
                <ReportCard report={{ ...report, company }} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-medium">Reports by Year</h2>
        {years.length === 0 ? (
          <p className="text-zinc-500">
            {source === "community"
              ? "No community reports for this company yet. Be the first to write one."
              : "No reports for this company yet."}
          </p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {years.map((year) => (
              <li key={year}>
                <Link
                  href={`/companies/${company.slug}/${year}${sourceQuery}`}
                  className="block rounded-lg border border-zinc-200 bg-white px-5 py-3 hover:border-zinc-400"
                >
                  {year}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
