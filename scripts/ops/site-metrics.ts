// Daily site-operations snapshot: Google Search Console, GA4, Vercel
// deployments and a live health check, printed as one JSON document for the
// "Site Operations - Daily" routine to read (see CLAUDE.md, "Daily
// operations routine"). Every section is independent: a missing credential or
// a failing API leaves that section as { error } instead of aborting.
//
//   npm run site-metrics            # JSON to stdout
//
// Behind an HTTPS proxy (the cloud routine's sandbox) the script re-runs
// itself with NODE_USE_ENV_PROXY=1: without it Node's built-in fetch ignores
// HTTPS_PROXY and hits financialreportinsights.com from the sandbox's raw IP,
// which the site's Vercel Firewall answers with a false 403 on every health
// check path. Done here rather than in the npm script so it also runs on
// Windows, where `VAR=1 cmd` isn't valid.
//
// Credentials (env):
//   GSC_SA_JSON_B64   base64 of the Google service-account key JSON
//                     (or GSC_SA_KEY_FILE = path to the JSON file)
//   VERCEL_TOKEN      Vercel API token scoped to the hop22 team
// Optional: GA4_PROPERTY_ID (default below), SITE_URL.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const child = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
    stdio: "inherit",
    env: { ...process.env, NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" },
  });
  process.exit(child.status ?? 1);
}

const SITE_URL = (process.env.SITE_URL || "https://financialreportinsights.com").replace(/\/$/, "");
const GSC_SITE = "sc-domain:financialreportinsights.com";
const GA4_PROPERTY = process.env.GA4_PROPERTY_ID || "557281541";
const VERCEL_PROJECT = "prj_eGaw60toZxrsdlHPvzgJ76JqH0FU";
const VERCEL_TEAM = "team_MfxRGuWiwCf3DqtVWElr3pRu";

const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

async function safe<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function json(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${url.split("?")[0]}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

// --- Google service-account auth (JWT bearer grant, no SDK) ---------------
function serviceAccount(): { client_email: string; private_key: string; token_uri: string } {
  if (process.env.GSC_SA_JSON_B64) {
    return JSON.parse(Buffer.from(process.env.GSC_SA_JSON_B64, "base64").toString("utf8"));
  }
  if (process.env.GSC_SA_KEY_FILE) return JSON.parse(readFileSync(process.env.GSC_SA_KEY_FILE, "utf8"));
  throw new Error("no Google credential (set GSC_SA_JSON_B64 or GSC_SA_KEY_FILE)");
}

let googleToken: Promise<string> | null = null;
function googleAccessToken(): Promise<string> {
  googleToken ??= (async () => {
    const sa = serviceAccount();
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/analytics.readonly",
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    })}`;
    const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    });
    const data = await json(sa.token_uri, { method: "POST", body });
    return data.access_token as string;
  })();
  return googleToken;
}

async function google(url: string, body?: object) {
  const token = await googleAccessToken();
  return json(url, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// --- Search Console --------------------------------------------------------
// GSC data lags ~2-3 days, so windows end 3 days ago.
async function searchConsole() {
  const base = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}`;
  const query = (startDate: string, endDate: string, extra: object = {}) =>
    google(`${base}/searchAnalytics/query`, { startDate, endDate, ...extra });
  const totals = async (start: string, end: string) => (await query(start, end)).rows?.[0] ?? { clicks: 0, impressions: 0 };
  const top = async (dimension: string, rowLimit: number) =>
    // GSC orders by clicks only; with few clicks that's arbitrary, so pull
    // more rows and rank by clicks, then impressions.
    ((await query(day(-30), day(-3), { dimensions: [dimension], rowLimit: 1000 })).rows ?? [])
      .sort((a: { clicks: number; impressions: number }, b: { clicks: number; impressions: number }) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, rowLimit)
      .map(
      (r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
        [dimension]: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: +(r.ctr * 100).toFixed(2),
        position: +r.position.toFixed(1),
      })
    );
  const [last7, prev7, last28, topQueries, topPages, sitemaps] = await Promise.all([
    totals(day(-9), day(-3)),
    totals(day(-16), day(-10)),
    totals(day(-30), day(-3)),
    top("query", 50),
    top("page", 30),
    google(`${base}/sitemaps`).then((d) => d.sitemap ?? []),
  ]);
  // Queries ranking 5-20 with real impressions: the cheapest wins (better
  // title/description or content can move them onto page one).
  const opportunities = topQueries
    .filter((q: { position: number; impressions: number }) => q.position >= 5 && q.position <= 20 && q.impressions >= 20)
    .slice(0, 15);
  return { window: { last7: [day(-9), day(-3)], prev7: [day(-16), day(-10)] }, last7, prev7, last28, topQueries, topPages, opportunities, sitemaps };
}

