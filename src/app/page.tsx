import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ReportCard } from "@/components/ReportCard";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { articlePath } from "@/lib/articles";
import { systemReports } from "@/lib/community";
import type { Metadata } from "next";
import hotList from "../../scripts/data/priority-tickers.json";
import { formatFilingDate, loadTracker } from "@/lib/tracker";
import { cleanCompanyName } from "@/lib/companyName";

// Most-searched tickers first (same list the report backlog is worked in).
const POPULAR_TICKERS: string[] = hotList.tickers;
const POPULAR_LIMIT = 16;
const UPCOMING_DAYS = 7;
const UPCOMING_LIMIT = 12;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Financial Report Insights: Earnings Reports Explained in Plain English" },
  description:
    "Plain-English analysis of US company earnings, built from each company's own SEC filing: what the numbers were, what drove them, and what management expects next.",
  alternates: { canonical: "/" },
};

// Covered companies expected to report in the next week, well-known names
// first: during earnings season this is what brings people back.
async function reportingSoon() {
  const tracker = await loadTracker();
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + UPCOMING_DAYS * 86_400_000).toISOString().slice(0, 10);
  const hot = new Map(POPULAR_TICKERS.map((t, i) => [t, i]));
  const upcoming = Object.entries(tracker)
    .filter(([ticker, e]) => {
      const d = e.nextExpectedFiling?.estimate;
      return ticker !== "_meta" && e.status === "done" && !!d && d >= today && d <= until;
    })
    .map(([ticker, e]) => ({
      ticker,
      date: e.nextExpectedFiling!.estimate!,
      confirmed: e.nextExpectedFiling!.confidence === "confirmed",
    }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (hot.get(a.ticker) ?? 1e9) - (hot.get(b.ticker) ?? 1e9)
    );
  if (upcoming.length === 0) return [];
  const companies = await prisma.company.findMany({
    where: { ticker: { in: upcoming.map((u) => u.ticker) }, reports: { some: systemReports } },
    select: { slug: true, ticker: true },
  });
  const slugs = new Map(companies.map((c) => [c.ticker, c.slug]));
  return upcoming
    .filter((u) => slugs.has(u.ticker))
    .slice(0, UPCOMING_LIMIT)
    .map((u) => ({ ...u, slug: slugs.get(u.ticker)! }));
}

export default async function Home() {
  const [industries, latest, guides, briefs, popularCandidates, soon] = await Promise.all([
    prisma.industry.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { companies: true } },
        companies: {
          where: { reports: { some: systemReports } },
          select: { id: true },
        },
      },
    }),
    prisma.report.findMany({
      where: systemReports,
      orderBy: { publishedAt: "desc" },
      take: 6,
      include: { company: { select: { name: true, ticker: true, slug: true } } },
    }),
    prisma.article.findMany({
      where: { kind: "GUIDE" },
      orderBy: { publishedAt: "desc" },
      take: 4,
      select: { slug: true, kind: true, title: true },
    }),
    prisma.article.findMany({
      where: { kind: { in: ["NEWS", "DIGEST"] } },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: { slug: true, kind: true, title: true, summary: true },
    }),
    prisma.company.findMany({
      where: { ticker: { in: POPULAR_TICKERS }, reports: { some: systemReports } },
      select: { slug: true, name: true, ticker: true },
    }),
    reportingSoon(),
  ]);

  const popular = popularCandidates
    .sort(
      (a, b) =>
        POPULAR_TICKERS.indexOf(a.ticker ?? "") -
        POPULAR_TICKERS.indexOf(b.ticker ?? "")
    )
    .slice(0, POPULAR_LIMIT);

  // Industries with published coverage first; the catch-all "Uncategorized"
  // bucket stays reachable but always sinks to the bottom.
  const isCatchAll = (slug: string) => slug === "uncategorized";
  const sortedIndustries = [...industries].sort(
    (a, b) =>
      Number(isCatchAll(a.slug)) - Number(isCatchAll(b.slug)) ||
      b.companies.length - a.companies.length ||
      a.name.localeCompare(b.name)
  );

  return (
    <div className="flex flex-col gap-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL,
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_URL}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />

      <section>
        <h1 className="text-3xl font-semibold tracking-tight">
          Earnings reports, explained in plain English
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Each analysis is built from the company&apos;s own SEC filing: what
          the numbers were, what drove them, and what management expects next.
          Sources are linked on every report.{" "}
          <Link href="/methodology" className="underline">
            How we work
          </Link>
          .
        </p>
      </section>

      {soon.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">Reporting this week</h2>
            <Link href="/earnings" className="text-sm text-zinc-500 hover:underline">
              Earnings calendar →
            </Link>
          </div>
          <ul className="flex flex-wrap gap-2">
            {soon.map((item) => (
              <li key={item.ticker}>
                <Link
                  href={`/companies/${item.slug}`}
                  className="block rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm hover:border-zinc-400"
                >
                  <span className="font-medium">{item.ticker}</span>{" "}
                  <span className="text-zinc-500">
                    {formatFilingDate(item.date, true)}
                    {item.confirmed ? "" : " (est.)"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {popular.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Popular companies</h2>
          <ul className="flex flex-wrap gap-2">
            {popular.map((company) => (
              <li key={company.slug}>
                <Link
                  href={`/companies/${company.slug}`}
                  className="block rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm hover:border-zinc-400"
                >
                  <span className="font-medium">{company.ticker}</span>{" "}
                  <span className="text-zinc-500">{cleanCompanyName(company.name)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Latest reports</h2>
          <Link href="/reports" className="text-sm text-zinc-500 hover:underline">
            All reports →
          </Link>
        </div>
        {latest.length === 0 ? (
          <p className="text-zinc-500">No reports yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {latest.map((report) => (
              <li key={report.id}>
                <ReportCard report={report} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {briefs.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">Briefs and weekly digests</h2>
            <Link href="/insights" className="text-sm text-zinc-500 hover:underline">
              All insights →
            </Link>
          </div>
          <ul className="flex flex-col gap-3">
            {briefs.map((brief) => (
              <li key={brief.slug}>
                <Link
                  href={articlePath(brief.kind, brief.slug)}
                  className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400"
                >
                  <div className="font-medium">{brief.title}</div>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                    {brief.summary}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {guides.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">New to reading earnings?</h2>
            <Link href="/learn" className="text-sm text-zinc-500 hover:underline">
              All guides →
            </Link>
          </div>
          <ul className="flex flex-wrap gap-2">
            {guides.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={articlePath(guide.kind, guide.slug)}
                  className="block rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm hover:border-zinc-400"
                >
                  {guide.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Browse by industry</h2>
        {industries.length === 0 ? (
          <p className="text-zinc-500">No industries yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sortedIndustries.map((industry) => (
              <li key={industry.id}>
                <Link
                  href={`/industries/${industry.slug}`}
                  className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400"
                >
                  <div className="font-medium">{industry.name}</div>
                  <div className="text-sm text-zinc-500">
                    {industry.companies.length} of {industry._count.companies}{" "}
                    companies analyzed
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
