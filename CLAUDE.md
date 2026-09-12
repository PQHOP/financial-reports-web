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

## Standing priority: 2026 report coverage, top companies first

Until this is caught up, treat "get every company a published 2026 report"
as the default background task whenever there's no more specific ask.
"2026 report" means: ANNUAL if FY2026 results are already out, otherwise
the latest 2026 quarter that's been reported (Q1/Q2/Q3/H1) — don't wait on
a quarter that hasn't been filed yet. Once a company has one qualifying
report, it's **done** for this initiative — this is a one-report-per-
company backlog to clear, not a commitment to republish every quarter.

Priority order across companies:

1. **S&P 500 companies first** (the 503 seeded via `scripts/seed-sp500.ts` —
   being in the S&P 500 at all is the "top companies" cut, so no further
   ranking within that tier is needed).
2. **Everything else** (the ~5,060 companies from `scripts/seed-us-listed.ts`,
   sitting in the `Uncategorized` industry) only after the S&P 500 tier is
   done.

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

1. Skip anything in the tracker already marked `"done"`.
2. Among what's left, prefer anything marked `"pending"` whose
   `nextExpectedFiling.estimate` has passed (or anything you have direct
   evidence — e.g. a fresh EDGAR filing — is now available) — its report
   is likely sitting on EDGAR unresearched and is higher-value than working
   further down an alphabetical backlog.
3. Otherwise, work through the backlog in file order (`scripts/data/sp500.json`
   then `scripts/data/us-listed.json`), skipping tickers already in the
   tracker as `"done"` or `"skipped"`.
4. Once literally every company in both files is `"done"` or `"skipped"`
   in the tracker, the initiative shifts to Phase 2: sweep the tracker for
   entries whose `nextExpectedFiling.estimate` has passed, confirm/update
   the date if needed, and check whether a newer filing now exists —
   if so, treat it like a normal new report (edit the existing one, or add
   the new period, per the publishing pipeline below) and refresh the
   tracker entry.

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
nightly — i.e. 14:00–19:59 UTC. A cloud `schedule` routine was tried for
this (so it'd keep running without a terminal open) but GitHub App
installation for repo access couldn't be gotten working from this account
— don't retry that path without a specific reason to think it'll behave
differently. Use a session-local `/loop` (dynamic/self-paced) instead, with
the time window enforced manually in the loop's own logic since
`ScheduleWakeup` has no native time-of-day gating and its `delaySeconds` is
capped at 3600:

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

### Model for the research/analysis step

Do the actual filing research and report-writing via an Agent subagent
with `model: "opus"` explicitly set — one company (or a small batch) per
subagent call, run synchronously (not backgrounded) so results are known
before deciding what's next and updating the tracker. Whatever model is
orchestrating the loop itself doesn't need to be Opus; the analysis quality
matters more for the actual research/writing step, so that's what should
run on it.

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
