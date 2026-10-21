/**
 * Claims: a lightweight lock so two hourly firings of the nightly routine
 * don't research the same company at the same time.
 *
 * On 2026-10-21 night two firings worked the same tier-0 queue at once:
 * each dispatched Opus research subagents for the same 8 us-listed tickers,
 * and the second firing's subagents were rejected at publish ("already
 * exists") — a wasted research pass each. The scan can't see what another
 * firing is *working on*, only what is already published in the tracker.
 *
 * A claim is one small file per ticker under `scripts/data/claims/`
 * (`<TICKER>.json`), committed and pushed before the research subagents are
 * dispatched. One file per ticker means two firings claiming different
 * tickers never conflict on rebase. `scan-recent-filings` and `next-batch`
 * drop claimed tickers while the claim is live; a claim expires after
 * CLAIM_TTL_HOURS so a firing that died mid-batch leaves no permanent lock.
 *
 * Usage (from the orchestrator, never from a research subagent):
 *   npm run claim -- NFLX GE GM            # write, commit and push claims
 *   npm run claim -- --release NFLX GE GM  # remove them (commit and push)
 *   npm run claim -- --release --no-push NFLX   # commit the release locally;
 *                                               # it goes up with the tracker push
 *   npm run claim -- --list                # live claims
 *
 * The commit/push is best-effort: a failed push is reported, not fatal, so a
 * network blip never blocks the batch (the claim then only protects this
 * container's own later scans).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
export const CLAIMS_DIR = join(HERE, "data", "claims");
export const CLAIM_TTL_HOURS = 3;

export type Claim = { ticker: string; claimedAt: string; note?: string };

/** Live (unexpired) claims, keyed by ticker. */
export function readClaims(now = Date.now()): Map<string, Claim> {
  const out = new Map<string, Claim>();
  if (!existsSync(CLAIMS_DIR)) return out;
  for (const file of readdirSync(CLAIMS_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const claim = JSON.parse(readFileSync(join(CLAIMS_DIR, file), "utf8")) as Claim;
      const age = now - new Date(claim.claimedAt).getTime();
      if (Number.isFinite(age) && age >= 0 && age < CLAIM_TTL_HOURS * 3_600_000) out.set(claim.ticker, claim);
    } catch {
      // A malformed claim file is ignored rather than blocking the scan.
    }
  }
  return out;
}

export function claimAge(claim: Claim, now = Date.now()): string {
  const minutes = Math.round((now - new Date(claim.claimedAt).getTime()) / 60_000);
  return minutes < 60 ? `${minutes} min ago` : `${(minutes / 60).toFixed(1)} h ago`;
}

function git(cmd: string) {
  return execSync(`git ${cmd}`, { cwd: HERE, stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
}

function commitAndPush(message: string, push: boolean) {
  try {
    git(`commit -q -m "${message.replace(/"/g, "'")}"`);
  } catch (err) {
    console.log(`  (nothing to commit: ${(err as Error).message.split("\n")[0]})`);
    return;
  }
  if (!push) {
    console.log(`  committed locally (--no-push)`);
    return;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      git("pull --rebase -q origin master");
      git("push -q origin HEAD:master");
      console.log(`  committed and pushed`);
      return;
    } catch (err) {
      console.log(`  push attempt ${attempt} failed: ${(err as Error).message.split("\n")[0]}`);
    }
  }
  console.log(`  WARNING: claims committed locally but not pushed; other firings can't see them.`);
}

function main() {
  const args = process.argv.slice(2);
  const release = args.includes("--release");
  const list = args.includes("--list");
  const push = !args.includes("--no-push");
  const noteIndex = args.indexOf("--note");
  const note = noteIndex >= 0 ? args[noteIndex + 1] : undefined;
  const tickers = args
    .filter((a, i) => !a.startsWith("--") && !(noteIndex >= 0 && i === noteIndex + 1))
    .map((t) => t.toUpperCase());

  if (list || tickers.length === 0) {
    const claims = readClaims();
    if (claims.size === 0) {
      console.log("No live claims.");
    } else {
      for (const c of claims.values()) console.log(`${c.ticker.padEnd(6)} ${claimAge(c).padEnd(12)} ${c.note ?? ""}`);
    }
    if (tickers.length === 0 && !list) console.log("\nUsage: npm run claim -- TICKER [TICKER...] | --release TICKER... | --list");
    return;
  }

  mkdirSync(CLAIMS_DIR, { recursive: true });
  const files = tickers.map((t) => join(CLAIMS_DIR, `${t}.json`));
  if (release) {
    for (const file of files) rmSync(file, { force: true });
    git(`add -A -- "${CLAIMS_DIR}"`);
    console.log(`Released: ${tickers.join(", ")}`);
    commitAndPush(`Release claims: ${tickers.join(", ")}`, push);
    return;
  }

  const live = readClaims();
  const already = tickers.filter((t) => live.has(t));
  if (already.length) {
    console.log(`Already claimed by another firing: ${already.map((t) => `${t} (${claimAge(live.get(t)!)})`).join(", ")}`);
  }
  const fresh = tickers.filter((t) => !live.has(t));
  const claimedAt = new Date().toISOString();
  for (const t of fresh) {
    writeFileSync(join(CLAIMS_DIR, `${t}.json`), JSON.stringify({ ticker: t, claimedAt, note } satisfies Claim, null, 2) + "\n");
  }
  if (fresh.length === 0) return;
  git(`add -A -- "${CLAIMS_DIR}"`);
  console.log(`Claimed: ${fresh.join(", ")} (expires in ${CLAIM_TTL_HOURS} h)`);
  commitAndPush(`Claim: ${fresh.join(", ")}`, push);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
