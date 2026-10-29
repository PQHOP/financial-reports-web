import Link from "@/components/Link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { periodLabels } from "@/lib/period";
import { reportPath } from "@/lib/reportPath";
import { buildBuybacks, MIN_BUYBACK_ENTRIES, type BuybackEntry } from "@/lib/buybacks";
import { formatMoneyMillions, formatPct } from "@/lib/metrics";
import { cleanCompanyName } from "@/lib/companyName";

// Cached on the CDN (ISR); publishes purge it via invalidateDbCache().
export const revalidate = 604800;

export async function generateMetadata(): Promise<Metadata> {
  const data = await buildBuybacks();
  const label = data ? `${periodLabels[data.period]} ${data.year}` : "This Quarter";
  const title = `Share Buybacks and Dividends ${label}: Who Returned the Most Cash, and Whose EPS Growth Came From a Smaller Share Count`;
  return {
    title: { absolute: title },
    description: data
      ? `${data.count} companies' ${label} buybacks and dividends from their own filings: ${formatMoneyMillions(data.totalRepurchases)} of repurchases, ${data.countShrinking} with fewer shares than a year ago, and how much of each company's EPS growth the lower share count explains.`
      : "Share repurchases, dividends and share-count changes by company, from each company's own filing, with how much of EPS growth a smaller share count explains.",
    alternates: { canonical: "/buybacks" },
    // Thin until enough reports carry the figures.
    ...(data ? {} : { robots: { index: false, follow: true } }),
  };
}

function name(e: BuybackEntry): string {
  return e.company.ticker ?? cleanCompanyName(e.company.name);
}

function money(v: number | undefined, currency?: string): string {
  return v === undefined ? "–" : formatMoneyMillions(v, currency);
}

function pct(v: number | undefined): string {
  return v === undefined ? "–" : formatPct(v);
}

function Table({
  entries,
  columns,
}: {
  entries: BuybackEntry[];
  columns: { head: string; cell: (e: BuybackEntry) => string }[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-zinc-600">
          <tr>
            <th className="px-3 py-2 font-semibold">Company</th>
            {columns.map((c) => (
              <th key={c.head} className="px-3 py-2 text-right font-semibold">
                {c.head}
              </th>
            ))}
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
              {columns.map((c) => (
                <td key={c.head} className="px-3 py-2 text-right tabular-nums">
                  {c.cell(e)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function BuybacksPage() {
  const data = await buildBuybacks();
  const label = data ? `${periodLabels[data.period]} ${data.year}` : null;

  return (
    <article className="flex flex-col gap-8">
      <div>
        <Breadcrumbs items={[{ name: "Buybacks", href: "/buybacks" }]} />
        <h1 className="mt-2 text-2xl font-semibold leading-tight">
          Share buybacks and dividends{label ? `, ${label}` : ""}
        </h1>
        <p className="mt-3 max-w-3xl text-zinc-700">
          A buyback lowers the share count, so earnings per share can rise even when
          profit doesn&apos;t. This page lines up, from each company&apos;s own filing,
          who spent the most on repurchases and dividends in the period, whose share
          count shrank most, and how much of each company&apos;s EPS growth the smaller
          count alone explains.
        </p>
      </div>

      {!data ? (
        <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
          Reports published from late October 2026 carry these figures; the page fills
          in once at least {MIN_BUYBACK_ENTRIES} reports for one period do. Check back
          after the next results days, or see the{" "}
          <Link href="/scorecards" className="underline">
            scorecards
          </Link>{" "}
          meanwhile.
        </p>
      ) : (
        <>
          <p className="text-zinc-700">
            Across the {data.count} {label} reports that state these figures,
            companies spent {formatMoneyMillions(data.totalRepurchases)} on repurchases
            and {formatMoneyMillions(data.totalDividends)} on dividends, and{" "}
            {data.countShrinking} of them had fewer diluted shares than a year earlier.
          </p>

          {data.epsFromBuybacks.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-medium">Where EPS growth came from the share count</h2>
              <Table
                entries={data.epsFromBuybacks.map((r) => r.entry)}
                columns={[
                  { head: "EPS YoY", cell: (e) => pct(e.m.epsYoyPct) },
                  { head: "Diluted shares YoY", cell: (e) => pct(e.m.dilutedSharesYoyPct) },
                  {
                    head: "EPS growth from fewer shares",
                    cell: (e) => {
                      const row = data.epsFromBuybacks.find((r) => r.entry.id === e.id);
                      return row ? `${Math.round(row.sharePct)}%` : "–";
                    },
                  },
                ]}
              />
              <p className="text-xs text-zinc-500">
                With N% fewer shares, EPS rises by about N/(100−N)% before any change in
                profit; that over the reported EPS growth is the share the buyback
                explains. 100% means profit did not grow at all.
              </p>
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Largest repurchases</h2>
            <Table
              entries={data.topRepurchases}
              columns={[
                { head: "Repurchases", cell: (e) => money(e.m.shareRepurchases, e.m.currency) },
                { head: "Dividends", cell: (e) => money(e.m.dividendsPaid, e.m.currency) },
                { head: "Diluted shares YoY", cell: (e) => pct(e.m.dilutedSharesYoyPct) },
              ]}
            />
          </section>

          {data.topShrink.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-medium">Share count shrinking fastest</h2>
              <Table
                entries={data.topShrink}
                columns={[
                  { head: "Diluted shares YoY", cell: (e) => pct(e.m.dilutedSharesYoyPct) },
                  { head: "Repurchases", cell: (e) => money(e.m.shareRepurchases, e.m.currency) },
                  { head: "EPS YoY", cell: (e) => pct(e.m.epsYoyPct) },
                ]}
              />
            </section>
          )}
        </>
      )}

      <aside className="rounded-lg border border-zinc-200 bg-white p-4 text-xs text-zinc-500">
        How this is built: repurchases and dividends are the cash flow statement
        figures for the period, and the share count is the diluted weighted-average
        share count against the same period a year earlier, each taken from our own
        analysis of the company&apos;s filing. Companies whose report doesn&apos;t state
        these figures aren&apos;t included. For information only, not investment advice.
      </aside>
    </article>
  );
}
