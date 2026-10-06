# Site operations backlog

Owned by the "Site Operations - Daily" routine (see CLAUDE.md, "Daily
operations routine"). Top = next. Move finished items to the bottom with the
date and commit.

## Next

- **Re-check Google indexing around 2026-10-11 through 10-18.** Sitemap
  still 0/1818 indexed as of 2026-10-06; still consistent with "new
  low-authority domain rationing crawl budget," not a bug — 2026-10-06
  re-checked the obvious suspects (robots.txt clean/unchanged, no stray
  noindex on real content pages, RSS autodiscovery present via
  `metadata.alternates`, query-string URLs on public pages don't bypass
  the ISR cache or force dynamic rendering) and found nothing. If still
  0 indexed by ~10-18, that's worth escalating past "just wait" — e.g.
  checking Manual Actions/Security Issues in the GSC UI directly (not
  exposed via the API this routine uses).
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
