import type { Metadata } from "next";
import { EconomyDashboard } from "@/components/economy/EconomyDashboard";
import { JsonLd } from "@/components/JsonLd";
import { INDICATORS, LIVE_INDICATORS, type MapData } from "@/lib/macro";
import { loadMacro } from "@/lib/macroStore";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import bundledWeo from "@/data/macro.json";
import mapJson from "@/data/world-map.json";

export const dynamic = "force-dynamic";

const map = mapJson as MapData;
// The WEO edition year is the first forecast year.
const EDITION_YEAR = Number(bundledWeo.source.match(/(\d{4})/)?.[1] ?? new Date().getUTCFullYear());

export const metadata: Metadata = {
  title: `Global Economy Dashboard ${EDITION_YEAR}: Inflation, GDP, Interest Rates by Country`,
  description:
    "Latest inflation, GDP growth, unemployment, central bank rates, bond yields and currency moves for 190+ economies on one interactive map, updated daily, with IMF annual data and forecasts to 2030.",
  alternates: { canonical: "/economy" },
};

export default async function EconomyPage({ searchParams }: PageProps<"/economy">) {
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const { weo, live } = await loadMacro();

  const view = pick(sp.view) === "annual" ? "annual" : "latest";
  const valid = view === "annual" ? INDICATORS : LIVE_INDICATORS;
  const indicator = valid.some((i) => i.code === pick(sp.indicator)) ? pick(sp.indicator)! : valid[0].code;
  const y = Number(pick(sp.year));
  const year = weo.years.slice(1).includes(y) ? y : EDITION_YEAR;
  const c = pick(sp.country)?.toUpperCase() ?? null;
  const country = c && weo.countries.some((x) => x.code === c) ? c : null;

  return (
    // Wider than the site's reading column (the map and tables need the
    // room), centered with margins rather than a transform: a transformed
    // ancestor would re-anchor the fixed tooltip and phone bottom sheet.
    <div className="ml-[calc(50%-min(40rem,50vw-1rem))] w-[min(80rem,calc(100vw-2rem))]">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "Global economy dashboard",
          description: metadata.description,
          url: `${SITE_URL}/economy`,
          temporalCoverage: `${weo.years[0]}/${weo.years[weo.years.length - 1]}`,
          spatialCoverage: "World",
          variableMeasured: [...LIVE_INDICATORS, ...INDICATORS].map((i) => i.label),
          isBasedOn: [
            "https://www.imf.org/external/datamapper/",
            "https://data.imf.org/",
            "https://ilostat.ilo.org/",
            "https://data.bis.org/",
            "https://data-explorer.oecd.org/",
          ],
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          dateModified: live.updatedAt,
        }}
      />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="text-2xl font-semibold">Global economy dashboard</h1>
          <p className="mt-1 max-w-3xl text-zinc-600">
            Inflation, growth, jobs, interest rates and currencies for {weo.countries.length} economies, from each country&apos;s latest
            release. Blue on the map is healthier, red is weaker.
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" aria-hidden />
          Updated daily · last {new Date(live.updatedAt).toUTCString().slice(5, 16)}
        </p>
      </div>
      <EconomyDashboard data={weo} live={live} map={map} initial={{ view, indicator, year, country }} />
      <div className="mt-8 flex flex-col gap-1 text-xs text-zinc-500">
        <p>
          Sources: International Monetary Fund ({weo.source}, retrieved {weo.fetchedAt}; consumer prices, national accounts, labor,
          monetary and exchange rate statistics), ILOSTAT (International Labour Organization), Bank for International Settlements
          (central bank policy rates), OECD (long-term interest rates), and{" "}
          <a href="https://www.exchangerate-api.com" className="underline" rel="nofollow">
            Rates By Exchange Rate API
          </a>{" "}
          (today&apos;s exchange rates). Latest figures refreshed {live.updatedAt.slice(0, 16).replace("T", " ")} UTC.
        </p>
        <p>
          Countries publish on different schedules, so &quot;latest&quot; means different months for different countries; each figure shows
          its own period. Region and group totals are IMF annual figures. IMF estimates and forecasts are revised with each edition (April and
          October). Map boundaries are for illustration only.
        </p>
      </div>
    </div>
  );
}
