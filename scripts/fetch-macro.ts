/**
 * Builds the bundled data behind /economy, plus a pre-projected world map.
 *
 *   npm run fetch-macro
 *
 * Writes:
 *   src/data/macro.json       IMF WEO annual values per country/aggregate,
 *                             2000-2030, and the country list (name, region,
 *                             ISO2, currency)
 *   src/data/macro-live.json  latest monthly/quarterly/daily figures
 *                             (src/lib/macroLive.ts)
 *   src/data/world-map.json   SVG path per ISO3 country (Natural Earth)
 *
 * In production /api/cron/macro refreshes both data sets daily into the
 * database; these files are the fallback when the database has nothing yet.
 * Re-run this when the country list or map should change.
 */
import fs from "node:fs";
import path from "node:path";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldCountries from "world-countries";
import { INDICATORS, AGGREGATES } from "../src/lib/macro";
import { fetchWeoCountryLabels, fetchWeoSeries, WEO_YEARS } from "../src/lib/macroWeo";
import { fetchLive } from "../src/lib/macroLive";

const OUT_DIR = path.join(__dirname, "..", "src", "data");

// IMF uses a few non-ISO codes.
const IMF_CODE_FIXES: Record<string, string> = { XKX: "UVK", PSE: "WBG" };
// world-countries lists several currencies for these; the one in use first.
const CURRENCY_OVERRIDE: Record<string, string> = { WBG: "ILS", ZWE: "ZWG" };
// world-countries' own code for the same places.
const WORLD_COUNTRIES_CODE: Record<string, string> = { UVK: "UNK", WBG: "PSE" };

async function fetchValues() {
  const [labels, { source, series }] = await Promise.all([fetchWeoCountryLabels(), fetchWeoSeries()]);
  for (const ind of INDICATORS) console.log(`${ind.code}: ${Object.keys(series[ind.code]).length} entities`);

  const byCode = new Map(worldCountries.map((c) => [c.cca3, c]));
  // Plain-English names (IMF's own labels read "Korea, Republic of" etc.).
  const nameOverride: Record<string, string> = { COD: "DR Congo", COG: "Republic of the Congo" };

  // Territories IMF reports that aren't worth a row (no own data in most
  // indicators) are dropped by requiring at least 3 indicators.
  const entities: { code: string; name: string; region: string; iso2?: string; currency?: string }[] = [];
  for (const [code, { label }] of Object.entries(labels)) {
    const present = INDICATORS.filter((ind) => series[ind.code][code]).length;
    if (present < 3) continue;
    const wc = byCode.get(WORLD_COUNTRIES_CODE[code] ?? code);
    entities.push({
      code,
      name: nameOverride[code] ?? wc?.name.common ?? label.replace(/, The$/, ""),
      region: wc ? (wc.region === "Americas" ? wc.subregion : wc.region) : "Other",
      iso2: wc?.cca2,
      currency: CURRENCY_OVERRIDE[code] ?? (wc ? Object.keys(wc.currencies ?? {})[0] : undefined),
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
    source,
    fetchedAt: new Date().toISOString().slice(0, 10),
    years: WEO_YEARS,
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

  const livePath = path.join(OUT_DIR, "macro-live.json");
  const previousLive = fs.existsSync(livePath) ? JSON.parse(fs.readFileSync(livePath, "utf8")) : null;
  const live = await fetchLive(macro.countries, previousLive);
  fs.writeFileSync(livePath, JSON.stringify(live));
  for (const [k, v] of Object.entries(live.sources)) {
    const n = k === "fx" ? Object.keys(live.fx).length : Object.keys(live.metrics[k as keyof typeof live.metrics]).length;
    console.log(`live ${k}: ${v.ok ? "ok" : "FAILED " + v.error} (${n} countries)`);
  }

  const map = buildMap();
  fs.writeFileSync(path.join(OUT_DIR, "world-map.json"), JSON.stringify(map));
  const unmatched = map.shapes.filter((s) => !macro.countries.some((c) => c.code === s.code));
  console.log(`world-map.json: ${map.shapes.length} shapes; without IMF data: ${unmatched.map((s) => s.name).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
