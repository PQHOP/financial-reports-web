# Site operations backlog

Owned by the "Site Operations - Daily" routine (see CLAUDE.md, "Daily
operations routine"). Top = next. Move finished items to the bottom with the
date and commit.

## Next

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
  signals more than another code fix. Re-check indexed count in a week.
- 2026-10-05: GA4 confirmed receiving hits (`analytics` section of `npm run site-metrics` now returns real rows for 10-03 and 10-04 — 4-6 users/day, 9-19 over the trailing 28 days). Volume is still tiny; that's the 10k-visits/month goal to work on, not a tracking bug.
- Once Search Console data is available: rewrite titles/descriptions for the position-5-to-20 opportunity queries. Note: most current `opportunities`/`topQueries` rows are odd templated phrases ("X bullish and bearish analyst opinions", "X forecast and analysis") against obscure/SPAC tickers with 0 clicks — looks like bot/scraper probing rather than real demand (same pattern as the 09-20 "breach/ransomware" probing of Uncategorized), not a rewrite target.
- AdSense readiness audit: list which pages a reviewer would see as thin or templated (company pages without reports are already noindex), check About/Contact/Privacy/Terms are complete, navigation reaches every content section, and propose what's missing. Applying for AdSense itself is the user's action (Never list). Partial pass done 2026-10-04: About/Contact/Privacy/Corrections are all substantial (10k+ chars) and current; found and fixed one real gap — Privacy didn't disclose GA4 (added earlier today, undisclosed) alongside Vercel Web Analytics. 2026-10-05: found and fixed a second real gap — `/terms` 404'd, no Terms of use page existed and nothing linked to it. Added one (same style/voice as About/Privacy/Corrections: not-investment-advice, content reuse, community-report submission terms, third-party links/ads, no-warranty), linked from the footer, listed in the sitemap. Also checked header nav (`SiteNav.tsx`) against every content section (reports/earnings/scorecards/economy/rates/world-risks/insights/learn) — complete, no gap. Still need: a fuller page-by-page thin-content sweep of the dynamic page types (industry pages, individual guide/insight articles) rather than just the static legal pages.
- Check Search Console coverage: how many report pages are indexed vs submitted in the sitemap; investigate "Discovered – currently not indexed". See the indexing note above — now have a concrete, API-confirmed answer (AAPL's own pages aren't indexed yet either), not just the sitemap report's 0.

## Done

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
