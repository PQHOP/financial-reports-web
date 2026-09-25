import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { systemReports } from "@/lib/community";
import { metricsHeadline, readMetrics } from "@/lib/metrics";
import { periodLabels } from "@/lib/period";
import hotList from "../../../scripts/data/priority-tickers.json";
import { formatFilingDate, loadTracker } from "@/lib/tracker";
import { reportPath } from "@/lib/reportPath";

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 3;
const LOOKAHEAD_DAYS = 28;

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

  // Group by expected date; well-known names first within a day.
  const days = new Map<string, typeof upcoming>();
  for (const item of upcoming.sort(
    (a, b) =>
      a.estimate!.localeCompare(b.estimate!) ||
      Number(hot.has(b.ticker)) - Number(hot.has(a.ticker)) ||
      a.ticker.localeCompare(b.ticker)
  )) {
    if (!byTicker.get(item.ticker)?.reports[0]) continue;
    const list = days.get(item.estimate!) ?? [];
    list.push(item);
    days.set(item.estimate!, list);
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
      </div>

      {days.size === 0 ? (
        <p className="text-zinc-500">No expected filings in the next four weeks.</p>
      ) : (
        [...days.entries()].map(([day, items]) => (
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
              {items.map((item) => {
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
                        {company.name} ({item.ticker})
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
          </section>
        ))
      )}
    </div>
  );
}
