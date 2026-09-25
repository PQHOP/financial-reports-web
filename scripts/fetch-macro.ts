/**
 * Builds the static data behind /economy from the IMF World Economic Outlook
 * (DataMapper API, free, no key) plus a pre-projected world map.
 *
 *   npm run fetch-macro
 *
 * Writes:
 *   src/data/macro.json      indicator values per country/aggregate, 2000-2030
 *   src/data/world-map.json  SVG path per ISO3 country (Natural Earth projection)
 *
 * The IMF publishes the WEO twice a year (April and October), so re-run this
 * after each release and redeploy. Nothing on the site calls the IMF at
 * request time.
 */
import fs from "node:fs";
import path from "node:path";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldCountries from "world-countries";
import { INDICATORS, AGGREGATES } from "../src/lib/macro";

const API = "https://www.imf.org/external/datamapper/api/v1";
const FIRST_YEAR = 2000;
const LAST_YEAR = 2030;
const OUT_DIR = path.join(__dirname, "..", "src", "data");

// IMF uses a few non-ISO codes.
const IMF_CODE_FIXES: Record<string, string> = { XKX: "UVK", PSE: "WBG" };
// Territories IMF reports that aren't worth a table row (no own economy data
// in most indicators) are dropped by requiring at least 3 indicators below.

async function getJson<T>(url: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "FinancialReportInsights macro-fetch" } });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return (await res.json()) as T;
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

function round(v: number, code: string): number {
  // Dollar levels keep whole units; rates keep one decimal.
  if (code === "NGDPDPC") return Math.round(v);
  if (code === "NGDPD") return Math.round(v * 10) / 10;
  return Math.round(v * 10) / 10;
}

async function fetchValues() {
  const years = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);
  const countries = await getJson<{ countries: Record<string, { label: string }> }>(`${API}/countries`);
  const meta = await getJson<{ indicators: Record<string, { label: string; source: string }> }>(
    `${API}/indicators`,
  );
  const sourceLabel = meta.indicators[INDICATORS[0].code]?.source ?? "IMF World Economic Outlook";

  // series[code][entity] = values aligned to `years` (null = missing)
  const series: Record<string, Record<string, (number | null)[]>> = {};
  for (const ind of INDICATORS) {
    const res = await getJson<{ values: Record<string, Record<string, Record<string, number>>> }>(
      `${API}/${ind.code}`,
    );
    const byEntity = res.values[ind.code] ?? {};
    series[ind.code] = {};
    for (const [entity, byYear] of Object.entries(byEntity)) {
      const row = years.map((y) => (byYear[y] == null ? null : round(byYear[y], ind.code)));
      if (row.some((v) => v != null)) series[ind.code][entity] = row;
    }
    console.log(`${ind.code}: ${Object.keys(byEntity).length} entities`);
  }

  const regionOf = new Map(worldCountries.map((c) => [c.cca3, c.region === "Americas" ? c.subregion : c.region]));
  // Plain-English names (IMF's own labels read "Korea, Republic of" etc.).
  const commonName = new Map(worldCountries.map((c) => [c.cca3, c.name.common]));
  commonName.set("COD", "DR Congo");
  commonName.set("COG", "Republic of the Congo");
  regionOf.set("XKX", "Europe");

  const entities: { code: string; name: string; region: string }[] = [];
  for (const [code, { label }] of Object.entries(countries.countries)) {
    const present = INDICATORS.filter((ind) => series[ind.code][code]).length;
    if (present < 3) continue;
    const isoForRegion = Object.entries(IMF_CODE_FIXES).find(([, imf]) => imf === code)?.[0] ?? code;
    entities.push({
      code,
      name: commonName.get(isoForRegion) ?? label.replace(/, The$/, ""),
      region: regionOf.get(isoForRegion) ?? "Other",
    });
  }
  entities.sort((a, b) => a.name.localeCompare(b.name));

  const aggregates = AGGREGATES.filter((a) => INDICATORS.some((ind) => series[ind.code][a.code]));
  const keep = new Set([...entities.map((e) => e.code), ...aggregates.map((a) => a.code)]);
  for (const ind of INDICATORS) {
    for (const entity of Object.keys(series[ind.code])) {
      if (!keep.has(entity)) delete series[ind.code][entity];
    }
  }

  return {
    source: sourceLabel,
    fetchedAt: new Date().toISOString().slice(0, 10),
    years,
    countries: entities,
    aggregates: aggregates.map((a) => a.code),
    series,
  };
}

function buildMap() {
  const load = (res: string) =>
    JSON.parse(fs.readFileSync(require.resolve(`world-atlas/${res}`), "utf8")) as Topology<{
      countries: GeometryCollection<{ name: string }>;
    }>;
  const coarse = load("countries-110m.json");
  const fine = load("countries-50m.json");
  const toFeatures = (topo: typeof coarse) =>
    (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>).features;

  const isoByNumeric = new Map(worldCountries.map((c) => [c.ccn3, c.cca3]));
  const isoByName = new Map(worldCountries.map((c) => [c.name.common, c.cca3]));
  isoByName.set("Kosovo", "XKX");
  const toIso = (f: Feature<Geometry, { name: string }>) => {
    const iso = (f.id != null && isoByNumeric.get(String(f.id))) || isoByName.get(f.properties.name);
    return iso ? (IMF_CODE_FIXES[iso] ?? iso) : null;
  };

  const coarseFeatures = toFeatures(coarse).filter((f) => f.properties.name !== "Antarctica");
  const have = new Set(coarseFeatures.map(toIso));
  // Small states (Singapore, Bahrain, Malta, island nations...) are missing at
  // 110m; take just those from the 50m file so they can still be hovered.
  const extras = toFeatures(fine).filter((f) => {
    const iso = toIso(f);
    return iso && !have.has(iso) && f.properties.name !== "Antarctica";
  });
  const all = [...coarseFeatures, ...extras];

  const width = 1000;
  const height = 520;
  const projection = geoNaturalEarth1().fitExtent(
    [
      [4, 4],
      [width - 4, height - 4],
    ],
    { type: "FeatureCollection", features: coarseFeatures } as FeatureCollection,
  );
  const pathGen = geoPath(projection).digits(1);

  const shapes: { code: string; name: string; d: string }[] = [];
  for (const f of all) {
    const code = toIso(f);
    const d = pathGen(f);
    if (!d) continue;
    shapes.push({ code: code ?? "", name: f.properties.name, d });
  }
  return { width, height, shapes };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const macro = await fetchValues();
  fs.writeFileSync(path.join(OUT_DIR, "macro.json"), JSON.stringify(macro));
  console.log(`macro.json: ${macro.countries.length} countries, ${macro.aggregates.length} aggregates`);

  const map = buildMap();
  fs.writeFileSync(path.join(OUT_DIR, "world-map.json"), JSON.stringify(map));
  const unmatched = map.shapes.filter((s) => !macro.countries.some((c) => c.code === s.code));
  console.log(`world-map.json: ${map.shapes.length} shapes; without IMF data: ${unmatched.map((s) => s.name).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
