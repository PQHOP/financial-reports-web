import type { Metadata } from "next";
import { EconomyDashboard } from "@/components/economy/EconomyDashboard";
import { JsonLd } from "@/components/JsonLd";
import { INDICATORS, type MacroData, type MapData } from "@/lib/macro";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import macroJson from "@/data/macro.json";
import mapJson from "@/data/world-map.json";

export const dynamic = "force-dynamic";

const data = macroJson as MacroData;
const map = mapJson as MapData;
// The WEO vintage year is the first forecast year and the default view.
const DEFAULT_YEAR = Number(data.source.match(/(\d{4})/)?.[1] ?? new Date().getUTCFullYear());

export const metadata: Metadata = {
  title: `Global Economy Dashboard ${DEFAULT_YEAR}: GDP, Inflation, Debt by Country`,
  description:
    "Interactive world map and tables of GDP growth, inflation, government debt, budget balance, unemployment and GDP per person for 190+ economies, from the IMF World Economic Outlook, with year-over-year changes.",
  alternates: { canonical: "/economy" },
};

export default async function EconomyPage({ searchParams }: PageProps<"/economy">) {
  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const indicator = INDICATORS.some((i) => i.code === pick(sp.indicator)) ? pick(sp.indicator)! : INDICATORS[0].code;
  const y = Number(pick(sp.year));
  const year = data.years.slice(1).includes(y) ? y : DEFAULT_YEAR;
  const c = pick(sp.country)?.toUpperCase() ?? null;
  const country = c && data.countries.some((x) => x.code === c) ? c : null;

  return (
    // Wider than the site's reading column: the map and tables need the room.
    <div className="relative left-1/2 w-[min(80rem,calc(100vw-2rem))] -translate-x-1/2">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: "Global economy dashboard",
          description: metadata.description,
          url: `${SITE_URL}/economy`,
          temporalCoverage: `${data.years[0]}/${data.years[data.years.length - 1]}`,
          spatialCoverage: "World",
          variableMeasured: INDICATORS.map((i) => i.label),
          isBasedOn: "https://www.imf.org/external/datamapper/",
          creator: { "@type": "Organization", name: "International Monetary Fund" },
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
          dateModified: data.fetchedAt,
        }}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Global economy dashboard</h1>
        <p className="mt-2 max-w-3xl text-zinc-600">
          GDP, inflation, government debt and the other headline numbers for {data.countries.length} economies on one
          page. Pick an indicator and a year; blue on the map is healthier, red is weaker. In the tables, green ▲/▼
          means better than the year before and red means worse. Years from {DEFAULT_YEAR} on are IMF forecasts.
        </p>
      </div>
      <EconomyDashboard data={data} map={map} initial={{ indicator, year, country }} />
      <p className="mt-8 text-xs text-zinc-500">
        Source: International Monetary Fund, {data.source} (DataMapper), retrieved {data.fetchedAt}. Aggregates are the
        IMF&apos;s own weighted totals. Figures for the latest years are IMF estimates and forecasts and are revised with
        each new edition (April and October). Map boundaries are for illustration only.
      </p>
    </div>
  );
}
