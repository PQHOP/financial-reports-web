// /world-risks: disasters, earthquakes, disease outbreaks and shipping
// chokepoints from free public feeds, fetched server-side through Next's data
// cache (no database, no model calls). Each source fails on its own: a feed
// that is down leaves its layer empty with a note instead of breaking the page.
import { unstable_cache } from "next/cache";
import places from "@/data/world-places.json";

export type RiskLayer = "disaster" | "quake" | "outbreak" | "chokepoint";
// GDACS / USGS PAGER alert levels, and for chokepoints how far traffic is
// from a year earlier ("down" ≈ disrupted, "low" ≈ below normal).
export type RiskLevel = "red" | "orange" | "yellow" | "green" | "down" | "low" | "normal" | "up";

export type RiskEvent = {
  id: string;
  layer: RiskLayer;
  kind: string;
  title: string;
  place: string;
  level: RiskLevel | null;
  detail: string;
  start: string; // ISO
  end: string | null;
  current: boolean;
  url: string;
  lat: number;
  lon: number;
  // Projected onto the /economy map's 1000x520 viewBox; null = not placeable.
  x: number | null;
  y: number | null;
  // Chokepoints only.
  change?: number;
  recent?: number;
  yearAgo?: number;
  weekly?: number[];
};

export type SourceStatus = { name: string; url: string; ok: boolean; fetchedAt: string; lag: string; note?: string };

// ---- projection -----------------------------------------------------------
// The /economy map is d3's geoNaturalEarth1 fitted to a 1000x520 box
// (scripts/fetch-macro.ts); its scale/translate are stored by
// scripts/build-world-places.ts. The raw formula is inlined so the runtime
// doesn't need d3-geo (a dev dependency).
const { scale, translate } = places.projection;

export function project(lon: number, lat: number): { x: number; y: number } {
  const lambda = (lon * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const phi2 = phi * phi;
  const phi4 = phi2 * phi2;
  const x =
    lambda *
    (0.8707 - 0.131979 * phi2 + phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4)));
  const y =
    phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4)));
  return { x: x * scale + translate[0], y: -y * scale + translate[1] };
}

function located(lon: number, lat: number) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return { x: null, y: null };
  return project(lon, lat);
}

// Country name -> representative point, for feeds that only name a country.
const placeByName = new Map<string, { name: string; lat: number; lon: number }>();
for (const p of places.places) {
  for (const n of [p.name, ...p.aliases]) placeByName.set(n.toLowerCase(), p);
}
const PLACE_ALIASES: Record<string, string> = {
  "democratic republic of the congo": "DR Congo",
  "democratic republic of congo": "DR Congo",
  "republic of the congo": "Republic of the Congo",
  "united republic of tanzania": "Tanzania",
  "türkiye": "Turkey",
  "turkiye": "Turkey",
  "viet nam": "Vietnam",
  "lao people's democratic republic": "Laos",
  "syrian arab republic": "Syria",
  "iran (islamic republic of)": "Iran",
  "republic of korea": "South Korea",
  "the united kingdom": "United Kingdom",
  "united states of america": "United States",
  "bolivia (plurinational state of)": "Bolivia",
  "venezuela (bolivarian republic of)": "Venezuela",
  "russian federation": "Russia",
  "côte d'ivoire": "Ivory Coast",
  "cote d'ivoire": "Ivory Coast",
};

export function findPlace(name: string) {
  const key = name.trim().toLowerCase();
  const alias = PLACE_ALIASES[key];
  return placeByName.get((alias ?? name).trim().toLowerCase()) ?? null;
}

// ---- fetching ------------------------------------------------------------
const UA = "FinancialReportInsights/1.0 (+https://financialreportinsights.com/contact)";
const DAY = 86_400_000;

// Fetched uncached: each source's whole result (with its fetchedAt) is cached
// below by unstable_cache, so "checked at" reflects the real fetch time.
async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return (await res.json()) as T;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---- GDACS: cyclones, floods, volcanoes, droughts, wildfires -------------
type GdacsFeature = {
  geometry: { type: string; coordinates: number[] };
  properties: {
    eventtype: string;
    eventid: number;
    episodeid: number;
    name: string;
    alertlevel: string;
    iscurrent: string;
    country: string;
    fromdate: string;
    todate: string;
    severitydata?: { severitytext?: string };
    url: { report: string };
  };
};

