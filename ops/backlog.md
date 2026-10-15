# Site operations backlog

Owned by the "Site Operations - Daily" routine (see CLAUDE.md, "Daily
operations routine"). Top = next. Move finished items to the bottom with the
date and commit.

## Next

- **Watch Googlebot crawl recovery (weekly, from Hop's Crawl stats
  screenshot).** Before 2026-10-15: ~15 crawls/day since 10-01 (was
  1,000-3,800), 80% "Other file type" (RSC `?_rsc=` payloads), 94%
  Refresh. Fix deployed 2026-10-15 (`8ac8a8f`, see Done). Expect the
  `_rsc` share to fall below 20% and HTML/Discovery to rise over 1-3
  weeks as Google re-reads robots.txt. If total crawls/day stay ~15 after
  2-3 weeks, the drop has another cause (sitemap staleness until
  `e49183b`, low site authority) and needs a separate look.
- **Possible follow-up: `/companies/*/write` is force-dynamic.** Now
  disallowed and nofollowed, so crawler CPU is gone; real visitors still
  trigger one function run per view, which is fine at current traffic.
  No change needed unless function CPU climbs.

- **Verify tomorrow: `/sitemap.xml` actually revalidates now.** Fixed
  2026-10-14 (`e49183b`, see Done): the sitemap was a fully static build
  artifact (ignored `revalidate`), 4 days stale. After the fix the live
  sitemap regenerates hourly and is purged on every publish. Check on the
  next run: `curl -sI https://financialreportinsights.com/sitemap.xml`
  should show `age` well under 3600 and the newest `<lastmod>` should
  match last night's latest publish, and reports published that night
  should be in it (`grep companies/<ticker>`). If it is stale again, the
  cause is something else (e.g. generation erroring in the background and
  the CDN serving the last good copy) and needs Vercel runtime logs.
- **Comparison ready to publish: JPM vs BAC, Q2 2026.** Both are same
  industry (banks), both already have a Q2 2026 report with full metrics
  (`/companies/jpm/2026/q2`, `/companies/bac/2026/q2`), no JPM/BAC
  comparison exists yet (checked `/insights` 2026-10-13 — only
  GS/MS, HD/LOW, KO/PEP, MAR/HLT, TJX/ROST, V/MA so far). This ops
  session can't write/publish it itself (no `ADMIN_PASSWORD`/`SITE_URL`
  in this environment, same gap noted 2026-10-10) — for the nightly
  routine to pick up per its own Comparison rule (CLAUDE.md, "Growth
  work"), or a future ops session once it has the credential.
- **Weekly earnings preview never fired.** CLAUDE.md says the nightly
  routine should publish one `PREVIEW` article on the first Sunday firing
  of each week from 2026-10-11 through earnings season — checked
  `scripts/data/nightly-log.md` (no mention of "preview", ever) and
  `/insights` (no `earnings-preview-*` slug exists). Likely cause: the
  nightly routine has hit its 35/night report cap every single night
  recently (see nightly-log), so editorial content never gets a turn.
  This week's window (Oct 12–16) is now moot — JPM/WFC/C/BAC/GS/JNJ/UNH
  already reported before this was checked (2026-10-13), and MS/BLK were
  due the next day — so publishing a preview for this week now would be
  stale. Flagging so the next Sunday (2026-10-18) isn't missed too; if it
  keeps getting skipped, the cap-vs-editorial tradeoff needs a decision
  (raise the cap, or carve out a fixed reserve for editorial before the
  report batch starts, as CLAUDE.md already says to do "before" the
  report batch — the rule exists, it's just not winning the time/cap
  race in practice).
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
