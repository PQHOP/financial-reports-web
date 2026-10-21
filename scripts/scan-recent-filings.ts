/**
 * Scans SEC EDGAR's daily filing index for the last N days looking for
 * 10-Q/10-K (incl. /A amendments) filings from companies in our seeded
 * lists (sp500.json + us-listed.json), cross-referenced via SEC's
 * ticker->CIK map, plus earnings-release 8-Ks (Item 2.02) from S&P 500
 * companies — those land on results day, weeks before the 10-Q.
 *
 * "skipped" tickers are excluded. A "done" ticker is kept only when the
 * filing is newer than its tracker `lastFilingSeen.filedAt` (kind
 * "update": a new period to publish, or the full 10-Q/10-K behind an
 * earnings release already covered — check the period before writing).
 * Without this, every company that already had one 2026 report would be
 * invisible to tier 0 for the rest of the year.
 *
 * This feeds "priority 0" of the standing 2026-report-coverage loop (see
 * CLAUDE.md "Standing priority" -> "Deciding what to work on this run"):
 * a company whose filing just landed on EDGAR is worth publishing before
 * falling back to the plain alphabetical backlog, so the site shows fresh
 * analysis close to when the underlying report actually came out.
 *
 * The daily index lags a day: SEC builds form.YYYYMMDD.idx at ~02:00 UTC
 * the *next* day (22:00 ET), so during the nightly window (16:00-22:59
 * UTC) today's file 403s and every same-day filing — pre-market earnings
 * releases and the after-close ones the window was moved to catch — was
 * invisible until the following night (found 2026-10-20: a Tuesday in
 * earnings season scanned as "0 filings today" seven firings in a row).
 * Days newer than the newest daily index are therefore read from two
 * live sources: EDGAR full-text search (efts.sec.gov, same-day, carries
 * the 8-K item list) for every company, plus each hot-list company's
 * own submissions JSON as a deterministic safety net.
 *
 * Usage:
 *   npm run scan-recent-filings                # last 7 days, 10-Q/10-K + S&P 500 earnings 8-Ks
 *   npm run scan-recent-filings -- --no-8k     # skip the 8-K Item 2.02 lookup
 *   npm run scan-recent-filings -- --no-live   # daily index only (skip the same-day sources)
 *   npm run scan-recent-filings -- --days 3
 *   npm run scan-recent-filings -- --forms 10-Q,10-K,8-K
 *
 * Output: scripts/data/recent-filings-candidates.json (sorted newest-first)
 * plus a human-readable summary on stdout. Never commit the output file —
 * it's a point-in-time scan artifact, regenerated every run.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { claimAge, readClaims, type Claim } from "./claims";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "data");
const USER_AGENT = "FinancialReportInsights research-tool contact@financial-reports-web.vercel.app";

type CompanyEntry = { slug: string; name: string; ticker: string; country: string; exchange: string; industry?: string };
type TrackerEntry = {
  status: "done" | "skipped" | "pending";
  lastFilingSeen?: { filedAt?: string };
  [key: string]: unknown;
};
type Candidate = {
  ticker: string;
  name: string;
  slug: string;
  tier: "sp500" | "us-listed";
  hot: boolean;
  kind: "new" | "update";
  form: string;
  filedDate: string; // YYYY-MM-DD
  cik: string;
  filingIndexUrl: string;
};

function parseArgs() {
  const args = process.argv.slice(2);
  let days = 7;
  let forms = ["10-K", "10-Q"];
  let earnings8k = true;
  let live = true;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--days") days = Number(args[++i]);
    if (args[i] === "--forms") forms = args[++i].split(",").map((f) => f.trim().toUpperCase());
    if (args[i] === "--no-8k") earnings8k = false;
    if (args[i] === "--no-live") live = false;
  }
  return { days, forms, earnings8k, live };
}

function isTargetForm(form: string, wanted: string[]): boolean {
  // Matches base form and its /A amendment variant, e.g. "10-Q" also matches "10-Q/A".
  const base = form.replace(/\/A$/, "");
  return wanted.includes(base) || wanted.includes(form);
}

async function fetchText(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  // 404 = no filings that day (weekend/holiday); 403 = today's index not
  // published yet (SEC serves this until the day's index is finalized).
  // Both mean "nothing to scan here", not a real error.
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

function quarterOf(date: Date): number {
  return Math.ceil((date.getUTCMonth() + 1) / 3);
}

function ymd(date: Date): string {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
}

const FORM_LINE_RE = /^(\S+(?:\s\S+)?)\s+(.+?)\s{2,}(\d{1,10})\s+(\d{8})\s+(\S+)\s*$/;

type Hit = {
  form: string;
  cik: string;
  filedDate: string; // YYYY-MM-DD
  fileName: string; // edgar/data/<cik>/<accession>.txt, as the daily index spells it
  items?: string[]; // 8-K items when the source already knows them (saves the submissions lookup)
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// null = SEC has no index file for that day (yet): a weekend/holiday, or
// a business day whose index hasn't been built (today, until ~02:00 UTC).
async function scanDay(date: Date, wantedForms: string[]): Promise<Hit[] | null> {
  const year = date.getUTCFullYear();
  const qtr = quarterOf(date);
  const stamp = ymd(date);
  const url = `https://www.sec.gov/Archives/edgar/daily-index/${year}/QTR${qtr}/form.${stamp}.idx`;
  const text = await fetchText(url);
  if (!text) return null;

  const out: Hit[] = [];
  for (const line of text.split("\n")) {
    const m = FORM_LINE_RE.exec(line);
    if (!m) continue;
    const [, form, , cik, filedRaw] = m;
    if (!isTargetForm(form, wantedForms)) continue;
    const fileName = m[5];
    const filedDate = `${filedRaw.slice(0, 4)}-${filedRaw.slice(4, 6)}-${filedRaw.slice(6, 8)}`;
    out.push({ form, cik: String(Number(cik)), filedDate, fileName });
  }
  return out;
}

// EDGAR full-text search, same-day and complete for the day (on 2026-10-20
// it listed exactly the 218 8-Ks + 2 8-K/A the "Latest Filings" feed
// had, and that feed stops at ~600 entries, too few for a peak earnings
// day). Without a `q` it returns every filing of the given form in the
// date range, 100 per page, with the 8-K item list in `_source.items`.
// Undocumented API: any failure is logged and leaves the day to the
// daily index (next night), never aborts the scan.
async function scanFullTextSearch(startDate: string, endDate: string, wantedForms: string[]): Promise<Hit[]> {
  const out: Hit[] = [];
  const seen = new Set<string>();
  for (const form of wantedForms) {
    for (let from = 0; from < 5000; from += 100) {
      const url =
        `https://efts.sec.gov/LATEST/search-index?forms=${encodeURIComponent(form)}` +
        `&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${from}`;
      let hits: Array<{ _source: { ciks?: string[]; form?: string; adsh?: string; file_date?: string; items?: string[] } }>;
      try {
        const text = await fetchText(url);
        if (!text) throw new Error("empty response");
        const json = JSON.parse(text) as { hits?: { hits?: typeof hits } };
        hits = json.hits?.hits ?? [];
      } catch (err) {
        console.log(`  full-text search ${form} from=${from}: ${(err as Error).message} (leaving the rest to the daily index)`);
        break;
      }
      for (const h of hits) {
        const s = h._source;
        if (!s.adsh || !s.file_date || !s.form) continue;
        for (const cikRaw of s.ciks ?? []) {
          const cik = String(Number(cikRaw));
          const key = `${cik}:${s.adsh}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ form: s.form, cik, filedDate: s.file_date, fileName: `edgar/data/${cik}/${s.adsh}.txt`, items: s.items ?? [] });
        }
      }
      if (hits.length < 100) break;
      await sleep(150);
    }
  }
  return out;
}

// Each company's submissions JSON is SEC's documented, near-real-time
// record of its own filings — the deterministic safety net for the
// hot-list tickers, where a same-day miss costs the most search demand.
async function scanSubmissions(cik: string, startDate: string, wantedForms: string[]): Promise<Hit[]> {
  const text = await fetchText(`https://data.sec.gov/submissions/CIK${cik.padStart(10, "0")}.json`);
  if (!text) return [];
  const recent = (
    JSON.parse(text) as {
      filings?: { recent?: { accessionNumber: string[]; filingDate: string[]; form: string[]; items: string[] } };
    }
  ).filings?.recent;
  if (!recent) return [];
  const out: Hit[] = [];
  for (let i = 0; i < recent.accessionNumber.length; i++) {
    const filedDate = recent.filingDate[i];
    if (filedDate < startDate) break; // newest first
    const form = recent.form[i];
    if (!isTargetForm(form, wantedForms)) continue;
    out.push({
      form,
      cik,
      filedDate,
      fileName: `edgar/data/${cik}/${recent.accessionNumber[i]}.txt`,
      items: (recent.items[i] ?? "").split(",").map((x) => x.trim()).filter(Boolean),
    });
  }
  return out;
}

async function loadCikTickerMap(): Promise<Map<string, string>> {
  const text = await fetchText("https://www.sec.gov/files/company_tickers.json");
  if (!text) throw new Error("could not fetch SEC company_tickers.json");
  const raw = JSON.parse(text) as Record<string, { cik_str: number; ticker: string; title: string }>;
  const map = new Map<string, string>();
  // SEC lists one row per listed security, so an issuer with preferred
  // shares/warrants under the same CIK (e.g. SCHW's CIK also has SCHW-PJ,
  // USB's also has USB-PS) appears multiple times. A later row for the
  // same CIK must never clobber an already-mapped plain ticker — that
  // silently dropped every such S&P 500 earnings 8-K from tier 0 for
  // weeks (discovered 2026-10-19 while investigating why SCHW/USB's
  // 10-15 earnings releases never surfaced as fresh candidates).
  for (const entry of Object.values(raw)) {
    const cik = String(entry.cik_str);
    const ticker = entry.ticker.toUpperCase();
    const existing = map.get(cik);
    if (existing && !existing.includes("-")) continue; // keep the plain ticker already found
    if (existing && ticker.includes("-")) continue; // don't replace a plain ticker with a suffixed one
    map.set(cik, ticker);
  }
  return map;
}

// 8-K items aren't in the daily index; the submissions JSON lists them per
// filing. True when this accession reports Item 2.02 (results of
// operations), i.e. an earnings release.
async function isEarnings8k(cik: string, fileName: string): Promise<boolean> {
  const accession = fileName.split("/").pop()?.replace(/\.txt$/, "") ?? "";
  const text = await fetchText(`https://data.sec.gov/submissions/CIK${cik.padStart(10, "0")}.json`);
  if (!text) return false;
  const recent = (JSON.parse(text) as { filings?: { recent?: { accessionNumber: string[]; items: string[] } } })
    .filings?.recent;
  if (!recent) return false;
  const i = recent.accessionNumber.indexOf(accession);
  return i >= 0 && (recent.items[i] ?? "").split(",").includes("2.02");
}

function filingIndexUrl(cik: string, fileName: string): string {
  // fileName looks like edgar/data/1084869/0001084869-26-000029.txt
  const accession = fileName.split("/").pop()?.replace(/\.txt$/, "") ?? "";
  const accessionNoDashes = accession.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoDashes}/${accession}-index.htm`;
}

async function main() {
  const { days, forms, earnings8k, live } = parseArgs();
  const scanForms = earnings8k && !forms.includes("8-K") ? [...forms, "8-K"] : forms;

  const sp500: CompanyEntry[] = JSON.parse(readFileSync(join(DATA_DIR, "sp500.json"), "utf8"));
  const usListed: CompanyEntry[] = JSON.parse(readFileSync(join(DATA_DIR, "us-listed.json"), "utf8"));
  const tracker: Record<string, TrackerEntry> = JSON.parse(readFileSync(join(DATA_DIR, "report-tracker.json"), "utf8"));

  const tickerLookup = new Map<string, { entry: CompanyEntry; tier: "sp500" | "us-listed" }>();
  for (const entry of sp500) tickerLookup.set(entry.ticker.toUpperCase(), { entry, tier: "sp500" });
  for (const entry of usListed) if (!tickerLookup.has(entry.ticker.toUpperCase())) tickerLookup.set(entry.ticker.toUpperCase(), { entry, tier: "us-listed" });

  const hotList = new Set<string>(
    JSON.parse(readFileSync(join(DATA_DIR, "priority-tickers.json"), "utf8")).tickers,
  );
  const trackerFor = (ticker: string) => (ticker === "_meta" ? undefined : tracker[ticker]);
  // Tickers another firing is researching right now (see scripts/claims.ts).
  const claims = readClaims();
  const claimedOut = new Map<string, Claim>();

  console.log(`Loading SEC CIK<->ticker map...`);
  const cikToTicker = await loadCikTickerMap();

  const candidatesByTicker = new Map<string, Candidate>();

  // One hit → zero or one candidate. Shared by the daily index and the
  // live same-day sources so every path applies the same tracker rules.
  async function consider(hit: Hit) {
    const ticker = cikToTicker.get(hit.cik);
    if (!ticker) return;
    const known = tickerLookup.get(ticker);
    if (!known) return; // not in our seeded company lists
    const entry = trackerFor(ticker);
    if (entry?.status === "skipped") return;
    // A done company only comes back for a filing newer than the last one
    // we recorded for it.
    const lastSeen = entry?.lastFilingSeen?.filedAt;
    if (entry?.status === "done" && (!lastSeen || hit.filedDate <= lastSeen)) return;
    // Amendments rarely change the numbers a published report is built on.
    if (entry?.status === "done" && hit.form.endsWith("/A")) return;
    // Another firing is researching this one right now (scripts/claims.ts).
    const claim = claims.get(ticker);
    if (claim) {
      claimedOut.set(ticker, claim);
      return;
    }

    const earningsRelease = hit.form.replace(/\/A$/, "") === "8-K" && !forms.includes("8-K");
    if (earningsRelease) {
      // Earnings releases: S&P 500 only, and only real Item 2.02 filings.
      if (known.tier !== "sp500") return;
      if (hit.items) {
        if (!hit.items.includes("2.02")) return;
      } else {
        await sleep(120);
        if (!(await isEarnings8k(hit.cik, hit.fileName))) return;
      }
    }

    const existing = candidatesByTicker.get(ticker);
    if (existing && existing.filedDate >= hit.filedDate) return; // keep the most recent hit per ticker

    candidatesByTicker.set(ticker, {
      ticker,
      name: known.entry.name,
      slug: known.entry.slug,
      tier: known.tier,
      hot: hotList.has(ticker),
      kind: entry?.status === "done" ? "update" : "new",
      form: earningsRelease ? "8-K (2.02)" : hit.form,
      filedDate: hit.filedDate,
      cik: hit.cik,
      filingIndexUrl: filingIndexUrl(hit.cik, hit.fileName),
    });
  }

  const today = new Date();
  const dayLabels: string[] = [];
  let newestIndexedDay: string | undefined;
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const dayLabel = d.toISOString().slice(0, 10);
    dayLabels.push(dayLabel);
    process.stdout.write(`Scanning ${dayLabel}... `);
    let hits: Hit[] | null;
    try {
      hits = await scanDay(d, scanForms);
    } catch (err) {
      console.log(`error (${(err as Error).message}), skipping`);
      continue;
    }
    if (hits === null) {
      console.log("no daily index (weekend/holiday, or not built yet)");
      continue;
    }
    newestIndexedDay ??= dayLabel; // the loop runs newest → oldest
    console.log(`${hits.length} ${scanForms.join("/")} filings`);
    for (const hit of hits) await consider(hit);

    // Be polite to SEC's servers between daily-index requests.
    await sleep(200);
  }

  // Days newer than the newest daily index — normally just today, whose
  // index SEC only builds at ~02:00 UTC tomorrow — come from the live
  // sources, so a company that reported this morning (or after today's
  // close) is a candidate tonight, not tomorrow night.
  const liveDays = dayLabels.filter((d) => !newestIndexedDay || d > newestIndexedDay);
  if (live && liveDays.length > 0) {
    const startDate = liveDays[liveDays.length - 1];
    const endDate = liveDays[0];
    const liveHits = new Map<string, Hit>(); // cik:accession → hit
    const add = (h: Hit) => liveHits.set(`${h.cik}:${h.fileName}`, h);

    process.stdout.write(`Live: EDGAR full-text search ${startDate}..${endDate}... `);
    const fts = await scanFullTextSearch(startDate, endDate, scanForms);
    fts.forEach(add);
    console.log(`${fts.length} ${scanForms.join("/")} filings`);

    const hotCiks = [...cikToTicker.entries()].filter(([, t]) => hotList.has(t) && trackerFor(t)?.status !== "skipped");
    process.stdout.write(`Live: submissions JSON for ${hotCiks.length} hot-list companies... `);
    const before = liveHits.size;
    for (const [cik] of hotCiks) {
      try {
        (await scanSubmissions(cik, startDate, scanForms)).forEach(add);
      } catch (err) {
        console.log(`\n  submissions CIK${cik}: ${(err as Error).message}`);
      }
      await sleep(110);
    }
    console.log(`${liveHits.size - before} not already found`);

    for (const hit of liveHits.values()) await consider(hit);
  } else if (liveDays.length > 0) {
    console.log(`Skipping live sources for ${liveDays.join(", ")} (--no-live)`);
  }

  const candidates = [...candidatesByTicker.values()].sort((a, b) => {
    // Search demand first (hot list, then S&P 500), newest first within each:
    // a hot-list filing from two days ago beats a micro-cap's from today.
    if (a.hot !== b.hot) return a.hot ? -1 : 1;
    if (a.tier !== b.tier) return a.tier === "sp500" ? -1 : 1;
    if (a.filedDate !== b.filedDate) return b.filedDate.localeCompare(a.filedDate);
    return a.ticker.localeCompare(b.ticker);
  });

  const outPath = join(DATA_DIR, "recent-filings-candidates.json");
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        scannedAt: new Date().toISOString(),
        daysScanned: days,
        forms: scanForms,
        candidates,
      },
      null,
      2,
    ),
  );

  console.log(`\n${candidates.length} fresh candidates, written to ${outPath}:\n`);
  for (const c of candidates.slice(0, 50)) {
    console.log(
      `  ${c.filedDate}  ${c.form.padEnd(10)}  ${c.ticker.padEnd(6)}  [${c.hot ? "hot" : c.tier}] [${c.kind}]  ${c.name}`,
    );
  }
  if (candidates.length > 50) console.log(`  ...and ${candidates.length - 50} more`);
  if (claimedOut.size > 0) {
    console.log(
      `\n${claimedOut.size} more claimed by another firing (left out; a claim expires after 3 h — see scripts/claims.ts):`,
    );
    for (const c of claimedOut.values()) console.log(`  ${c.ticker.padEnd(6)} ${claimAge(c)}${c.note ? `  ${c.note}` : ""}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
