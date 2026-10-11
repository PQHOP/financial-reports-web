# Site operations backlog

Owned by the "Site Operations - Daily" routine (see CLAUDE.md, "Daily
operations routine"). Top = next. Move finished items to the bottom with the
date and commit.

## Next

- **Publish the 2 new bank/insurer `/learn` guides (code is deployed,
  articles are not).** Done 2026-10-10: wrote
  `content/guides/what-is-net-interest-margin.md` and
  `content/guides/what-is-combined-ratio.md`, added a `metricsProfile(m)`
  branch to `relatedGuides()` (`src/lib/metrics.ts:304`) so bank/insurer
  reports link them instead of the `gaap-vs-adjusted-eps` fallback.
  Typechecked, committed (`e56154d`), deployed
  (`dpl_6DYtitrct6zuRFXFcR5XSkU3VPAL`, READY), verified live on BPOP's
  company page (`/learn/what-is-net-interest-margin` link now renders).
  **Still needed: the actual publish.** This ops environment has no
  `ADMIN_PASSWORD`/`SITE_URL`, so it cannot run
  `npm run admin-publish -- --articles-dir content/guides`.
  **2026-10-11: confirmed still 404 live (both guides), and found why it
  never happened** — the backlog note above only existed here, which the
  nightly report routine never reads; the one-time task that got the
  original 9 guides published on 2026-09-20 worked because it was a
  bullet in CLAUDE.md itself, in the section the nightly routine's prompt
  points at. Added that same kind of bullet to CLAUDE.md's "Growth work"
  section (self-deleting instruction, do-once) so tonight's nightly
  firing runs `npm run admin-publish -- --articles-dir content/guides`
  before its report batch. Did not touch `report-tracker.json`. No
  redeploy needed (CLAUDE.md isn't code). Re-check tomorrow that both
  guides are live and the CLAUDE.md bullet was removed as instructed; if
  not, the nightly routine skipped it and this needs a more forceful nudge.
- **Re-check Google indexing around 2026-10-11 through 10-18.** Sitemap
  still 0/1818 indexed as of 2026-10-06 (re-checked 2026-10-08: still
  0, now 0/1960 as submitted count grew); still consistent with "new
  low-authority domain rationing crawl budget," not a bug — 2026-10-06
  re-checked the obvious suspects (robots.txt clean/unchanged, no stray
  noindex on real content pages, RSS autodiscovery present via
  `metadata.alternates`, query-string URLs on public pages don't bypass
  the ISR cache or force dynamic rendering) and found nothing. If still
  0 indexed by ~10-18, that's worth escalating past "just wait" — e.g.
  checking Manual Actions/Security Issues in the GSC UI directly (not
  exposed via the API this routine uses).
  **2026-10-11 (window start): still 0/2166 indexed.** Not yet the
  10-18 trigger date — no action taken, just the data point. GSC 7-day
  impressions this window: 1,446 (down hard from 14,298 the week
  before) — consistent with the predicted continued drop-off of
  `/industries/uncategorized` bot-noise queries leaving the index (same
  trend noted 2026-10-09), not a new problem. Clicks still 0 for the
  week, 7 over 28 days.
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
