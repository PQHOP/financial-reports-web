// Daily site-operations snapshot: Google Search Console, GA4, Vercel
// deployments and a live health check, printed as one JSON document for the
// "Site Operations - Daily" routine to read (see CLAUDE.md, "Daily
// operations routine"). Every section is independent: a missing credential or
// a failing API leaves that section as { error } instead of aborting.
//
//   npm run site-metrics            # JSON to stdout
//
// Run via the npm script, not `tsx` directly: it sets NODE_USE_ENV_PROXY=1,
// without which Node's built-in fetch ignores HTTPS_PROXY and hits
// financialreportinsights.com directly from the sandbox's raw IP, which the
// site's Vercel Firewall rejects with a false-positive 403 on every health
// check path (Vercel's own API and Google's don't have that firewall, so
// those calls succeed either way and the gap only shows up here).
//
// Credentials (env):
//   GSC_SA_JSON_B64   base64 of the Google service-account key JSON
//                     (or GSC_SA_KEY_FILE = path to the JSON file)
//   VERCEL_TOKEN      Vercel API token scoped to the hop22 team
// Optional: GA4_PROPERTY_ID (default below), SITE_URL.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

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

// --- GA4 ----------------------------------------------------------------------
async function analytics() {
  const run = (body: object) =>
    google(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY}:runReport`, body);
  const rows = (r: { rows?: { dimensionValues?: { value: string }[]; metricValues: { value: string }[] }[] }) =>
    (r.rows ?? []).map((x) => [...(x.dimensionValues ?? []).map((d) => d.value), ...x.metricValues.map((m) => Number(m.value))]);
  const metrics = [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }];
  const [daily, last28, pages, channels, countries] = await Promise.all([
    run({ dateRanges: [{ startDate: "14daysAgo", endDate: "yesterday" }], dimensions: [{ name: "date" }], metrics, orderBys: [{ dimension: { dimensionName: "date" } }] }),
    run({ dateRanges: [{ startDate: "28daysAgo", endDate: "yesterday" }], metrics }),
    run({ dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }], dimensions: [{ name: "pagePath" }], metrics: [{ name: "screenPageViews" }, { name: "averageSessionDuration" }], limit: 25, orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }] }),
    run({ dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }] }),
    run({ dateRanges: [{ startDate: "7daysAgo", endDate: "yesterday" }], dimensions: [{ name: "country" }], metrics: [{ name: "activeUsers" }], limit: 10, orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }] }),
  ]);
  return {
    columns: { daily: ["date", "activeUsers", "sessions", "pageViews"], pages: ["path", "pageViews", "avgSessionSec"] },
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
      try {
        const res = await fetch(SITE_URL + path, { redirect: "manual", headers: { "User-Agent": "FinancialReportInsights ops-check" } });
        return { path, status: res.status, ms: Date.now() - started, cache: res.headers.get("x-vercel-cache") };
      } catch (e) {
        return { path, status: 0, ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) };
      }
    })
  );
}

async function main() {
  const [searchConsoleData, analyticsData, deployments, healthData] = await Promise.all([
    safe(searchConsole),
    safe(analytics),
    safe(vercel),
    health(),
  ]);
  console.log(
    JSON.stringify({ generatedAt: new Date().toISOString(), site: SITE_URL, health: healthData, deployments, searchConsole: searchConsoleData, analytics: analyticsData }, null, 1)
  );
}

main();
