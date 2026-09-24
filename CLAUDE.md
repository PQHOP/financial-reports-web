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
   last 7 days of 10-K/10-Q filings **plus S&P 500 earnings-release 8-Ks
   (Item 2.02)**, which land on results day weeks before the 10-Q; `--
   --days N` / `-- --no-8k` to adjust). It cross-references SEC EDGAR's
   daily filing index against `scripts/data/sp500.json` /
   `scripts/data/us-listed.json` via SEC's ticker↔CIK map, drops
   `"skipped"` tickers, and writes
   `scripts/data/recent-filings-candidates.json` (gitignored — a
   regenerated scan artifact, never commit it) sorted hot list → S&P 500 →
   us-listed, newest first within each. Work through that list before
   touching the plain backlog below.

   **`"done"` companies come back as `kind: "update"`** when the filing is
   newer than their tracker `lastFilingSeen.filedAt` (amendments
   excluded). Since 2026-09-24 this is how an already-covered company's
   *next* quarter gets published — before that the scan dropped every
   `"done"` ticker, so a hot-list company's Q3 results would have been
   invisible until all ~5,500 companies were covered. For an update:
   - **New period** (e.g. Q3 results after a published Q2): publish a new
     report for that period, then set the tracker's `latestReport`,
     `lastFilingSeen`, `nextExpectedFiling`.
   - **Same period already published** (e.g. the 10-Q arriving weeks after
     the earnings 8-K we already wrote from): no new report — just update
     `lastFilingSeen` so the scan stops listing it. Only edit the existing
     report (`--edit`) if the full filing changes a figure or adds
     something material.
   - **8-K Item 2.02 source:** write from the earnings release (Exhibit
     99.1) and use it as `sourceUrl`; say in the report that the full
     10-Q/10-K isn't filed yet if segment/MD&A detail is missing.

   **Earnings season (roughly mid-Oct to mid-Nov, mid-Jan to late Feb,
   mid-Apr to mid-May, mid-Jul to mid-Aug):** tier 0 is the whole job.
   Search demand for "`<ticker>` earnings" peaks in the 1–3 days after
   results, so a hot-list company that reported today beats any backlog
   company; don't touch tiers 1–2 on a night tier 0 isn't empty.