// The sitemaps report's `indexed` count lags badly (saw 0/2166 for 3+ weeks
// while real pages were indexed) — the URL Inspection API gives the true,
// per-page verdict instead. A small fixed sample across page types, checked
// daily, so a real indexing regression shows up without re-discovering this
// lag by hand each time.
const INDEX_SAMPLE_PATHS = ["/", "/companies/aapl", "/industries/information-technology", "/insights", "/learn"];
async function indexSample() {
  return Promise.all(
    INDEX_SAMPLE_PATHS.map(async (path) => {
      try {
        const data = await google("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
          inspectionUrl: SITE_URL + path,
          siteUrl: GSC_SITE,
        });
        const r = data.inspectionResult?.indexStatusResult ?? {};
        return { path, verdict: r.verdict, coverageState: r.coverageState, lastCrawlTime: r.lastCrawlTime ?? null, googleCanonical: r.googleCanonical ?? null, userCanonical: r.userCanonical ?? null };
      } catch (e) {
        return { path, error: e instanceof Error ? e.message : String(e) };
      }
    })
  );
}

// --- GA4 ----------------------------------------------------------------------
async function analytics() {
  const run = (body: object) =>
    google(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY}:runReport`, body);
  const rows = (r: { rows?: { dimensionValues?: { value: string }[]; metricValues: { value: string }[] }[] }) =>
    (r.rows ?? []).map((x) => [...(x.dimensionValues ?? []).map((d) => d.value), ...x.metricValues.map((m) => Number(m.value))]);
  // `engagedSessions` (GA4: >10 s, a conversion, or 2+ views) is the cheap
  // bot filter: a headless crawler that runs the GA tag counts as a user and
  // a session but almost never as an engaged one. The 10,000-visits goal is
  // about people, so every breakdown carries both.
  const metrics = [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "engagedSessions" }];
  const [daily, last28, pages, channels, countries] = await Promise.all([
    run({ dateRanges: [{ startDate: "14daysAgo", endDate: "yesterday" }], dimensions: [{ name: "date" }], metrics, orderBys: [{ dimension: { dimensionName: "date" } }] }),
    run({ dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }], metrics }),
    run({ dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }], dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }, { name: "averageSessionDuration" }], limit: 25, orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }] }),
    run({ dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }, { name: "engagedSessions" }] }),
    run({ dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }], dimensions: [{ name: "country" }], metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "engagedSessions" }, { name: "averageSessionDuration" }], limit: 10, orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }] }),
  ]);
  return {
    columns: {
      daily: ["date", "activeUsers", "sessions", "pageViews", "engagedSessions"],
      last28: ["activeUsers", "sessions", "pageViews", "engagedSessions"],
      pages: ["path", "pageViews", "avgSessionSec"],
      channels: ["channel", "sessions", "engagedSessions"],
      countries: ["country", "activeUsers", "sessions", "engagedSessions", "avgSessionSec"],
    },
    daily: rows(daily),
    last28: rows(last28)[0] ?? null,
    topPages: rows(pages),
    channels: rows(channels),
    countries: rows(countries),
  };
}

// --- Vercel -------------------------------------------------------------------
async function vercel() {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN not set");
  const d = await json(
    `https://api.vercel.com/v6/deployments?projectId=${VERCEL_PROJECT}&teamId=${VERCEL_TEAM}&target=production&limit=5`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return (d.deployments ?? []).map((x: { uid: string; url: string; state: string; created: number; meta?: Record<string, string> }) => ({
    id: x.uid,
    url: x.url,
    state: x.state,
    created: new Date(x.created).toISOString(),
    commit: x.meta?.githubCommitSha?.slice(0, 7),
    message: x.meta?.githubCommitMessage?.split("\n")[0],
  }));
}

// --- Live health check ----------------------------------------------------------
const HEALTH_PATHS = ["/", "/companies/aapl", "/reports", "/earnings", "/insights", "/sitemap.xml", "/robots.txt", "/ads.txt"];
async function health() {
  return Promise.all(
    HEALTH_PATHS.map(async (path) => {
      const started = Date.now();
      let lastError: unknown;
      // One retry: the sandbox's egress proxy occasionally drops a single
      // request ("fetch failed" on a page that is fine), which read as an
      // outage on 2026-10-14. A second identical failure is reported.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(SITE_URL + path, { redirect: "manual", headers: { "User-Agent": "FinancialReportInsights ops-check" } });
          return { path, status: res.status, ms: Date.now() - started, cache: res.headers.get("x-vercel-cache"), retried: attempt > 0 || undefined };
        } catch (e) {
          lastError = e;
        }
      }
      return { path, status: 0, ms: Date.now() - started, error: lastError instanceof Error ? lastError.message : String(lastError) };
    })
  );
}

