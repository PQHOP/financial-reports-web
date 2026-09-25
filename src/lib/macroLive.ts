// "Latest" layer for /economy: monthly/quarterly/daily figures from public,
// key-free APIs, used wherever a country has them; the page falls back to
// the IMF WEO annual numbers (src/lib/macro.ts) for everything else.
//
// Sources (all fetched by /api/cron/macro once a day, and by
// `npm run fetch-macro` for the bundled fallback copy):
//   IMF SDMX (api.imf.org)  CPI inflation, quarterly real GDP, unemployment,
//                           policy rates and bond yields, month-end FX rates
//   ILO (rplumber.ilo.org)  monthly/quarterly unemployment
//   BIS (stats.bis.org)     central bank policy rates, daily
//   OECD (sdmx.oecd.org)    10-year government bond yields
//   ExchangeRate-API        today's exchange rates (open.er-api.com)
//
// No Next.js imports here: the data script runs this under plain tsx.

export type Point = [period: string, value: number];

export type LiveSeries = {
  // Oldest first. Periods: "2026-08" (month), "2026-Q2" (quarter).
  hist: Point[];
  source: string;
  // Daily sources: the most recent observation, e.g. ["2026-09-22", 4.25].
  latest?: Point;
  // Policy rates: when the rate last moved.
  lastChange?: { period: string; from: number; to: number };
};

export type FxLive = {
  currency: string;
  // Units of local currency per US dollar.
  spot: number;
  spotDate: string;
  // Month-end rates, oldest first.
  hist: Point[];
};

export type LiveMetricKey = "cpi" | "gdpq" | "unemp" | "policy" | "bond";

export type LiveData = {
  updatedAt: string;
  sources: Record<string, { fetchedAt: string; ok: boolean; error?: string }>;
  metrics: Record<LiveMetricKey, Record<string, LiveSeries>>;
  fx: Record<string, FxLive>;
};

export type CountryMeta = { code: string; iso2?: string; currency?: string };

// Cloudflare-fronted APIs (OECD, ExchangeRate-API) reject a User-Agent with
// an email address in it.
const UA = "FinancialReportInsights/1.0 (+https://financialreportinsights.com)";
const IMF = "https://api.imf.org/external/sdmx/2.1/data/IMF.STA";
const MONTHS_KEPT = 25;
const QUARTERS_KEPT = 9;

// Euro area members (Bulgaria joined 1 January 2026): the ECB sets their
// policy rate, which BIS reports under "XM".
export const EURO_AREA = [
  "AUT", "BEL", "BGR", "HRV", "CYP", "EST", "FIN", "FRA", "DEU", "GRC", "IRL",
  "ITA", "LVA", "LTU", "LUX", "MLT", "NLD", "PRT", "SVK", "SVN", "ESP",
];

async function getText(url: string, timeoutMs = 120_000): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "*/*" },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// --- period helpers ---------------------------------------------------------

