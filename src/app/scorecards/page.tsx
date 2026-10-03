import Link from "@/components/Link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { periodLabels } from "@/lib/period";
import { availableScorecards } from "@/lib/scorecard";
import { scorecardPath } from "@/lib/scorecardPath";

// Cached on the CDN (ISR); publishes purge it via invalidateDbCache().
export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Earnings Scorecards: Every Sector, Every Quarter",
  description:
    "Quarter-by-quarter scorecards of the companies we analyze: median revenue growth, operating margin and EPS growth by sector, with the fastest and slowest growers.",
  alternates: { canonical: "/scorecards" },
};

export default async function ScorecardsPage() {
  const cards = await availableScorecards();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs items={[{ name: "Scorecards", href: "/scorecards" }]} />
        <h1 className="mt-2 text-2xl font-semibold">Earnings scorecards</h1>
        <p className="mt-2 text-zinc-600">
          Each scorecard lines up every company we have analyzed for one
          reporting period, sector by sector, using only the figures from our
          own reports. It answers two questions a single earnings report
          can&apos;t: was this a good quarter for the sector as a whole, and
          which companies stood out from it?
        </p>
      </div>
      {cards.length === 0 ? (
        <p className="text-zinc-500">No period has enough reports for a scorecard yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cards.map((c) => (
            <li key={`${c.year}-${c.period}`}>
              <Link
                href={scorecardPath(c.year, c.period)}
                className="block rounded-lg border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-400"
              >
                <div className="font-medium">
                  {periodLabels[c.period]} {c.year} earnings scorecard
                </div>
                <div className="text-sm text-zinc-500">{c.count} companies</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
