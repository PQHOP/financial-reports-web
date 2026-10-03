import Link from "@/components/Link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { RiskMap } from "@/components/worldRisks/RiskMap";
import { ImpactBody } from "@/components/worldRisks/ImpactBody";
import { LEVEL_COLOR, LEVEL_LABEL, formatEventDate } from "@/components/worldRisks/riskStyle";
import type { MapData } from "@/lib/macro";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import {
  bySeverity,
  fetchChokepoints,
  fetchDisasters,
  fetchEarthquakes,
  fetchOutbreaks,
  type RiskEvent,
  type SourceStatus,
} from "@/lib/worldRisks";
import { allImpactTickers, impactFor, type ResolvedImpact } from "@/lib/riskImpacts";
import { fetchSignals, type Signal, type SignalState } from "@/lib/riskSignals";
import { prismaCached as prisma } from "@/lib/prisma";
import { systemReports } from "@/lib/community";
import mapJson from "@/data/world-map.json";

// Cached on the CDN for 15 minutes; the feeds themselves are cached for
// 10-60 minutes in Next's data cache (src/lib/worldRisks.ts).
export const revalidate = 900;

const map = mapJson as MapData;

export const metadata: Metadata = {
  title: "World Risk Monitor: Disasters, Outbreaks and Shipping Chokepoints",
  description:
    "Live map of severe natural disasters, earthquakes, disease outbreaks and ship traffic through key maritime chokepoints, plus less obvious signals (solar storms, Mississippi River levels, exploited software flaws, FDA recalls, severe US weather) and the companies each one reaches.",
  alternates: { canonical: "/world-risks" },
};

function Badge({ e }: { e: RiskEvent }) {
  if (!e.level) return null;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-zinc-700">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: LEVEL_COLOR[e.level] }} aria-hidden />
      {LEVEL_LABEL[e.level]}
    </span>
  );
}

function EventTable({ events, empty }: { events: RiskEvent[]; empty: string }) {
  if (events.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-zinc-600">
          <tr>
            <th className="px-3 py-2 font-semibold">Event</th>
            <th className="px-3 py-2 font-semibold">Where</th>
            <th className="px-3 py-2 font-semibold">Level</th>
            <th className="px-3 py-2 font-semibold">When</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t border-zinc-100 align-top">
              <td className="px-3 py-2">
                <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                  {e.title}
                </a>
                {e.detail && <div className="text-xs text-zinc-500">{e.detail}</div>}
              </td>
              <td className="px-3 py-2 text-zinc-700">{e.place}</td>
              <td className="px-3 py-2">
                <Badge e={e} />
                {!e.current && <div className="text-xs text-zinc-500">ended</div>}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-600">{formatEventDate(e)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const pts = values.map((v, i) => [i, v] as const).filter(([, v]) => Number.isFinite(v));
  if (pts.length < 2) return null;
  const min = Math.min(...pts.map(([, v]) => v));
  const max = Math.max(...pts.map(([, v]) => v));
  const w = 96;
  const h = 24;
  const x = (i: number) => (i / (values.length - 1)) * (w - 4) + 2;
  const y = (v: number) => (max === min ? h / 2 : h - 3 - ((v - min) / (max - min)) * (h - 6));
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden className="overflow-visible">
      <polyline
        points={pts.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(last[0])} cy={y(last[1])} r={2.5} fill={color} />
    </svg>
  );
}