const GDACS_KINDS: Record<string, string> = {
  TC: "Tropical cyclone",
  FL: "Flood",
  VO: "Volcano",
  DR: "Drought",
  WF: "Wildfire",
  EQ: "Earthquake",
};

function gdacsEvent(f: GdacsFeature): RiskEvent | null {
  const p = f.properties;
  if (p.eventtype === "EQ" || !GDACS_KINDS[p.eventtype]) return null; // quakes come from USGS
  const [lon, lat] = f.geometry.coordinates;
  const level = p.alertlevel.toLowerCase() as RiskLevel;
  // Timestamps without a zone are UTC.
  const utc = (s: string) => (s ? `${s.replace(/Z$/, "")}Z` : null);
  return {
    id: `gdacs-${p.eventtype}-${p.eventid}`,
    layer: "disaster",
    kind: GDACS_KINDS[p.eventtype],
    title: p.name.replace(/\s+/g, " ").trim(),
    place: p.country.replace(/\s+/g, " ").trim(),
    level: ["red", "orange", "green"].includes(level) ? level : null,
    // GDACS writes "Magnitude 0" for events it has no severity figure for.
    detail: (p.severitydata?.severitytext ?? "").replace(/\s+/g, " ").replace(/^Magnitude 0\s*$/, "").trim(),
    start: utc(p.fromdate)!,
    end: utc(p.todate),
    current: p.iscurrent === "true",
    url: p.url.report,
    lat,
    lon,
    ...located(lon, lat),
  };
}

async function fetchDisastersUncached(): Promise<{ events: RiskEvent[]; status: SourceStatus }> {
  const status: SourceStatus = {
    name: "GDACS (UN / European Commission)",
    url: "https://www.gdacs.org/",
    ok: true,
    fetchedAt: new Date().toISOString(),
    lag: "minutes to hours",
  };
  try {
    const now = new Date();
    const [current, recent] = await Promise.all([
      // Everything GDACS currently tracks, all alert levels.
      getJson<{ features: GdacsFeature[] }>(
        "https://www.gdacs.org/gdacsapi/api/Events/geteventlist/EVENTS4APP"
      ),
      // Orange/red events of the last 30 days, including ones already over.
      getJson<{ features: GdacsFeature[] }>(
        `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC;FL;VO;DR;WF&alertlevel=Orange;Red&fromdate=${isoDay(
          new Date(now.getTime() - 30 * DAY)
        )}&todate=${isoDay(now)}`
      ),
    ]);
    const byId = new Map<string, RiskEvent>();
    for (const f of [...recent.features, ...current.features]) {
      const e = gdacsEvent(f);
      if (e) byId.set(e.id, e); // current feed wins (newest episode)
    }
    return { events: [...byId.values()], status };
  } catch (err) {
    return { events: [], status: { ...status, ok: false, note: String(err) } };
  }
}

// ---- USGS earthquakes ----------------------------------------------------
type UsgsFeature = {
  id: string;
  geometry: { coordinates: number[] };
  properties: { mag: number; place: string; time: number; url: string; alert: string | null; tsunami: number };
};

async function fetchEarthquakesUncached(): Promise<{ events: RiskEvent[]; status: SourceStatus }> {
  const status: SourceStatus = {
    name: "USGS Earthquake Hazards Program",
    url: "https://earthquake.usgs.gov/earthquakes/map/",
    ok: true,
    fetchedAt: new Date().toISOString(),
    lag: "minutes",
  };
  try {
    const data = await getJson<{ features: UsgsFeature[] }>(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson"
    );
    const weekAgo = Date.now() - 7 * DAY;
    const events = data.features
      // Keep what could matter: M6+ in the last 30 days, anything with a
      // PAGER impact alert, and M5.5+ in the last week.
      .filter(
        (f) =>
          f.properties.mag >= 6 ||
          (f.properties.alert && f.properties.alert !== "green") ||
          (f.properties.mag >= 5.5 && f.properties.time >= weekAgo)
      )
      .map((f): RiskEvent => {
        const [lon, lat, depth] = f.geometry.coordinates;
        const p = f.properties;
        const alert = p.alert as RiskLevel | null;
        return {
          id: `usgs-${f.id}`,
          layer: "quake",
          kind: "Earthquake",
          title: `M${p.mag.toFixed(1)} earthquake`,
          place: p.place ?? "",
          level: alert,
          detail: `Magnitude ${p.mag.toFixed(1)}, depth ${Math.round(depth)} km${
            p.tsunami ? ", tsunami bulletin issued" : ""
          }${alert ? `, USGS PAGER ${alert} alert` : ""}`,
          start: new Date(p.time).toISOString(),
          end: null,
          current: p.time >= weekAgo,
          url: p.url,
          lat,
          lon,
          ...located(lon, lat),
        };
      });
    return { events, status };
  } catch (err) {
    return { events: [], status: { ...status, ok: false, note: String(err) } };
  }
}

