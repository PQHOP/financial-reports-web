# Site operations backlog

Owned by the "Site Operations - Daily" routine (see CLAUDE.md, "Daily
operations routine"). Top = next. Move finished items to the bottom with the
date and commit.

## Next

- **Keep `scripts/data/earnings-dates.json` fresh (ops job, since
  2026-10-23).** Before each heavy week, search the hot-list names due in
  the next ~14 days and add every date a company's own release states;
  leave out third-party calendars. 44 entries as of 10-24 (13 added
  10-24: INTC 10-29, UPS/PYPL/RCL 10-27, ORLY/KLAC 10-28, CVX/CL 10-30,
  PFE 11-03, UBER/QCOM 11-04, TTWO/PSKY 11-09; GOOGL + GOOG 10-28 added
  10-25 from Alphabet's 10-06 notice, which plain searches missed until
  the exact release title was searched). 47 entries. **META needs no
  entry:** its Q3 2026 report is already on the site (reported 10-21).
  Still no company notice as of 10-25: F, MCD, AMGN (investors.amgen.com
  403s from this environment), LYV, PLTR (every "Nov 2" source is a
  calendar; the 2025 Business Wire notice is what the search engines
  return). Entries whose date has passed are ignored by the overlay and
  can be deleted when convenient. Next sweep: before the 11-02 week
  (AAPL/AMD/PFE/QCOM/UBER are in; look again for PLTR, F, MCD, AMGN).
  **For the nightly routine:** INTC reports **Thu 10-29** (tracker
  estimated 10-23 — the 10-23 night scan correctly found nothing); AAPL
  **Mon 11-02** (not 10-29/30 as the Big Tech week note assumes); AMD
  11-03; V 10-27; CAT/LLY/MRK/GILD 10-29; SO/DUK/ABNB 11-05.

- **Nightly capacity is going unused on non-peak nights (seen 10-23
  night: 18/40).** With the hot list and S&P 500 fully `done` for 2026,
  a night's new report-periods are tier-0 S&P 500/hot-list filings
  (8 on a Thursday in earnings season) plus the ~10 us-listed cap; tier
  2 (multi-year backfill) never opens because its gate is "every
  us-listed company done or skipped", which at 10/night is years away.
  So firings 3-6 each confirmed one 10-Q and exited. Proposed to the
  user in the 2026-10-24 report: let tier 2 open for hot-list, then S&P
  500, companies whenever tier 0 is empty and the us-listed cap is hit,
  inside the ~40 cap. Waiting on the user; if yes, the CLAUDE.md tier-2
  gate paragraph is the change.

- **10-22 night result (watch item from 10-22, part (a) answered):**
  `npm run claim` was used before all 9 research batches ("Claimed …
  pushed cleanly", "Claims released after"), no "already exists"
  collision, and the 18:04/19:05/20:04/21:04 firings exited at once on
  40/~40. 40 report-periods, all tier 0 (incl. the 8 S&P 500 left over
  from 10-21: CCI, CSX, GL, KMI, LUV, LVS, ROL, URI); 2 hot-list rewrites
  (ULTA, GIS) + 15 queue items set `superseded`. Part (b) (FPIs gone from
  the top of the us-listed queue) could not be checked: tier 1 was never
  reached. 11 us-listed tier-0 candidates carried over (MAYS, VC, ARR,
  EGP, EPRT, INBS, LOAN, NTST, NVEC, TFIN, WFRD); EBAY deferred (8-K was
  a preannouncement, results 10-29 per the log).

- **Watch 2026-10-22 night: do firings use `npm run claim`, and does
  next-batch stop listing the waiting FPIs?** Ops shipped both on 10-22
  morning (`6825a03`, scripts + CLAUDE.md only). Check the nightly log:
  (a) a "Claim: ..." commit before each research batch and a "claimed by
  another firing" line in later scans; no "already exists" collisions.
  (b) `next-batch` no longer prints BRAI, BTCT, CCHH, CDTG, CHNR, CLWT,
  CRE, CUPR, CURR, DSY (pending, next filing not due) at the top of the
  us-listed backlog — before the fix they were re-confirmed as "nothing
  yet" firing after firing (10-19, 10-20, 10-21 nights). If the routine
  ignores the claim rule, the stored prompt is where it has to go (user's
  call). Also from the 10-21 night: 8 S&P 500 tier-0 candidates (CCI,
  CSX, GL, KMI, LUV, LVS, ROL, URI, all filed 10-21) were left
  unresearched because the night was already at 43/~40 — they're still
  inside the 7-day window and should surface first thing tonight. UDR
  needs an `--edit` on/after 2026-11-02 (preliminary figures) — the
  nightly's own follow-up, noted in its log.

- **Tier 0 same-day fix confirmed working (10-21 night).** The first
  firing's scan printed "Live: EDGAR full-text search" and 42 candidates
  (12 hot-list, 22 S&P 500, 8 us-listed); NFLX, GE, GM, RTX, ISRG, UAL,
  T, TMO, PM, MMM (10-20 filers) and TSLA, META, IBM, TXN, LRCX (10-21
  after-close filers) were all live the same night: 43 report-periods,
  the most ever, 3 over the cap via the hot-list exception. Downside
  seen the same night: two firings worked the same 8 us-listed tier-0
  tickers concurrently (7 wasted Opus passes, no duplicates went live)
  → the claims mechanism above.

- **Page indexing drill-down from Hop, 2026-10-20 (answers the 10-20
  "cần quyết định" item 1 — don't ask again).** Every example URL was
  last crawled Sep 20 – Oct 2, i.e. before the fixes; checked live 10-20,
  all now correct:
  - *Duplicate without user-selected canonical (21):* report URLs
    (`/companies/{pep,cmi,see,iqv,msci,exe,mco,ew,ddog}/2026/q2`) crawled
    Sep 26-27, right after the 09-25 URL move, plus `/companies/hal/2026`.
    Live: self-referencing canonical, `www.` and `/reports/<id>` 308 to
    it; year pages with one year of coverage are `noindex` on purpose.
    Nothing to fix; wait for recrawl.
  - *Crawled – currently not indexed (6 pending / 2 failed, validation
    failed 10-05):* `opengraph-image?…`, `/feed.xml`, two old
    `/reports/<id>`, `/learn/how-to-read-a-10-q`,
    `/insights/hd-vs-low-q2-2026` — the first four aren't meant to be
    indexed; the last two are real content to request indexing for.
  - *Page with redirect (8):* `/reports/<id>` → canonical, intended.
  - *Blocked 4xx (1):* old `pgr/2026/q2/opengraph-image?<hash>`, harmless.
  - *noindex (142):* `/companies/*/2026` single-year pages and
    `/companies/*/write`, intended.
  - *Discovered – not indexed (1.64K, data as of 10-12):* includes
    `/companies/aapl`, `/companies/a` — crawl budget, not a page defect.
  - Hop accidentally clicked **Validate fix** on noindex, duplicate and
    redirect (started 10-20). Harmless: the duplicate one even asks
    Google to recrawl those 21; the noindex/redirect ones will end
    "failed" because those states are intended — ignore that result.

- **GSC screenshots from Hop, 2026-10-19 (Crawl stats to 10-17, Page
  indexing):** 90 days 18.4K crawl requests (18,341 bare domain, 30
  `www.`), avg response 160 ms, 100% 200s. Daily line: ~3.8K/day 9-19,
  falling to ~0 by 10-01 and still flat at ~15/day through 10-17 — no
  recovery yet, but the robots.txt fix (10-15) has only 2 days in the
  data. Breakdown (90-day aggregate, so unchanged): Other file type 80%,
  HTML 13%, JSON 4%, JS 2%; Refresh 94% / Discovery 6%; Desktop 85%.
  Page indexing: ~2.45K known, ~0.6K indexed; not indexed: **Discovered –
  currently not indexed 1,638 (rising)**, noindex 142 (intended thin
  pages), Duplicate without user-selected canonical 21, Crawled –
  currently not indexed 8 (validation Failed), Page with redirect 8,
  other 4xx 1. Reading: Google knows the URLs but won't spend crawl on
  them — supports the 10-19 us-listed cap.
  **Follow-up from Hop, 2026-10-25 (don't ask again):** Page indexing
  unchanged (Discovered – not indexed 1,631, noindex 144, duplicate 21,
  redirect 8, crawled-not-indexed 8, 4xx 1). The 21 duplicates are
  canonical report URLs, all **last crawled 2026-09-27**: `/companies/
  {cmi,see,iqv,pep,msci,exe}/2026/q2`… — two days after the 09-25 move
  off `/reports/<id>`. Google kept the already-indexed old `/reports/<id>`
  as canonical (same reason those old URLs still earn impressions at
  position ~5). Today the new URLs declare their own canonical
  (`reportMetadata` in `ReportView.tsx`) and the old ones 308 to them, so
  it resolves on recrawl; the validation Hop started 10-20 already asks
  for that. Nothing to fix — check again only if still 21 by mid-November.

- **Hop's answers to the 2026-10-19 review (given 10-19, don't ask
  again): yes to all five.** (1) us-listed capped at ~10/night, budget to
  tier 0 + preview + comparisons + rewrites — in CLAUDE.md. (2) The two
  10-19 nightly rules stay. (3) Hop does Bing Webmaster Tools (import from
  GSC) and GSC "Request indexing" for ~10 URLs/day by hand — suggest the
  day's best URLs in the report (homepage, `/companies/aapl`, `/learn`,
  freshly rewritten hot-list reports). (4) Ops drafts outside posts on
  Mondays, Hop posts — in CLAUDE.md. (5) "At a glance" box above the
  figures — shipped 10-19 (see Done). Next deep review should check
  whether US engaged sessions/time on report pages move after (5).

- **From Hop, 2026-10-17 (don't ask again):** sitemap resubmitted in GSC
  on 10-17 — status Success, read 10-17, **2,609 discovered pages**.
  Manual actions: **No issues detected**. Security issues: **No issues
  detected**. So the crawl slowdown isn't a penalty; drop those two items
  from "cần anh/chị quyết định". **AdSense: Hop's decision is to hold off
  applying** (`ADSENSE_CLIENT` stays unset) until the site looks stronger
  — keep doing content-depth work, and propose when it's ready, with
  evidence, rather than re-asking daily. No Crawl stats screenshot this
  week yet.
- **GA4 traffic is mostly bots — measure people, not sessions (since
  2026-10-18).** 28 days to 10-16: 248 sessions, **26 engaged**; last 7
  days Germany 100 sessions / 1 engaged / 5 s average, China 27 / 0,
  Singapore 16 / 0, versus United States 24 / 6 / 51 s. `site-metrics`
  now carries `engagedSessions` on every GA4 breakdown; report
  engaged sessions (and Organic Search sessions) against the 10,000
  goal, never raw users. If the Germany/China direct traffic keeps
  growing, it is a candidate for a Vercel Firewall challenge rule by
  ASN (user's call; find the ASN in the Vercel Firewall traffic view —
  not in the API this routine has).
- **Watch after 2026-10-19 (CLAUDE.md changes, see Done):** (a) **10-19
  night: no collision** — the per-firing cap held (first firing 24 incl.
  14 tier-0 banks + 8 tier-1, second 2 us-listed + 1 comparison, third 1
  comparison, firings 4-7 exited with nothing workable); the night ended
  at 26/40 because the us-listed cap (10/10) was reached and S&P 500
  tier 1 is empty — expected under the 10-19 rules. (b) does
  `earnings-preview-2026-10-26` appear on `/insights` next Sunday
  (2026-10-25 16:00 UTC firing). If that rule is ignored again, the
  routine's stored prompt (not CLAUDE.md) is where it has to go — user's
  call, this environment has no RemoteTrigger access.
- **Nightly found and fixed a tier-0 blind spot (10-19 night, its own
  commit `5dc995e`):** SEC `company_tickers.json` has one row per security,
  so an issuer with preferred shares (SCHW-PJ, USB-PS…) overwrote its
  common ticker in the CIK map and its earnings 8-Ks never reached tier 0
  — for weeks. After the fix 22 candidates surfaced at once. Ops lesson:
  a night with "0 tier-0 candidates" in mid-earnings-season is itself a
  bug signal; `site-metrics` can't see it, so check the nightly log's
  tier-0 count against the week's known reporters (this week: TSLA 10-21,
  IBM/T/INTC 10-22). Also from that log: **DOMO's operating business was
  sold; the shell is now Huckleberry.ai (HUCK)** — `us-listed.json` swap
  is the nightly routine's, not ops'.
- **GSC sitemap re-downloaded 2026-10-18 22:52 and again 2026-10-21
  04:57 UTC** (2,832 submitted, 0 errors) — two fetches in three days
  after none between 10-16 and 10-18; not daily yet, but moving.
  `indexSample` on 10-20: `/learn` flipped from "Discovered – currently
  not indexed" to "URL is unknown to Google" (homepage still Duplicate on
  the 09-22 crawl; `/companies/aapl` still never crawled). Could be API
  noise; watch two more days before reading anything into it.
- **Plan reset 2026-10-25 (evening, with Hop — "do everything you
  can"; don't re-ask):** the 10-19 review's arithmetic still holds and
  the Crawl stats (17 URLs/day, all HTML, no `_rsc` waste left) moved the
  diagnosis from "technical" to "authority". Decided and written into
  CLAUDE.md the same day: checkpoints table under the ops goals (grade
  every run); tier 2 and us-listed **paused until the 11-20 night**;
  nightly writes **company what-to-watch notes** (PREVIEW articles,
  slug `what-to-watch-<ticker>-<period>-<year>`, shown on the company
  page by the new amber card in `CompanyView.tsx`, deployed 10-25); ops
  drafts outside posts **every day with a hot-list/S&P 500 result**, not
  only Mondays; ops turns `/scorecards/2026/q3` into the linkable asset
  and builds `ops/outreach.md` (15 newsletters/blogs with email drafts,
  Google Publisher Center submission text) — first pass on 10-26. Hop
  does by hand: posts the drafts, Request indexing 10/day, sends Bing
  Webmaster's indexed-page count, creates an X account for the social
  cron if willing (instructions given 10-25), submits Publisher Center.
  First things to verify 10-26: `earnings-preview-2026-10-26` exists;
  the nightly wrote watch notes for V/KO (10-27) and MSFT/GOOGL (10-28)
  and the cards show on `/companies/msft` etc.
- **Bing Webmaster, screenshot from Hop 2026-10-25 (Search
  Performance, 3 months):** 5 clicks, 346 impressions, CTR 1.45%.
  Impressions were ~5–10/day through mid-October and rose from 10-18 to
  ~45/day on 10-23 (the Q3 bank reports week); clicks on 4 days only.
  Top keyword "fis 2026 revenue guidance full year total billion" at
  position 3 (a real query answered by the FIS report). Bing's direct
  traffic is marginal; its value is as the index behind Copilot/ChatGPT
  search. Still to get from Hop: Site Explorer's indexed-page count and
  the "AI Performance (beta)" tab (citations in Copilot/chat) — ask once
  in the 10-26 report, then track both monthly, not weekly.
- **Identity reset shipped 2026-10-25 evening (Hop: "do both
  packages"):** site now positions as "what the earnings headlines hide".
  Shipped in code: finding-style H1 on every report (`reportHeadline()`;
  new reports write the finding as `title`), story-first report layout
  (figures/charts/peers moved below the body, TOC collapsed), homepage
  without the backlog-ordered "Latest reports", `metrics` gained
  `earningsQuality`/`earningsQualityNote`/`epsAdjusted`/`guidance` with a
  badge on report + company pages, a "Reported vs underlying" section on
  scorecards (renders once ≥5 labelled reports exist for the period —
  expect it on `/scorecards/2026/q3` by 10-28), a "promised vs delivered"
  table on company pages, an About "How each report is made" section
  linked from every byline, and (gated on `RESEND_API_KEY`) per-ticker
  email alerts. **Ops follow-ups:** (1) watch US engaged sessions and
  time on report pages for two weeks — the first measurable effect of the
  layout change; (2) once labelled reports exist, link the scorecard's
  `#quality` section from the homepage season block; (3) backfill
  `earningsQuality` on hot-list reports needs a metrics-only edit path in
  `scripts/admin-publish.ts` (`--metrics-only`?) — build it, then the
  nightly can label ~10 a night from each report's own quality section
  (no filing read); (4) **alerts are live since 2026-10-25 evening:**
  Hop created the Resend account, added the domain's DNS records
  (`resend._domainkey` TXT, `send.` MX/TXT resolve) and a send-only
  `RESEND_API_KEY` (production env, set with `vercel env add`); the form
  renders on company and report pages and `/api/alerts` answers. Not yet
  verified end to end (no real signup sent). Next: Hop signs up for one
  ticker with his own address and reports whether the confirmation
  arrives; if Resend returns 403 the domain is still "pending" in the
  Resend dashboard. Then watch the Resend dashboard for the daily count
  (free tier 100/day) and report confirmed subscribers weekly from the
  `Subscription` table (needs a small admin view or a `site-metrics`
  count — add one).
- **X account created 2026-10-25 (@FinReportInsigh — X cut the handle
  to 15 chars; name "Financial Report Insights"), developer app on the
  Free tier, OAuth 1.0a keys set in Vercel production (`X_API_KEY`,
  `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`), redeployed.**
  `GET /2/users/me` works (200) but `POST /2/tweets` returns **402
  "credits depleted"**: X's API now bills writes by credit and the Free
  tier has none, so the social cron will log a 402 for X every night
  until credits are bought. Buying credits costs money → the user's
  call; asked 10-25. Until then X is configured-but-dead; Bluesky keeps
  posting. If Hop declines, remove the four X env vars so the cron stops
  trying (one less failing call per run).
- **New sections shipped 2026-10-25 night (Hop's choice from the "what
  else to analyze" list):** `/red-flags` (EDGAR 8-K 4.02/4.01, NT
  10-K/10-Q, going-concern text; hourly, no usage; live and answering
  from Vercel — 73 filings on first render, covered names tagged) and
  `/buybacks` (from the new `shareRepurchases` / `dividendsPaid` /
  `dilutedSharesYoyPct` metrics; noindex until ≥5 reports of one period
  carry them — expect that by 10-29). Menu is now Reports · Earnings ·
  Scorecards · Red flags · Buybacks · Insights · Learn; `/economy`,
  `/rates`, `/world-risks` stay online, out of the menu. **Ops
  follow-ups:** (1) link `/red-flags` from the homepage (a small "Red
  flags this week: N filings" line under the season block, built from
  `fetchRedFlags()` — keep the homepage ISR; the data is cached hourly);
  (2) add `/buybacks` to `STATIC_PAGES` in `src/lib/sitemapEntries.ts`
  once it has data; (3) propose (don't build yet) nightly 2–3 sentence
  notes for red flags on hot-list/S&P 500 names; (4) Reddit/X drafts:
  the red-flags page is a natural weekly post ("N companies told the SEC
  not to rely on their past numbers this week") — use it on quiet days;
  (5) next on Hop's approved list: standing pair comparison pages
  (`/compare/<a>-vs-<b>`, code only), then IPO S-1 reads when a notable
  IPO files, then Form 4 insider transactions on company pages (code +
  cron, no usage), then `/guidance` once ~3 weeks of guidance data exist. The 10-19 one
  is in `ops/reports/2026-10-19.md` ("Đánh giá & hướng đi"); its ranked
  directions wait on the user's answers in that report.
- **Credential for ops publishing: in place since 2026-10-25.** Hop
  added `ADMIN_PASSWORD`, `SITE_URL` and
  `PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium` as environment
  variables of cloud environment `env_01BS8ej9WZxyj4AZyF5TrTyC` (shared
  with the nightly routine); a one-off check run that day confirmed all
  three are set, the password matches, the Chromium path resolves and
  `/admin/login` returns 200. Ops can now publish articles
  itself: `npm run admin-publish -- --article file.json` (and
  `--articles-dir content/guides` for guides). Check
  `[ -n "$ADMIN_PASSWORD" ]` without printing it. First use: the JPM vs
  BAC comparison below, if the nightly routine hasn't done it.

- **For the nightly routine (owner of `hotlist-rewrite.json`):** a
  read-only scan of all 90 `pending` items on 2026-10-17 found exactly one
  already in the current format — **MU 2026/ANNUAL** (has "At a glance"
  and the quality-check section) — so it can be set `superseded` instead
  of rewritten. **C** (Citigroup) has the quality-check section but no
  "At a glance"; rewrite stands. No other item meets the format; the queue
  is sound.
- **Watch Googlebot crawl recovery (weekly, from Hop's Crawl stats
  screenshot).** Before 2026-10-15: ~15 crawls/day since 10-01 (was
  1,000-3,800), 80% "Other file type" (RSC `?_rsc=` payloads), 94%
  Refresh. Fix deployed 2026-10-15 (`8ac8a8f`, see Done).
  **Screenshots from Hop, 2026-10-25 (data to 10-21):** total still flat,
  **17 crawl requests on 10-21** (90 days 18.4K, avg 160 ms, 100% 200s,
  www. 30). "Other file type" row: 14.7K, and its **newest example is
  10-01 20:52** (`/companies/trow/write?_rsc=…`, `/privacy?_rsc=…`) — the
  `_rsc` crawling already stopped on 10-01, when pages went ISR, two weeks
  before the robots.txt fix. HTML row: 2.43K, ~10-20/day since 10-01, avg
  296 ms; newest examples 10-22 08:18 = WFC, GS, BAC, C, SCHW, USB, MTB, MS
  Q3 reports (a week after publish) and `/companies/tsla` 05:56. Reading:
  the daily crawl is now ~all HTML and goes to fresh hot-list pages; the
  "80% Other file type" figure is a 90-day aggregate of the September
  spike and is no longer a useful target — stop tracking it. Three weeks
  at ~15/day with no waste left to remove means the cap is crawl demand
  (low site authority), not a technical defect: levers are outside links
  (Monday drafts), Request indexing on the best URLs, and not adding
  low-demand URLs. Next screenshot: just the top chart (requests/day).
- **Possible follow-up: `/companies/*/write` is force-dynamic.** Now
  disallowed and nofollowed, so crawler CPU is gone; real visitors still
  trigger one function run per view, which is fine at current traffic.
  No change needed unless function CPU climbs.

- **Comparison ready to publish: JPM vs BAC, Q2 2026.** Both are same
  industry (banks), both already have a Q2 2026 report with full metrics
  (`/companies/jpm/2026/q2`, `/companies/bac/2026/q2`), no JPM/BAC
  comparison exists yet (checked `/insights` 2026-10-13 — only
  GS/MS, HD/LOW, KO/PEP, MAR/HLT, TJX/ROST, V/MA so far). This ops
  session can't write/publish it itself (no `ADMIN_PASSWORD`/`SITE_URL`
  in this environment, same gap noted 2026-10-10) — for the nightly
  routine to pick up per its own Comparison rule (CLAUDE.md, "Growth
  work"), or a future ops session once it has the credential.
- **Check 10-26 (Mon JST) morning: did `earnings-preview-2026-10-26`
  appear on `/insights` after the Sunday 16:00 UTC firing?** The 10-25
  ops run (07:40 JST Sunday) was before that firing, so it could not be
  checked yet. If it exists, the homepage's "Reporting this week" header
  links it automatically ("This week's earnings preview →", while < 8
  days old, `currentPreview()` in `src/app/page.tsx`); confirm the link
  renders. If it is missing a third time, the routine's stored prompt is
  where the rule has to go (user's call).
- **Weekly earnings preview: missed twice (10-11, 10-18).** No
  `earnings-preview-*` slug on `/insights`, no "preview" in the nightly
  log either Sunday; the first firing went straight to hot-list rewrites
  and tier 1. CLAUDE.md now says it is the Sunday first firing's first
  job and counts as 2 report-periods (`59d4651`). Why it matters: for
  "Tesla Q3 2026 earnings preview" on 2026-10-18 the ranking pages were
  small sites (Hudson Labs, days.to, basenor, Barchart), i.e. the one
  earnings query type a new domain can realistically rank for. Next
  check: 2026-10-26.
- **Google indexing: sitemap-report "0 indexed" was misleading — corrected
  2026-10-12.** The sitemap report had shown 0/N indexed for weeks (0/2166
  as of 2026-10-11), read by every prior entry below as "nothing is
  indexed yet." Checked directly today with the URL Inspection API
  (`searchConsole.googleapis.com/v1/urlInspection/index:inspect`, same
  service-account auth as the rest of `site-metrics`) against a sample of
  real page types — result: `/industries/information-technology`,
  `/insights`, a specific company page (`/companies/mrsh`), a company/
  year/period page (`/companies/bny/2026/q2`) and a report page all come
  back `verdict: PASS, coverageState: "Submitted and indexed"`. So a real
  chunk of the site **is** indexed; the sitemap report's count is just
  stale/unreliable (a documented GSC quirk), not evidence of zero
  progress. The more useful and more concerning signal from the same
  check: **every one of those indexed pages was last crawled between
  2026-09-20 and 09-26** — nothing sampled has been recrawled in the ~2.5
  weeks since, including the homepage itself (last crawl 09-22, and its
  cached `googleCanonical` still points at `www.financialreportinsights.com`
  from before the www→bare 308 redirect/canonical-tag fix shipped — the
  live site is configured correctly, Google just hasn't revisited to see
  it). `/companies/aapl` (AAPL's own company page) and `/learn` (the guide
  hub, linked from the homepage nav, so not an orphan) have never been
  crawled at all. Read together: initial crawl happened in one burst the
  first week after launch, then crawl frequency collapsed — consistent
  with "low-authority new domain, budget now rationed hard," same theory
  as before, but with real evidence instead of an all-zeros number that
  looked like total failure. Nothing to fix in code (internal linking,
  robots.txt, canonical tags all confirmed correct again). **Added this
  check permanently to `npm run site-metrics`** (`indexSample` section,
  `scripts/ops/site-metrics.ts`) — 5 fixed representative URLs (home,
  one company, one industry, `/insights`, `/learn`) inspected every run,
  so a stall or a real regression (e.g. a crawled page suddenly losing
  its PASS verdict) shows up day over day instead of being re-discovered
  by hand. Typechecked clean, no site code touched, no deploy needed.
  **For the user, 2-minute check (not exposed via this API):** GSC's
  Manual Actions / Security Issues page — worth a quick look given crawl
  has stalled this hard, even though nothing else here points to a
  penalty. Not re-escalating the original 10-18 date otherwise; the
  picture is "slow," not "stuck at zero" as previously read.
- Once Search Console shows real (non-bot) query volume: rewrite
  titles/descriptions for position-5-to-20 opportunity queries. As of
  2026-10-06 every `opportunities`/`topQueries`/per-page query we checked
  (including the GICS industry pages, not just `/industries/uncategorized`)
  is automated-pattern noise with 0 clicks — templated "`<company>`
  bullish and bearish analyst opinions" phrasing, and literal Boolean
  search-operator strings like `intitle:(acquire or acquires or ...)
  -site:youtube.com ...` that only an SEO/M&A-monitoring bot would type.
  Not a rewrite target; re-assess once real queries show up.
- FTSE 100 / TSX / ASX expansion (`docs/GROWTH_PLAN.md` giai đoạn 5) is
  still a large, new-finance-area feature — propose to the user, don't
  just build it.

## Done

- **2026-10-25 — Homepage "Reporting this week" ranked by search demand
  and grouped by day; follow-up 10-Qs dropped from both calendars; GOOGL
  date** (`105f691`; prod `dpl_8MgWJ4zaCcPPTNYqizD2FfdJ24rT`). Going into
  Big Tech week the homepage listed the first twelve covered companies
  by date — COFS/BFST (weekend estimates), AZO, AMT, BKR, BRO, CDNS,
  CINF, PFG, BMRC, CBK, then V — and nothing else: MSFT, GOOGL, AMZN,
  KO, BA, MA, LLY were all outside the twelve. Now up to 18 names by hot
  list rank → S&P 500 → rest (announced date before estimate), one row
  per day, weekend estimates skipped, an "(est.)" note. Live after
  deploy: Tue V KO MU(est.) PYPL · Wed MSFT GOOGL NOW · Thu AMZN LLY MA
  MRK CAT COIN INTC · Fri XOM ABBV CVX VZ(est.). New
  `isFollowUpFiling()` in `src/lib/tracker.ts`: a tracker "next filing"
  that is the full 10-Q for the quarter already analyzed from the 8-K
  ("10-Q (Q3 2026)" with latestReport Q3 2026) is not a results day —
  BAC/WFC/GS/JPM/MS/UNH/AXP/PG/BLK/SCHW (51 of 980 entries in the
  4-week window) were shown as "reporting" on Oct 30 – Nov 5 on
  `/earnings` and would have been on the homepage too. Company pages
  are untouched (there "next filing" is still accurate). Also: GOOGL and
  GOOG in `earnings-dates.json` (Alphabet notice 10-06, call Wed 10-28);
  live titles now "Next Report Oct 28". Still ISR (`revalidate 3600`),
  no new DB reads (`publishedAt` added to an existing select). tsc 0
  errors (after `next typegen`), eslint clean (one `react-hooks/purity`
  hit on `Date.now()` in render, moved into a helper), health 8/8 and
  `figures` 7/7 after the deploy.

- **2026-10-24 — 13 more company-announced earnings dates** (`7f78629`,
  no deploy needed: `loadTracker()` reads the file from
  raw.githubusercontent with a 15-minute revalidate, bundled copy only
  as fallback). INTC/UPS/PYPL/RCL/ORLY/KLAC/CVX/CL/PFE/UBER/QCOM/TTWO/
  PSKY now show "Next Report <date>" in their company-page `<title>` and
  as Confirmed on `/earnings`. CLAUDE.md's Sunday-preview rule now says
  to start from this file before searching calendars. ~35 web searches,
  0 Opus.

- **2026-10-23 — company-announced earnings dates overlaid on the
  tracker** (`7018d18`; prod `dpl_F15cPitbryiK1BiaCBP1u3HZZJ98`). Every
  hot-list company page said "Estimated from past filing dates" going
  into Big Tech week, so no `<title>` carried the date (only confirmed
  dates go there), and NOW's estimate (10-22) had already passed so its
  page showed no next date at all. New ops-owned
  `scripts/data/earnings-dates.json` (31 hot-list names, each from the
  company's release/IR page, with `source` + `checked`);
  `loadTracker()` overlays them while the date is ahead, so company
  pages, report pages, `/earnings` and the homepage all see `confirmed`.
  Verified live: MSFT "Next Report Oct 28", V "Oct 27", AAPL "Nov 2",
  AMD "Nov 3", NOW "Oct 28"; `/earnings` shows 62 "Confirmed" rows (was
  ~28, mostly small companies). Health 9/9, `figures` 7/7 clean after
  the deploy. Pure-function merge tested with a tsx script; tsc errors
  unchanged (12 pre-existing `PageProps`).

- **2026-10-22 — claims between firings + waiting FPIs out of next-batch
  + homepage pool** (`6825a03`, `d01c3db`; prod
  `dpl_CcBjehtuMn1ii2MNWMifjaZXFNU5`). New `scripts/claims.ts` /
  `npm run claim -- A B C`: one `scripts/data/claims/<TICKER>.json` per
  ticker (no rebase conflicts between firings), committed and pushed
  before research subagents are dispatched; `scan-recent-filings` and
  `next-batch` leave claimed tickers out for 3 hours and print them;
  `--release`, `--list`, `--no-push`. Tested locally: claim → scan
  listed CSX/NFLX as "claimed by another firing", next-batch dropped
  them; test commits were discarded. `next-batch` now also skips
  `pending` entries whose `nextExpectedFiling.estimate` is in the future
  (BRAI…DSY, ten FPIs, were the first ten us-listed picks every night).
  `site-metrics` figures check adds the 3 newest reports from
  `/feed.xml` (`sample: "newest"`); META/LRCX/TSLA Q3 clean on the first
  run. Homepage `SEASON_POOL` 16 → 40: after the 43-report night the
  section showed KEY instead of NFLX/GE/GM; live after deploy: META,
  TSLA, NFLX, TMO, IBM, GE; health 9/9. CLAUDE.md: "Claim before you
  dispatch" paragraph under the per-firing cap.

- **2026-10-21 — tier 0 blind spot: same-day EDGAR filings** (`0104044`,
  script only, no deploy). `form.YYYYMMDD.idx` is built at ~02:01 UTC
  the next day (Last-Modified checked on 10-16 and 10-19's files), so the
  nightly window never saw the current day; the script even had a
  comment calling the 403 "today's index not published yet" and then
  did nothing about it. Now days newer than the newest daily index are
  read from EDGAR full-text search (`efts.sec.gov/LATEST/search-index`,
  no `q`, `forms=`, `dateRange=custom`, 100/page, `_source.items` has
  the 8-K items) plus the hot list's submissions JSON. Validation on
  10-20 22:45 UTC: efts listed 218 8-K + 2 8-K/A for the day, identical
  to the Latest Filings atom feed (which caps at ~600 entries, so it was
  not usable alone); the hot-list submissions pass added 0 beyond efts.
  Full 7-day scan now takes 30 s and printed 27 candidates for 10-20
  where the night had 0. CLAUDE.md tier 0 paragraph updated.

- **2026-10-20 — Homepage: "Earnings season: latest results" section**
  (`7567cdf`, `8f9f967`; prod `dpl_DCVJSzcjxWce7gWQAmetRU9PUcFq`). On the
  morning after 14 bank Q3 reports, the homepage's "Latest reports" showed
  DRH, DRS, DOMO, DORM, DOCU, DNLI (the backlog's last six) and none of
  BAC/WFC/GS/MS/C/SCHW. New section above it: the newest hot-list/S&P 500
  reports (pool of 16 newest, hot-list tickers ranked first), a link to
  that period's scorecard ("Q3 2026 scorecard (74 companies)") and the
  latest COMPARISON/PREVIEW articles; "Latest reports" skips what it shows.
  `/earnings` got an "Already reported: Q3 2026 scorecard" line via
  `seasonScorecard()` in `src/lib/scorecard.ts` (the first version linked
  "Full Year 2026": `availableScorecards()[0]` ranks ANNUAL above Q3).
  Still ISR; two extra `prismaCached` reads on the homepage, one on
  `/earnings`. Health 9/9 after both deploys.

- **2026-10-19 — "Updated <date>" in the report byline** (`59d4651`, prod
  `dpl_2JGtHdMiTU6C5hswJgHntmHPfHFv`). 48 hot-list reports have been
  rewritten since 10-14 but still read "Published Sep 21" (JSON-LD
  `dateModified` was right, the visible byline wasn't). `ReportView` now
  appends "· Updated Oct 18, 2026" when `updatedAt` is >24 h after
  `publishedAt`; only `src/app/admin/actions.ts` (the edit form) touches
  reports now that the social cron no longer bumps `updatedAt` (10-16), so
  the date means an editorial revision. Verified live on
  `/companies/sbux/2026/q3`; health 8/8, `figures` clean. Same commit, in
  CLAUDE.md for the nightly routine: per-firing cap of ~8 tier-1
  report-periods (3-4 hourly firings overlapped on 10-18 night; CYRX,
  CYTK, CZWI researched twice) and the Sunday earnings preview made the
  first firing's first job.

- **2026-10-18 — `/earnings` slimmed from 1.49 MB to 0.89 MB** (`79ae24a`,
  `784edbe`; prod `dpl_A2dxTg8A2w9QVWm7RKJohsFrs7ci`). In earnings season
  the calendar rendered ~950 companies as full cards (28-day window, 605 KB
  markup + 880 KB RSC payload), 96% with a cadence-estimated date. Now
  hot-list, S&P 500 and company-confirmed dates keep the card with last
  quarter's headline (446 today); the other ~520 share one compact line
  of ticker links per day (company name in `title`), so every company
  page stays linked. Still ISR (`revalidate = 3600`), no new reads.
  Verified live: 200, HIT, no "smaller company" wording (first version
  called ASML that — fixed in the second commit), health 8/8.
- **2026-10-18 — GA4 engaged sessions in `site-metrics`** (same commit):
  `engagedSessions` on daily / 28-day / channel / country rows and
  `averageSessionDuration` per country. First reading: see the Next
  item above — the week's "growth" to 46 users/day is a bot wave.


- **2026-10-17 — `site-metrics` now checks rendered figures** (`figures`
  section, `scripts/ops/site-metrics.ts`, no site code). Four fixed sample
  reports (CRWV Q2 loss-maker, PNC Q3 bank, PGR Q3 insurer, JBHT Q3
  general) are fetched; the visible HTML (scripts and `<!--$-->` Suspense
  comments stripped, then tags) is searched for `$-<digit>`, `NaN`,
  `undefined`, `%%`, `$$`, `--$`/`++`, and the figures strip must have ≥3
  non-empty items. Each entry lists the strip's values and an `issues`
  array; all four are clean after the fix below. Would have flagged the
  `$-1.14` bug on day one.

- **2026-10-17 — negative per-share figures rendered `$-1.14`** (`be0806f`,
  prod `dpl_CPHZmNDXfs5EhfkmgxwaUHscQvu4`). `formatPerShare` in
  `src/lib/metrics.ts` put the currency symbol before the sign, unlike
  `formatMoneyMillions` (`-$626M`), so every loss-making company's figures
  strip, company results table, industry peer table, scorecard and OG card
  showed `$-x.xx` (flagged by the nightly routine on CRWV Q2 2026). Sign
  now goes first; the weekly digest and `ReportCharts` had private copies
  of the formatter (digest wrong, charts right) and both now import the
  shared one. Verified live on `/companies/crwv/2026/q2` and
  `/companies/crwv` (`-$1.14`), OG image 200, health check 9/9 after the
  deploy. Also confirmed yesterday's sitemap fix held: live sitemap 2,609
  URLs, newest lastmod 17:04 UTC = last night's final publish; GSC
  `lastDownloaded` still 10-15 00:32 (Google skipped the 10-16 fetch or
  GSC lags) — watch.

- **2026-10-16 — sitemap: render per request behind a 10-minute CDN cache**
  (`a434830`, prod `dpl_CVJEH7ZKzYcWmczCYzzfXDDHZe5P`) **+ social cron no
  longer bumps `updatedAt`** (`ffe9d1e`, prod `dpl_9ChfwjuPFSvw1VRWpkMisD7ebvL9`).
  The "verify tomorrow" check from 10-15 failed in an instructive way: the
  route-handler sitemap did regenerate (`age` 32 s) but its content was
  the build-time copy from the 11:38 UTC deploy — none of the 40 reports
  published 16:19–16:52 UTC, while `/feed.xml` (same mechanism, same
  purge) had them. Cause: ISR stale-while-revalidate. The sitemap is only
  visited ~twice a day (Googlebot 00:32 UTC, the ops health check ~22:40),
  so the first visit after expiry/purge is served the previous copy while
  the new one generates in the background, and Google always got the copy
  from the visit before. Fix: `export const dynamic = "force-dynamic"` +
  `Cache-Control: s-maxage=600` (Vercel's CDN caches it, HIT on repeat;
  ≤ ~6 function runs/hour/region), entries read through plain `prisma`.
  Documented as a deliberate exception in CLAUDE.md "Stack notes".
  `site-metrics` now has an `xml` section (age, `x-sitemap-generated`,
  URL count, newest lastmod/pubDate for sitemap + feed). Also found that
  `/api/cron/social` set `socialPostedAt` through Prisma `@updatedAt`, so
  every announced report's `updatedAt` (→ `<lastmod>`, JSON-LD
  `dateModified`) moved to the cron time; it now keeps the old value.
  Verified on prod: sitemap 2,532 URLs (was 2,457), newest lastmod =
  last night's last publish 16:51 UTC, CPBI/BLK Q3 present, valid XML,
  no localhost; health check all 200 after both deploys. The 63 entries
  sharing lastmod 06:15 UTC are the `/rates/*` pages (macro cron at 06:15)
  — expected.

- **2026-10-15 — robots.txt: stop crawl waste on `?_rsc=` and `/write`**
  (`8ac8a8f`, prod `dpl_2X7bVkWJsVXULw7nwNyxAUNj2JKG`). Hop's Search
  Console Crawl stats (not in the API): ~15 crawls/day since 10-01, 80%
  "Other file type" = RSC payload URLs Googlebot learned while `<Link>`
  still prefetched (before 10-03) and now only refreshes. Added
  `Disallow: /*?_rsc=`, `/*&_rsc=`, `/companies/*/write`. `/write` is the
  public community-submission form (not admin; already `noindex`, not in
  the sitemap); kept open for visitors, its two buttons now
  `rel="nofollow"`. Prefetch needs no change: `@/components/Link` already
  defaults to `prefetch={false}` (no viewport or hover prefetch in Next
  16) and nothing imports `next/link` directly. Audit of other internal
  routes: `/admin/*` 307 to login and every page/action checks the
  signed cookie; `/api/cron/*` 401 without the secret; PENDING
  `/reports/<id>` admin-only. Verified on prod: robots has the new lines
  + Sitemap; sitemap 200, 2,457 URLs, no `/write`, no localhost;
  site-metrics all 200.

- 2026-10-14 ops run (`e49183b`, deployed `dpl_CRYwjQKYb9Bb8ygujtiKDvfS4hP1`,
  READY): **found and fixed a real SEO bug — the production sitemap was
  stale by 4 days.** `site-metrics` flagged `/sitemap.xml` as status 0
  ("fetch failed"); a direct curl showed it was up (200, 390KB), but the
  response headers gave it away: `x-vercel-cache: HIT` with `age: 344652`
  (4 days) and `Last-Modified` equal to the 10-10 deploy time, so its
  `export const revalidate = 3600` was never honoured — the
  `app/sitemap.ts` metadata-file route was baked into the build as a
  fully static file (same age as `robots.txt`), while `/feed.xml` (a
  plain route handler with the identical export) revalidated normally
  (`STALE` after ~1h). Consequence: every report published after a deploy
  was missing from the sitemap Google downloads daily (it did download it
  2026-10-14 12:53) until the next deploy — 290 URLs missing as of today
  (2,166 vs 2,456 after the fix), including JPM/JNJ/UNH Q3 and all of
  the last 4 nights' us-listed reports — and every `<lastmod>` was frozen
  at the last deploy, undermining the freshness signal added 10-04.
  Fix: moved the entry builder to `src/lib/sitemapEntries.ts` and serve
  it from `src/app/sitemap.xml/route.ts` as a plain route handler (same
  mechanism as `/feed.xml`); `invalidateDbCache()` now also calls
  `revalidatePath` on `/sitemap.xml` and `/feed.xml` (route handlers are
  not covered by the root-layout purge, so until now a publish only
  reached the feeds when the hourly timer elapsed). Verified on a preview
  first (bypass header — `vercel curl` can't be used with this team token,
  "User not found"; **don't `vercel promote` a preview: previews have no
  `SITE_URL` and emit `http://localhost:3000` URLs**), then a fresh
  `--prod` deploy: live sitemap 200, valid XML, 2,456 URLs, newest
  lastmod = tonight's last publish, JPM Q3/JNJ Q3/CMPR/CLSK present, no
  localhost. Health check all green after. Also: `site-metrics` health
  check now retries a fetch once on a network error (the status-0 that
  started this was a one-off proxy drop, not an outage).
- 2026-10-13 ops run: health check all green, latest production deployment
  (`de8478c`/`dpl_C63yNaYPzW4Ue7EhATxsLKgFNCea`) confirmed READY and a
  real ancestor of current `master` (local clone was shallow again;
  `git fetch --unshallow` before trusting `merge-base`). `npx tsc --noEmit`
  clean after `next typegen` (same one-time route-types gap as every
  prior run). Re-verified the `indexSample` "Duplicate without
  user-selected canonical" reading on the homepage isn't a new
  regression: inspected both the bare and trailing-slash homepage URL
  directly — both still show `googleCanonical:
  "https://www.financialreportinsights.com/"`, same stale 2026-09-22
  crawl as the 2026-10-12 entry below found, just a different `verdict`
  label surfacing from the same unrefreshed data. Spot-checked 3 of last
  night's freshly-published company pages (CHRS, CLSK, CMTL) — all 200,
  not broken. No code change shipped this cycle (nothing unsafe found,
  nothing new to fix); found two concrete items for the backlog above
  (JPM/BAC comparison ready to publish; weekly earnings-preview rule
  never fired) instead.



- 2026-10-12: confirmed both bank/insurer `/learn` guides are now live
  (`/learn/what-is-net-interest-margin` and `/learn/what-is-combined-ratio`
  both return 200 with real rendered content, not a stub) — the nightly
  routine ran the `--articles-dir content/guides` publish per the
  self-deleting CLAUDE.md bullet, but left the bullet in place. Removed it
  from CLAUDE.md's "Growth work" section as its own instructions said to.
  Closes out the item that had been open since 2026-10-10.
- 2026-10-10 (`e56154d`, `64d1003`, `de8478c`): wrote the 2 bank/insurer
  `/learn` guides from the top of the list above
  (`what-is-net-interest-margin.md`, `what-is-combined-ratio.md`) and
  added a `metricsProfile(m)` branch to `relatedGuides()`
  (`src/lib/metrics.ts:304`) so bank/insurer reports link them instead of
  falling back to `gaap-vs-adjusted-eps`. Verified live on BPOP's company
  page. **The articles themselves still need publishing** — this ops
  environment has no `ADMIN_PASSWORD`/`SITE_URL`, so it can't run
  `npm run admin-publish -- --articles-dir content/guides`; flagging for
  whichever session runs the nightly report routine next (it has the
  credential) to run that command once (safe to re-run, upserts by slug).
  While verifying those links, found and fixed a real bug: six dynamic
  routes were soft-404ing (HTTP 200 instead of a real 404) for content
  that doesn't exist — `/companies/[slug]`, `/companies/[slug]/[year]/
  [period]` (and `/write`, which shares the boundary), `/industries/
  [slug]`, `/insights/[slug]`, `/learn/[slug]`, `/scorecards/[year]/
  [period]`. Confirmed with fresh random slugs against production
  (cache-MISS, so not a caching artifact) before and after. Every one of
  these pages does call `notFound()` correctly — the actual cause was a
  `loading.tsx` (skeleton) on the route itself *or* on a listing-level
  ancestor (`insights/`, `learn/`, `scorecards/` each had one), which
  turns the route into a streamed Suspense boundary: Next sends a 200
  shell before the suspended page resolves to `notFound()`, so the status
  can't change afterward. CLAUDE.md's "Stack notes" already called out
  this exact trade-off for `/rates/` and `/app/reports/` ("No loading.tsx
  under src/app/rates/: streaming would turn those 308s/404s into 200s")
  — it just hadn't been checked for the rest. Fix: deleted the 9 offending
  `loading.tsx` files (6 at the dynamic-segment level, plus 3 ancestor
  ones at `insights/`, `learn/`, `scorecards/` root that still wrapped
  their children even after the first round). Left every other
  `loading.tsx` alone (`search/`, `earnings/`, the company-level ones that
  have no ancestor boundary problem, etc.); `PageSkeleton` is still used
  elsewhere, confirmed not dead code. Doesn't touch `revalidate` or make
  anything dynamic, so the $1 spend-cap risk doesn't apply. Typechecked
  clean both rounds, two preview-then-promote deploys
  (`dpl_FvG6zbJcAus4QkDRd4WoZiWocVs8` then `dpl_C63yNaYPzW4Ue7EhATxsLKgFNCea`,
  both READY), re-verified with fresh random slugs after each: all 6
  routes now return real 404s, all spot-checked valid pages (including the
  `/insights`, `/learn`, `/scorecards` listings themselves) still render
  normally. Full health check clean after. Worth watching Search Console
  over the next couple of weeks for whether this helps the indexing stall
  below — soft 404s are one of Google's own named reasons for pages
  staying stuck at "Discovered/Crawled – not indexed."
- 2026-10-09: no new safe code change found worth making this cycle —
  broader audit than usual since the top 3 backlog items are all gated
  (indexing re-check not due until 10-11, opportunity queries still bot
  noise, FTSE/TSX/ASX is propose-only). Verified: health check all green
  (`/ads.txt` 404 expected), latest production deployment (`dd1f194`)
  READY and confirmed an ancestor of current `master`; `npx tsc --noEmit`
  clean (after `next typegen`, same one-time route-types gap as always);
  no new `contains:` Prisma filter missing `mode: "insensitive"`; fonts
  still self-hosted via `next/font`; `/industries/uncategorized` still
  correctly `noindex, follow`. Spot-checked a freshly-published bank report
  (BPOP) live — "At a glance", Takeaway, and "What the headline numbers
  hide" all present, not truncated (no "did last time's read hold up?"
  section, correctly, since it's BPOP's first report). GSC last 7d
  (9-30→10-6) impressions collapsed to 1,981 from 22,727 the week before —
  not a regression, this is the predicted continuation of the
  `/industries/uncategorized` noindex (9-24) finally dropping the bot-noise
  queries out of the index; clicks still ~0, consistent with the 0-indexed
  sitemap. GA4 28-day: 42 users/48 sessions/54 pageviews, up from 34/40/46
  yesterday — still single digits/day, nothing to react to yet. Sitemap:
  0/2,028 indexed (still short of the 10-11 re-check date set 10-06). No
  deploy this cycle (nothing changed).
- Considered writing 1-2 new `/learn` guides to cover bank/insurer-specific
  terms (net interest margin, combined ratio) — `relatedGuides()`
  (`src/lib/metrics.ts:304`) currently falls back to `gaap-vs-adjusted-eps`
  for any report without `operatingMarginPct` (i.e. every bank and
  insurer), which is a real internal-linking gap given how many bank
  reports are in the backlog. Didn't execute: this routine's environment
  has no `ADMIN_PASSWORD`/`SITE_URL`, so it can't run `admin-publish
  --articles-dir` to actually publish new articles — that needs the
  nightly routine's credential. Left as a concrete next step (see below)
  rather than half-finishing it (writing the guide content + code without
  a way to publish it).
- 2026-10-08 (`dd1f194`): extended the `/learn` guide-link block (see
  2026-10-07 below) to the company page's results-by-period table and the
  industry peer tables, reusing the same `relatedGuides()` helper — same
  jargon (operating margin, YoY) shows up there too. Typecheck + lint
  clean, verified with a preview build before promoting. Deployed
  (`dpl_7gNRiRGXADH6SktdNduWisUqfmQG`, READY); verified live on AAPL's
  company page and the Information Technology industry page — links
  render with working `/learn/...` hrefs. Health check all green after
  (same expected `/ads.txt` 404). Also: sitemap still 0/1960 indexed as
  of today — within the 2026-10-11–10-18 re-check window set on 10-06, no
  action yet.
- 2026-10-07 (`4516e68`): found that no report, company, or industry page
  linked to any of the 9 published `/learn` glossary guides anywhere
  outside `/learn` itself — a real internal-linking gap (helps both crawl
  budget into that content and lay readers who hit a term like "operating
  margin"). Added `relatedGuides()` (`src/lib/metrics.ts`) and a "New to
  these terms?" block on every report page, picking 2-3 guides from that
  report's own metrics/period. Verified live on a freshly-rendered page
  (BGC Q2 2026) post-deploy — links render correctly. Deployed
  (`dpl_6WzJk3ewtYoNw6oRbaLXd9mtYsvR`, READY); health check all green
  after. Also re-verified (independently, not just trusting the prior
  day's note): latest production deployment before this one (`78aaba2`)
  really is an ancestor of `origin/master` (local clone was shallow;
  `git fetch --unshallow` + `merge-base --is-ancestor` confirmed it) and
  sitemap/robots/JSON-LD/guide-sitemap-inclusion all still fine.
- 2026-10-06: ops run found no new safe code change worth making this
  cycle. Verified (not just assumed) that recent audits still hold:
  robots.txt/meta-robots/RSS autodiscovery all correct, `?utm_*`-style
  query strings on public pages still hit the ISR cache (`x-vercel-cache:
  HIT`) rather than forcing per-request rendering, latest production
  deployment (`78aaba2`) matches a commit in `git log` and is READY,
  health check all green except the expected `/ads.txt` 404
  (`ADSENSE_CLIENT` unset). No deploy needed — nothing changed.
- 2026-10-05: full page-by-page thin-content sweep done (was the last open
  item in the AdSense readiness audit) — spot-checked industry pages (11
  GICS sectors, each 19-79 reports / 120KB-357KB rendered), `/learn` guide
  pages (~1200 rendered words incl. chrome), `/insights` articles (market
  brief ~2800 words, comparison ~3500, weekly digest ~4200), and a
  single-report company page (AUR, 942 words, not noindex'd). No thin pages
  found; nothing to fix. AdSense readiness audit is now complete — only
  thing left is the user actually submitting AdSense (Never list).
- 2026-10-05 (`78aaba2`): added `sameAs` (Bluesky profile) to every
  Organization JSON-LD block (`src/lib/site.ts` → `SITE_SAME_AS`, wired
  into homepage WebSite, economy/rates/world-risks, ArticleView,
  ReportView) — small E-E-A-T signal for AdSense/SEO. Deployed
  (`dpl_GQQzrZsaDqkAA5hQwbtMTQhKLv3h`, READY); re-checked health after,
  all clean.
- Confirmed 2026-10-04: company/report pages are genuinely stuck at
  "Discovered - currently not indexed" in Search Console (checked AAPL's
  company page and its 2026 Q3 report directly via the URL Inspection API,
  not just the sitemap report's indexed count, which is known to lag).
  Homepage is indexed; ~1559 company pages mostly are not yet. This is
  consistent with a 2-week-old low-authority domain rationing crawl budget,
  not an obvious bug — added `lastModified` to sitemap entries that lacked
  it (company/industry/year pages, homepage, listings) as a cheap freshness
  signal, but expect this needs weeks of patience + continued link/content
  signals more than another code fix.
- 2026-10-05: GA4 confirmed receiving hits (`analytics` section of `npm run site-metrics` now returns real rows for 10-03 and 10-04 — 4-6 users/day, 9-19 over the trailing 28 days). Volume is still tiny; that's the 10k-visits/month goal to work on, not a tracking bug.
- AdSense readiness audit (full): About/Contact/Privacy/Corrections/Terms all
  substantial and current, GA4 disclosed in Privacy, `/terms` added and
  linked from the footer, header nav (`SiteNav.tsx`) covers every content
  section, full thin-content sweep done 2026-10-05. Complete — only thing
  left is the user submitting AdSense itself (Never list).
- Check Search Console coverage: how many report pages are indexed vs submitted in the sitemap; investigate "Discovered – currently not indexed" — confirmed via URL Inspection API (AAPL's own pages aren't indexed yet either), not just the sitemap report's 0.
- 2026-10-04: the "token can't deploy" blocker was a missing project link,
  not a bad token — deploy with `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` set (see
  CLAUDE.md step 4). `4ced282` deployed that way from a fresh clone
  (dpl_7TsFDBUyGcd7Hi3ic89gQkZYRtFD, READY).
- 2026-10-04 (`4ced282`): disclosed GA4 in the privacy policy; added `lastModified`
  to sitemap entries that lacked it; fixed `site-metrics`' health check
  reporting every public page as down (403) — Node's native `fetch` ignores
  `HTTPS_PROXY` in this sandbox by default, so the unproxied request hit
  the site's own Vercel Firewall from the sandbox's raw IP and got a false
  403; `npm run site-metrics` now sets `NODE_USE_ENV_PROXY=1`.