function ChokepointTable({ events }: { events: RiskEvent[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-zinc-600">
          <tr>
            <th className="px-3 py-2 font-semibold">Chokepoint</th>
            <th className="px-3 py-2 text-right font-semibold">Ships / day</th>
            <th className="px-3 py-2 text-right font-semibold">A year ago</th>
            <th className="px-3 py-2 text-right font-semibold">Change</th>
            <th className="px-3 py-2 font-semibold">Last 12 weeks</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t border-zinc-100">
              <td className="px-3 py-2">
                <div className="font-medium text-zinc-900">{e.title}</div>
                <Badge e={e} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{e.recent!.toFixed(0)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-600">{e.yearAgo!.toFixed(0)}</td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {e.change! > 0 ? "+" : ""}
                {e.change!.toFixed(0)}%
              </td>
              <td className="px-3 py-2">
                <Sparkline values={e.weekly ?? []} color={LEVEL_COLOR[e.level ?? "normal"] === LEVEL_COLOR.normal ? "#52514e" : LEVEL_COLOR[e.level!]} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImpactList({ items }: { items: { e: RiskEvent; impact: ResolvedImpact }[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map(({ e, impact }) => (
        <li key={e.id} className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-medium text-zinc-900">{e.title}</span>
            <Badge e={e} />
            {e.layer === "chokepoint" && e.change !== undefined && (
              <span className="text-xs text-zinc-600">
                ships {e.change.toFixed(0)}% vs a year ago
              </span>
            )}
          </div>
          <ImpactBody impact={impact} />
        </li>
      ))}
    </ul>
  );
}

const STATE_STYLE: Record<SignalState, { label: string; dot: string }> = {
  alert: { label: "Alert", dot: "#d03b3b" },
  watch: { label: "Watch", dot: "#ec835a" },
  normal: { label: "Normal", dot: "#a3a29b" },
  unavailable: { label: "Unavailable", dot: "#a3a29b" },
};

function SignalCard({ signal, hrefByTicker }: { signal: Signal; hrefByTicker: Map<string, string> }) {
  const st = STATE_STYLE[signal.state];
  const groups = signal.groups
    .map((g) => ({
      role: g.role,
      companies: g.tickers.flatMap((t) => {
        const href = hrefByTicker.get(t);
        return href ? [{ ticker: t, href }] : [];
      }),
    }))
    .filter((g) => g.companies.length > 0);
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium text-zinc-900">{signal.title}</h3>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-700">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: st.dot }} aria-hidden />
          {st.label}
        </span>
      </div>
      <p className="text-sm font-medium text-zinc-800">{signal.headline}</p>
      <p className="text-sm text-zinc-600">{signal.why}</p>
      {signal.items.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-zinc-100 pt-2 text-xs">
          {signal.items.map((i, n) => (
            <li key={`${i.label}-${n}`} className="flex flex-col">
              <span className="text-zinc-800">
                {i.url ? (
                  <a href={i.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {i.label}
                  </a>
                ) : (
                  i.label
                )}
                {i.tickers?.map((t) => {
                  const href = hrefByTicker.get(t);
                  return href ? (
                    <Link key={t} href={href} className="ml-1.5 font-medium text-blue-700 hover:underline">
                      {t}
                    </Link>
                  ) : null;
                })}
              </span>
              {i.sub && <span className="text-zinc-500">{i.sub}</span>}
            </li>
          ))}
        </ul>
      )}
      {groups.length > 0 && <ImpactBody impact={{ why: "", groups }} />}
      <p className="mt-auto pt-1 text-[11px] text-zinc-400">
        <a href={signal.source.url} target="_blank" rel="noopener noreferrer" className="underline">
          {signal.source.name}
        </a>{" "}
        · {signal.source.ok ? `checked ${signal.source.fetchedAt.slice(11, 16)} UTC` : "unavailable"} · delay{" "}
        {signal.source.lag}
      </p>
    </article>
  );
}

function Tile({ value, label, note }: { value: number | string; label: string; note: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-sm text-zinc-700">{label}</div>
      <div className="text-xs text-zinc-500">{note}</div>
    </div>
  );
}

function Sources({ statuses }: { statuses: SourceStatus[] }) {
  return (
    <ul className="flex flex-col gap-1 text-xs text-zinc-500">
      {statuses.map((s) => (
        <li key={s.name}>
          <span
            className={`mr-1.5 inline-block h-2 w-2 rounded-full ${s.ok ? "bg-emerald-600" : "bg-red-600"}`}
            aria-hidden
          />
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
            {s.name}
          </a>
          : {s.ok ? `checked ${s.fetchedAt.slice(11, 16)} UTC` : "unavailable right now, try again shortly"} · source
          delay {s.lag}
        </li>
      ))}
    </ul>
  );
}

export default async function WorldRisksPage() {
  const [disasters, quakes, outbreaks, chokepoints, signals] = await Promise.all([
    fetchDisasters(),
    fetchEarthquakes(),
    fetchOutbreaks(),
    fetchChokepoints(),
    fetchSignals(),
  ]);

  const serious = disasters.events.filter((e) => e.level === "red" || e.level === "orange").sort(bySeverity);
  const quakeList = [...quakes.events].sort(
    (a, b) => (a.current === b.current ? b.start.localeCompare(a.start) : Number(b.current) - Number(a.current))
  );
  const choke = [...chokepoints.events].sort((a, b) => a.change! - b.change!);
  const all = [...disasters.events, ...quakes.events, ...outbreaks.events, ...chokepoints.events];

  // Link only companies with a published analysis (their page is the target).
  // A database hiccup only drops the company links, not the page.
  const covered = await prisma.company
    .findMany({
      where: {
        ticker: {
          in: [
            ...allImpactTickers(),
            ...signals.flatMap((s) => [...s.groups.flatMap((g) => g.tickers), ...s.items.flatMap((i) => i.tickers ?? [])]),
          ],
        },
        reports: { some: systemReports },
      },
      select: { ticker: true, slug: true },
    })
    .catch(() => []);
  const hrefByTicker = new Map(covered.map((c) => [c.ticker!, `/companies/${c.slug}`]));
  const impacts: Record<string, ResolvedImpact> = {};
  for (const e of all) {
    const impact = impactFor(e);
    if (!impact) continue;
    const groups = impact.groups
      .map((g) => ({
        role: g.role,
        companies: g.tickers.flatMap((t) => {
          const href = hrefByTicker.get(t);
          return href ? [{ ticker: t, href }] : [];
        }),
      }))
      .filter((g) => g.companies.length > 0);
    if (groups.length > 0) impacts[e.id] = { why: impact.why, groups };
  }
  const impactItems = all
    .filter((e) => impacts[e.id])
    // Same level: the bigger traffic drop first.
    .sort((a, b) => bySeverity(a, b) || (a.change ?? 0) - (b.change ?? 0))
    .map((e) => ({ e, impact: impacts[e.id] }));

  const activeSevere = serious.filter((e) => e.current).length;
  // Titles read "M6.6 earthquake".
  const bigQuakes = quakes.events.filter((e) => e.current && parseFloat(e.title.slice(1)) >= 6).length;
  const disrupted = choke.filter((e) => e.level === "down" || e.level === "low").length;

  return (
    <div className="ml-[calc(50%-min(40rem,50vw-1rem))] flex w-[min(80rem,calc(100vw-2rem))] flex-col gap-6">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "World risk monitor",
          description: metadata.description,
          url: `${SITE_URL}/world-risks`,
          spatialCoverage: "World",
          isBasedOn: [
            "https://www.gdacs.org/",
            "https://earthquake.usgs.gov/",
            "https://www.who.int/emergencies/disease-outbreak-news",
            "https://portwatch.imf.org/",
          ],
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        }}
      />
      <div>
        <h1 className="text-2xl font-semibold">World risk monitor</h1>
        <p className="mt-1 max-w-3xl text-zinc-600">
          Severe natural disasters, significant earthquakes, disease outbreaks and ship traffic through the
          world&apos;s maritime chokepoints on one map. Each layer refreshes from its official source every
          10–60 minutes; how current the underlying data is depends on the source (listed at the bottom).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile value={activeSevere} label="Active orange/red disasters" note="GDACS alerts, ongoing now" />
        <Tile value={bigQuakes} label="Magnitude 6+ earthquakes" note="last 7 days (USGS)" />
        <Tile value={outbreaks.events.length} label="Outbreaks in WHO notices" note="last 120 days" />
        <Tile
          value={chokepoints.status.ok ? `${disrupted} of ${choke.length}` : "–"}
          label="Chokepoints with fewer ships"
          note={chokepoints.asOf ? `10%+ below a year ago, week to ${chokepoints.asOf}` : "data unavailable"}
        />
      </div>

      <RiskMap map={map} events={all} impacts={impacts} />

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Why markets care: companies in the path</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          For the events above that have a well-established link to business results, how the effect usually
          travels and which companies we cover sit on that path. This describes exposure, not a forecast: how
          much an event matters depends on how long it lasts, and each company&apos;s latest analysis has the
          detail.
        </p>
        {impactItems.length > 0 ? (
          <ImpactList items={impactItems} />
        ) : (
          <p className="text-sm text-zinc-500">
            None of today&apos;s events has a direct link to the companies we cover.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Less obvious signals that reach company results</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Events that don&apos;t look financial at first — a solar storm, a river running low, a software flaw
          under attack, a product recall — but have a known route into revenue or costs. Each card says what
          the route is and, when the signal is live, which companies we cover sit on it.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[...signals]
            .sort((a, b) => ["alert", "watch", "normal", "unavailable"].indexOf(a.state) - ["alert", "watch", "normal", "unavailable"].indexOf(b.state))
            .map((s) => (
              <SignalCard key={s.id} signal={s} hrefByTicker={hrefByTicker} />
            ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Shipping chokepoints: traffic vs a year ago</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Average ships passing each day over the latest week in IMF PortWatch&apos;s satellite ship-tracking
          data, against the same week a year earlier. A sustained drop usually means ships are avoiding the
          route (conflict, drought, canal restrictions) and taking longer ones, which raises freight costs and
          delivery times.
        </p>
        {chokepoints.status.ok ? (
          <ChokepointTable events={choke} />
        ) : (
          <p className="text-sm text-zinc-500">PortWatch data is unavailable right now.</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Severe disasters (orange and red alerts, last 30 days)</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          GDACS rates each cyclone, flood, drought, volcano and wildfire by its likely humanitarian impact:
          red means international help is likely needed, orange a significant regional event.
        </p>
        <EventTable events={serious} empty="No orange or red disaster alerts in the last 30 days." />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Significant earthquakes</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Magnitude 6 and above in the last 30 days, any quake with a USGS PAGER impact alert, and magnitude
          5.5 and above in the last week.
        </p>
        <EventTable events={quakeList} empty="No significant earthquakes in this window." />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Disease outbreaks reported by WHO</h2>
        <p className="max-w-3xl text-sm text-zinc-600">
          Events WHO has published a Disease Outbreak News notice on in the last 120 days, one row per disease
          and country, dated by the latest notice.
        </p>
        <EventTable events={outbreaks.events} empty="No WHO outbreak notices in the last 120 days." />
      </section>

      <section className="flex flex-col gap-2 border-t border-zinc-200 pt-4">
        <h2 className="text-sm font-medium text-zinc-700">Sources and freshness</h2>
        <Sources statuses={[disasters.status, quakes.status, outbreaks.status, chokepoints.status]} />
        <p className="text-xs text-zinc-500">
          Figures are shown as each source publishes them. For information only; not investment advice. See
          also the <Link href="/economy" className="underline">global economy dashboard</Link>.
        </p>
      </section>
    </div>
  );
}
