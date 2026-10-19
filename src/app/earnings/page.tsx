import Link from "@/components/Link";
import type { Metadata } from "next";
import { prismaCached as prisma } from "@/lib/prisma";
import { systemReports } from "@/lib/community";
import { metricsHeadline, readMetrics } from "@/lib/metrics";
import { periodLabels } from "@/lib/period";
import hotList from "../../../scripts/data/priority-tickers.json";
import sp500 from "../../../scripts/data/sp500.json";
import { formatFilingDate, loadTracker } from "@/lib/tracker";
import { reportPath } from "@/lib/reportPath";
import { cleanCompanyName } from "@/lib/companyName";
import { availableScorecards } from "@/lib/scorecard";
import { scorecardPath } from "@/lib/scorecardPath";

// Cached on the CDN (ISR); publishes purge it via invalidateDbCache().
export const revalidate = 3600;

const LOOKBACK_DAYS = 3;
const LOOKAHEAD_DAYS = 28;

// Well-known names (hot list, S&P 500) and every company-confirmed date get
// a full card with last quarter's headline. The rest of the ~5,000 US-listed
// companies only have a cadence estimate and most readers have never heard
// of them, so they share one compact line per day: during earnings season
// the full-card version of this page reached 1.5 MB of HTML for ~950
// companies (2026-10-17), which is slow for visitors and a poor page for
// Google to crawl from the header nav every visit.
const WELL_KNOWN = new Set<string>([...hotList.tickers, ...sp500.map((c) => c.ticker)]);

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function formatDay(iso: string): string {
  return formatFilingDate(iso, true);
}

export const metadata: Metadata = {
  title: "Earnings Calendar: Upcoming Filings for Companies We Cover",
  description:
    "When the next quarterly and annual reports are expected for the companies we analyze, with last quarter's results for each and a link to our full analysis.",
  alternates: { canonical: "/earnings" },
};

export default async function EarningsCalendarPage() {
  const tracker = await loadTracker();
  const hot = new Set<string>(hotList.tickers);
  const from = isoDay(-LOOKBACK_DAYS);
  const to = isoDay(LOOKAHEAD_DAYS);
  const today = isoDay(0);

  const upcoming = Object.entries(tracker)
    .filter(([ticker, entry]) => {
      const estimate = entry.nextExpectedFiling?.estimate;
      return (
        ticker !== "_meta" &&
        entry.status === "done" &&
        !!estimate &&
        estimate >= from &&
        estimate <= to
      );
    })
    .map(([ticker, entry]) => ({ ticker, ...entry.nextExpectedFiling! }));

  const companies = await prisma.company.findMany({
    where: { ticker: { in: upcoming.map((u) => u.ticker) } },
    select: {
      ticker: true,
      name: true,
      slug: true,
      reports: {
        where: systemReports,
        orderBy: [{ year: "desc" }, { publishedAt: "desc" }],
        take: 1,
        select: { id: true, year: true, period: true, metrics: true },
      },
    },
  });
  const byTicker = new Map(companies.map((c) => [c.ticker, c]));
  // The newest period with enough results for a scorecard: what has already
  // been reported this season, next to what is still to come.
  const [scorecard] = await availableScorecards();

  // Group by expected date; well-known names first within a day.
  const days = new Map<string, { featured: typeof upcoming; others: typeof upcoming }>();
  for (const item of upcoming.sort(
    (a, b) =>
      a.estimate!.localeCompare(b.estimate!) ||
      Number(hot.has(b.ticker)) - Number(hot.has(a.ticker)) ||
      a.ticker.localeCompare(b.ticker)
  )) {
    if (!byTicker.get(item.ticker)?.reports[0]) continue;
    const day = days.get(item.estimate!) ?? { featured: [], others: [] };
    const featured = WELL_KNOWN.has(item.ticker) || item.confidence === "confirmed";
    (featured ? day.featured : day.others).push(item);
    days.set(item.estimate!, day);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Earnings calendar</h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          When the next quarterly or annual report is expected for the
          companies we cover, with what last quarter showed. Most dates are
          our estimate from each company&apos;s past filing pattern, marked{" "}
          <span className="font-medium">Estimated</span>; dates a company has
          announced are marked <span className="font-medium">Confirmed</span>.
          Check the company&apos;s investor relations page before relying on a
          date.
        </p>
        {scorecard && (
          <p className="mt-2 text-sm text-zinc-600">
            Already reported:{" "}
            <Link href={scorecardPath(scorecard.year, scorecard.period)} className="underline">
              {periodLabels[scorecard.period]} {scorecard.year} scorecard
            </Link>{" "}
            compares the {scorecard.count} companies whose results are in.
          </p>
        )}
      </div>

      {days.size === 0 ? (
        <p className="text-zinc-500">No expected filings in the next four weeks.</p>
      ) : (
        [...days.entries()].map(([day, { featured, others }]) => (
          <section key={day} className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">
              {formatDay(day)}
              {day < today && (
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  expected, not yet covered
                </span>
              )}
            </h2>
            <ul className="flex flex-col gap-2">
              {featured.map((item) => {
                const company = byTicker.get(item.ticker)!;
                const last = company.reports[0];
                const metrics = readMetrics(last.metrics);
                const confirmed = item.confidence === "confirmed";
                return (
                  <li
                    key={item.ticker}
                    className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <Link
                        href={`/companies/${company.slug}`}
                        className="font-medium hover:underline"
                      >
                        {cleanCompanyName(company.name)} ({item.ticker})
                      </Link>
                      <div className="text-sm text-zinc-500">
                        {item.type}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                            confirmed
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {confirmed ? "Confirmed" : "Estimated"}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={reportPath({ ...last, company })}
                      className="text-sm text-zinc-700 hover:underline sm:text-right"
                    >
                      Last: {periodLabels[last.period]} {last.year}
                      {metrics ? ` · ${metricsHeadline(metrics)}` : ""} →
                    </Link>
                  </li>
                );
              })}
            </ul>
            {others.length > 0 && (
              <p className="text-sm leading-relaxed text-zinc-600">
                <span className="text-zinc-500">
                  Also expected around this date ({others.length} more, dates estimated from each
                  company&apos;s past filings):
                </span>{" "}
                {others.map((item, i) => {
                  const company = byTicker.get(item.ticker)!;
                  return (
                    <span key={item.ticker}>
                      {i > 0 && ", "}
                      <Link
                        href={`/companies/${company.slug}`}
                        title={cleanCompanyName(company.name)}
                        className="hover:underline"
                      >
                        {item.ticker}
                      </Link>
                    </span>
                  );
                })}
              </p>
            )}
          </section>
        ))
      )}
    </div>
  );
}
