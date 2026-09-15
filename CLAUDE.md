@AGENTS.md

# Financial Report Insights

A site that publishes financial-report analysis for publicly listed companies,
organized by industry -> company -> year -> report. Public pages are
read-only; all authoring happens under `/admin` (password-protected) or via
the local scripts below.

The company/industry directory is seeded from the full S&P 500 constituent
list (503 tickers, 11 GICS sectors as industries, no reports attached) via
`scripts/seed-sp500.ts` — sourced from Wikipedia's "List of S&P 500
companies", with HQ country hand-corrected for the ~25 constituents
headquartered outside the US (Ireland, UK, Switzerland, etc. — see the
`countryOverride` map baked into `scripts/data/sp500.json` at generation
time). It's idempotent (upsert by slug, never deletes) and safe to re-run
against a fresh database — see git history for how it was last invoked (it
runs once via a temporary line in `vercel-build`, since Vercel's serverless
environment is the only place with real access to the production
`DATABASE_URL` — see the Stack notes below on why local scripts can't reach
it directly). Companies outside the S&P 500 still need to be added via
`/admin/companies` per the workflow below.

On top of that, `scripts/seed-us-listed.ts` bulk-added every other US-listed
common stock (NASDAQ + NYSE + NYSE American + NYSE Arca + Cboe BZX, ~5,060
more companies) from NASDAQ Trader's public symbol directory — "all
US-listed companies" was the deliberately-scoped stand-in for "all listed
companies in the world" (not achievable: no free bulk source covers every
global exchange, and licensed data APIs would be needed for full global
coverage). That source has no sector data, so anything from this batch
without another industry lands in a catch-all `Uncategorized` industry —
don't be surprised to see it, it's not a bug. Same idempotent/additive/
temporary-`vercel-build`-hook approach as the S&P 500 seed.

Also: any Prisma `contains` string filter needs `mode: "insensitive"`
explicitly (see `src/app/search/page.tsx`) — Postgres `contains` is
case-sensitive by default, unlike SQLite's, and this bit us once already
after the Postgres migration (search silently returned nothing for
non-exact-case queries until fixed).

## Standing priority: fresh filings first, then 2026 coverage, then multi-year backfill

Until this is caught up, treat keeping report coverage current and broad as
the default background task whenever there's no more specific ask. Work
happens in three priority tiers, always in this order — the goal is that a
visitor landing on the site sees analysis of a report that came out
*recently*, not just eventually:

0. **Companies whose filing just landed on EDGAR.** Run
   `npm run scan-recent-filings` at the start of a batch (defaults to the
   last 7 days of 10-K/10-Q filings; `-- --days N` / `-- --forms
   10-Q,10-K,8-K` to adjust). It cross-references SEC EDGAR's daily filing
   index against `scripts/data/sp500.json` / `scripts/data/us-listed.json`
   via SEC's ticker↔CIK map, excludes tickers already `"done"` or
   `"skipped"` in the tracker, and writes
   `scripts/data/recent-filings-candidates.json` (gitignored — a
   regenerated scan artifact, never commit it) sorted newest-filed-first.
   Work through that list before touching the plain backlog below — S&P
   500 tickers still sort ahead of `us-listed` ones on a same-day tie, but
   a fresher `us-listed` filing outranks a stale S&P 500 backlog entry.
