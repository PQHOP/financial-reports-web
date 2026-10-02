import Link from "@/components/Link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { periodLabels } from "@/lib/period";
import { periodFromSlug, reportPath } from "@/lib/reportPath";
import { buildScorecard, type ScorecardEntry } from "@/lib/scorecard";
import { scorecardPath } from "@/lib/scorecardPath";
import { formatPct } from "@/lib/metrics";
import { cleanCompanyName } from "@/lib/companyName";
import { RankedBarChart } from "@/components/ReportCharts";

export const dynamic = "force-dynamic";

type Params = Promise<{ year: string; period: string }>;

async function load(params: Params) {
  const { year, period } = await params;
  const periodValue = periodFromSlug(period);
  const yearNum = Number(year);
  if (!periodValue || !Number.isInteger(yearNum)) return null;
  return buildScorecard(yearNum, periodValue);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const card = await load(params);
  if (!card) return {};
  const name = `${periodLabels[card.period]} ${card.year}`;
  const growth = card.overall.medianRevenueGrowth;
  const title = `${name} Earnings Scorecard: Revenue Growth, Margins and EPS by Sector`;
  const description = `${card.count} companies' ${name} results compared sector by sector${
    growth !== null ? `: median revenue growth ${formatPct(growth)}` : ""
  }, with the fastest and slowest growers in each sector.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: scorecardPath(card.year, card.period) },
    openGraph: { title, description },
  };
}

function pct(value: number | null | undefined, signed = true): string {
  return typeof value === "number" ? formatPct(value, signed) : "–";
}

function name(e: ScorecardEntry): string {
  return e.company.ticker ?? cleanCompanyName(e.company.name);
}

function MoversTable({ entries }: { entries: ScorecardEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-zinc-600">
          <tr>
            <th className="px-3 py-2 font-semibold">Company</th>
            <th className="px-3 py-2 text-right font-semibold">Rev. YoY</th>
            <th className="px-3 py-2 text-right font-semibold">Op. margin</th>
            <th className="px-3 py-2 text-right font-semibold">EPS YoY</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-zinc-100">
              <td className="px-3 py-2">
                <Link href={reportPath(e)} className="text-blue-700 hover:underline">
                  {name(e)}
                </Link>{" "}
                <span className="text-zinc-500">{cleanCompanyName(e.company.name)}</span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{pct(e.m.revenueYoyPct)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{pct(e.m.operatingMarginPct, false)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{pct(e.m.epsYoyPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MoverList({ title, entries }: { title: string; entries: ScorecardEntry[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-700">{title}</h3>
      <ul className="mt-1 flex flex-col gap-2 text-sm">
        {entries.map((e) => (
          <li key={e.id}>
            <Link href={reportPath(e)} className="font-medium text-blue-700 hover:underline">
              {name(e)}
            </Link>{" "}
            <span className="tabular-nums">({pct(e.m.revenueYoyPct)} revenue)</span>
            <span className="text-zinc-600"> — {e.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ScorecardPage({ params }: { params: Params }) {
  const card = await load(params);
  if (!card) notFound();
  const label = `${periodLabels[card.period]} ${card.year}`;
  const o = card.overall;
  const ranked = card.sectors.filter((s) => s.medianRevenueGrowth !== null && s.count >= 4);
  const strongest = ranked[0];
  const weakest = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;

  return (
    <article className="flex flex-col gap-8">
      <div>
        <Breadcrumbs
          items={[
            { name: "Scorecards", href: "/scorecards" },
            { name: label, href: scorecardPath(card.year, card.period) },
          ]}
        />
        <h1 className="mt-2 text-2xl font-semibold leading-tight">
          {label} earnings scorecard by sector
        </h1>
        <p className="mt-3 text-zinc-700">
          We have analyzed {card.count} companies&apos; {label} results. The
          median company grew revenue {pct(o.medianRevenueGrowth)} from a year
          earlier
          {o.shareGrowingRevenue !== null &&
            `, and ${Math.round(o.shareGrowingRevenue)}% of them grew revenue at all`}
          . The median operating margin (the share of revenue left after running
          the business, before interest and tax) was {pct(o.medianOperatingMargin, false)},
          and median earnings per share changed {pct(o.medianEpsGrowth)}.
          {strongest && weakest && (
            <>
              {" "}By sector, {strongest.name} grew fastest (median{" "}
              {pct(strongest.medianRevenueGrowth)}) and {weakest.name} slowest
              (median {pct(weakest.medianRevenueGrowth)}).
            </>
          )}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Sectors at a glance</h2>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-zinc-700">Median revenue growth by sector</h3>
          <RankedBarChart
            items={card.sectors.flatMap((s) =>
              s.medianRevenueGrowth === null
                ? []
                : [
                    {
                      key: s.slug,
                      label: s.name,
                      href: `#${s.slug}`,
                      value: s.medianRevenueGrowth,
                      title: `${s.name}: median ${pct(s.medianRevenueGrowth)} across ${s.count} ${s.count === 1 ? "company" : "companies"}`,
                    },
                  ]
            )}
            format={(v) => pct(v)}
            wideLabels
          />
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Sector</th>
                <th className="px-3 py-2 text-right font-semibold">Companies</th>
                <th className="px-3 py-2 text-right font-semibold">Median rev. YoY</th>
                <th className="px-3 py-2 text-right font-semibold">Growing revenue</th>
                <th className="px-3 py-2 text-right font-semibold">Median op. margin</th>
                <th className="px-3 py-2 text-right font-semibold">Median EPS YoY</th>
              </tr>
            </thead>
            <tbody>
              {card.sectors.map((s) => (
                <tr key={s.slug} className="border-t border-zinc-100">
                  <td className="px-3 py-2">
                    <a href={`#${s.slug}`} className="text-blue-700 hover:underline">
                      {s.name}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(s.medianRevenueGrowth)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {s.shareGrowingRevenue !== null ? `${Math.round(s.shareGrowingRevenue)}%` : "–"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(s.medianOperatingMargin, false)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(s.medianEpsGrowth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          Sorted by median revenue growth. &quot;Growing revenue&quot; is the share
          of the sector&apos;s companies whose revenue rose year over year. Banks
          don&apos;t report an operating margin, so that column covers the
          companies that do.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Fastest revenue growth, all sectors</h2>
        <MoversTable entries={card.topOverall} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Slowest revenue growth, all sectors</h2>
        <MoversTable entries={card.bottomOverall} />
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-medium">Sector by sector</h2>
        {card.sectors.map((s) => (
          <div key={s.slug} id={s.slug} className="scroll-mt-4 rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="font-semibold">
              <Link href={`/industries/${s.slug}`} className="hover:underline">
                {s.name}
              </Link>
            </h3>
            <p className="mt-1 text-sm text-zinc-600">
              {s.count} {s.count === 1 ? "company" : "companies"} · median revenue{" "}
              {pct(s.medianRevenueGrowth)} · median operating margin{" "}
              {pct(s.medianOperatingMargin, false)} · median EPS {pct(s.medianEpsGrowth)}
            </p>
            {s.top.length > 0 && (
              <div className="mt-3 flex flex-col gap-3">
                <MoverList title="Fastest growers" entries={s.top} />
                <MoverList title="Slowest growers" entries={s.bottom} />
              </div>
            )}
          </div>
        ))}
      </section>

      <aside className="rounded-lg border border-zinc-200 bg-white p-4 text-xs text-zinc-500">
        How this is built: every figure comes from the metrics of our own
        published {label} analyses, each of which links to the company&apos;s SEC
        filing. Periods follow each company&apos;s own fiscal calendar, so a
        company whose fiscal year doesn&apos;t match the calendar may report a
        different span of months under the same label. Coverage grows as we
        publish more reports; companies we haven&apos;t analyzed yet aren&apos;t
        included. For information only, not investment advice.
      </aside>
    </article>
  );
}
