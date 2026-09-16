# Nightly report-coverage log

One running file tracking report-coverage progress **per night** of the
23:00–05:00 JST operating window (see `CLAUDE.md` → "Standing priority" →
"Operating window"). Updated at the end of every batch during the window
— never rewritten from scratch, only appended/updated for the current
night's entry. Counts are **report-periods published** (one company can
get several periods — Q1, Q2, Q3 — backfilled in a single night), not
unique companies; each entry also notes unique companies for clarity.

**Two mechanisms have run this task, don't confuse them:**
- A **cloud routine** (`trig_01GNdUY59Na4x3JxMr6p7mxK`, "2026 Report
  Coverage - Nightly", created 2026-09-12) — fires hourly 14:00–19:00 UTC
  (23:00–04:00 JST) on its own, no terminal needed. Check it with
  `RemoteTrigger {action: "list_runs", trigger_id: "trig_01GNdUY59Na4x3JxMr6p7mxK"}`
  before assuming nothing is scheduled, and **don't create a second cloud
  routine for this task** — update this one instead.
- A **session-local `/loop`** (dynamic, `ScheduleWakeup`-based) — only
  runs while a terminal/session stays open; started 2026-09-15 as a
  fallback while the cloud routine's blocker (below) was being sorted out.

## 2026-09-12 night through 2026-09-14 night — cloud routine blocked, 0 published

Discovered 2026-09-15: the cloud routine fired on schedule every night
since it was created (~17 firings total across 2026-09-12, 09-13, 09-14),
but **every single firing was blocked before any research could start** —
the cloud sandbox's network egress policy rejects outbound access to
`www.sec.gov` and `financial-reports-web.vercel.app` (and everything else
outside a small npm/GitHub/Anthropic allowlist), so it can't fetch
filings or reach the admin UI to publish. Each run correctly detected
this, published nothing, changed nothing in the tracker, and sent a push
notification — it did not fabricate or half-publish anything. Confirmed
by reading `get_run_log` for the first firing (2026-09-12 14:07 UTC) and
the most recent one (2026-09-14 19:06 UTC): identical failure both times.

The 16 companies / 32 report-periods that *did* get published on
2026-09-12 and 2026-09-13 (AAPL, MSFT, MMM, AOS, ABT, ABBV, ACN, ADBE,
AMD, AES, AFL, A, APD, ABNB, AKAM, ALB) were done in manual/interactive
sessions, not by this routine — see git history around "Migrate to
Postgres/Vercel, add SEO, seed S&P 500 + US-listed companies, and start
2026 report coverage".

**Fix needed (requires the user, no tool here can do it):** the cloud
Environment's (`env_01BS8ej9WZxyj4AZyF5TrTyC`, "Default") network egress
policy needs `sec.gov` and `financial-reports-web.vercel.app` allowlisted
— set at https://claude.ai/code environment settings. Until that's done,
the cloud routine will keep firing on schedule and keep publishing
nothing.

**Also fixed 2026-09-15** (while the network policy above still needs a
human): the routine's prompt now checks network access with one `curl` as
its very first command and stops immediately (no tracker/commit changes)
if blocked, instead of burning ~20 tool calls rediscovering the same wall
every single firing; `ADMIN_PASSWORD` was rotated (it had been sitting in
plaintext in the routine's stored prompt since 2026-09-12 — routines have
no secrets mechanism, `environment_variables` is rejected on triggers, so
it's still in the prompt text, just a fresh value); and
`scripts/admin-publish.ts` now honors `PLAYWRIGHT_EXECUTABLE_PATH` so the
routine doesn't have to re-patch the Chromium path every run either.

## 2026-09-15 night — network fix verified, local loop stood down

Manually triggered the cloud routine at 22:41 JST (19 min before the
window) to test the network fix: confirmed working — `sec.gov` and the
deployed site both returned 200 with the proper User-Agent (the earlier
403 was SEC's own bot-block, not the proxy). The routine correctly did
nothing else since it was outside the operating window (no
research/publish, tracker/log untouched, reverted an incidental
`package-lock.json` diff from `npm install`) — exactly the intended
behavior. Its next natural cron firing is 23:06 JST, the first firing
expected to actually publish since 2026-09-12.

The session-local `/loop` fallback was stopped this same night (user is
shutting down the machine) — it can't survive that regardless, so no
loss. From here, the **cloud routine is the only mechanism running
tonight**; it doesn't need this machine on. Next session: check
`RemoteTrigger {action: "list_runs", trigger_id: "trig_01GNdUY59Na4x3JxMr6p7mxK"}`
for tonight's firings (23:06 JST onward) and report what actually got
published before doing anything else.

## Nightly log (one entry per 23:00–05:00 JST window, from 2026-09-15 on)

<!-- New entries appended below. Format:

### YYYY-MM-DD night (23:00 JST YYYY-MM-DD → 05:00 JST YYYY-MM-DD+1)

- Mechanism: cloud routine / session-local loop
- Published: N report-periods across M companies — TICKER PERIOD YEAR, ...
- Skipped: TICKER (reason), ...
- Tier worked: 0 (fresh filings) / 1 (2026 backlog) / 2 (multi-year backfill) / Phase 2 (freshness)
- Running total after tonight: X companies done, Y report-periods published
- Notes: anything unusual (a subagent that came back incomplete and was
  NOT published, a company that needed a skip, etc.)
-->

### 2026-09-15 night (23:00 JST 2026-09-15 → 05:00 JST 2026-09-16)

- Mechanism: cloud routine (`trig_01GNdUY59Na4x3JxMr6p7mxK`), 6 firings at
  23:06/00:07/01:07/02:07/03:06/04:06 JST — its first real chance to work
  since 2026-09-12 now that network access is fixed.
- Published: **0 report-periods.** Tier 0 scan (`scan-recent-filings`) ran
  fine each time (88 fresh candidates found), but every firing was stopped
  before any research began by two blockers, both since fixed or flagged
  below:
  1. **`ADMIN_PASSWORD` mismatch** (every firing): the password rotated
     2026-09-15 was set on Vercel via `vercel env add` but the production
     deployment was never redone afterward — Vercel env var changes only
     take effect on the *next* deploy, not retroactively on an already-
     running deployment. Confirmed and **fixed 2026-09-16 morning**: ran
     `vercel --prod` again, `admin-publish -- --list` now logs in fine
     with the current password.
  2. **GitHub App has no write access to `PQHOP/financial-reports-web`**
     (every firing, once it got past #1): `git push` and both
     `mcp__github__push_files` / `create_or_update_file` all returned
     `403 Resource not accessible by integration`, with: *"Claude doesn't
     have GitHub access to PQHOP/financial-reports-web for your
     organization. An org admin can install the Claude GitHub App at
     https://github.com/apps/claude/installations/select_target, or
     reconnect GitHub from claude.ai settings
     (https://claude.ai/customize/connectors?auth_start=github&auth_start_force=1)."*
     **Still unresolved as of 2026-09-16 morning — needs a human with
     admin rights on the PQHOP GitHub org to fix via one of those two
     links.** Every prior firing (09-12 through 09-14) failed even
     earlier at the network check, so this was never surfaced before —
     it may have been broken since the routine's creation. Until fixed,
     the routine can research and even publish reports to the live site,
     but **cannot persist `report-tracker.json`/`nightly-log.md` updates**
     — each firing would re-discover the same "what's next" state from
     scratch (wasteful, though not harmful — `admin-publish`'s own
     uniqueness check still rejects a true duplicate).
  3. One firing (23:06 JST) also hit Playwright's bundled Chromium not
     trusting the sandbox's TLS-intercepting proxy (`ERR_CERT_AUTHORITY_
     INVALID` navigating to the deployed site) — fresh container each
     firing, so this isn't a one-time fix. Confirmed working fix:
     `apt-get install -y libnss3-tools && certutil -A -n "ccr-agent-proxy"
     -t "CT,C,C" -i /root/.ccr/agent-proxy-ca.crt -d sql:/root/.pki/nssdb`.
     Belongs in the cloud Environment's **Setup script** (runs before
     Claude Code launches, so it'd apply every firing) rather than
     rediscovered each time — not yet added, needs the user via the
     Environment edit dialog (see `CLAUDE.md` "Operating window").
- Tier worked: 0 only (scan ran; never got past login to research/publish).
- Running total after tonight: unchanged — 16 companies done, 32
  report-periods published (all from before 2026-09-15).
- Notes: two of the routine's own local commits from tonight (an
  unconfirmed alternate Chromium-TLS-trust code fix, and a nightly-log
  write-up) never reached GitHub because of blocker #2 above and were
  lost when their ephemeral containers were reclaimed — this entry was
  reconstructed from `RemoteTrigger get_run_log` transcripts instead, and
  pushed from a local session that still has working git access (unlike
  the routine, until #2 is fixed).

### 2026-09-16 night (23:00 JST 2026-09-16 → 05:00 JST 2026-09-17)

- Mechanism: this firing's invocation matches the cloud routine's pattern
  (automated `[SCHEDULED TASK]` prompt, no live user) — treating it as
  `trig_01GNdUY59Na4x3JxMr6p7mxK`'s work unless a later check shows
  otherwise.
- Network check passed first thing (`curl https://www.sec.gov/` without a
  User-Agent returned SEC's own 403 "Request Rate Threshold Exceeded" —
  that's SEC's fair-access page, not a proxy/policy block; retrying with
  the required `User-Agent` header from CLAUDE.md returned 200, as did the
  deployed site). Both blockers from the night of 09-15 were also
  confirmed fixed: `admin-publish -- --list` logged in fine with the
  current `ADMIN_PASSWORD` (no redeploy needed this time), and this
  entry's own `git push` below is the first real test of GitHub App write
  access since blocker #2 was reported unresolved on 09-16 morning.
- Ran tier 0 (`npm run scan-recent-filings`, 7-day window): 63 fresh
  candidates, newest-filed-first. Worked the top of the list in strict
  date order (09-15 filings before 09-14 before 09-11 before 09-10; no
  sp500 tie to break yet since AVGO/PANW only appear on 09-10).
- Published this batch (5 companies researched via opus subagents in
  parallel, run synchronously — results confirmed before tracker updates):
  - **FPS** (Forgent Power Solutions) — FY2026 ANNUAL (10-K, period end
    2026-06-30): https://financial-reports-web.vercel.app/reports/cmu46n798000104jqd7qd4bry
  - **BNTC** (Benitec Biopharma) — FY2026 ANNUAL (10-K, period end
    2026-06-30): https://financial-reports-web.vercel.app/reports/cmu46nbmh000004l0y23losq9
  - **ABAT** (American Battery Technology) — FY2026 ANNUAL (10-K, period
    end 2026-06-30): https://financial-reports-web.vercel.app/reports/cmu46n26n000004jqsxz89mo7
  - **VRA** (Vera Bradley) — 2026 Q2 (10-Q, fiscal Q2 FY2027, period end
    2026-08-01): https://financial-reports-web.vercel.app/reports/cmu46nd1n000004jq37upvstm
  - **ISPR** (Ispire Technology) — FY2026 ANNUAL (10-K, period end
    2026-06-30): https://financial-reports-web.vercel.app/reports/cmu46o9aj000004l8k78grtcx
- Skipped: **WFCF** (Where Food Comes From) — the only other 09-15
  candidate. Its listed filing was a 10-Q/A that, per its own explanatory
  note, "solely" amends Item 4 Controls & Procedures and re-files
  Section 302/906 certifications for the quarter ended March 31, 2026 —
  no financial data changed from the original 10-Q (filed 2026-05-14,
  itself not yet published by us). Not marked `skipped` in the tracker —
  WFCF still owes a 2026 report from the *original* Q1 10-Q, just not
  from this amendment; left untouched so it surfaces normally in tier-1
  backlog processing.
  - Note: the ABAT subagent flagged that the deployed site's CDN served a
    briefly-stale cached response for a `/reports/<id>` URL right after
    publish (a re-fetch with cache-busting returned the correct content).
    Not something this batch could fix — noting for whoever next touches
    the deploy config.
- Tier worked: 0 (fresh filings only; tier-1 backlog untouched tonight).
- Running total after tonight: 21 companies done, 37 report-periods
  published (16/32 before tonight + this batch's 5).
- Notes: none of the 5 subagents reported running low on budget; all
  passed their own post-publish sanity check (fetched the live page,
  confirmed no truncation) before reporting success.
