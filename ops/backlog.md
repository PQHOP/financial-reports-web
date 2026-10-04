# Site operations backlog

Owned by the "Site Operations - Daily" routine (see CLAUDE.md, "Daily
operations routine"). Top = next. Move finished items to the bottom with the
date and commit.

## Next

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
- Verify GA4 is receiving hits after the 2026-10-04 deploy (`analytics` section of `npm run site-metrics`) — can't confirm yet: GA4 only went live with `f540c32` today and the GA4 Data API returned all-empty rows, which is expected this soon (data processing lag), not necessarily broken.
- Once Search Console data is available: rewrite titles/descriptions for the position-5-to-20 opportunity queries. Note: most current `opportunities`/`topQueries` rows are odd templated phrases ("X bullish and bearish analyst opinions", "X forecast and analysis") against obscure/SPAC tickers with 0 clicks — looks like bot/scraper probing rather than real demand (same pattern as the 09-20 "breach/ransomware" probing of Uncategorized), not a rewrite target.
- AdSense readiness audit: list which pages a reviewer would see as thin or templated (company pages without reports are already noindex), check About/Contact/Privacy/Terms are complete, navigation reaches every content section, and propose what's missing. Applying for AdSense itself is the user's action (Never list). Partial pass done 2026-10-04: About/Contact/Privacy/Corrections are all substantial (10k+ chars) and current; found and fixed one real gap — Privacy didn't disclose GA4 (added earlier today, undisclosed) alongside Vercel Web Analytics. Still need: a fuller page-by-page thin-content sweep.
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
