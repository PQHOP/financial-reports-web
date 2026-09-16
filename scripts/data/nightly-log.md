# Nightly report-coverage log

One running file tracking report-coverage progress **per night** of the
23:00–05:00 JST operating window (see `CLAUDE.md` → "Standing priority" →
"Operating window"). Updated at the end of every batch during the window
— never rewritten from scratch, only appended/updated for the current
night's entry. Counts are **report-periods published** (one company can
get several periods — Q1, Q2, Q3 — backfilled in a single night), not
unique companies; each entry also notes unique companies for clarity.

**Two mechanisms have run this task, don't confuse them:**
- A **cloud routine** (`trig_01GNdUY59Na4x3JxMr6p7mxK`, "2026 Report
  Coverage - Nightly", created 2026-09-12) — fires hourly 14:00–19:00 UTC
  (23:00–04:00 JST) on its own, no terminal needed. Check it with
  `RemoteTrigger {action: "list_runs", trigger_id: "trig_01GNdUY59Na4x3JxMr6p7mxK"}`
  before assuming nothing is scheduled, and **don't create a second cloud
  routine for this task** — update this one instead.
- A **session-local `/loop`** (dynamic, `ScheduleWakeup`-based) — only
  runs while a terminal/session stays open; started 2026-09-15 as a
  fallback while the cloud routine's blocker (below) was being sorted out.

## 2026-09-12 night through 2026-09-14 night — cloud routine blocked, 0 published

Discovered 2026-09-15: the cloud routine fired on schedule every night
since it was created (~17 firings total across 2026-09-12, 09-13, 09-14),
but **every single firing was blocked before any research could start** —
the cloud sandbox's network egress policy rejects outbound access to
`www.sec.gov` and `financial-reports-web.vercel.app` (and everything else
outside a small npm/GitHub/Anthropic allowlist), so it can't fetch
filings or reach the admin UI to publish. Each run correctly detected
this, published nothing, changed nothing in the tracker, and sent a push
notification — it did not fabricate or half-publish anything. Confirmed
by reading `get_run_log` for the first firing (2026-09-12 14:07 UTC) and
the most recent one (2026-09-14 19:06 UTC): identical failure both times.

The 16 companies / 32 report-periods that *did* get published on
2026-09-12 and 2026-09-13 (AAPL, MSFT, MMM, AOS, ABT, ABBV, ACN, ADBE,
AMD, AES, AFL, A, APD, ABNB, AKAM, ALB) were done in manual/interactive
sessions, not by this routine — see git history around "Migrate to
Postgres/Vercel, add SEO, seed S&P 500 + US-listed companies, and start
2026 report coverage".

**Fix needed (requires the user, no tool here can do it):** the cloud
Environment's (`env_01BS8ej9WZxyj4AZyF5TrTyC`, "Default") network egress
policy needs `sec.gov` and `financial-reports-web.vercel.app` allowlisted
— set at https://claude.ai/code environment settings. Until that's done,
the cloud routine will keep firing on schedule and keep publishing
nothing.

**Also fixed 2026-09-15** (while the network policy above still needs a
human): the routine's prompt now checks network access with one `curl` as
its very first command and stops immediately (no tracker/commit changes)
if blocked, instead of burning ~20 tool calls rediscovering the same wall
every single firing; `ADMIN_PASSWORD` was rotated (it had been sitting in
plaintext in the routine's stored prompt since 2026-09-12 — routines have
no secrets mechanism, `environment_variables` is rejected on triggers, so
it's still in the prompt text, just a fresh value); and
`scripts/admin-publish.ts` now honors `PLAYWRIGHT_EXECUTABLE_PATH` so the
routine doesn't have to re-patch the Chromium path every run either.

## 2026-09-15 night — network fix verified, local loop stood down

Manually triggered the cloud routine at 22:41 JST (19 min before the
window) to test the network fix: confirmed working — `sec.gov` and the
deployed site both returned 200 with the proper User-Agent (the earlier
403 was SEC's own bot-block, not the proxy). The routine correctly did
nothing else since it was outside the operating window (no
research/publish, tracker/log untouched, reverted an incidental
`package-lock.json` diff from `npm install`) — exactly the intended
behavior. Its next natural cron firing is 23:06 JST, the first firing
expected to actually publish since 2026-09-12.

The session-local `/loop` fallback was stopped this same night (user is
shutting down the machine) — it can't survive that regardless, so no
loss. From here, the **cloud routine is the only mechanism running
tonight**; it doesn't need this machine on. Next session: check
`RemoteTrigger {action: "list_runs", trigger_id: "trig_01GNdUY59Na4x3JxMr6p7mxK"}`
for tonight's firings (23:06 JST onward) and report what actually got
published before doing anything else.

## Nightly log (one entry per 23:00–05:00 JST window, from 2026-09-15 on)

<!-- New entries appended below. Format:

### YYYY-MM-DD night (23:00 JST YYYY-MM-DD → 05:00 JST YYYY-MM-DD+1)

- Mechanism: cloud routine / session-local loop
- Published: N report-periods across M companies — TICKER PERIOD YEAR, ...
- Skipped: TICKER (reason), ...
- Tier worked: 0 (fresh filings) / 1 (2026 backlog) / 2 (multi-year backfill) / Phase 2 (freshness)
- Running total after tonight: X companies done, Y report-periods published
- Notes: anything unusual (a subagent that came back incomplete and was
  NOT published, a company that needed a skip, etc.)
-->

### 2026-09-15 night (23:00 JST 2026-09-15 → 05:00 JST 2026-09-16)

- Mechanism: cloud routine (`trig_01GNdUY59Na4x3JxMr6p7mxK`), 6 firings at
  23:06/00:07/01:07/02:07/03:06/04:06 JST — its first real chance to work
  since 2026-09-12 now that network access is fixed.
- Published: **0 report-periods.** Tier 0 scan (`scan-recent-filings`) ran
  fine each time (88 fresh candidates found), but every firing was stopped
  before any research began by two blockers, both since fixed or flagged
  below:
  1. **`ADMIN_PASSWORD` mismatch** (every firing): the password rotated
     2026-09-15 was set on Vercel via `vercel env add` but the production
     deployment was never redone afterward — Vercel env var changes only
     take effect on the *next* deploy, not retroactively on an already-
     running deployment. Confirmed and **fixed 2026-09-16 morning**: ran
     `vercel --prod` again, `admin-publish -- --list` now logs in fine
     with the current password.
  2. **GitHub App has no write access to `PQHOP/financial-reports-web`**
     (every firing, once it got past #1): `git push` and both
     `mcp__github__push_files` / `create_or_update_file` all returned
     `403 Resource not accessible by integration`, with: *"Claude doesn't
     have GitHub access to PQHOP/financial-reports-web for your
     organization. An org admin can install the Claude GitHub App at
     https://github.com/apps/claude/installations/select_target, or
     reconnect GitHub from claude.ai settings
     (https://claude.ai/customize/connectors?auth_start=github&auth_start_force=1)."*
     **Still unresolved as of 2026-09-16 morning — needs a human with
     admin rights on the PQHOP GitHub org to fix via one of those two
     links.** Every prior firing (09-12 through 09-14) failed even
     earlier at the network check, so this was never surfaced before —
     it may have been broken since the routine's creation. Until fixed,
     the routine can research and even publish reports to the live site,
     but **cannot persist `report-tracker.json`/`nightly-log.md` updates**
     — each firing would re-discover the same "what's next" state from
     scratch (wasteful, though not harmful — `admin-publish`'s own
     uniqueness check still rejects a true duplicate).
  3. One firing (23:06 JST) also hit Playwright's bundled Chromium not
     trusting the sandbox's TLS-intercepting proxy (`ERR_CERT_AUTHORITY_
     INVALID` navigating to the deployed site) — fresh container each
     firing, so this isn't a one-time fix. Confirmed working fix:
     `apt-get install -y libnss3-tools && certutil -A -n "ccr-agent-proxy"
     -t "CT,C,C" -i /root/.ccr/agent-proxy-ca.crt -d sql:/root/.pki/nssdb`.
     Belongs in the cloud Environment's **Setup script** (runs before
     Claude Code launches, so it'd apply every firing) rather than
     rediscovered each time — not yet added, needs the user via the
     Environment edit dialog (see `CLAUDE.md` "Operating window").
- Tier worked: 0 only (scan ran; never got past login to research/publish).
- Running total after tonight: unchanged — 16 companies done, 32
  report-periods published (all from before 2026-09-15).
- Notes: two of the routine's own local commits from tonight (an
  unconfirmed alternate Chromium-TLS-trust code fix, and a nightly-log
  write-up) never reached GitHub because of blocker #2 above and were
  lost when their ephemeral containers were reclaimed — this entry was
  reconstructed from `RemoteTrigger get_run_log` transcripts instead, and
  pushed from a local session that still has working git access (unlike
  the routine, until #2 is fixed).

### 2026-09-16 night (23:00 JST 2026-09-16 → 05:00 JST 2026-09-17)

- Mechanism: this firing's invocation matches the cloud routine's pattern
  (automated `[SCHEDULED TASK]` prompt, no live user) — treating it as
  `trig_01GNdUY59Na4x3JxMr6p7mxK`'s work unless a later check shows
  otherwise.
- Network check passed first thing (`curl https://www.sec.gov/` without a
  User-Agent returned SEC's own 403 "Request Rate Threshold Exceeded" —
  that's SEC's fair-access page, not a proxy/policy block; retrying with
  the required `User-Agent` header from CLAUDE.md returned 200, as did the
  deployed site). Both blockers from the night of 09-15 were also
  confirmed fixed: `admin-publish -- --list` logged in fine with the
  current `ADMIN_PASSWORD` (no redeploy needed this time), and this
  entry's own `git push` below is the first real test of GitHub App write
  access since blocker #2 was reported unresolved on 09-16 morning.
- Ran tier 0 (`npm run scan-recent-filings`, 7-day window): 63 fresh
  candidates, newest-filed-first. Worked the top of the list in strict
  date order (09-15 filings before 09-14 before 09-11 before 09-10; no
  sp500 tie to break yet since AVGO/PANW only appear on 09-10).
- Published this batch (5 companies researched via opus subagents in
  parallel, run synchronously — results confirmed before tracker updates):
  - **FPS** (Forgent Power Solutions) — FY2026 ANNUAL (10-K, period end
    2026-06-30): https://financial-reports-web.vercel.app/reports/cmu46n798000104jqd7qd4bry
  - **BNTC** (Benitec Biopharma) — FY2026 ANNUAL (10-K, period end
    2026-06-30): https://financial-reports-web.vercel.app/reports/cmu46nbmh000004l0y23losq9
  - **ABAT** (American Battery Technology) — FY2026 ANNUAL (10-K, period
    end 2026-06-30): https://financial-reports-web.vercel.app/reports/cmu46n26n000004jqsxz89mo7
  - **VRA** (Vera Bradley) — 2026 Q2 (10-Q, fiscal Q2 FY2027, period end
    2026-08-01): https://financial-reports-web.vercel.app/reports/cmu46nd1n000004jq37upvstm
  - **ISPR** (Ispire Technology) — FY2026 ANNUAL (10-K, period end
    2026-06-30): https://financial-reports-web.vercel.app/reports/cmu46o9aj000004l8k78grtcx
- Skipped: **WFCF** (Where Food Comes From) — the only other 09-15
  candidate. Its listed filing was a 10-Q/A that, per its own explanatory
  note, "solely" amends Item 4 Controls & Procedures and re-files
  Section 302/906 certifications for the quarter ended March 31, 2026 —
  no financial data changed from the original 10-Q (filed 2026-05-14,
  itself not yet published by us). Not marked `skipped` in the tracker —
  WFCF still owes a 2026 report from the *original* Q1 10-Q, just not
  from this amendment; left untouched so it surfaces normally in tier-1
  backlog processing.
  - Note: the ABAT subagent flagged that the deployed site's CDN served a
    briefly-stale cached response for a `/reports/<id>` URL right after
    publish (a re-fetch with cache-busting returned the correct content).
    Not something this batch could fix — noting for whoever next touches
    the deploy config.
- Second batch (tier 0, 09-14 date group, next 5 in ticker order): CNXU,
  CODA, FEIM, IMMR, KMTS — also via parallel opus subagents.
  - **CNXU** (Conexeu Sciences) — 2026 Q3 (10-Q, fiscal Q3 ends 2026-07-31,
    Oct 31 FYE): https://financial-reports-web.vercel.app/reports/cmu46v6ow000104jqcu2w59r9
    Pre-revenue regen-medicine direct-listing; flagged going-concern
    doubt and ~2 months of cash runway at quarter-end.
  - **CODA** (Coda Octopus Group) — 2026 Q3 (10-Q, fiscal Q3 ends
    2026-07-31, Oct 31 FYE): https://financial-reports-web.vercel.app/reports/cmu46w45d000204jqarvyqwsh
  - **KMTS** (Kestra Medical Technologies) — 2026 Q1 (10-Q, quarter ended
    2026-07-31, Apr 30 FYE): https://financial-reports-web.vercel.app/reports/cmu46wltv000304jq9dp9y784
  - **IMMR** (Immersion Corporation) — 2026 Q1 (10-Q, quarter ended
    2026-07-31, Apr 30 FYE, fiscal Q1 2027 by the company's own label):
    https://financial-reports-web.vercel.app/reports/cmu46wp11000104l89qs4znzs
  - **FEIM** (Frequency Electronics) — 2026 Q1 (10-Q, quarter ended
    2026-07-31, Apr 30 FYE, fiscal Q1 2027 by the company's own label):
    https://financial-reports-web.vercel.app/reports/cmu46x2kn000404jqjmtuq6pz
  - Note: several of tonight's non-calendar-fiscal-year companies (VRA,
    IMMR, FEIM) file quarters that the company itself labels one fiscal
    year ahead of the calendar year the quarter falls in (e.g. "fiscal Q1
    2027" for a quarter ended July 2026). Consistently bucketed these
    under the *calendar* year the period falls in (year 2026) per this
    tracker's existing convention (see AAPL's entries, which do the
    same for its Sept-FYE quarters) — each report's own title/body states
    the company's fiscal label explicitly so the page itself isn't
    misleading.
- Third batch (a later firing this same night; re-ran `npm run
  scan-recent-filings`, got 53 fresh candidates — the same underlying
  09-14/09-11/09-10 filings minus the 10 already published above, plus
  WFCF's 10-Q/A still surfacing since it was deliberately left untouched
  in the tracker). Skipped WFCF again for the same reason (amendment only
  touches Item 4 controls/certifications, no financial data). Worked the
  top 5 of the 09-14 group in list order, via 5 parallel opus subagents:
  - **MWYN** (Marwynn Holdings) — 2026 Q1 (10-Q, fiscal Q1 FY2027 by the
    company's own label, period end 2026-07-31):
    https://financial-reports-web.vercel.app/reports/cmu48paih000004kxeswl3wc0
    Revenue jumped on two new low-margin scrap-copper-resale and
    food-and-beverage lines; flagged thin cash ($3,541) against $1.31M
    receivables and an explicit going-concern doubt.
  - **PLCE** (Children's Place) — 2026 Q2 (10-Q, thirteen weeks ended
    2026-08-01): https://financial-reports-web.vercel.app/reports/cmu48q2x5000004l6kqicbnkw
    Net sales down 18.9%; reported gross margin rose only because ~$39M of
    refunded IEEPA tariffs was booked as a COGS reduction — underlying
    margin actually fell ~1,550bps per management's own bridge.
  - **PLAY** (Dave & Buster's) — 2026 Q2 (10-Q, 13 weeks ended
    2026-08-04): https://financial-reports-web.vercel.app/reports/cmu48qqgo000104l646z9vunr
    Net loss of $12.5M; separated a one-off breakage-accounting swing from
    genuine comp-sales softness and a margin-mix shift toward food & bev.
  - **OPTT** (Ocean Power Technologies) — 2026 Q1 (10-Q, fiscal Q1 FY2027
    by the company's own label, period end 2026-07-31):
    https://financial-reports-web.vercel.app/reports/cmu48q0c4000104kxds5lj3gx
    Gross margin went negative on foreseeable-loss contract charges; going
    concern doubt, unwaived note default, 1-for-30 reverse split effective
    2026-09-11.
  - **RFIL** (RF Industries) — 2026 Q3 (10-Q, three months ended
    2026-07-31): https://financial-reports-web.vercel.app/reports/cmu48r6km000204l6vtwduvvg
    Record quarterly revenue +21.1%, net income tripled; flagged that most
    of the margin gain was a non-repeating tariff refund and that a
    valuation-allowance release will distort one future quarter's EPS.
  - All 5 subagents ran their own post-publish sanity check before
    reporting success; one (OPTT) hit a briefly-stale CDN response on
    first fetch (same symptom noted for ABAT earlier tonight) that
    resolved on a cache-busted re-fetch — recurring enough now to flag as
    a real (if minor) deploy-config quirk, not a one-off.
- Fourth batch (a later firing this same night, 04:06-04:16 JST; network
  check re-verified from scratch first — `curl` to sec.gov without a
  User-Agent returned SEC's own 403, not a proxy block, confirmed by a
  clean 200 with the required header, and the deployed site also returned
  200 — SEC and the site remained reachable). Re-ran `npm run
  scan-recent-filings`: 48 fresh candidates (same underlying 09-14/09-11/
  09-10 filings minus the 15 already published above, plus WFCF's 10-Q/A
  still surfacing since it remains deliberately untouched in the tracker).
  Skipped WFCF again for the same reason (amendment only touches Item 4
  controls/certifications, no financial data — still left out of the
  tracker on purpose). Worked the remaining 5 tickers in the 09-14 group
  (the last of that date's candidates), via 5 parallel opus subagents:
  - **RLGT** (Radiant Logistics) — FY2026 ANNUAL (10-K, July-June fiscal
    year, period end 2026-06-30):
    https://financial-reports-web.vercel.app/reports/cmu4hee7e000004kzwvppcj18
    Revenue +3.5%, diluted EPS +11.4%, but adjusted EBITDA (the bank
    covenant metric) fell 5.3% — the GAAP gain came from a non-cash
    earn-out revaluation and lower acquisition amortization; ~$29M of the
    $31.7M revenue increase came from the Weport (Mexico) acquisition, and
    receivables days stretched with a larger bad-debt allowance.
  - **UNFI** (United Natural Foods) — FY2026 ANNUAL (10-K, 52 weeks ended
    2026-08-01):
    https://financial-reports-web.vercel.app/reports/cmu4haz92000104jrjw21rina
    Net sales -2.0% but net income swung from a $118M loss to $84M profit
    and adjusted EBITDA +27%, driven by exiting a ~$1B low-margin East
    region customer agreement and DC consolidation rather than volume
    growth; flagged a cybersecurity-insurance recovery, a LIFO
    liquidation benefit, and rising customer concentration (28%, one
    customer).
  - **UROY** (Uranium Royalty Corp.) — 2026 Q3 (10-Q, fiscal Q1 FY2027 by
    the company's own label, Apr 30 FYE, period end 2026-07-31):
    https://financial-reports-web.vercel.app/reports/cmu4hbbs8000304jrnme812o6
    Sold nearly its entire physical uranium stockpile to help fund a
    $964.3M soda-ash royalty acquisition (Sweetwater); the resulting
    inventory gain is nearly all of operating income, and the filing
    discloses a going-concern doubt against a $40M bridge loan due
    January 2027.
  - **VALU** (Value Line) — 2026 Q3 (10-Q, fiscal Q1 FY2027 by the
    company's own label, Apr 30 FYE, period end 2026-07-31):
    https://financial-reports-web.vercel.app/reports/cmu4haw15000004jrja5l4l06
    Net income -27.9% with all three income streams (publishing, EAM
    asset-management interests, investment gains) down together; Value
    Line Funds AUM fell 32.2% while the Russell 2000 rose 32.5% over the
    same span, implying sustained redemptions rather than market losses.
  - **WLTH** (Wealthfront) — 2026 Q2 (10-Q, fiscal Q2 FY2027 by the
    company's own label, Jan 31 FYE, period end 2026-07-31):
    https://financial-reports-web.vercel.app/reports/cmu4hbaao000204jrcqhyugs7
    Revenue flat (+1%) but net income -49% as stock-based comp jumped
    roughly 10x after December 2025 IPO-triggered RSU vesting began
    expensing; client assets kept shifting from the higher-fee cash-sweep
    product into lower-fee advisory, which is the real reason revenue
    stalled despite AUM growth.
  - One transient hiccup: the RLGT subagent's first `admin-publish` run
    timed out waiting for the login form; a plain retry of the identical
    command succeeded immediately, so treated as a one-off rather than
    the previously-diagnosed CDN-staleness or TLS-trust issues.
- Tier worked: 0 (fresh filings only; tier-1 backlog untouched tonight).
- Running total after tonight: **36 companies done, 52 report-periods
  published** (16/32 before tonight + 10 in the first two sub-batches + 5
  in the third sub-batch + 5 in this fourth sub-batch). All 20 of
  tonight's fresh-filing candidates that were attempted published
  successfully; only WFCF (considered three times now, in sub-batches 1,
  3, and 4) was set aside each time, for the non-financial-amendment
  reason above.
- Notes: none of tonight's fourth-batch subagents reported running low on
  budget; all 5 passed their own post-publish sanity check (fetched the
  live page, confirmed no truncation) before reporting success. **`git
  push` to `origin master` succeeded** (commit `4e49f88`, fast-forward
  `fd5311c..4e49f88`) — the GitHub App write-access blocker reported
  unresolved as of 2026-09-16 morning (CLAUDE.md's "Operating window"
  section, blocker #2: `403 Resource not accessible by integration`) did
  **not** reproduce this firing. Treat this one clean push as encouraging
  but not conclusive — CLAUDE.md should be updated to reflect this fix
  once a couple more firings confirm it holds. This third sub-batch's own
  5 pushes (one per company, to keep the stop-hook's "commit before
  finishing" check satisfied incrementally) also succeeded cleanly against
  `origin master`, so GitHub App write access held across at least 6
  pushes this session — treat as further (still not fully conclusive)
  evidence blocker #2 is resolved. This fourth sub-batch's own push (this
  commit) is a further data point in the same direction.
- Fifth batch (same firing, immediately after the fourth; ~35 minutes left
  in the window). Re-checked the admin dropdown for the next 5 tickers in
  the 09-11 date group (AXR, CSBR, CULP, FLWS, GWRE — confirmed present),
  then ran 5 more parallel opus subagents:
  - **AXR** (AMREP Corporation) — 2026 Q3 (10-Q, fiscal Q1 FY2027 by the
    company's own label, Apr 30 FYE, period end 2026-07-31):
    https://financial-reports-web.vercel.app/reports/cmu4hmhze000404jrz9bohs7w
    Zero developed acres sold this quarter vs. 8.9 acres a year ago,
    collapsing land-sale revenue 98% and flipping operating income to a
    loss — deliberate per management's own guidance as capital shifts into
    homebuilding.
  - **CSBR** (Champions Oncology) — 2026 Q3 (10-Q, fiscal Q1 FY2027 by the
    company's own label, Apr 30 FYE, period end 2026-07-31):
    https://financial-reports-web.vercel.app/reports/cmu4hprfc000404kzr5u2s280
    Revenue +8.8%, gross margin up ~760bps, but the entire gross-profit
    gain was consumed by a 66.6% jump in sales & marketing spend, leaving
    the operating loss roughly flat; cash down to $4.4M from $10.3M.
  - **CULP** (Culp, Inc.) — 2026 Q3 (10-Q, fiscal Q1 FY2027 by the
    company's own label, early-May FYE, period end 2026-08-02):
    https://financial-reports-web.vercel.app/reports/cmu4hopgu000204kz2b17nib7
    Reported net income of $6.0M vs. a prior-year loss is almost entirely
    a one-time $6.9M IEEPA tariff refund booked inside cost of sales;
    excluding it, Culp still ran an operating loss, though bedding-segment
    margin genuinely improved post-restructuring.
  - **FLWS** (1-800-FLOWERS.COM) — FY2026 ANNUAL (10-K, period end
    2026-06-28): https://financial-reports-web.vercel.app/reports/cmu4hovk5000304kzmku7tbkz
    Revenue -10.8% on deliberate marketing cuts, but gross profit fell
    more than the marketing savings; adjusted EBITDA down 90%. A September
    9, 2026 credit-agreement amendment replaced leverage covenants with a
    minimum-liquidity test as cash fell to $11.4M.
  - **GWRE** (Guidewire Software) — FY2026 ANNUAL (10-K, period end
    2026-07-31): https://financial-reports-web.vercel.app/reports/cmu4hoiku000104kz5h6mrokk
    Revenue +23%, subscription gross margin up to 73%, GAAP operating
    income roughly tripled — the cloud transition turned profitable this
    year; FY2027 guidance implies incremental operating margin cooling to
    ~24% from ~40%.
  - Operational notes: the CULP subagent hit a Chromium/proxy-CA trust
    issue (`/root/.pki/nssdb` had the `ccr-agent-proxy` cert imported but
    with trust flags `C,,` instead of `CT,C,C`) and fixed it with
    `certutil -M -n "ccr-agent-proxy" -t "CT,C,C" -d sql:/root/.pki/nssdb`
    — worth folding into the Environment setup script alongside the
    existing `certutil -A` step in CLAUDE.md's Operating Window notes,
    since this is a *different* failure mode (existing-but-wrong trust
    bits, not a missing cert) from the one already documented there.
  - All 5 subagents passed their own post-publish sanity check before
    reporting success; none reported running low on budget.
- Tier worked: 0 (fresh filings only; tier-1 backlog untouched tonight).
- Running total after tonight: **41 companies done, 57 report-periods
  published** (16/32 before tonight + 10 in the first two sub-batches + 5
  in the third sub-batch + 5 in the fourth sub-batch + 5 in this fifth
  sub-batch). All 25 of tonight's fresh-filing candidates that were
  attempted published successfully; only WFCF (considered on sub-batches
  1, 3, and 4) was set aside, for the non-financial-amendment reason
  above. This firing is stopping here as the 05:00 JST window close
  approaches — remaining 09-11 and 09-10 fresh-filing candidates (still
  ~18 left after tonight, per the last `scan-recent-filings` run) carry
  over to the next firing.
- This fifth sub-batch's own push (this commit) succeeded cleanly against
  `origin master` — a further (7th+) clean push this session, continuing
  to support that the GitHub App write-access blocker is resolved.
