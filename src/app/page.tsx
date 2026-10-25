import Link from "@/components/Link";
import { prismaCached as prisma } from "@/lib/prisma";
import { ReportCard } from "@/components/ReportCard";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_SAME_AS, SITE_URL } from "@/lib/site";
import { articlePath } from "@/lib/articles";
import { systemReports } from "@/lib/community";
import type { Metadata } from "next";
import hotList from "../../scripts/data/priority-tickers.json";
import sp500 from "../../scripts/data/sp500.json";
import { formatFilingDate, isFollowUpFiling, loadTracker } from "@/lib/tracker";
import { cleanCompanyName } from "@/lib/companyName";
import { periodLabels } from "@/lib/period";
import { availableScorecards } from "@/lib/scorecard";
import { scorecardPath } from "@/lib/scorecardPath";

// Most-searched tickers first (same list the report backlog is worked in).
const POPULAR_TICKERS: string[] = hotList.tickers;
const POPULAR_LIMIT = 16;
// Hot list plus the S&P 500: the companies people search for by name. Their
// newest results lead the homepage so a results-day visitor sees BAC's Q3,
// not the six micro-caps the backlog happened to publish last.
const WELL_KNOWN: string[] = [...new Set([...POPULAR_TICKERS, ...sp500.map((c) => c.ticker)])];
const SEASON_LIMIT = 6;
// Newest well-known results to choose from; hot-list names come first within
// this window so BAC and GS, published early on results night, aren't pushed
// out by the dozen regional banks that followed them. Sized to a full
// night's publishing (~40 cap): with 16, the 43-report night of 2026-10-21
// pushed NFLX, GE and GM (reported the day before) out behind KEY.
const SEASON_POOL = 40;
const SEASON_ARTICLES = 4;
const UPCOMING_DAYS = 7;
const UPCOMING_LIMIT = 18;
const PREVIEW_MAX_AGE_DAYS = 8;

// Cached on the CDN (ISR); publishes purge it via invalidateDbCache().
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "Financial Report Insights: What the Earnings Headlines Hide" },
  description:
    "Plain-English analysis of US company earnings, built from each company's own SEC filing, with a verdict on whether the reported numbers flatter or understate the business: one-offs, adjusted vs GAAP, buybacks and tax rates.",
  alternates: { canonical: "/" },
};

function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

type SoonItem = { ticker: string; slug: string; date: string; confirmed: boolean };

// The week's earnings preview, while it is still this week's.
function currentPreview<T extends { kind: string; publishedAt: Date }>(articles: T[]): T | undefined {
  const cutoff = Date.now() - PREVIEW_MAX_AGE_DAYS * 86_400_000;
  return articles.find((a) => a.kind === "PREVIEW" && a.publishedAt.getTime() > cutoff);
}

// Covered companies expected to report in the next week, grouped by day.
// Picked by how much people search for them (hot list, then the S&P 500,
// then the rest), a company's own announced date ahead of a cadence
// estimate — not by date: ordered by date, the twelve slots going into the
// week of 2026-10-26 (MSFT, GOOGL, AMZN, V, KO, BA) went to micro-caps
// estimated for the weekend and Monday, and V was the only well-known name.
// Weekend dates are cadence artifacts (no company reports on a Saturday),
// so an estimate that lands on one is left out, as is the full 10-Q due for
// a quarter we already covered from the earnings release (see
// isFollowUpFiling): BAC does not "report" again on Oct 30.
async function reportingSoon(): Promise<{ date: string; items: SoonItem[] }[]> {
  const tracker = await loadTracker();
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + UPCOMING_DAYS * 86_400_000).toISOString().slice(0, 10);
  const hot = new Map(POPULAR_TICKERS.map((t, i) => [t, i]));
  const sp = new Set(sp500.map((c) => c.ticker));
  const rank = (ticker: string) => hot.get(ticker) ?? (sp.has(ticker) ? 1_000 : 2_000);
  const upcoming = Object.entries(tracker)
    .filter(([ticker, e]) => {
      const d = e.nextExpectedFiling?.estimate;
      if (ticker === "_meta" || e.status !== "done" || !d || d < today || d > until) return false;
      if (isFollowUpFiling(e)) return false;
      return e.nextExpectedFiling?.confidence === "confirmed" || !isWeekend(d);
    })
    .map(([ticker, e]) => ({
      ticker,
      date: e.nextExpectedFiling!.estimate!,
      confirmed: e.nextExpectedFiling!.confidence === "confirmed",
    }))
    .sort(
      (a, b) =>
        rank(a.ticker) - rank(b.ticker) ||
        Number(b.confirmed) - Number(a.confirmed) ||
        a.date.localeCompare(b.date) ||
        a.ticker.localeCompare(b.ticker)
    );
  if (upcoming.length === 0) return [];
  const companies = await prisma.company.findMany({
    where: { ticker: { in: upcoming.map((u) => u.ticker) }, reports: { some: systemReports } },
    select: { slug: true, ticker: true },
  });
  const slugs = new Map(companies.map((c) => [c.ticker, c.slug]));
  const picked = upcoming
    .filter((u) => slugs.has(u.ticker))
    .slice(0, UPCOMING_LIMIT)
    .map((u) => ({ ...u, slug: slugs.get(u.ticker)! }));
  const days = new Map<string, SoonItem[]>();
  for (const item of picked) days.set(item.date, [...(days.get(item.date) ?? []), item]);
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
}