// "2026-M08" / "2026M08" -> "2026-08"; "2026Q2" -> "2026-Q2".
function normPeriod(p: string): string {
  let m = p.match(/^(\d{4})-?M(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;
  m = p.match(/^(\d{4})-?Q(\d)$/);
  if (m) return `${m[1]}-Q${m[2]}`;
  return p;
}

// Last day covered by a period, for "which source is fresher" comparisons.
export function periodEnd(p: string): string {
  let m = p.match(/^(\d{4})-Q(\d)$/);
  if (m) return `${m[1]}-${String(Number(m[2]) * 3).padStart(2, "0")}-31`;
  m = p.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${p}-31`;
  return p;
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 7);
}

// --- parsers ----------------------------------------------------------------

type SdmxSeries = { attrs: Record<string, string>; obs: Point[] };

function parseSdmx(xml: string): SdmxSeries[] {
  const out: SdmxSeries[] = [];
  for (const chunk of xml.split("<Series ").slice(1)) {
    const head = chunk.slice(0, chunk.indexOf(">"));
    const attrs: Record<string, string> = {};
    for (const m of head.matchAll(/(\w+)="([^"]*)"/g)) attrs[m[1]] = m[2];
    const obs: Point[] = [];
    for (const m of chunk.matchAll(/<Obs\b[^>]*?TIME_PERIOD="([^"]+)"[^>]*?OBS_VALUE="([^"]+)"/g)) {
      const v = Number(m[2]);
      if (Number.isFinite(v)) obs.push([normPeriod(m[1]), v]);
    }
    obs.sort((a, b) => a[0].localeCompare(b[0]));
    out.push({ attrs, obs });
  }
  return out;
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

// Six significant digits: keeps exchange rates like 0.8787 EUR/USD intact.
const tidy = (v: number) => Number(v.toPrecision(6));
const trim = (hist: Point[], n: number) => hist.slice(-n).map(([p, v]) => [p, tidy(v)] as Point);

// --- fetchers ---------------------------------------------------------------

async function imfCpi(): Promise<Record<string, LiveSeries>> {
  const xml = await getText(`${IMF},CPI/.CPI._T.YOY_PCH_PA_PT.M?startPeriod=${monthsAgo(MONTHS_KEPT + 1)}`);
  const out: Record<string, LiveSeries> = {};
  for (const s of parseSdmx(xml)) {
    if (s.obs.length) out[s.attrs.COUNTRY] = { hist: trim(s.obs, MONTHS_KEPT), source: "IMF CPI" };
  }
  return out;
}

// Real GDP growth vs the same quarter a year earlier, from chain-linked
// volume levels (seasonally adjusted where available).
async function imfGdpQ(): Promise<Record<string, LiveSeries>> {
  const start = `${new Date().getUTCFullYear() - 4}-Q1`;
  const xml = await getText(`${IMF},QNEA/.B1GQ.Q.SA+NSA.XDC.Q?startPeriod=${start}`, 180_000);
  const byCountry = new Map<string, SdmxSeries>();
  for (const s of parseSdmx(xml)) {
    if (!s.obs.length) continue;
    const prev = byCountry.get(s.attrs.COUNTRY);
    const last = (x: SdmxSeries) => x.obs[x.obs.length - 1][0];
    // Freshest series wins; seasonally adjusted on a tie.
    if (
      !prev ||
      last(s) > last(prev) ||
      (last(s) === last(prev) && s.attrs.S_ADJUSTMENT === "SA" && prev.attrs.S_ADJUSTMENT !== "SA")
    ) {
      byCountry.set(s.attrs.COUNTRY, s);
    }
  }
  const out: Record<string, LiveSeries> = {};
  for (const [country, s] of byCountry) {
    const level = new Map(s.obs);
    const growth: Point[] = [];
    for (const [p, v] of s.obs) {
      const [y, q] = p.split("-");
      const base = level.get(`${Number(y) - 1}-${q}`);
      if (base) growth.push([p, ((v - base) / base) * 100]);
    }
    if (growth.length) out[country] = { hist: trim(growth, QUARTERS_KEPT), source: "IMF national accounts" };
  }
  return out;
}

// Unemployment: IMF labor statistics and ILOSTAT, monthly or quarterly;
// the freshest series per country wins (monthly on a tie).
async function unemployment(): Promise<Record<string, LiveSeries>> {
  const since = new Date().getUTCFullYear() - 3;
  const candidates = new Map<string, { hist: Point[]; source: string; monthly: boolean }[]>();
  const add = (country: string, hist: Point[], source: string) => {
    if (!hist.length) return;
    const list = candidates.get(country) ?? [];
    list.push({ hist, source, monthly: !hist[hist.length - 1][0].includes("Q") });
    candidates.set(country, list);
  };

  const [imfRes, iloM, iloQ] = await Promise.allSettled([
    getText(`${IMF},LS/.U.PT.M+Q?startPeriod=${since}`),
    getText(
      `https://rplumber.ilo.org/data/indicator/?id=UNE_DEAP_SEX_AGE_RT_M&sex=SEX_T&classif1=AGE_YTHADULT_YGE15&timefrom=${since}&type=code&format=.csv`,
    ),
    getText(
      `https://rplumber.ilo.org/data/indicator/?id=UNE_DEAP_SEX_AGE_RT_Q&sex=SEX_T&classif1=AGE_YTHADULT_YGE15&timefrom=${since}&type=code&format=.csv`,
    ),
  ]);
  if (imfRes.status === "fulfilled") {
    for (const s of parseSdmx(imfRes.value)) add(s.attrs.COUNTRY, s.obs, "IMF labor statistics");
  }
  for (const res of [iloM, iloQ]) {
    if (res.status !== "fulfilled") continue;
    // One series per country+source (labour force survey vs registrations).
    const groups = new Map<string, Point[]>();
    for (const r of parseCsv(res.value)) {
      const v = Number(r.obs_value);
      if (!r.ref_area || !Number.isFinite(v) || r.obs_value === "") continue;
      const key = `${r.ref_area}|${r.source}`;
      const list = groups.get(key) ?? [];
      list.push([normPeriod(r.time), v]);
      groups.set(key, list);
    }
    for (const [key, hist] of groups) {
      const [country, source] = key.split("|");
      // Prefer labour force surveys ("BA:") over registered unemployment.
      if (!source.startsWith("BA")) continue;
      hist.sort((a, b) => a[0].localeCompare(b[0]));
      add(country, hist, "ILOSTAT");
    }
  }
  if (imfRes.status === "rejected" && iloM.status === "rejected" && iloQ.status === "rejected") {
    throw imfRes.reason;
  }

  const out: Record<string, LiveSeries> = {};
  for (const [country, list] of candidates) {
    list.sort(
      (a, b) =>
        periodEnd(b.hist[b.hist.length - 1][0]).localeCompare(periodEnd(a.hist[a.hist.length - 1][0])) ||
        Number(b.monthly) - Number(a.monthly),
    );
    const best = list[0];
    out[country] = { hist: trim(best.hist, best.monthly ? MONTHS_KEPT : QUARTERS_KEPT), source: best.source };
  }
  return out;
}

