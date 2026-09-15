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