export default async function Home() {
  const [
    industries,
    seasonPool,
    seasonArticles,
    scorecards,
    guides,
    briefs,
    popularCandidates,
    soon,
  ] = await Promise.all([
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
      where: { ...systemReports, company: { ticker: { in: WELL_KNOWN } } },
      orderBy: { publishedAt: "desc" },
      take: SEASON_POOL,
      include: { company: { select: { name: true, ticker: true, slug: true } } },
    }),
    prisma.article.findMany({
      where: { kind: { in: ["COMPARISON", "PREVIEW"] } },
      orderBy: { publishedAt: "desc" },
      take: SEASON_ARTICLES,
      select: { slug: true, kind: true, title: true, publishedAt: true },
    }),
    availableScorecards(),
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

  const hotRank = (ticker: string | null) => {
    const i = ticker ? POPULAR_TICKERS.indexOf(ticker) : -1;
    return i === -1 ? POPULAR_TICKERS.length : i;
  };
  // Only well-known names make the homepage (2026-10-25): a "latest reports"
  // list of whatever the backlog published last showed micro-caps nobody
  // searches for; /reports still lists everything.
  const season = [...seasonPool]
    .sort(
      (a, b) =>
        hotRank(a.company.ticker) - hotRank(b.company.ticker) ||
        b.publishedAt.getTime() - a.publishedAt.getTime()
    )
    .slice(0, SEASON_LIMIT);
  // The scorecard for the period the newest well-known result belongs to,
  // when enough companies have reported it; otherwise the newest scorecard.
  const newest = seasonPool[0];
  const seasonPeriod = newest
    ? scorecards.find((c) => c.year === newest.year && c.period === newest.period) ?? scorecards[0]
    : scorecards[0];

  const weekPreview = currentPreview(seasonArticles);

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
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, sameAs: SITE_SAME_AS },
          potentialAction: {
            "@type": "SearchAction",
            target: `${SITE_URL}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />

      <section>
        <h1 className="text-3xl font-semibold tracking-tight">
          What the earnings headlines hide
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Every analysis is built from the company&apos;s own SEC filing, says
          what drove the numbers, and checks whether they flatter or understate
          the business: one-offs, adjusted versus GAAP, buybacks and tax rates
          doing the work. Sources are linked on every report.
        </p>
      </section>

      {soon.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-lg font-medium">Reporting this week</h2>
            <div className="flex flex-wrap gap-x-4 text-sm text-zinc-500">
              {weekPreview && (
                <Link href={articlePath(weekPreview.kind, weekPreview.slug)} className="hover:underline">
                  This week&apos;s earnings preview →
                </Link>
              )}
              <Link href="/earnings" className="hover:underline">
                Earnings calendar →
              </Link>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {soon.map((day) => (
              <li key={day.date} className="flex flex-wrap items-center gap-2">
                <span className="w-full text-sm font-medium text-zinc-700 sm:w-24">
                  {formatFilingDate(day.date, true)}
                </span>
                {day.items.map((item) => (
                  <Link
                    key={item.ticker}
                    href={`/companies/${item.slug}`}
                    className="block rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm hover:border-zinc-400"
                  >
                    <span className="font-medium">{item.ticker}</span>
                    {item.confirmed ? "" : <span className="text-zinc-500"> (est.)</span>}
                  </Link>
                ))}
              </li>
            ))}
          </ul>
          <p className="text-xs text-zinc-500">
            Dates marked (est.) are our estimate from the company&apos;s past filing pattern;
            the others are company-announced.
          </p>
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

      {season.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-lg font-medium">Latest results</h2>
            <div className="flex flex-wrap gap-x-4 text-sm text-zinc-500">
              {seasonPeriod && (
                <Link
                  href={scorecardPath(seasonPeriod.year, seasonPeriod.period)}
                  className="hover:underline"
                >
                  {`${periodLabels[seasonPeriod.period]} ${seasonPeriod.year} scorecard (${seasonPeriod.count} companies) →`}
                </Link>
              )}
              <Link href="/reports" className="hover:underline">
                All reports →
              </Link>
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {season.map((report) => (
              <li key={report.id}>
                <ReportCard report={report} />
              </li>
            ))}
          </ul>
          {seasonArticles.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {seasonArticles.map((article) => (
                <li key={article.slug}>
                  <Link
                    href={articlePath(article.kind, article.slug)}
                    className="block rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm hover:border-zinc-400"
                  >
                    {article.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
