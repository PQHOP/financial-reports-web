import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RateChart } from "@/components/rates/RateChart";
import { fmtPeriod } from "@/lib/macroCells";
import { EURO_AREA, type Point } from "@/lib/macroLive";
import { loadMacro } from "@/lib/macroStore";
import {
  bankName,
  buildRates,
  describeMove,
  EURO_SLUG,
  fmtAsOf,
  fmtPp,
  fmtYield,
  moveKind,
  rateAt,
  rateLabel,
  slugify,
  type RateRow,
} from "@/lib/rates";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const { weo, live } = await loadMacro();
  const today = new Date().toISOString().slice(0, 10);
  const rows = buildRates(weo, live, today);
  return { weo, live, today, rows, row: rows.find((r) => r.slug === slug) ?? null };
}

function signed(v: number, digits = 1): string {
  const abs = Math.abs(v).toFixed(digits);
  if (Number(abs) === 0) return `${abs}%`;
  return `${v > 0 ? "+" : "−"}${abs}%`;
}

// "The policy rate set by the Bank of Japan"
function setBy(row: RateRow): string {
  return `The policy rate set by ${bankName(row)}`;
}

export async function generateMetadata({ params }: PageProps<"/rates/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { row } = await load(slug);
  if (!row) return {};
  const when = fmtPeriod(row.asOf.slice(0, 7));
  const title = `${row.name} Interest Rate: ${rateLabel(row)} (${when})${row.bank ? ` – ${row.bank}` : ""}`;
  const move = row.lastMove
    ? ` Last move: ${moveKind(row.lastMove) === "hike" ? "a hike" : "a cut"} of ${fmtPp(row.lastMove.to - row.lastMove.from).replace(/^[+−]/, "")} in ${fmtAsOf(row.lastMove.period)}.`
    : " No change in the past year.";
  return {
    title,
    description: `${setBy(row)} is ${rateLabel(row)} as of ${fmtAsOf(row.asOf)}.${move} History, real rate after inflation and 10-year bond yield, updated daily.`,
    alternates: { canonical: `/rates/${row.slug}` },
  };
}

