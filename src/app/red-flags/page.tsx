import Link from "@/components/Link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { prismaCached as prisma } from "@/lib/prisma";
import { systemReports } from "@/lib/community";
import { FLAG_KINDS, fetchRedFlags, type FlagKind, type RedFlag } from "@/lib/redFlags";

// Cached on the CDN for an hour; the EDGAR searches themselves are cached for
// an hour in Next's data cache (src/lib/redFlags.ts). No database writes.
export const revalidate = 86400;

const KIND_ORDER: FlagKind[] = ["non-reliance", "auditor-change", "late-filing", "going-concern"];
const MAX_ROWS = 40;

export const metadata: Metadata = {
  title: "Red Flags in SEC Filings: Restatements, Auditor Changes, Late Filings, Going Concern",
  description:
    "The filings that say a company's numbers can't be taken as reported: 8-K non-reliance notices (Item 4.02), auditor changes (Item 4.01), late-filing notices (NT 10-K/10-Q) and going-concern warnings, from EDGAR, updated hourly.",
  alternates: { canonical: "/red-flags" },
};

function edgarCompanyUrl(cik: string): string {
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=&dateb=&owner=include&count=40`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function FlagTable({ flags, covered }: { flags: RedFlag[]; covered: Map<string, string> }) {
  if (flags.length === 0) {
    return <p className="text-sm text-zinc-500">No filings of this kind in the last two weeks.</p>;
  }
  const rows = flags.slice(0, MAX_ROWS);
  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Filed</th>
              <th className="px-3 py-2 font-semibold">Company</th>
              <th className="px-3 py-2 font-semibold">Form</th>
              <th className="px-3 py-2 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const slug = f.ticker ? covered.get(f.ticker) : undefined;
              return (
                <tr key={`${f.cik}-${f.url}`} className="border-t border-zinc-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{formatDate(f.filedAt)}</td>
                  <td className="px-3 py-2">
                    {slug ? (
                      <Link href={`/companies/${slug}`} className="font-medium text-blue-700 hover:underline">
                        {f.company}
                        {f.ticker ? ` (${f.ticker})` : ""}
                      </Link>
                    ) : (
                      <a
                        href={edgarCompanyUrl(f.cik)}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="hover:underline"
                      >
                        {f.company}
                        {f.ticker ? ` (${f.ticker})` : ""}
                      </a>
                    )}
                    {slug && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                        our analysis
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-700">
                    {f.form}
                    {f.items.length > 0 && (
                      <span className="text-zinc-500"> · items {f.items.join(", ")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-blue-700 underline"
                    >
                      Filing
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {flags.length > MAX_ROWS && (
        <p className="text-xs text-zinc-500">
          Showing the {MAX_ROWS} most recent of {flags.length}.
        </p>
      )}
    </>
  );
}

export default async function RedFlagsPage() {
  const data = await fetchRedFlags();
  const tickers = [...new Set(data.flags.flatMap((f) => (f.ticker ? [f.ticker] : [])))];
  const companies =
    tickers.length === 0
      ? []
      : await prisma.company.findMany({
          where: { ticker: { in: tickers }, reports: { some: systemReports } },
          select: { ticker: true, slug: true },
        });
  const covered = new Map(companies.map((c) => [c.ticker!, c.slug]));
  // Companies we have analyzed first, so a reader of ours sees their names
  // before the micro-caps that make up most of these lists.
  const byKind = (kind: FlagKind) =>
    data.flags
      .filter((f) => f.kind === kind)
      .sort(
        (a, b) =>
          Number(Boolean(b.ticker && covered.has(b.ticker))) -
            Number(Boolean(a.ticker && covered.has(a.ticker))) || b.filedAt.localeCompare(a.filedAt)
      );
  const failed = data.sources.filter((s) => !s.ok);
  const checkedAt = data.sources[0]?.fetchedAt;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Breadcrumbs items={[{ name: "Red flags", href: "/red-flags" }]} />
        <h1 className="mt-2 text-2xl font-semibold">Red flags in SEC filings</h1>
        <p className="mt-2 max-w-3xl text-zinc-600">
          Four kinds of filing say, in the company&apos;s own words, that its numbers
          can&apos;t be taken as reported: a notice not to rely on past financial
          statements, a change of auditor, a notice that a report will be late, and a
          going-concern warning. This page lists every one filed with the SEC in the
          last {data.lookbackDays} days, straight from EDGAR, with the plain-English
          meaning of each. Companies we have analyzed link to our report.
        </p>
        {checkedAt && (
          <p className="mt-1 text-xs text-zinc-500">
            Checked{" "}
            {new Date(checkedAt).toLocaleString("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })}{" "}
            UTC · refreshed hourly.
          </p>
        )}
      </div>

      {KIND_ORDER.map((kind) => {
        const info = FLAG_KINDS[kind];
        const flags = byKind(kind);
        const source = data.sources.find((s) => s.kind === kind);
        return (
          <section key={kind} id={kind} className="flex flex-col gap-3 scroll-mt-4">
            <h2 className="text-lg font-medium">{info.title}</h2>
            <div className="grid grid-cols-1 gap-3 text-sm text-zinc-700 sm:grid-cols-2">
              <p>
                <span className="font-medium text-zinc-900">What it is: </span>
                {info.what}
              </p>
              <p>
                <span className="font-medium text-zinc-900">Why it matters: </span>
                {info.why}
              </p>
            </div>
            {source && !source.ok ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                EDGAR search for this list didn&apos;t answer ({source.note}); try again in an hour.
              </p>
            ) : (
              <FlagTable flags={flags} covered={covered} />
            )}
          </section>
        );
      })}

      <aside className="rounded-lg border border-zinc-200 bg-white p-4 text-xs text-zinc-500">
        How this is built: EDGAR full-text search for 8-Ks carrying Item 4.02 or
        4.01, every NT 10-K and NT 10-Q, and 10-K/10-Q filings that contain the
        phrases &quot;substantial doubt&quot; and &quot;going concern&quot; (the last
        list can include filings that quote the phrase about a subsidiary or a
        customer; read the filing). A filing appears here because of what it is,
        not because of any judgment of ours about the company. For information only,
        not investment advice.
        {failed.length > 0 && ` ${failed.length} of 4 searches failed on the last refresh.`}
      </aside>
    </div>
  );
}
