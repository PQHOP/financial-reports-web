// Annual IMF World Economic Outlook values via the DataMapper API. Shared by
// `npm run fetch-macro` (which also builds the country list and map) and
// /api/cron/macro (which refreshes the values daily, so a new WEO edition
// shows up without a redeploy). No Next.js imports: runs under plain tsx.
import { INDICATORS } from "./macro";

const API = "https://www.imf.org/external/datamapper/api/v1";
export const FIRST_YEAR = 2000;
export const LAST_YEAR = 2030;

export async function getJson<T>(url: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "FinancialReportInsights macro-fetch" },
        signal: AbortSignal.timeout(60_000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

function round(v: number, code: string): number {
  if (code === "NGDPDPC") return Math.round(v);
  return Math.round(v * 10) / 10;
}

export const WEO_YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i);

// series[indicator][entity] = values aligned to WEO_YEARS (null = missing).
// `keep` limits the entities returned (countries + aggregates we show).
export async function fetchWeoSeries(keep?: Set<string>) {
  const meta = await getJson<{ indicators: Record<string, { source: string }> }>(`${API}/indicators`);
  const source = meta.indicators[INDICATORS[0].code]?.source ?? "World Economic Outlook";
  const series: Record<string, Record<string, (number | null)[]>> = {};
  const results = await Promise.all(
    INDICATORS.map((ind) =>
      getJson<{ values: Record<string, Record<string, Record<string, number>>> }>(`${API}/${ind.code}`),
    ),
  );
  INDICATORS.forEach((ind, i) => {
    const byEntity = results[i].values[ind.code] ?? {};
    series[ind.code] = {};
    for (const [entity, byYear] of Object.entries(byEntity)) {
      if (keep && !keep.has(entity)) continue;
      const row = WEO_YEARS.map((y) => (byYear[y] == null ? null : round(byYear[y], ind.code)));
      if (row.some((v) => v != null)) series[ind.code][entity] = row;
    }
  });
  return { source, series };
}

export async function fetchWeoCountryLabels() {
  const res = await getJson<{ countries: Record<string, { label: string }> }>(`${API}/countries`);
  return res.countries;
}
