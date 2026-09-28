// Builds src/data/world-places.json for /world-risks: the projection the
// /economy map was drawn with (so points line up with its shapes), and each
// country's names + a representative point, used to place events that only
// name a country (WHO outbreak notices). Re-run only if the map changes:
//   npx tsx scripts/build-world-places.ts
import fs from "node:fs";
import path from "node:path";
import { geoNaturalEarth1 } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection } from "geojson";
import worldCountries from "world-countries";

const topo = JSON.parse(
  fs.readFileSync(require.resolve("world-atlas/countries-110m.json"), "utf8")
) as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection;
fc.features = fc.features.filter((f) => f.properties?.name !== "Antarctica");

// Same call as scripts/fetch-macro.ts builds the map with.
const width = 1000;
const height = 520;
const projection = geoNaturalEarth1().fitExtent(
  [
    [4, 4],
    [width - 4, height - 4],
  ],
  fc
);

const places = worldCountries.map((c) => ({
  iso3: c.cca3,
  name: c.name.common,
  aliases: [...new Set([c.name.official, ...c.altSpellings].filter((n) => n.length > 3))],
  lat: c.latlng[0],
  lon: c.latlng[1],
}));

const out = {
  projection: { scale: projection.scale(), translate: projection.translate() },
  places,
};
fs.writeFileSync(path.join(__dirname, "../src/data/world-places.json"), JSON.stringify(out));
console.log(out.projection, places.length);