export default async function RateCountryPage({ params }: PageProps<"/rates/[slug]">) {
  const { slug } = await params;
  const { weo, live, today, rows, row } = await load(slug);
  if (!row) {
    // Euro members share the ECB's page.
    const member = weo.countries.find((c) => EURO_AREA.includes(c.code) && slugify(c.name) === slug);
    if (member) permanentRedirect(`/rates/${EURO_SLUG}`);
    notFound();
  }

  const labels = row.hist.map(([p]) => fmtPeriod(p));
  const values = row.hist.map(([, v]) => v);
  const cpiSeries = row.code !== "EURO" ? live.metrics.cpi?.[row.code] : undefined;
  const bondSeries = row.code !== "EURO" ? live.metrics.bond?.[row.code] : undefined;
  const peers = rows.filter((r) => r.region === row.region && r.slug !== row.slug).slice(0, 8);
  const members =
    row.members
      ?.map((code) => ({
        code,
        name: weo.countries.find((c) => c.code === code)?.name ?? code,
        cpi: lastOf(live.metrics.cpi?.[code]?.hist, today),
        bond: lastOf(live.metrics.bond?.[code]?.hist, today),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)) ?? [];

  const summary: string[] = [
    `${setBy(row)} is ${rateLabel(row)} as of ${fmtAsOf(row.asOf)}.`,
  ];
  if (row.lastMove) {
    summary.push(`Its most recent move: it ${describeMove(row, row.lastMove)} (${fmtAsOf(row.lastMove.period)}).`);
  } else {
    summary.push("It has not changed the rate in the past year.");
  }
  if (row.change12m !== null && Math.abs(row.change12m) >= 0.01) {
    summary.push(
      `The rate is ${Math.abs(row.change12m).toFixed(2)} percentage points ${row.change12m > 0 ? "higher" : "lower"} than a year earlier.`,
    );
  }
  if (row.cpi && row.realRate !== null) {
    summary.push(
      `With consumer prices up ${row.cpi.value.toFixed(1)}% over the 12 months to ${fmtPeriod(row.cpi.period)}, the real rate (policy rate minus inflation) is ${signed(row.realRate)}${
        row.realRate > 0 ? ": borrowing costs are above inflation" : ": borrowing costs are below inflation"
      }.`,
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Breadcrumbs
          items={[
            { name: "Interest rates", href: "/rates" },
            { name: row.name, href: `/rates/${row.slug}` },
          ]}
        />
        <h1 className="mt-2 text-2xl font-semibold">{row.name} interest rate</h1>
        {row.bank && <p className="text-sm text-zinc-500">{row.bank}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Policy rate" value={rateLabel(row)} note={fmtAsOf(row.asOf)} />
        <Tile
          label="Last move"
          value={row.lastMove ? fmtPp(row.lastMove.to - row.lastMove.from) : "None"}
          note={row.lastMove ? fmtAsOf(row.lastMove.period) : "in the past year"}
        />
        {row.code === "EURO" ? (
          <Tile label="12-month change" value={row.change12m !== null ? fmtPp(row.change12m) : "–"} note="vs a year earlier" />
        ) : (
          <Tile label="Inflation" value={row.cpi ? `${row.cpi.value.toFixed(1)}%` : "–"} note={row.cpi ? fmtPeriod(row.cpi.period) : "not available"} />
        )}
        {row.code === "EURO" ? (
          <Tile label="Member countries" value={String(members.length)} note="share this rate" />
        ) : (
          <Tile label="10-year bond yield" value={row.bond ? fmtYield(row.bond.value) : "–"} note={row.bond ? fmtPeriod(row.bond.period) : "not available"} />
        )}
      </dl>

      <p className="leading-relaxed text-zinc-800">{summary.join(" ")}</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Policy rate over the past two years</h2>
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <RateChart label={`${row.name} policy rate`} labels={labels} values={values} decimals={row.code === "USA" ? 3 : 2} />
        </div>
        {row.code === "USA" && (
          <p className="text-xs text-zinc-500">The chart shows the midpoint of the Federal Reserve&apos;s 0.25-point target range.</p>
        )}
      </section>

      {row.moves.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Rate changes</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">When</th>
                  <th className="px-3 py-2 font-semibold">Decision</th>
                  <th className="px-3 py-2 text-right font-semibold">From</th>
                  <th className="px-3 py-2 text-right font-semibold">To</th>
                  <th className="px-3 py-2 text-right font-semibold">Change</th>
                </tr>
              </thead>
              <tbody>
                {row.moves.map((m) => (
                  <tr key={m.period} className="border-t border-zinc-100">
                    <td className="whitespace-nowrap px-3 py-2">{fmtAsOf(m.period)}</td>
                    <td className="px-3 py-2">{moveKind(m) === "hike" ? "Hike" : "Cut"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{rateAt(row, m.from)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{rateAt(row, m.to)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPp(m.to - m.from)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500">
            Changes between month-end rates{row.hist.length > 0 && row.hist[row.hist.length - 1][0].length > 7 ? ", plus the latest daily reading" : ""}.
            Two decisions in one month show up as a single change.
          </p>
        </section>
      )}

      {(Boolean(cpiSeries?.hist.length) || Boolean(bondSeries?.hist.length)) && (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cpiSeries && cpiSeries.hist.length > 1 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-3">
              <h2 className="text-sm font-medium">Inflation (% vs a year earlier)</h2>
              <RateChart
                label="Inflation"
                labels={cpiSeries.hist.map(([p]) => fmtPeriod(p))}
                values={cpiSeries.hist.map(([, v]) => v)}
                decimals={1}
                height={120}
              />
            </div>
          )}
          {bondSeries && bondSeries.hist.length > 1 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-3">
              <h2 className="text-sm font-medium">10-year government bond yield</h2>
              <RateChart
                label="10-year bond yield"
                labels={bondSeries.hist.map(([p]) => fmtPeriod(p))}
                values={bondSeries.hist.map(([, v]) => v)}
                height={120}
              />
            </div>
          )}
        </section>
      )}

      {members.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Euro area countries</h2>
          <p className="text-sm text-zinc-600">
            All {members.length} countries share the ECB&apos;s rate, but inflation and government borrowing costs differ.
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-600">
                <tr>
                  <th className="px-3 py-2 font-semibold">Country</th>
                  <th className="px-3 py-2 text-right font-semibold">Inflation</th>
                  <th className="px-3 py-2 text-right font-semibold">Real rate</th>
                  <th className="px-3 py-2 text-right font-semibold">10-yr bond</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.code} className="border-t border-zinc-100">
                    <td className="px-3 py-2">
                      <Link href={`/economy?country=${m.code}`} className="text-blue-700 hover:underline">
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {m.cpi ? `${m.cpi[1].toFixed(1)}% (${fmtPeriod(m.cpi[0])})` : "–"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.cpi ? signed(row.rate - m.cpi[1]) : "–"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.bond ? fmtYield(m.bond[1]) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {peers.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium">Other central banks in {row.region}</h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {peers.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/rates/${p.slug}`}
                  className="flex justify-between rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm hover:border-zinc-400"
                >
                  <span>{p.name}</span>
                  <span className="font-medium tabular-nums">{rateLabel(p)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-zinc-500">
        Source: {row.source}
        {cpiSeries ? `; inflation: ${cpiSeries.source}` : ""}
        {bondSeries ? `; bond yield: ${bondSeries.source}` : ""}. Updated daily.{" "}
        <Link href="/rates" className="underline">
          All central bank rates
        </Link>
        {row.code !== "EURO" && (
          <>
            {" · "}
            <Link href={`/economy?country=${row.code}`} className="underline">
              {row.name} economy dashboard
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

function lastOf(hist: Point[] | undefined, today: string): Point | null {
  const last = hist?.[hist.length - 1];
  if (!last) return null;
  const age = (Date.parse(today) - Date.parse(`${last[0].slice(0, 7)}-01`)) / 86400_000;
  return age <= 290 ? last : null;
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-zinc-500">{note}</dd>
    </div>
  );
}