// ---- WHO Disease Outbreak News -------------------------------------------
type WhoItem = { PublicationDateAndTime: string; Title: string; UrlName: string };

// "Ebola disease caused by Bundibugyo virus - Democratic Republic of the Congo"
// "Ebola disease ..., Democratic Republic of the Congo & Uganda"
export function splitOutbreakTitle(title: string): { disease: string; countries: string[] } {
  const clean = title.replace(/\s+/g, " ").trim();
  let idx = clean.lastIndexOf(" - ");
  let sep = 3;
  if (idx < 0) {
    idx = clean.lastIndexOf(", ");
    sep = 2;
  }
  if (idx < 0) return { disease: clean, countries: [] };
  const disease = clean.slice(0, idx).trim();
  const countries = clean
    .slice(idx + sep)
    .split(/\s*(?:&|,| and )\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { disease, countries };
}

async function fetchOutbreaksUncached(): Promise<{ events: RiskEvent[]; status: SourceStatus }> {
  const status: SourceStatus = {
    name: "WHO Disease Outbreak News",
    url: "https://www.who.int/emergencies/disease-outbreak-news",
    ok: true,
    fetchedAt: new Date().toISOString(),
    lag: "days (published once WHO has verified an event)",
  };
  try {
    const data = await getJson<{ value: WhoItem[] }>(
      "https://www.who.int/api/news/diseaseoutbreaknews?$orderby=PublicationDateAndTime%20desc&$top=40&$select=PublicationDateAndTime,Title,UrlName"
    );
    const since = Date.now() - 120 * DAY;
    // One entry per outbreak: WHO posts repeated updates on the same event.
    const seen = new Set<string>();
    const events: RiskEvent[] = [];
    for (const item of data.value) {
      const published = new Date(item.PublicationDateAndTime);
      if (published.getTime() < since) continue;
      const { disease, countries } = splitOutbreakTitle(item.Title);
      for (const country of countries.length > 0 ? countries : [""]) {
        const key = `${disease}|${country}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const multi = !country || /multi/i.test(country);
        const place = multi ? null : findPlace(country);
        events.push({
          id: `who-${item.UrlName}-${country || "multi"}`,
          layer: "outbreak",
          kind: "Disease outbreak",
          title: disease,
          place: multi ? "Multiple locations" : country,
          level: null,
          detail: `Latest WHO notice ${published.toISOString().slice(0, 10)}`,
          start: published.toISOString(),
          end: null,
          current: true,
          url: `https://www.who.int/emergencies/disease-outbreak-news/item/${item.UrlName}`,
          lat: place?.lat ?? NaN,
          lon: place?.lon ?? NaN,
          ...(place ? located(place.lon, place.lat) : { x: null, y: null }),
        });
      }
    }
    return { events, status };
  } catch (err) {
    return { events: [], status: { ...status, ok: false, note: String(err) } };
  }
}

// ---- IMF PortWatch chokepoints -------------------------------------------
const PORTWATCH =
  "https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services";

type ArcRows<T> = { features: { attributes: T }[]; exceededTransferLimit?: boolean };

async function arcQuery<T>(layer: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ f: "json", ...params });
  return getJson<ArcRows<T>>(`${PORTWATCH}/${layer}/FeatureServer/0/query?${qs}`);
}

// Transit counts are daily; a ship-count drop versus the same week a year
// earlier is what PortWatch itself uses to flag disruption.
export function chokepointLevel(change: number): RiskLevel {
  if (change <= -25) return "down";
  if (change <= -10) return "low";
  if (change >= 10) return "up";
  return "normal";
}

