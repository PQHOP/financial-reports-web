import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { loadMacro } from "@/lib/macroStore";
import {
  bankName,
  buildRates,
  capitalize,
  describeMove,
  fmtAsOf,
  fmtPp,
  fmtYield,
  isRecent,
  moveKind,
  rateLabel,
} from "@/lib/rates";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

const RECENT_DAYS = 45;

function fmtSigned(v: number): string {
  const abs = Math.abs(v).toFixed(1);
  return Number(abs) === 0 ? `${abs}%` : `${v > 0 ? "+" : "−"}${abs}%`;
}

function monthYear(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export async function generateMetadata(): Promise<Metadata> {
  const { live } = await loadMacro();
  return {
    title: `Central Bank Interest Rates by Country (${monthYear(live.updatedAt)})`,
    description:
      "Current policy interest rates for the Fed, ECB, Bank of England, Bank of Japan and 60+ other central banks, with the latest rate decisions, real rates after inflation and 10-year bond yields. Updated daily.",
    alternates: { canonical: "/rates" },
  };
}

export default async function RatesPage() {
  const { weo, live } = await loadMacro();
  const today = new Date().toISOString().slice(0, 10);
  const rows = buildRates(weo, live, today);

  const recent = rows
    .filter((r) => r.lastMove && isRecent(r.lastMove.period, today, RECENT_DAYS))
    .sort((a, b) => b.lastMove!.period.localeCompare(a.lastMove!.period));
  const yearly = rows.filter((r) => r.change12m !== null);
  const higher = yearly.filter((r) => r.change12m! >= 0.01).length;
  const lower = yearly.filter((r) => r.change12m! <= -0.01).length;
  const same = yearly.length - higher - lower;

  return (
    <div className="flex flex-col gap-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "Central bank interest rates by country",
          description:
            "Current central bank policy rates, latest rate changes, real policy rates and 10-year government bond yields by country.",
          url: `${SITE_URL}/rates`,
          spatialCoverage: "World",
          variableMeasured: ["Central bank policy rate", "Consumer price inflation", "10-year government bond yield"],
          isBasedOn: ["https://data.bis.org/", "https://data.imf.org/", "https://data-explorer.oecd.org/"],
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          dateModified: live.updatedAt,
        }}
      />
      <div>
        <Breadcrumbs items={[{ name: "Interest rates", href: "/rates" }]} />
        <h1 className="mt-2 text-2xl font-semibold">Central bank interest rates by country</h1>
        <p className="mt-1 text-zinc-600">
          The policy rate is the interest rate a central bank sets to steer borrowing costs across its economy: it feeds
          through to what banks charge on loans and pay on deposits. {rows.length} central banks, largest economies
          first. Updated daily; last refreshed {live.updatedAt.slice(0, 16).replace("T", " ")} UTC.
        </p>
      </div>

      {yearly.length > 0 && (
        <p className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm">
          Over the past 12 months, <strong>{lower}</strong> of these central banks lowered their rate,{" "}
          <strong>{higher}</strong> raised it and <strong>{same}</strong> left it where it was (comparing each
          bank&apos;s latest rate with its month-end rate a year earlier).
        </p>
      )}

      {recent.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Latest rate decisions</h2>
          <ul className="flex flex-col gap-2">
            {recent.map((r) => {
              const m = r.lastMove!;
              return (
                <li key={r.slug} className="flex items-start gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm">
                  <span
                    className={`mt-0.5 rounded px-1.5 py-0.5 text-xs font-medium ${
                      moveKind(m) === "hike" ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"
                    }`}
                  >
                    {moveKind(m) === "hike" ? "Hike" : "Cut"} {fmtPp(m.to - m.from)}
                  </span>
                  <span>
                    <Link href={`/rates/${r.slug}`} className="font-medium text-blue-700 hover:underline">
                      {r.name}
                    </Link>
                    : {capitalize(bankName(r))} {describeMove(r, m)} ({fmtAsOf(m.period)}).
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-zinc-500">
            Moves in the past {RECENT_DAYS} days. Dates are when the new rate took effect in the daily data, or the month
            for banks reported monthly.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">All central banks</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Country</th>
                <th className="px-3 py-2 font-semibold">Central bank</th>
                <th className="px-3 py-2 text-right font-semibold">Policy rate</th>
                <th className="px-3 py-2 font-semibold">Last move</th>
                <th className="px-3 py-2 text-right font-semibold">12-month change</th>
                <th className="px-3 py-2 text-right font-semibold">Inflation</th>
                <th className="px-3 py-2 text-right font-semibold">Real rate</th>
                <th className="px-3 py-2 text-right font-semibold">10-yr bond</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.slug} className="border-t border-zinc-100">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link href={`/rates/${r.slug}`} className="text-blue-700 hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{r.bank ?? "–"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">{rateLabel(r)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-600">
                    {r.lastMove
                      ? `${moveKind(r.lastMove) === "hike" ? "▲" : "▼"} ${fmtPp(r.lastMove.to - r.lastMove.from)}, ${fmtAsOf(r.lastMove.period)}`
                      : "None in past year"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {r.change12m !== null ? fmtPp(r.change12m) : "–"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {r.cpi ? `${r.cpi.value.toFixed(1)}%` : "–"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {r.realRate !== null ? fmtSigned(r.realRate) : "–"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {r.bond ? fmtYield(r.bond.value) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-1 text-xs text-zinc-500">
          <p>
            <strong>Real rate</strong>: the policy rate minus the latest 12-month inflation rate. Above zero, borrowing
            costs outpace price rises, which tends to cool an economy; below zero, they don&apos;t. <strong>10-yr bond</strong>:
            the latest monthly yield on 10-year government bonds, which reflects where markets expect rates to go over
            the long run. The US rate is the Federal Reserve&apos;s target range.
          </p>
          <p>
            Sources: Bank for International Settlements (daily policy rates), IMF monetary and consumer price statistics,
            OECD (long-term interest rates). A rate not reported for about nine months is left out.{" "}
            <Link href="/economy?indicator=L_POLICY" className="underline">
              See rates on the world map
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