function lastChange(hist: Point[]): LiveSeries["lastChange"] {
  for (let i = hist.length - 1; i > 0; i--) {
    if (Math.abs(hist[i][1] - hist[i - 1][1]) >= 0.01) {
      return { period: hist[i][0], from: hist[i - 1][1], to: hist[i][1] };
    }
  }
  return undefined;
}

// Policy rates: BIS (daily, ~38 central banks incl. the ECB), then IMF
// monetary statistics (monthly) for countries BIS doesn't cover.
async function policyRates(countries: CountryMeta[]): Promise<Record<string, LiveSeries>> {
  const iso3 = new Map(countries.filter((c) => c.iso2).map((c) => [c.iso2!, c.code]));
  const out: Record<string, LiveSeries> = {};
  const start = monthsAgo(MONTHS_KEPT + 12);
  const dailyStart = new Date(Date.now() - 45 * 86400_000).toISOString().slice(0, 10);

  const [bisM, bisD, imf] = await Promise.allSettled([
    getText(`https://stats.bis.org/api/v1/data/WS_CBPOL/M..?startPeriod=${start}&format=csv`),
    getText(`https://stats.bis.org/api/v1/data/WS_CBPOL/D..?startPeriod=${dailyStart}&format=csv`),
    getText(`${IMF},MFS_IR/.MFS166_RT_PT_A_PT.M?startPeriod=${start}`),
  ]);

  if (bisM.status === "fulfilled") {
    const monthly = new Map<string, Point[]>();
    for (const r of parseCsv(bisM.value)) {
      const v = Number(r.OBS_VALUE);
      if (!r.REF_AREA || r.OBS_VALUE === "" || !Number.isFinite(v)) continue;
      const list = monthly.get(r.REF_AREA) ?? [];
      list.push([normPeriod(r.TIME_PERIOD), v]);
      monthly.set(r.REF_AREA, list);
    }
    const latest = new Map<string, Point>();
    if (bisD.status === "fulfilled") {
      for (const r of parseCsv(bisD.value)) {
        const v = Number(r.OBS_VALUE);
        if (!r.REF_AREA || r.OBS_VALUE === "" || !Number.isFinite(v)) continue;
        const prev = latest.get(r.REF_AREA);
        if (!prev || prev[0] < r.TIME_PERIOD) latest.set(r.REF_AREA, [r.TIME_PERIOD, v]);
      }
    }
    for (const [area, hist] of monthly) {
      hist.sort((a, b) => a[0].localeCompare(b[0]));
      const series: LiveSeries = {
        hist: trim(hist, MONTHS_KEPT),
        source: area === "XM" ? "BIS (European Central Bank)" : "BIS",
        latest: latest.get(area),
        lastChange: lastChange(hist),
      };
      // A move after the last monthly figure shows up in the daily series.
      if (series.latest && Math.abs(series.latest[1] - hist[hist.length - 1][1]) >= 0.01) {
        series.lastChange = { period: series.latest[0], from: hist[hist.length - 1][1], to: series.latest[1] };
      }
      if (area === "XM") for (const c of EURO_AREA) out[c] = series;
      else if (iso3.has(area)) out[iso3.get(area)!] = series;
    }
  }

  if (imf.status === "fulfilled") {
    for (const s of parseSdmx(imf.value)) {
      const c = s.attrs.COUNTRY;
      if (out[c] || !s.obs.length) continue;
      out[c] = { hist: trim(s.obs, MONTHS_KEPT), source: "IMF monetary statistics", lastChange: lastChange(s.obs) };
    }
  }
  if (bisM.status === "rejected" && imf.status === "rejected") throw bisM.reason;
  return out;
}