async function fetchChokepointsUncached(): Promise<{ events: RiskEvent[]; status: SourceStatus; asOf: string | null }> {
  const status: SourceStatus = {
    name: "IMF PortWatch (satellite ship-tracking data)",
    url: "https://portwatch.imf.org/",
    ok: true,
    fetchedAt: new Date().toISOString(),
    lag: "about a week (daily figures, published weekly)",
  };
  try {
    const [latest, db] = await Promise.all([
      arcQuery<{ date: number | string }>(
        "Daily_Chokepoints_Data",
        { where: "1=1", outFields: "date", orderByFields: "date DESC", resultRecordCount: "1" }
      ),
      arcQuery<{ portid: string; portname: string; lat: number; lon: number }>(
        "PortWatch_chokepoints_database",
        { where: "1=1", outFields: "portid,portname,lat,lon", resultRecordCount: "100" }
      ),
    ]);
    const raw = latest.features[0]?.attributes.date;
    if (raw === undefined) throw new Error("no PortWatch dates");
    const end = new Date(typeof raw === "number" ? raw : `${raw}T00:00:00Z`);
    const day = (offset: number) => isoDay(new Date(end.getTime() - offset * DAY));

    const stats = (from: string, to: string) =>
      arcQuery<{ portid: string; avg_n: number; days: number }>(
        "Daily_Chokepoints_Data",
        {
          where: `date >= DATE '${from}' AND date <= DATE '${to}'`,
          groupByFieldsForStatistics: "portid",
          outStatistics: JSON.stringify([
            { statisticType: "avg", onStatisticField: "n_total", outStatisticFieldName: "avg_n" },
            { statisticType: "count", onStatisticField: "n_total", outStatisticFieldName: "days" },
          ]),
        }
      );
    // 12 weekly averages for the sparkline, oldest first.
    const weeks = Array.from({ length: 12 }, (_, i) => 11 - i);
    const [recent, yearAgo, ...weekly] = await Promise.all([
      stats(day(6), day(0)),
      stats(day(371), day(365)),
      ...weeks.map((w) => stats(day(w * 7 + 6), day(w * 7))),
    ]);
    const avg = (rows: typeof recent) =>
      new Map(rows.features.map((f) => [f.attributes.portid, f.attributes.avg_n]));
    const recentBy = avg(recent);
    const yearAgoBy = avg(yearAgo);
    const weeklyBy = weekly.map(avg);

    const events = db.features.flatMap(({ attributes: c }): RiskEvent[] => {
      const now = recentBy.get(c.portid);
      const before = yearAgoBy.get(c.portid);
      if (now === undefined || before === undefined || before <= 0) return [];
      const change = ((now - before) / before) * 100;
      return [
        {
          id: `portwatch-${c.portid}`,
          layer: "chokepoint",
          kind: "Shipping chokepoint",
          title: c.portname,
          place: c.portname,
          level: chokepointLevel(change),
          detail: `${now.toFixed(0)} ships a day in the week to ${day(0)}, vs ${before.toFixed(0)} a year earlier`,
          start: `${day(6)}T00:00:00Z`,
          end: `${day(0)}T00:00:00Z`,
          current: true,
          url: "https://portwatch.imf.org/pages/port-monitor",
          lat: c.lat,
          lon: c.lon,
          ...located(c.lon, c.lat),
          change,
          recent: now,
          yearAgo: before,
          weekly: weeklyBy.map((m) => m.get(c.portid) ?? NaN),
        },
      ];
    });
    return { events, status, asOf: day(0) };
  } catch (err) {
    return { events: [], status: { ...status, ok: false, note: String(err) }, asOf: null };
  }
}

// Most severe first, then newest.
const LEVEL_RANK: Record<string, number> = { red: 0, down: 0, orange: 1, low: 1, yellow: 2, green: 3, normal: 3, up: 3 };
export function bySeverity(a: RiskEvent, b: RiskEvent): number {
  const ra = a.level ? LEVEL_RANK[a.level] : 2;
  const rb = b.level ? LEVEL_RANK[b.level] : 2;
  return ra - rb || Number(b.current) - Number(a.current) || b.start.localeCompare(a.start);
}

// Cached per source (shared across serverless instances). A failed fetch is
// cached for the same TTL, which keeps a down feed from being hammered.
export const fetchDisasters = unstable_cache(fetchDisastersUncached, ["world-risks-gdacs"], { revalidate: 900 });
export const fetchEarthquakes = unstable_cache(fetchEarthquakesUncached, ["world-risks-usgs"], { revalidate: 600 });
export const fetchOutbreaks = unstable_cache(fetchOutbreaksUncached, ["world-risks-who"], { revalidate: 1800 });
export const fetchChokepoints = unstable_cache(fetchChokepointsUncached, ["world-risks-portwatch"], { revalidate: 3600 });
