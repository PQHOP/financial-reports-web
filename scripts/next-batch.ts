/**
 * Prints the next companies to research, in the order CLAUDE.md prescribes,
 * so the nightly loop doesn't have to re-derive the priority logic each run.
 *
 *   0. fresh-filing candidates from `npm run scan-recent-filings`
 *      (scripts/data/recent-filings-candidates.json, if present)
 *   1. pending-due: tracker entries whose nextExpectedFiling.estimate has passed
 *   2. hot list: scripts/data/priority-tickers.json, in file order
 *   3. sp500: scripts/data/sp500.json, in file order
 *   4. us-listed: scripts/data/us-listed.json, in file order
 *
 * Tickers already "done" or "skipped" in report-tracker.json are excluded
 * (tier 0 candidates are already filtered by the scan itself, and may include
 * done companies with a newer filing — those are kept on purpose).
 *
 * Usage:
 *   npm run next-batch              # next 5
 *   npm run next-batch -- --n 10
 *   npm run next-batch -- --json    # machine-readable
 */
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "data");

type Company = { ticker: string; name: string };
type TrackerEntry = {
  status?: string;
  nextExpectedFiling?: { estimate?: string };
};
type Pick = { ticker: string; name: string; tier: string; note?: string };

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8")) as T;
}

function main() {
  const args = process.argv.slice(2);
  const nIndex = args.indexOf("--n");
  const limit = nIndex >= 0 ? Number(args[nIndex + 1]) || 5 : 5;
  const asJson = args.includes("--json");

  const tracker = readJson<Record<string, TrackerEntry>>("report-tracker.json");
  const sp500 = readJson<Company[]>("sp500.json");
  const usListed = readJson<Company[]>("us-listed.json");
  const hot = readJson<{ tickers: string[] }>("priority-tickers.json").tickers;

  const names = new Map<string, string>();
  for (const c of [...sp500, ...usListed]) if (!names.has(c.ticker)) names.set(c.ticker, c.name);

  const finished = (ticker: string) => {
    const status = tracker[ticker]?.status;
    return status === "done" || status === "skipped";
  };

  const picks: Pick[] = [];
  const seen = new Set<string>();
  // `force`: tier 0 already decided a done company has a newer filing.
  const add = (ticker: string, tier: string, note?: string, force = false) => {
    if (seen.has(ticker) || (!force && finished(ticker)) || !names.has(ticker)) return;
    seen.add(ticker);
    picks.push({ ticker, name: names.get(ticker)!, tier, note });
  };

  // Tier 0: fresh EDGAR filings (already sorted newest-first by the scan).
  const candidatesFile = join(DATA_DIR, "recent-filings-candidates.json");
  if (existsSync(candidatesFile)) {
    const scan = readJson<{
      candidates: { ticker: string; form: string; filedDate: string; kind?: string }[];
    }>("recent-filings-candidates.json");
    for (const c of scan.candidates) {
      const update = c.kind === "update";
      add(
        c.ticker,
        "0-fresh-filing",
        `${c.form} filed ${c.filedDate}${update ? ", newer than last report" : ""}`,
        update
      );
    }
  }

  // Pending entries whose expected filing date has passed.
  const today = new Date().toISOString().slice(0, 10);
  for (const [ticker, entry] of Object.entries(tracker)) {
    if (entry.status === "pending" && (entry.nextExpectedFiling?.estimate ?? "9999") <= today) {
      add(ticker, "1-pending-due", `expected ${entry.nextExpectedFiling?.estimate}`);
    }
  }

  for (const ticker of hot) add(ticker, "2-hot-list");
  for (const c of sp500) add(c.ticker, "3-sp500-backlog");
  for (const c of usListed) add(c.ticker, "4-us-listed-backlog");

  const next = picks.slice(0, limit);
  if (asJson) {
    console.log(JSON.stringify(next, null, 2));
    return;
  }
  if (next.length === 0) {
    console.log("Nothing left: every company is done/skipped. Move to Phase 2 / tier 2 (see CLAUDE.md).");
    return;
  }
  for (const p of next) {
    console.log(`${p.ticker.padEnd(6)} ${p.tier.padEnd(20)} ${p.name}${p.note ? `  (${p.note})` : ""}`);
  }
}

main();