1. **2026 report coverage, S&P 500 first.** Once the fresh-filing queue for
   this batch is exhausted, fall back to "get every company a published
   2026 report" (see the tracker mechanics below). "2026 report" means:
   ANNUAL if FY2026 results are already out, otherwise the latest 2026
   quarter that's been reported (Q1/Q2/Q3/H1) — don't wait on a quarter
   that hasn't been filed yet. Once a company has one qualifying report,
   it's **done** for this tier — this is a one-2026-report-per-company
   backlog to clear, not a commitment to republish every quarter (further
   quarters are tier 2's job, below). Within this tier: S&P 500 companies
   (the 503 seeded via `scripts/seed-sp500.ts` — being in the S&P 500 at
   all is the "top companies" cut, so no further ranking within the tier
   is needed) come before the ~5,060 companies from
   `scripts/seed-us-listed.ts` sitting in the `Uncategorized` industry.
2. **Multi-year backfill.** Only once every company in both files is
   `"done"` or `"skipped"` for 2026: go back through already-`"done"`
   companies and add reports for their other available fiscal years, most
   recent not-yet-covered year first (e.g. 2025 before 2024), same
   S&P-500-first ordering, tracked via each entry's `reports` array. This
   has no finish line — it's a standing expansion of how much history the
   site carries per company, not a one-off backlog, so keep working
   backward through years for as long as the operating window allows.
   Phase 2 freshness maintenance (below) still takes priority over this
   tier once triggered — keeping an already-published company's *current*
   year up to date beats adding another company's old history.

### The tracker file — read it first, update it after every company

`scripts/data/report-tracker.json`, keyed by ticker, is the single source
of truth for what's been done and what's coming. Read it at the start of
every run before picking companies, and write an entry (or update one) for
every company you touch — including skips, so the reason isn't
re-discovered from scratch next time. Shape per entry:

```json
{
  "TICKER": {
    "name": "...",
    "status": "done" | "skipped" | "pending",
    "latestReport": { "year": 2026, "period": "Q2", "publishedAt": "YYYY-MM-DD", "url": "..." },
    "lastFilingSeen": { "type": "10-Q", "periodEnd": "YYYY-MM-DD", "filedAt": "YYYY-MM-DD" },
    "nextExpectedFiling": { "type": "10-Q (Q3 2026)", "estimate": "YYYY-MM-DD", "basis": "...", "confidence": "estimated" | "confirmed" },
    "skipReason": "only present when status is 'skipped', e.g. 'no 2026 filing found on EDGAR'",
    "lastChecked": "YYYY-MM-DD"
  }
}
```

`nextExpectedFiling` is an estimate inferred from filing cadence (a
company's quarterlies land roughly 90 days apart, annuals roughly 365 —
compute the next one from `lastFilingSeen.filedAt` when you don't have
anything better) — refine it with an actual WebSearch (e.g. "`<company>`
Q3 2026 earnings date") when it's cheap to do so, and mark `confidence:
"confirmed"` when a search backs it. This calendar isn't needed to clear
the initial backlog (below) — it's what Phase 2 (after full coverage) uses
to revisit companies as new quarters come out, and what tells the loop not
to bother re-checking a company whose next filing clearly hasn't happened
yet.

### Deciding what to work on this run

1. Run `npm run scan-recent-filings` and work its output first (tier 0) —
   it has already excluded `"done"`/`"skipped"` tickers, so anything it
   lists is fair game, newest-filed first.
2. Once that list is exhausted (or empty), skip anything in the tracker
   already marked `"done"` for 2026, and among what's left, prefer anything
   marked `"pending"` whose `nextExpectedFiling.estimate` has passed (or
   anything you have direct evidence — e.g. a fresh EDGAR filing the scan
   missed — is now available) — its report is likely sitting on EDGAR
   unresearched and is higher-value than working further down an
   alphabetical backlog.
3. Otherwise, work through the tier-1 backlog in file order
   (`scripts/data/sp500.json` then `scripts/data/us-listed.json`), skipping
   tickers already in the tracker as `"done"` or `"skipped"` for 2026.
4. Once literally every company in both files is `"done"` or `"skipped"`
   for 2026, two ongoing tracks open up — Phase 2 freshness maintenance
   takes priority over tier 2 multi-year backfill when both apply to the
   same company:
   - **Phase 2 (freshness):** sweep the tracker for entries whose
     `nextExpectedFiling.estimate` has passed, confirm/update the date if
     needed, and check whether a newer filing now exists — if so, treat it
     like a normal new report (edit the existing one, or add the new
     period, per the publishing pipeline below) and refresh the tracker
     entry.
   - **Tier 2 (multi-year backfill):** for `"done"` companies with no
     pending freshness check, add their next-most-recent uncovered fiscal
     year (see tier 2 above), S&P 500 first.

As a live secondary check (not a replacement for the tracker), you can
still spot-check `https://<SITE_URL>/companies/<slug>` — if the tracker and
the live site ever disagree, the live site wins and the tracker entry
should be corrected.

This is far too large a backlog (thousands of companies) to complete in one
sitting — it's meant to be worked through incrementally, one company per
full pipeline run (below), across many sessions or via a `/loop`/schedule.
Since this publishes real analysis of real public companies to a live site,
apply the same rigor per company regardless of how many are left in the
queue — never fabricate figures to move faster; skip and flag a company
(in the tracker, with `skipReason`) rather than guess when its filing isn't
findable.

### Operating window

This background task only runs **23:00–05:00 Japan Standard Time (JST)**
nightly — i.e. 14:00–19:59 UTC.

**A cloud routine already exists for this — check it before creating
another one.** `trig_01GNdUY59Na4x3JxMr6p7mxK` ("2026 Report Coverage -
Nightly", created 2026-09-12) fires hourly across the whole window on its
own, no terminal required — strictly better than the session-local `/loop`
fallback below when it works. Check its state first with `RemoteTrigger
{action: "list_runs", trigger_id: "trig_01GNdUY59Na4x3JxMr6p7mxK"}` (and
`get_run_log` on a recent run) before assuming nothing is scheduled or
spinning up a second one — a repeated task run twice a night wastes a
research pass and can race on tracker/nightly-log updates.

This routine fired every night from 09-12 through 09-14 and published
nothing every single time — its cloud sandbox's network egress policy
blocked `www.sec.gov` and `financial-reports-web.vercel.app`. **Fixed
2026-09-15** by the user (Network access on Environment
`env_01BS8ej9WZxyj4AZyF5TrTyC` "Default", changed from "Trusted" to
"Full"/unrestricted at https://claude.ai/code's environment settings —
edit the environment, no tool available to a session can do this from
inside itself). Confirmed working via a manual `RemoteTrigger run` and
via the 6 real cron firings on the night of 09-15: both `sec.gov` and the
deployed site return 200. Full diagnosis history: `scripts/data/
nightly-log.md`.

Fixing the network unblocked the routine only to hit two more blockers on
09-15 night, **zero report-periods published that night either** — see
`scripts/data/nightly-log.md`'s 2026-09-15 entry for the full detail:

1. **Rotating `ADMIN_PASSWORD` needs a redeploy to actually take effect.**
   `vercel env rm/add` alone does **not** update an already-running
   production deployment — Vercel bakes env vars into the deployed
   function at deploy time, not read live per request. Every firing on
   09-15 night failed to log in because the routine's prompt had the
   *new* password while production was still serving the *old* one.
   **Fixed 2026-09-16**: ran `vercel --prod` again. Whenever
   `ADMIN_PASSWORD` is rotated going forward, redeploy in the same breath
   — updating the routine's prompt and Vercel's env var isn't enough by
   itself. (Also as of 2026-09-15: routines have no secrets mechanism —
   `job_config.ccr.session_context.environment_variables` is rejected on
   triggers ("not supported on triggers — trigger configs are persisted
   and replayed on every fire") — so the password still lives in the
   prompt text; rotate periodically as the only available mitigation.)
2. **The GitHub App backing this routine can clone/fetch but cannot
   push** — `git push`, `mcp__github__push_files`, and
   `mcp__github__create_or_update_file` all returned `403 Resource not
   accessible by integration` on every 09-15 firing that got far enough
   to try, with: *"Claude doesn't have GitHub access to
   PQHOP/financial-reports-web for your organization. An org admin can
   install the Claude GitHub App at
   https://github.com/apps/claude/installations/select_target, or
   reconnect GitHub from claude.ai settings
   (https://claude.ai/customize/connectors?auth_start=github&auth_start_force=1)."*
   **Unresolved as of 2026-09-16 — still needs a human with admin rights
   on the GitHub org/repo**, via one of the two links above. (An earlier
   version of this note claimed repo access was "fine in every run" and
   blamed the old, wrong network-policy-was-GitHub-App theory — that was
   read-only clone/fetch working, which is a different permission from
   push; don't conflate the two again.) Until fixed, the routine can
   still research and publish reports to the live site (that path is
   Playwright-against-the-deployed-admin-UI, unrelated to git), but
   **cannot persist `report-tracker.json`/`nightly-log.md` updates** —
   each firing re-derives "what's next" from scratch. Treat this as the
   current top-priority blocker to get a human to fix.
3. One firing also hit Playwright's Chromium not trusting the sandbox's
   TLS-intercepting proxy (`ERR_CERT_AUTHORITY_INVALID`) — a fresh
   container every firing means this isn't a one-time fix. Confirmed
   working: `apt-get install -y libnss3-tools && certutil -A -n
   "ccr-agent-proxy" -t "CT,C,C" -i /root/.ccr/agent-proxy-ca.crt -d
   sql:/root/.pki/nssdb`. **Put this in the Environment's Setup script**
   (the "Edit cloud environment" dialog, same place as Network access —
   it runs before Claude Code launches, so it applies every firing
   instead of being rediscovered each time) along with `npm install`.
   Not yet added as of 2026-09-16 — needs the user.

Fall back to a session-local `/loop` (dynamic/self-paced) when the cloud
routine isn't reliably publishing, with the time window enforced manually
in the loop's own logic since `ScheduleWakeup` has no native time-of-day
gating and its `delaySeconds` is capped at 3600 — but don't run both
simultaneously once the cloud routine works, to avoid duplicate/competing
runs; stop the session-local one (`ScheduleWakeup({stop: true})`) once the
cloud routine is confirmed to be publishing again.

- On each wake, get the current time and convert to JST (UTC+9, no DST).
- If it's inside 23:00–05:00 JST: do a normal batch (research + publish a
  few companies per the tracker-driven priority below), then
  `ScheduleWakeup` again in ~20-30 minutes (`noop: false`).
- If it's outside the window: do nothing, and `ScheduleWakeup` for 3600
  seconds (the max) with `noop: true`, repeating hourly until the check
  lands back inside the window — there's no way to jump straight to 23:00
  in one call, so this chains several no-op hourly wakeups while waiting.

This only runs while the session/terminal stays open on the machine — if
that's not viable, that's a real limitation to flag to the user rather
than something to silently route around by re-attempting the cloud path.

### Nightly log — update after every batch

`scripts/data/nightly-log.md` is a human-readable, per-night running log
(separate from the tracker, which is the machine-readable source of
truth) — it's what answers "how many reports got done last night vs. the
night before" without having to recompute it from `report-tracker.json`
every time. At the end of every batch during the operating window (i.e.
right before each `ScheduleWakeup(noop: false)`), append to or update
tonight's entry (identified by the JST calendar date the 23:00 window
started on) with: how many report-periods got published this batch and
in total tonight, which tickers/periods, any skips with their reason, and
which tier/phase was worked. Don't create a new entry per batch — a night
spans several wakes 20-30 minutes apart, so accumulate into one entry per
night. A batch that produced nothing (e.g. a subagent came back
incomplete and nothing was published, see below) still gets a note in
that night's entry rather than silently vanishing.

### Model for the research/analysis step

Do the actual filing research and report-writing via an Agent subagent
with `model: "opus"` explicitly set — one company (or a small batch) per
subagent call, run synchronously (not backgrounded) so results are known
before deciding what's next and updating the tracker. Whatever model is
orchestrating the loop itself doesn't need to be Opus; the analysis quality
matters more for the actual research/writing step, so that's what should
run on it.

**If the subagent runs low on budget mid-analysis, it must stop and
report back incomplete — never publish a partial report.** A subagent can
run out of context/output budget while reading a filing or writing the
markdown; if it pushes ahead and calls `admin-publish` anyway with
whatever it has (e.g. content that cuts off mid-sentence, a metrics table
with placeholder-looking figures), that goes live exactly like a finished
report — the admin form only validates that fields are non-empty, not
that the content is actually complete. Tell every research subagent
explicitly, as part of its task prompt: if you can't finish a thorough,
sourced analysis within your available budget, stop and say so instead of
publishing something partial. On the orchestrating side, treat a subagent
result as untrusted until checked, not as ground truth:

- If the subagent reports it didn't finish (or its final message doesn't
  contain a clean `/reports/<id>` URL matching what `admin-publish`
  itself prints on success), do **not** mark the tracker `"done"` — leave
  it `"pending"` (or unset) with a short note so the next run retries it,
  and do not count it in the nightly log's published total.
- If it reports success, do one cheap sanity check before trusting it:
  fetch the resulting `/reports/<id>` URL and confirm the content is
  present and doesn't look truncated (ends mid-sentence, a table with an
  obviously unclosed row, a summary shorter than a sentence). If it looks
  broken, fix it via edit mode (`--edit <reportId>`) rather than leaving a
  half-finished report live, and note what happened in the tracker/nightly
  log.
- This also means running out of the *session's* own budget (not just the
  subagent's) mid-write is recoverable, not catastrophic: nothing reaches
  the live site until the JSON file is written and `admin-publish` is
  actually run, so a session that stops before that point has simply
  wasted that iteration's partial work, not published broken data. Only a
  subagent that ignores the instruction above and publishes prematurely
  creates a real risk, which is what the post-publish sanity check catches.

### Writing for a lay audience

On top of the writing-style rules below (precise, sourced, no buzzwords):
write so someone with no finance background can follow what happened and
why it matters, not just an analyst. Briefly explain a term the first time
it's load-bearing (e.g. "operating margin — the share of revenue left
after running the business, before interest and tax" the first time it's
the crux of a sentence), don't assume the reader already knows what a
"comp" or "constant currency" means, and prefer plain phrasing over
finance jargon wherever the two say the same thing equally precisely. This
is about accessibility, not dumbing down the substance — keep the specific
numbers and the specific causal claims, just don't require a finance
degree to parse the sentence carrying them.

## Publishing a report analysis (the main recurring task)

Publishing happens by driving the real `/admin` UI with a headless browser
(`scripts/admin-publish.ts`, using Playwright) — the same login, the same
form, the same validation a human admin would go through. There is no
direct-database path; this also means it works unchanged against a deployed
site (set `SITE_URL`), not just local dev, with no DB credentials involved.

When asked to research and publish a financial report for a company, follow
this pipeline end to end in one session:

1. **Find the company's exact listing.** Run `npm run admin-publish -- --list`
   to print every company name/ticker as it appears in the admin dropdown.
   If the company doesn't exist yet, it must be added first via
   `/admin/companies` (there is no scripted path for creating companies,
   only for publishing reports).
2. **Get the source filing, and read it yourself — don't let WebFetch's
   summarizer do the analysis.** Find the filing on SEC EDGAR
   (https://www.sec.gov/cgi-bin/browse-edgar) or the company's investor
   relations page; WebFetch is fine for this lookup step (finding accession
   numbers, filing-index links, picking the right exhibit). But for the
   actual numbers and MD&A commentary, download the primary document (the
   10-Q/10-K itself, or its earnings-release 8-K Exhibit 99.1 when the full
   filing is too large to search efficiently) and read it directly:

   ```
   curl -H "User-Agent: FinancialReportInsights research-tool contact@financial-reports-web.vercel.app" <doc-url> -o <scratchpad-file>.htm
   node scripts/html-to-text.mjs <scratchpad-file>.htm <scratchpad-file>.txt
   ```

   SEC blocks plain/undeclared user agents outright (returns an HTML error
   page instead of the filing) — the `User-Agent` header above is required,
   per SEC's fair-access policy. SEC's inline-XBRL filings also ship as one
   giant minified HTML line, unreadable via Grep/Read directly; the
   `html-to-text.mjs` conversion (line-per-element) is what makes them
   greppable. Then Grep the `.txt` for the section you need (e.g.
   "CONDENSED CONSOLIDATED STATEMENTS OF OPERATIONS", "Segment Operating
   Performance", a specific line item name) and Read the surrounding lines
   — this is where the real depth comes from: exact line-item figures,
   the specific MD&A sentence explaining *why* something moved (e.g. "due to
   higher net sales of Pro models", "primarily due to... investments in
   artificial intelligence"), YTD figures alongside the quarter, per-product
   and per-region detail, not just the headline numbers. WebFetch's
   fetch-and-summarize pipeline routes the actual content through a small,
   fast model before you ever see it — good enough for "where's the
   filing," not for the analysis itself. For non-US companies, ask the user
   for a PDF/link if it isn't reachable by URL.
3. **Analyze comprehensively and write Markdown content.** This renders on
   the public report page via `src/components/ReportContent.tsx`, which
   supports GFM tables and blockquote callouts. **Text only — no images,**
   including no `placehold.co` chart placeholders; a table conveys the same
   information without a fake chart standing in for a real one. There's no
   fixed template — shape each report around what's actually notable in
   that filing rather than forcing identical section headings every time
   (skip "Segment Performance" for a single-segment company, add a section
   for a one-off item like an acquisition, restructuring, or guidance cut,
   lead with whatever the filing itself emphasizes). What every report
   should still have, however it's organized:
   - A clear headline (what happened and what drove it)
   - A metrics table (GFM: Metric | This period | Same period last year |
     YoY Change) with revenue, margin, net income/profit, EPS or
     equivalent, plus 1-2 metrics specific to the industry (e.g. NIM+NPL
     for banks, same-store sales for retail, ARPU for telecom)
   - One clear `> **Takeaway:**` callout — the single most important
     insight, not a recap
   - Some forward-looking read: management's guidance if given, plus your
     own view on trajectory

   **Writing style — analyze like an actual equity/credit analyst would,**
   not like generic press-release rewriting:
   - State what moved and why, backed by the specific line item or MD&A
     sentence that explains it (see the sourcing note above) — not vague
     causal gestures.
   - Call out what's actually a mix effect, an FX effect, a one-off, or a
     comp-driven distortion when the filing supports that read (e.g. GAAP
     vs. adjusted EPS diverging, a prior-year one-time item, a currency
     tailwind inflating a region's growth rate). Flag when a headline
     number and the underlying driver point in different directions.
   - Avoid empty, sounds-impressive-says-nothing phrasing: no "robust
     growth trajectory," "well-positioned to capitalize," "solidifies its
     position as a leader," "testament to," "underscores its commitment
     to," "in today's dynamic environment," or similar filler. If a
     sentence would still be true with the specific numbers deleted from
     it, rewrite or cut it.
   - Precision over enthusiasm — a flat, specific sentence beats an
     enthusiastic vague one every time.

4. **Publish it** by writing a JSON file (anywhere, e.g. in the OS temp dir
   or the scratchpad — never commit it) shaped like:

   ```json
   {
     "company": "Apple",
     "year": 2026,
     "period": "Q3",
     "title": "AAPL — Q3 2026 Financial Report Analysis",
     "summary": "One sentence shown in report lists and search.",
     "contentMd": "## Overview\n...",
     "coverImageUrl": "https://placehold.co/1200x630/111827/ffffff?text=..."
   }
   ```

   `company` is matched as a case-insensitive substring against the admin
   dropdown's visible text (name or ticker) — use whatever `--list` printed.
   `period` must be one of `Q1 Q2 Q3 Q4 H1 ANNUAL` (`H1` = interim/half-year,
   `ANNUAL` = full year). Then run:

   ```
   npm run admin-publish -- path/to/report.json
   ```

   This logs into `/admin/login` and submits `/admin/reports/new` exactly
   like a human admin would (see `scripts/admin-publish.ts`). There's no
   upsert-on-conflict here — if a report for that company/year/period
   already exists, the real form's own uniqueness validation will reject it
   with the same error a human would see.

   To revise an already-published report (e.g. redoing one with deeper
   research), use edit mode instead of creating a duplicate:

   ```
   npm run admin-publish -- --edit <reportId> path/to/report.json
   ```

   This drives `/admin/reports/<id>/edit` the same way — same JSON shape,
   same field validation — just submitting to the existing report instead
   of creating a new one.
5. Report the resulting `/reports/<id>` URL back to the user.

By default this targets `http://localhost:3000`. Once the site is deployed,
point at it instead: `SITE_URL=https://your-deployed-domain npm run
admin-publish -- report.json` (and set `ADMIN_PASSWORD` to match that
deployment's password if different from `.env`). No database credentials
are ever needed for this — only the site URL and the admin password.

## Stack notes

- Next.js 16 (App Router, Turbopack) + Prisma 6 + Postgres (Neon). See
  `AGENTS.md` for framework-version caveats — this version has real
  differences from older Next.js docs/training data (Cache Components,
  `proxy.ts` instead of `middleware.ts`, `params`/`searchParams` as
  Promises). Read `node_modules/next/dist/docs/` before assuming an older
  API surface.
- Cache Components is **not** enabled; all data-reading pages use
  `export const dynamic = "force-dynamic"` and query Prisma directly per
  request. Keep new data pages consistent with that pattern.
- Database is Postgres via Neon (Vercel Storage integration), not SQLite.
  The Prisma generator uses `engineType = "client"` (see
  `prisma/schema.prisma`) so the query engine is engine-free at runtime —
  `src/lib/prisma.ts` connects through `@prisma/adapter-neon` instead of a
  native binary. This was required to deploy on Vercel's serverless
  runtime: the classic native query-engine binary reliably failed to be
  included in the function bundle (`rhel-openssl-3.0.x` "Query Engine not
  found", even with `binaryTargets` + `outputFileTracingIncludes` set) —
  the driver-adapter path sidesteps that entirely and is also the
  Neon-recommended pattern for serverless. `prisma migrate deploy` (which
  still uses its own bundled engine, unaffected by `engineType`) runs
  automatically before every build via the `vercel-build` script in
  `package.json`, so schema changes just need a normal `prisma migrate
  dev`-generated migration committed — no manual migration step on deploy.
- Local dev's `DATABASE_URL` (in `.env`) must point at a real Postgres
  connection string (e.g. a Neon branch) — the schema has a single
  `postgresql` datasource, so there's no local SQLite fallback anymore.
- Deployed on Vercel (project `hop22/financial-reports-web`, production
  domain `https://financial-reports-web.vercel.app` until a custom domain
  is attached) via `vercel --prod` run directly from this directory — no
  GitHub connection is used for deploys. Vercel env vars (`DATABASE_URL` and
  friends from the Postgres integration, plus `ADMIN_PASSWORD`,
  `ADMIN_SESSION_SECRET`, `SITE_URL`) are managed with `vercel env add/rm`;
  always pass `--value "..."` explicitly rather than piping the value over
  stdin — piped stdin has silently corrupted values here before (a wrong
  `ADMIN_PASSWORD` that made `admin-publish` fail login, an empty `SITE_URL`
  that broke `new URL()` in the root layout at build time).