1. **2026 report coverage, S&P 500 first.** Once the fresh-filing queue for
   this batch is exhausted, fall back to "get every company a published
   2026 report" (see the tracker mechanics below). "2026 report" means:
   ANNUAL if FY2026 results are already out, otherwise the latest 2026
   quarter that's been reported (Q1/Q2/Q3/H1) — don't wait on a quarter
   that hasn't been filed yet. Once a company has one qualifying report,
   it's **done** for this tier — this is a one-2026-report-per-company
   backlog to clear, not a commitment to republish every quarter (further
   quarters are tier 2's job, below). Within this tier: the **hot list**
   (`scripts/data/priority-tickers.json`, ~120 of the most-searched
   tickers) comes first, then the rest of the S&P 500 (the 503 seeded via
   `scripts/seed-sp500.ts`), then the ~5,060 companies from
   `scripts/seed-us-listed.ts` sitting in the `Uncategorized` industry.
   `npm run next-batch` applies exactly this order (see "Deciding what to
   work on this run").
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
   it has already dropped `"skipped"` tickers and `"done"` ones with
   nothing newer, so anything it lists is fair game (see the `"update"`
   rules under tier 0 above).
2. **Then run `npm run next-batch -- --n 5` and take its output in the
   order it prints — do not re-derive the ordering by hand.** It encodes:
   fresh-filing candidates (tier 0), then `"pending"` entries whose
   `nextExpectedFiling.estimate` has passed, then the **hot list**
   (`scripts/data/priority-tickers.json` — mega-caps and the names retail
   investors search for most, in search-demand order, so a visitor's likely
   query "`<ticker>` earnings" is answered before an obscure company's),
   then the rest of the S&P 500 in file order, then `us-listed`. Outside
   tier 0 it skips anything `"done"`/`"skipped"`. The hot list replaced pure
   alphabetical order on 2026-09-20 because search demand for "X earnings"
   is concentrated on a few hundred well-known tickers.
3. If you have direct evidence a company outside the printed batch has a
   fresh filing the scan missed, that outranks the batch order.
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

This background task only runs **01:00–07:59 Japan Standard Time (JST)**
nightly — i.e. 16:00–22:59 UTC (routine cron `0 16-22 * * *`). Moved on
2026-09-24 from 23:00–05:00 JST (14:00–19:59 UTC): US companies that
report after the close file their earnings 8-K around 20:05–21:00 UTC,
which the old window missed by a full day; pre-market reporters (~11:00–
12:30 UTC) are still picked up by the first firing.

**Nightly cap: at most ~20 report-periods per night.** The account's
*weekly* usage limit is shared with everything else; on 09-21 and 09-22
the routine published ~35 per night and then was locked out from 09-24
00:17 JST until 09-26 03:00 UTC — two and a half dark days. During
earnings season a dark day is the worst possible outcome, so pace the
week: once tonight's entry in the nightly log reaches ~20, stop and end
the firing with a short summary (later firings that night should see the
count and exit immediately). Tier 0 hot-list/S&P 500 items may exceed the
cap by a few if they reported that day.

**A cloud routine already exists for this — check it before creating
another one.** `trig_01GNdUY59Na4x3JxMr6p7mxK` ("2026 Report Coverage -
Nightly", created 2026-09-12) fires hourly across the whole window on its
own, no terminal required — strictly better than the session-local `/loop`
fallback below when it works. Check its state first with `RemoteTrigger
{action: "list_runs", trigger_id: "trig_01GNdUY59Na4x3JxMr6p7mxK"}` (and
`get_run_log` on a recent run) before assuming nothing is scheduled or
spinning up a second one — a repeated task run twice a night wastes a
research pass and can race on tracker/nightly-log updates.

**Status as of 2026-09-16 night: working end to end.** This routine fired
every night from 09-12 through 09-14 and published nothing every single
time (blocked by the cloud sandbox's network egress policy — see
`scripts/data/nightly-log.md` for that history), then hit two further
blockers on 09-15 night (an `ADMIN_PASSWORD` rotation that needed a
redeploy to take effect, and what looked like broken GitHub App write
access) that are now resolved. On 09-16 night — the first fully clean
run — it published **25 report-periods across 25 companies** (16→41
companies done, 32→57 report-periods total) across 5 sub-batches in one
extended firing, with GitHub `git push` succeeding cleanly 7+ times in a
row. Full per-blocker diagnosis and the running total: `scripts/data/
nightly-log.md`. Known remaining rough edges, none blocking:

- **Chromium/TLS-proxy trust** needs re-establishing every firing (fresh
  container each time) — two distinct failure modes seen so far: a
  missing cert (`certutil -A -n "ccr-agent-proxy" -t "CT,C,C" -i
  /root/.ccr/agent-proxy-ca.crt -d sql:/root/.pki/nssdb`) and, separately,
  a cert present with the wrong trust bits (`certutil -M -n
  "ccr-agent-proxy" -t "CT,C,C" -d sql:/root/.pki/nssdb`). Firings work
  around this in-session when hit, but it'd be one less thing to
  rediscover if the Environment's **Setup script** (the "Edit cloud
  environment" dialog, same place as Network access — runs before Claude
  Code launches, so it'd apply every firing) ran both `certutil` commands
  plus `npm install`. Not yet added as of 2026-09-16 — optional, needs
  the user.
- **A `/reports/<id>` URL occasionally serves a briefly-stale CDN
  response** right after publish (seen on ABAT and OPTT, both on 09-16) —
  a cache-busted re-fetch gets the correct content. Recurring enough to
  be a real (minor) deploy-config quirk, not investigated further yet.

Fall back to a session-local `/loop` (dynamic/self-paced) when the cloud
routine isn't reliably publishing, with the time window enforced manually
in the loop's own logic since `ScheduleWakeup` has no native time-of-day
gating and its `delaySeconds` is capped at 3600 — but don't run both
simultaneously once the cloud routine works, to avoid duplicate/competing
runs; stop the session-local one (`ScheduleWakeup({stop: true})`) once the
cloud routine is confirmed to be publishing again.

- On each wake, get the current time and convert to JST (UTC+9, no DST).
- If it's inside 01:00–07:59 JST: do a normal batch (research + publish a
  few companies per the tracker-driven priority below), then
  `ScheduleWakeup` again in ~20-30 minutes (`noop: false`).
- If it's outside the window: do nothing, and `ScheduleWakeup` for 3600
  seconds (the max) with `noop: true`, repeating hourly until the check
  lands back inside the window — there's no way to jump straight to 01:00
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
tonight's entry (identified by the JST calendar date of the evening
before the window — a window starting 01:00 JST on 09-25 is the "09-24
night" entry, same labelling as before the window moved) with: how many report-periods got published this batch and
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
publishing something partial. Also tell it explicitly: **never read or
write `scripts/data/report-tracker.json` or `nightly-log.md`** — report
findings back to the orchestrator, which is the only writer of those
files (subagents that self-wrote raced and clobbered each other's tracker
entries on three separate nights; asking nicely without an explicit
prohibition did not work). On the orchestrating side, treat a subagent
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
     "sourceUrl": "https://www.sec.gov/Archives/edgar/data/<cik>/<accession>/<primary-doc>.htm",
     "metrics": {
       "currency": "USD",
       "revenue": 94930,
       "revenueYoyPct": 6.0,
       "netIncome": 21448,
       "netIncomeYoyPct": 9.3,
       "epsDiluted": 1.4,
       "epsYoyPct": 12.0,
       "operatingMarginPct": 30.2
     }
   }
   ```

   - **`sourceUrl` is required for every new report:** the URL of the
     primary filing document you actually read (10-Q/10-K, or the
     earnings-release exhibit). It renders as "Source filing" on the
     report and is the main trust signal for a finance site.
   - **`metrics` is required too** (omit only a field the filing genuinely
     doesn't report, e.g. `operatingMarginPct` for a bank). Money is in
     **millions** of `currency`; percentages are plain numbers (6.0 means
     6.0%); `epsDiluted` is per share. These feed the report page's
     figures strip, the generated social card, social posts, the weekly
     newsletter draft and future sector scorecards, so they must match the
     metrics table in the report body exactly.
   - **Do not set `coverImageUrl`.** Placeholder images (placehold.co) are
     ignored by the site now; the site generates a social card from the
     metrics automatically. Omit the field.
   - When **editing** an existing report (`--edit`), include `sourceUrl`
     and `metrics` in the JSON too — an edit replaces those fields, so
     omitting them clears them.
   - Publishing pings IndexNow (Bing/Yandex) automatically from the
     server; nothing to do. A daily Vercel cron (`/api/cron/social`)
     announces new reports on Bluesky/X when credentials are configured.

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

## Community reports

Visitors can write their own report for any company at
`/companies/<slug>/write` (button on the company and report pages). They
leave a public name and a private email (never rendered; the admin sees it in
the review queue). Stored as `Report` rows with `origin: COMMUNITY`; system
reports are `origin: ADMIN` (the default, so every existing script and report
is unchanged). Rules future changes must keep:

- **Every public listing filters with `systemReports` / `communityReports`
  from `src/lib/community.ts`.** A new query that lists reports without one of
  them would leak PENDING submissions or mix community text into the system
  feed/sitemap/newsletter/social cron. Company and year pages show the system
  view by default and `?source=community` for the community view.
- Submissions start `PENDING` and only appear after `/admin` -> Approve
  (Reject deletes). `COMMUNITY_AUTO_PUBLISH=true` skips the queue.
- Community report pages are `noindex`, excluded from the sitemap, feed and
  IndexNow, and their Markdown renders with `untrusted` (no images, links
  `nofollow ugc`).
- Uniqueness is `(company, year, period, authorEmail)`; `authorEmail` is `""`
  for system reports, so there is still one system report per period.
- Spam controls: honeypot field, max 3 per email and 5 per IP-hash per rolling
  24h (`COMMUNITY_LIMITS`). Email is not verified.

## Daily market brief (automated news digest)

`/api/cron/news` (Vercel cron, `30 11 * * 1-5` UTC: weekday mornings, ahead of
the 13:30 UTC US market open, because the readers are English-speaking and
US-market focused) publishes one `Article` of
kind `NEWS` per UTC day at `/insights/market-brief-YYYY-MM-DD`. It does not
use the nightly Claude Code routine, so it does not draw on that usage budget;
it calls the Claude API directly and costs real money per run (about $0.1-0.2
with the default `claude-opus-5`; set `NEWS_MODEL=claude-sonnet-5` to roughly
halve it). Rules to keep:

- Needs `ANTHROPIC_API_KEY` and `CRON_SECRET` in Vercel env (both unset =
  the cron is a no-op / 401). `?force=1` with the bearer secret regenerates
  today's brief; otherwise an existing slug is skipped.
- Sources are fixed in `src/lib/newsFeeds.ts` (Fed, SEC, BLS, EDGAR 8-K
  filtered to companies we cover, CNBC, MarketWatch, Yahoo Finance RSS). Press
  items are only paraphrased and linked, never quoted at length. Fewer than 8
  usable items in the feed window (30h; 66h on Mondays to cover the weekend)
  = the run is skipped, not padded. No brief is scheduled for Saturday/Sunday.
- The model returns structured JSON (`source_ids`, not URLs) and
  `assembleBrief` in `src/lib/newsBrief.ts` builds the Markdown: source links
  come only from the feed items, tickers must be ones we cover, and a story
  whose dollar/percent figures don't appear in its cited items is dropped. If
  fewer than 3 stories survive, nothing is published. Keep that validation
  when changing the prompt.
- SEO: the title is `<headline naming the day's events> – Market Brief, <date>`
  (headline first, since search results truncate from the right; if its
  figures aren't in the kept stories it falls back to the first story's
  headline), the summary is capped at 160 chars, `NEWS` pages emit
  `NewsArticle` JSON-LD, and `src/app/insights/[slug]/opengraph-image.tsx`
  generates the social card.

## Weekly digest (the "newsletter", published to the web)

`/api/cron/digest` (Vercel cron, `0 23 * * 0`, Sunday 23:00 UTC) publishes one
`DIGEST` article per run date at `/insights/weekly-digest-YYYY-MM-DD`, straight
to the site with no review. It calls no model: `renderDigest` in
`src/lib/weeklyDigest.ts` only re-assembles what the site already published in
the last 7 UTC days (system reports with their `metrics`, plus `NEWS` briefs),
so every figure is one already published in a report. Skipped when fewer than 3
items. This is a web page plus the RSS feed, not an email send: there is no
subscriber list or mail provider. `/admin/newsletter` still generates a manual
paste-into-an-email-tool draft.

## Growth work (traffic, SEO, distribution)

**One-time pending task (delete this paragraph once done):** the 9 guides
in `content/guides/*.md` are written but not yet published (the local
`.env` password doesn't match production, and Vercel won't reveal it).
The first nightly firing should run, with the automation
`ADMIN_PASSWORD` and `SITE_URL` from its prompt:
`npm run admin-publish -- --articles-dir content/guides`, confirm
`/learn` lists 9 guides, then remove this paragraph and commit. It's
idempotent (upserts by slug), so a repeat is harmless. Do this before
starting research so it never gets skipped.

The plan lives in `docs/GROWTH_PLAN.md`; what's implemented vs. waiting on
the user is tracked at its end. Things future sessions should know:

- **Editorial articles** (guides, earnings previews, comparisons,
  scorecards) are a separate model (`Article`) from reports. Publish with
  `npm run admin-publish -- --article path/to/article.json` (shape in the
  script header; upserts by `slug`). Guides render at `/learn/<slug>`,
  everything else at `/insights/<slug>`. Guide sources live in
  `content/guides/*.json`.
- **Editorial content piggybacks on the nightly firing** (no separate
  routine: a second routine would need its own copy of the admin
  credential and would compete for the same usage budget). Do these
  *after* the guide task above and *before* the report batch, only when
  the condition holds, and count them in the nightly log:
  - **Weekly earnings preview** — on the first firing of each Sunday (UTC)
    from 2026-10-11 through the end of earnings season (roughly
    2026-11-20), if no `PREVIEW` article for that week exists yet
    (check `/insights`). Find which hot-list / S&P 500 companies report
    Monday–Friday of the coming week (WebSearch an earnings calendar; use
    only dates a source states). Keep the ones that already have a report
    on the site (so there is a "last quarter" to anchor on); if fewer than
    3 qualify, skip the week. For each: expected report date, what the
    last published quarter showed (figures **only from our own published
    reports** and management's own guidance in them), and the 1-2 things
    to watch. Do **not** state analyst consensus numbers unless you fetched
    a source you can name inline; otherwise leave consensus out. Link each
    company's latest report (`/reports/<id>`). Slug
    `earnings-preview-<YYYY-MM-DD>` (the Monday), kind `PREVIEW`, `tickers`
    set. Publish with `--article`. Same research-subagent rules as reports.
  - **Comparison** — at most one per firing, at most two per week: when
    two companies in the same industry both have a current-period report
    with `metrics` and no comparison of that pair exists, publish a
    `COMPARISON` (`<a>-vs-<b>-<period>-<year>`) using only the two
    reports' own figures: growth, margins, what drove each, and where they
    diverge and why.
  - **Scorecard** — not automated; run by hand once ≥20 companies have
    `metrics` for the same quarter (kind `SCORECARD`, table of revenue
    growth / operating margin / EPS growth by company, top and bottom
    movers with the reason from each report).
- **Thin pages stay out of the index:** companies/industries/years with no
  report are `noindex` and absent from `sitemap.xml`. Don't add them back.
- **Env vars that gate features** (all optional, set with `vercel env add
  ... --value`): `CONTACT_EMAIL` (shown on `/contact`), `CRON_SECRET` (must
  be set for `/api/cron/social` to run at all), `BLUESKY_HANDLE` +
  `BLUESKY_APP_PASSWORD`, `X_API_KEY` / `X_API_SECRET` / `X_ACCESS_TOKEN` /
  `X_ACCESS_SECRET`. With none of the social ones set the cron is a no-op.
- **Bluesky is live (2026-09-24):** account `@financialreportinsights.com`
  (domain handle via the `_atproto` TXT record in Vercel DNS; originally
  `finreportinsights.bsky.social`). `BLUESKY_HANDLE` holds the account's
  DID (`did:plc:mxxajezbqpgikhmf2lhssdce`), not the handle, so a future
  handle change can't break login. `/api/cron/social` runs at 23:10 UTC,
  right after the nightly window, posting up to 8 reports from the last 3
  days, each with a link card using the report's OG image (Bluesky doesn't
  unfurl links on its own). X is not set up.
- **Usage budget is the bottleneck, not schedule slots.** The nightly
  routine has repeatedly hit the account's 5-hour session limit (later
  hourly firings exit in seconds with "session limit"). Don't add LLM
  routines casually; each one takes report capacity from the nightly job.
- `/admin/newsletter` generates the weekly digest draft from the last 7
  days of publications.

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
  domain `https://financialreportinsights.com` since 2026-09-20, bought
  through Vercel (registrar + nameservers both Vercel, expires 2027-09-20,
  $11.25/yr renewal); `www.` is attached too. The old
  `https://financial-reports-web.vercel.app` alias still serves the same
  site, and canonical/sitemap/OG URLs follow `SITE_URL` so they point at
  the custom domain. Changing `SITE_URL` needs a redeploy to take effect.
  The nightly cloud routine's stored prompt still says the old
  `.vercel.app` URL for `SITE_URL` — that keeps working via the alias, so
  it wasn't changed) via `vercel --prod` run directly from this directory — no
  GitHub connection is used for deploys. Vercel env vars (`DATABASE_URL` and
  friends from the Postgres integration, plus `ADMIN_PASSWORD`,
  `ADMIN_SESSION_SECRET`, `SITE_URL`) are managed with `vercel env add/rm`;
  always pass `--value "..."` explicitly rather than piping the value over
  stdin — piped stdin has silently corrupted values here before (a wrong
  `ADMIN_PASSWORD` that made `admin-publish` fail login, an empty `SITE_URL`
  that broke `new URL()` in the root layout at build time).
