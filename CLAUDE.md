@AGENTS.md

# Financial Report Insights

A site that publishes financial-report analysis for publicly listed companies,
organized by industry -> company -> year -> report. Public pages are
read-only; all authoring happens under `/admin` (password-protected) or via
the local scripts below.

## Publishing a report analysis (the main recurring task)

When asked to research and publish a financial report for a company, follow
this pipeline end to end in one session — no need to touch the browser:

1. **Find the company's slug.** Run `npm run list-companies` to see every
   existing slug, ticker, and its industries. If the company doesn't exist
   yet, it must be added first via `/admin/companies` (there is no CLI for
   creating companies, only reports).
2. **Get the source filing.** For US companies, fetch the 10-Q/10-K or
   earnings release from SEC EDGAR (https://www.sec.gov/cgi-bin/browse-edgar)
   or the company's investor relations page. For non-US companies, ask the
   user for a PDF/link if it isn't reachable by URL.
3. **Analyze comprehensively and write Markdown content** matching this exact
   structure (this is what renders on the public report page via
   `src/components/ReportContent.tsx`, which supports GFM tables, blockquote
   callouts, and inline images):

   ```
   ## Overview
   2-3 sentences on the headline result and what drove it.

   ## Key Financial Metrics
   A GFM table: Metric | This period | Same period last year | YoY Change
   Include revenue, margin, net income/profit, EPS (or equivalent), plus
   1-2 metrics specific to the industry (e.g. NIM+NPL for banks, same-store
   sales for retail, ARPU for telecom).

   > **Takeaway:** one sentence — the single most important insight.

   ## Segment Performance
   Break down by business line or geography, whichever the filing
   emphasizes. Note what grew, what didn't, and why.

   ## Outlook
   Management guidance if given, plus your own read on trajectory.
   ```

   Where a chart would clarify a trend, insert `![descriptive alt
   text](https://placehold.co/900x420/1d4ed8/ffffff?text=...)` as a
   placeholder — the alt text becomes the visible caption. Swap in a real
   chart URL later if one becomes available; a placeholder is fine to ship.

4. **Publish it** by writing a JSON file (anywhere, e.g. in the OS temp dir
   or the scratchpad — never commit it) shaped like:

   ```json
   {
     "companySlug": "aapl",
     "year": 2026,
     "period": "Q3",
     "title": "AAPL — Q3 2026 Financial Report Analysis",
     "summary": "One sentence shown in report lists and search.",
     "contentMd": "## Overview\n...",
     "coverImageUrl": "https://placehold.co/1200x630/111827/ffffff?text=..."
   }
   ```

   `period` must be one of `Q1 Q2 Q3 Q4 H1 ANNUAL` (`H1` = interim/half-year,
   `ANNUAL` = full year). Then run:

   ```
   npm run publish-report -- path/to/report.json
   ```

   This writes straight to the database via Prisma (see
   `scripts/publish-report.ts`) — no browser, no admin login needed. Running
   it again for the same company/year/period **updates** that report instead
   of erroring, so it's safe to re-run after fixing something.
5. Report the resulting `/reports/<id>` URL back to the user.

`scripts/publish-report.ts` and `scripts/list-companies.ts` are local-only
tools with no auth — they exist because whoever can run them already has
full access to this machine. Never expose either as a network endpoint.

## Stack notes

- Next.js 16 (App Router, Turbopack) + Prisma 6 + SQLite (dev). See
  `AGENTS.md` for framework-version caveats — this version has real
  differences from older Next.js docs/training data (Cache Components,
  `proxy.ts` instead of `middleware.ts`, `params`/`searchParams` as
  Promises). Read `node_modules/next/dist/docs/` before assuming an older
  API surface.
- Cache Components is **not** enabled; all data-reading pages use
  `export const dynamic = "force-dynamic"` and query Prisma directly per
  request. Keep new data pages consistent with that pattern.
- `DATABASE_URL` in `.env` must be an absolute path on Windows (a relative
  `file:./...` path resolves differently between the Prisma CLI and the
  Next.js runtime and fails with "unable to open the database file").