// Adds new observations to an earlier history (same period: new value wins).
function mergeHist(older: Point[] | undefined, newer: Point[]): Point[] {
  const byPeriod = new Map(older ?? []);
  for (const [p, v] of newer) byPeriod.set(p, v);
  return [...byPeriod.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

// 10-year government bond yields: OECD, then IMF for the rest. OECD's API
// errors on long date ranges, so it's asked for the last few months only and
// merged into the history kept from earlier runs.
async function bondYields(previous?: Record<string, LiveSeries>): Promise<Record<string, LiveSeries>> {
  const [oecd, imf] = await Promise.allSettled([
    getText(
      `https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,4.0/.M.IRLT.PA.....?startPeriod=${monthsAgo(8)}&format=csvfile`,
    ),
    getText(`${IMF},MFS_IR/.S13BOND_RT_PT_A_PT.M?startPeriod=${monthsAgo(MONTHS_KEPT + 1)}`),
  ]);
  const out: Record<string, LiveSeries> = {};
  if (oecd.status === "fulfilled") {
    const groups = new Map<string, Point[]>();
    for (const r of parseCsv(oecd.value)) {
      const v = Number(r.OBS_VALUE);
      if (!/^[A-Z]{3}$/.test(r.REF_AREA) || r.OBS_VALUE === "" || !Number.isFinite(v)) continue;
      const list = groups.get(r.REF_AREA) ?? [];
      list.push([normPeriod(r.TIME_PERIOD), v]);
      groups.set(r.REF_AREA, list);
    }
    for (const [c, hist] of groups) {
      const prevHist = previous?.[c]?.source === "OECD" ? previous[c].hist : undefined;
      out[c] = { hist: trim(mergeHist(prevHist, hist), MONTHS_KEPT), source: "OECD" };
    }
  }
  if (imf.status === "fulfilled") {
    for (const s of parseSdmx(imf.value)) {
      if (!out[s.attrs.COUNTRY] && s.obs.length) {
        out[s.attrs.COUNTRY] = { hist: trim(s.obs, MONTHS_KEPT), source: "IMF monetary statistics" };
      }
    }
  }
  if (oecd.status === "rejected" && imf.status === "rejected") throw oecd.reason;
  return out;
}

async function exchangeRates(countries: CountryMeta[]): Promise<Record<string, FxLive>> {
  const [spotRes, eopRes] = await Promise.all([
    getText("https://open.er-api.com/v6/latest/USD", 30_000),
    getText(`${IMF},ER/.XDC_USD.EOP_RT.M?startPeriod=${monthsAgo(MONTHS_KEPT + 1)}`),
  ]);
  const spot = JSON.parse(spotRes) as { result: string; time_last_update_unix: number; rates: Record<string, number> };
  if (spot.result !== "success") throw new Error("open.er-api returned an error");
  const spotDate = new Date(spot.time_last_update_unix * 1000).toISOString().slice(0, 10);
  const eop = new Map(parseSdmx(eopRes).map((s) => [s.attrs.COUNTRY, s.obs]));

  // IMF month-end rates are per country; a country without its own series
  // (e.g. some euro members) borrows one from another user of the currency.
  const byCurrency = new Map<string, Point[]>();
  for (const c of countries) {
    const hist = eop.get(c.code);
    if (c.currency && hist?.length && !byCurrency.has(c.currency)) byCurrency.set(c.currency, hist);
  }
  const out: Record<string, FxLive> = {};
  for (const c of countries) {
    if (!c.currency || c.currency === "USD") continue;
    const rate = spot.rates[c.currency];
    if (!rate) continue;
    const hist = eop.get(c.code)?.length ? eop.get(c.code)! : (byCurrency.get(c.currency) ?? []);
    out[c.code] = { currency: c.currency, spot: tidy(rate), spotDate, hist: trim(hist, MONTHS_KEPT) };
  }
  return out;
}

// --- orchestration ----------------------------------------------------------

type Job = (c: CountryMeta[], previous?: Record<string, LiveSeries>) => Promise<Record<string, LiveSeries>>;
const JOBS: Record<LiveMetricKey, Job> = {
  cpi: () => imfCpi(),
  gdpq: () => imfGdpQ(),
  unemp: () => unemployment(),
  policy: (c) => policyRates(c),
  bond: (_c, prev) => bondYields(prev),
};

// Fetches every source; a source that fails keeps its block from `previous`
// so one flaky API never blanks a column.
export async function fetchLive(countries: CountryMeta[], previous?: LiveData | null): Promise<LiveData> {
  const now = new Date().toISOString();
  const keys = Object.keys(JOBS) as LiveMetricKey[];
  const [fxRes, ...results] = await Promise.allSettled([
    exchangeRates(countries),
    ...keys.map((k) => JOBS[k](countries, previous?.metrics?.[k])),
  ]);

  const data: LiveData = {
    updatedAt: now,
    sources: {},
    metrics: {} as LiveData["metrics"],
    fx: {},
  };
  keys.forEach((k, i) => {
    const r = results[i];
    if (r.status === "fulfilled" && Object.keys(r.value).length > 0) {
      data.metrics[k] = r.value;
      data.sources[k] = { fetchedAt: now, ok: true };
    } else {
      data.metrics[k] = previous?.metrics?.[k] ?? {};
      data.sources[k] = {
        fetchedAt: previous?.sources?.[k]?.fetchedAt ?? now,
        ok: false,
        error: r.status === "rejected" ? String(r.reason).slice(0, 300) : "empty response",
      };
    }
  });
  if (fxRes.status === "fulfilled" && Object.keys(fxRes.value).length > 0) {
    data.fx = fxRes.value;
    data.sources.fx = { fetchedAt: now, ok: true };
  } else {
    data.fx = previous?.fx ?? {};
    data.sources.fx = {
      fetchedAt: previous?.sources?.fx?.fetchedAt ?? now,
      ok: false,
      error: fxRes.status === "rejected" ? String(fxRes.reason).slice(0, 300) : "empty response",
    };
  }
  return data;
}