// --- Sitemap / feed freshness ------------------------------------------------------
// A 200 is not enough for the XML crawlers depend on: on 2026-10-14 the
// sitemap was 4 days stale (static build artifact) and on 2026-10-15 it was
// a day stale (ISR stale-while-revalidate) while returning 200 both times.
// Report the cache age and the newest <lastmod>/<pubDate> so the morning
// report can compare it with last night's latest publish.
async function xmlFreshness(path: string) {
  const started = Date.now();
  const res = await fetch(SITE_URL + path, { headers: { "User-Agent": "FinancialReportInsights ops-check" } });
  const text = await res.text();
  const dates = [...text.matchAll(/<(?:lastmod|pubDate)>([^<]+)</g)]
    .map((m) => new Date(m[1]).getTime())
    .filter((t) => Number.isFinite(t));
  return {
    path,
    status: res.status,
    ms: Date.now() - started,
    cache: res.headers.get("x-vercel-cache"),
    ageSeconds: res.headers.get("age") ? Number(res.headers.get("age")) : null,
    generatedAt: res.headers.get("x-sitemap-generated"),
    urls: (text.match(/<(?:loc|item)>/g) ?? []).length,
    newestDate: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
  };
}
async function xmlFeeds() {
  return Promise.all(["/sitemap.xml", "/feed.xml"].map(xmlFreshness));
}

// --- Rendered-figure sanity check --------------------------------------------------
// The health check only sees status and freshness. On 2026-10-17 a formatter
// bug ("$-1.14" for a negative EPS) had been live on every loss-making
// company's pages for about a month, found by a report-writing subagent,
// not by ops. Fetch a few fixed reports of different metric profiles and
// flag figure strings that no correct render produces.
const FIGURE_SAMPLE_PATHS = [
  "/companies/crwv/2026/q2", // loss-making (negative EPS and net income)
  "/companies/pnc/2026/q3", // bank profile
  "/companies/pgr/2026/q3", // insurer profile
  "/companies/jbht/2026/q3", // general profile
];
const FIGURE_BAD_PATTERNS: [string, RegExp][] = [
  ["currency-after-sign", /[$]-\d/],
  ["NaN", /\bNaN\b/],
  ["undefined", /\bundefined\b/],
  ["double-percent", /%%/],
  ["double-currency", /\$\$/],
  ["double-sign", /--\$|\+\+/],
];
// Plus the newest reports from the feed: a bug in a brand-new page type or
// a fresh publish (the night's mega-cap results) shows up the same morning,
// not when the fixed samples happen to hit it.
const FIGURE_NEWEST = 3;
async function newestReportPaths(): Promise<string[]> {
  try {
    const res = await fetch(SITE_URL + "/feed.xml", { headers: { "User-Agent": "FinancialReportInsights ops-check" } });
    const xml = await res.text();
    return [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)]
      .map((m) => m[1].replace(SITE_URL, ""))
      .filter((p) => /^\/companies\/[^/]+\/\d{4}\/[a-z0-9]+$/.test(p))
      .slice(0, FIGURE_NEWEST);
  } catch {
    return [];
  }
}
async function figureSample() {
  const newest = await newestReportPaths();
  const paths = [...FIGURE_SAMPLE_PATHS, ...newest.filter((p) => !FIGURE_SAMPLE_PATHS.includes(p))];
  return Promise.all(
    paths.map(async (path) => {
      const res = await fetch(SITE_URL + path, { headers: { "User-Agent": "FinancialReportInsights ops-check" } });
      const html = await res.text();
      // Visible markup only: the RSC payload in <script> escapes "$" as "$$",
      // and React's Suspense markers are "<!--$-->" comments.
      const visible = html.replace(/<script[^>]*>[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "");
      const strip = [...visible.matchAll(/<dd class="mt-0\.5 text-lg font-semibold">([^<]*)<\/dd>/g)].map((m) => m[1]);
      const text = visible.replace(/<[^>]+>/g, " ");
      const issues: string[] = [];
      for (const [name, re] of FIGURE_BAD_PATTERNS) {
        const hit = text.match(re);
        if (hit) issues.push(`${name}: ${text.slice(Math.max(0, hit.index! - 20), hit.index! + 20).replace(/\s+/g, " ")}`);
      }
      if (strip.length < 3) issues.push(`figures strip has ${strip.length} items`);
      if (strip.some((v) => v.trim() === "" || v.trim() === "—")) issues.push("empty figure in strip");
      return { path, sample: newest.includes(path) ? "newest" : "fixed", status: res.status, strip, issues };
    })
  );
}

async function main() {
  const [searchConsoleData, indexSampleData, analyticsData, deployments, healthData, xmlData, figureData] = await Promise.all([
    safe(searchConsole),
    safe(indexSample),
    safe(analytics),
    safe(vercel),
    health(),
    safe(xmlFeeds),
    safe(figureSample),
  ]);
  console.log(
    JSON.stringify(
      { generatedAt: new Date().toISOString(), site: SITE_URL, health: healthData, xml: xmlData, figures: figureData, deployments, searchConsole: searchConsoleData, indexSample: indexSampleData, analytics: analyticsData },
      null,
      1
    )
  );
}

main();
