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

### 2026-09-17 night (23:00 JST 2026-09-17 → 05:00 JST 2026-09-18)

- Mechanism: cloud routine (`trig_01GNdUY59Na4x3JxMr6p7mxK`), firing at
  ~23:07 JST. Network check (`curl` to `www.sec.gov` with the required
  User-Agent) passed with 200 — the plain-`curl`-without-UA 403 seen first
  is SEC's own block for an undeclared user agent, not a proxy/policy
  denial; confirmed not a repeat of the 09-12–09-14 network blocker.
  `npm install` postinstall (`prisma generate`) failed on missing
  `DATABASE_URL` as expected in this DB-credential-free environment — does
  not block `admin-publish`/`scan-recent-filings`, neither of which touch
  Prisma.
- Ran `npm run scan-recent-filings`: 18 fresh tier-0 candidates (7-day
  window, 09-16/09-15/09-11 filing dates). Two were 10-Q/A amendments
  (RTB, WFCF) confirmed by reading the actual amendment text to be
  non-substantive — RTB's "sole purpose... is to correct an Inline XBRL
  tagging error" (no change to any reported figure), WFCF's solely amends
  Item 4 Controls/re-files certifications (same pattern flagged on 09-16
  night). Both left untouched in the tracker per the existing precedent,
  so they'll resurface via their original 10-Qs during tier-1 backlog
  processing rather than being wrongly marked done/skipped off an
  amendment with no financials.
- Published: **5 report-periods across 5 companies**, all from the 09-16
  filing-date group, via 5 parallel opus subagents:
  - **ALMU** (Aeluma, Inc.) — FY2026 ANNUAL (10-K, period end
    2026-06-30): https://financial-reports-web.vercel.app/reports/cmu5m0b3q000004jyh6n8tcdr
    Revenue -4.4% and gross margin fell 59.6%→35.2%, but cash swelled to
    $56.0M (from $15.7M) entirely via equity raises; net loss widened to
    $9.16M with two-customer government concentration at 73% of revenue
    and an unremediated material weakness in internal controls.
  - **EPM** (Evolution Petroleum) — FY2026 ANNUAL (10-K, period end
    2026-06-30): https://financial-reports-web.vercel.app/reports/cmu5m1f21000104jyh60uz03g
    Revenue flat (+0.6%) but net income swung to a $2.4M loss (from +$1.5M)
    entirely below the operating line — a $3.3M negative derivative swing
    plus higher interest on SCOOP/STACK-funded debt; dividend coverage
    ($16.9M paid vs ~$16.2M FCF) is the key thing to watch next.
  - **IHT** (InnSuites Hospitality Trust) — 2026 Q2 (10-Q, fiscal Q2
    FY2027 by the company's Jan 31 FYE, period end 2026-07-31):
    https://financial-reports-web.vercel.app/reports/cmu5m1nbk000204jy3zt5pfde
    Revenue +2.1% and the net loss narrowed, but the real story is a June
    2026 NYSE American non-compliance notice over stockholders' deficit,
    only partly offset by an August 2026 $3.0M debt-to-equity conversion
    with an affiliate that still leaves the company short of the listing
    standard on a pro-forma basis.
  - **MBBC** (Marathon Bancorp) — FY2026 ANNUAL (10-K, period end
    2026-06-30): https://financial-reports-web.vercel.app/reports/cmu5m2wmc000104jsktynphh8
    Net income $1.79M vs $42K, NIM up 63bp to 3.59%, but flagged that part
    of the improvement is a one-time $373K drop in foreclosed-asset
    expense and the first full year deploying April 2025 conversion
    proceeds, not purely organic.
  - **WSBK** (Winchester Bancorp) — FY2026 ANNUAL (10-K, period end
    2026-06-30, first full year as a public company post an April 2025
    mutual-holding-company conversion):
    https://financial-reports-web.vercel.app/reports/cmu5m210r000004jsqzfgnqi7
    Net income $4.42M vs a $874K prior-year loss and NIM up 50bp, but the
    filing discloses that at June 30, 2026 the bank's rate-sensitivity
    metrics were out of compliance with its own board policy limits and
    the ALCO voted to permit the exception rather than sell assets at a
    loss — led the report's takeaway with that.
- Skipped: none beyond the two non-substantive amendments (RTB, WFCF)
  above, which were deliberately left untracked rather than marked
  `skipped` (see reasoning above).
- Tier worked: 0 (fresh filings only; ~13 tier-0 candidates from the
  09-11 filing-date group remain for the next firing, per the
  `scan-recent-filings` output, plus RTB/WFCF's original filings still
  pending discovery via tier-1).
- Running total after tonight: **46 companies done, 62 report-periods
  published** (41/57 before tonight + 5 in this firing).
- **Second firing this window (~00:08 JST 09-18):** re-ran
  `npm run scan-recent-filings` fresh (18 candidates again — same list,
  since none of the 09-16 group's remainder had been picked up since the
  first firing). Network re-checked from scratch as instructed by this
  firing's prompt: the plain-`curl` 403 was again confirmed to be SEC's
  own fair-access block for a missing `User-Agent` (AkamaiGHost error
  page, "Request Rate Threshold Exceeded" / fair-access notice), not a
  proxy denial — the same request with the required header returned 200,
  and the deployed site was independently reachable too, so this was not
  a repeat of the 09-12–09-14 blocker. `npm install`'s `prisma generate`
  postinstall step failed on missing `DATABASE_URL` as expected (this
  environment is DB-credential-free by design); Playwright's browser
  bindings were already present so this didn't block `admin-publish`.
  Worked the remaining 09-11 filing-date group from tier 0 (skipping RTB
  and WFCF per the precedent above): published **5 more report-periods
  across 5 companies**, via 5 parallel opus subagents, all independently
  re-verified live (title tag + rendered Takeaway callout) by the
  orchestrating session before being marked done:
  - **HOFT** (Hooker Furnishings) — fiscal Q2 FY2027, filed as 2026 Q2
    (10-Q, period end 2026-08-02):
    https://financial-reports-web.vercel.app/reports/cmu5o5nii000004jmdbcgzve0
    Swung to a $1.3M operating profit from a $0.5M loss, but the entire
    swing (and then some) is $7.9M of one-time IEEPA tariff refunds
    following the Feb 2026 Supreme Court ruling; stripped of that, sales
    fell 8.7%, unit volume fell 10.8%, and the underlying business lost
    more than a year ago — the one repeatable positive is Hooker Branded
    backlog up ~35% YoY.
  - **JVA** (Coffee Holding) — fiscal Q3 FY2026, filed as 2026 Q3 (10-Q,
    period end 2026-07-31):
    https://financial-reports-web.vercel.app/reports/cmu5o91i5000104jjesw7yazi
    Net sales fell 9.3% but gross margin jumped from 9.4% to 25.0% and
    EPS swung from -$0.21 to +$0.35, mostly from selling green-coffee
    inventory bought before the price crash — 44% of the gross-profit
    gain is actually a coffee futures/options trading swing management
    says it's deliberately scaling down, and ~2.8pts of the margin
    "expansion" is a prior-period SG&A-to-COGS reclassification, not new
    performance.
  - **KEQU** (Kewaunee Scientific) — fiscal Q1 FY2027, filed as 2026 Q1
    (10-Q, period end 2026-07-31):
    https://financial-reports-web.vercel.app/reports/cmu5o5x7e000104jm8n58uc5k
    Sales fell 6.7% and EPS fell 44%, but gross margin actually rose;
    the earnings drop is mostly flat opex spread over less revenue plus
    an 8.6-point jump in the effective tax rate — order backlog, down
    17.6% YoY, was up sequentially from the April 30 year-end for the
    first time, a possible sign orders have troughed.
  - **LPTH** (LightPath Technologies) — FY2026 ANNUAL (10-K, period end
    2026-06-30):
    https://financial-reports-web.vercel.app/reports/cmu5o62lc000004gw0ebyp9j2
    Revenue +93% to $71.7M driven by G5 Infrared camera/module shipments
    and the AML acquisition, but the reported net loss widened to $20.6M
    purely on a $15.6M non-cash earnout fair-value markup (the acquired
    business beating its targets); adjusted EBITDA swung to +$4.2M.
    Backlog nearly tripled to $110.9M but ~$58M of the increase is one
    customer, and the top three now make up 37% of revenue.
  - **MSB** (Mesabi Trust) — fiscal Q2 FY2027, filed as 2026 Q2 (10-Q,
    period end 2026-07-31):
    https://financial-reports-web.vercel.app/reports/cmu5o73sa000004jjoyxmdl93
    Swung to a $95K net loss despite pellet shipments rising 3.4%,
    because Cliffs now consumes nearly all Northshore output internally,
    collapsing the arm's-length pricing reference used to set bonus
    royalties, while legal expenses for the Trust's AAA arbitration
    against Cliffs/Northshore nearly tripled operating costs;
    distribution cut to $0.05/unit from $0.12.
  - Skipped: none this sub-batch (RTB/WFCF already excluded above).
  - Tier worked: 0 (fresh filings) — this exhausts the entire tier-0
    09-16/09-15/09-11 candidate list from tonight's scan except the two
    deliberately-untouched amendments.
  - Running total after this sub-batch: **51 companies done, 67
    report-periods published** (46/62 after the first firing + 5 in this
    sub-batch).
- **Third sub-batch, same firing (~00:35 JST 09-18):** tier 0 exhausted
  (only RTB/WFCF amendments left, deliberately untouched), so moved to
  tier 1 per priority order — S&P 500 backlog, in `sp500.json` file order,
  skipping the 16 tickers already `done`. Looked up each company's CIK via
  `https://www.sec.gov/files/company_tickers.json` and its latest 10-Q/10-K
  via `data.sec.gov/submissions/CIK##########.json` directly (bypassing
  the EDGAR browse UI) to hand each subagent an exact filing-index URL
  up front. All 5 next-in-line S&P 500 tickers (ARE, ALGN, ALLE, LNT, ALL)
  had Q2 2026 (period end 2026-06-30) as their latest already-reported
  quarter — Q3 2026 isn't due yet for calendar-year filers — so all 5
  qualify as Q2 2026 reports per the tracker's "2026 report" definition.
  Published **5 more report-periods across 5 companies**, via 5 parallel
  opus subagents, all independently re-verified live by the orchestrating
  session:
  - **ARE** (Alexandria Real Estate Equities) — Q2 2026 (10-Q, period end
    2026-06-30): https://financial-reports-web.vercel.app/reports/cmu5oigkr000404jmfx3007ik
    Revenue -13.0% and same-property occupancy fell to 87.1% from 92.6%
    on previously-disclosed lease expirations; Nareit FFO/share actually
    rose 26.4% only because that measure adds back $1.30/share of Q2
    impairments, while adjusted FFO/share fell 25.8%. Leverage is 7.0x
    against a 5.6x-6.2x target with only $170M of a $2.90B disposition
    plan closed so far; FY26 guidance midpoint held but implies a further
    step-down in 2H26.
  - **ALGN** (Align Technology) — Q2 2026 (10-Q, period end 2026-06-30):
    https://financial-reports-web.vercel.app/reports/cmu5ohcpu000204jmh6ayokjf
    Clear aligner case volume +7.4% and gross margin +1.8pt, but a new
    $38.7M UK VAT provision (after a July 2026 Upper Tribunal reversal of
    Align's earlier win) erased the operating gain, cutting operating
    income 5.5% despite the operational improvement; revenue per case
    rose just 0.8%, so growth is volume/mix-driven, not pricing power.
  - **ALLE** (Allegion) — Q2 2026 (10-Q, period end 2026-06-30):
    https://financial-reports-web.vercel.app/reports/cmu5oiwao000604jm75flzi10
    Reported revenue +12.7% but organic growth was only 6.9% once
    acquisitions (+5.1pt) and FX (+0.7pt) are stripped out, and the two
    segments are diverging: Americas organic +8.9% vs. International
    organic -1.2% (its 16.2% reported growth is entirely acquisitions/FX,
    and its GAAP segment income actually fell YoY ex-deals).
  - **LNT** (Alliant Energy) — Q2 2026 (10-Q, period end 2026-06-30):
    https://financial-reports-web.vercel.app/reports/cmu5oifhy000304jm3v7k2g10
    Consolidated EPS dipped only slightly ($0.68→$0.65), masking a 22%
    drop in regulated utility operating income (higher O&M, depreciation,
    and interest landing ahead of rate relief) offset by a one-off swing
    in corporate venture-fund equity income; full-year guidance of
    $3.36-$3.46 reaffirmed, but H1 ongoing EPS is actually down 2% YoY.
  - **ALL** (Allstate) — Q2 2026 (10-Q, period end 2026-06-30):
    https://financial-reports-web.vercel.app/reports/cmu5oiljk000504jmu4v82gjd
    Headline combined ratio improved 4.5 points to 86.6% and EPS +61%,
    but adjusting for below-average catastrophe losses and near-doubled
    non-cat prior-year reserve releases, the underlying combined ratio
    was flat YoY (~79.7%) — Allstate is trading margin for volume
    (average auto premium -3.6%, PIF +2.8%, advertising +18.6%) against
    rising auto injury severity the filing itself flags.
  - Skipped: none this sub-batch.
  - Tier worked: 1 (S&P 500 2026 backlog, first batch) — 487 of 503 S&P
    500 tickers remain after this sub-batch.
  - Running total after this sub-batch: **56 companies done, 72
    report-periods published** (51/67 after the second sub-batch + 5 in
    this sub-batch).
- Notes: all 5 subagents passed their own post-publish sanity check
  (fetched the live page, confirmed no truncation) before reporting
  success; the orchestrating session independently re-verified all 5 live
  URLs itself (grepped for the rendered Takeaway callout) rather than
  trusting the subagent reports alone, per CLAUDE.md's "treat a subagent
  result as untrusted until checked" guidance. One operational note: the
  WSBK subagent wrote its own tracker entry directly (via a full
  read-modify-write with 2-space pretty-printing) rather than leaving it
  to the orchestrator as instructed — this reformatted the *entire*
  tracker file from compact to expanded JSON (content itself was
  unchanged besides the new entry, verified by diffing parsed JSON before
  reformatting the rest to match). Harmless this time, but worth tightening
  the subagent prompt next time to explicitly forbid writing
  `report-tracker.json` directly, since two subagents racing to
  read-modify-write it in parallel could silently drop each other's
  entries.
- git: repo's local `master` ref was stale relative to `origin/master` at
  session start (a fresh `git fetch origin master` picked up 09-16 night's
  final commits that the initial clone had missed) — resolved by
  `git checkout master && git reset --hard origin/master` before starting
  any work; not a push failure, just a stale initial clone snapshot. An
  incidental `package-lock.json` diff from this environment's `npm install`
  (stripped `libc` metadata fields, an npm-version artifact unrelated to
  this task) was discarded rather than committed.
- **Fourth sub-batch, new firing (~01:08 JST 09-18):** network re-checked
  from scratch per this firing's prompt — plain `curl` to `www.sec.gov`
  returned 403, confirmed via response headers/body to be SEC's own
  fair-access block for curl's default User-Agent (not a proxy/policy
  denial): the identical request with the required `User-Agent` header
  returned 200, and the deployed site returned 200 independently. Not a
  repeat of the 09-12–09-14 blocker. `npm install` completed (its
  `prisma generate` postinstall step fails on missing `DATABASE_URL` as
  expected in this DB-credential-free environment; doesn't block
  `admin-publish`/`scan-recent-filings`, neither of which touch Prisma).
  Local `master` was in a detached-HEAD state at session start (past a
  stale `origin/master` fetch) — reset to a proper branch via
  `git checkout -B master origin/master`.
  Re-ran `npm run scan-recent-filings` (7-day window): 8 fresh tier-0
  candidates — RTB and WFCF resurfacing as 10-Q/A amendments (per
  existing precedent, both confirmed non-substantive: RTB's is solely an
  XBRL-tagging fix, WFCF's solely amends Item 4 Controls & re-files
  certifications for a *different, older* quarter than its own latest
  10-Q) plus REF, RENT, RSSS, SMBC, USAU, VNCE, none seen before.
  Rather than skip RTB/WFCF a fourth time, looked up each company's
  actual filing history via `data.sec.gov/submissions/CIK...json` and
  found both already have a **more recent, substantively normal 10-Q**
  on file that the 7-day scan window doesn't reach (RTB: original 10-Q
  filed 2026-08-14 for the same 2026-06-30 quarter the amendment
  touches; WFCF: a full Q2 2026 10-Q filed 2026-08-06, one quarter newer
  than the Q1 2026 quarter its amendment touches) — used those original
  filings instead, so both get their 2026 report from real financial
  content rather than being skipped again.
  Published **5 report-periods across 5 companies**, via 5 parallel opus
  subagents, all independently re-verified live (title tag + rendered
  Takeaway callout, full byte count, no mid-sentence cutoff) by the
  orchestrating session before being marked done:
  - **RTB** (RTB Digital) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-08-14): https://financial-reports-web.vercel.app/reports/cmu5qcg06000004lc0mu0ztnc
    Headline +350.3% revenue growth is almost entirely ~7 weeks of the
    Ryvyl payment-processing acquisition; the filing's own pro forma
    table shows combined-entity growth of only ~12.5%. Net loss widened
    to $9.58M on a $3.3M warrant-modification charge and $1.2M merger
    advisory fee. Reported $4.1M of working capital depends entirely on
    a $10.0M nonrefundable "deposit on digital media investment" with no
    disclosed counterparty; excluding it, liquid assets are $0.84M
    against $11.04M of current liabilities.
  - **WFCF** (Where Food Comes From) — Q2 2026 (10-Q, period end
    2026-06-30, filed 2026-08-06): https://financial-reports-web.vercel.app/reports/cmu5qc7l2000004jphw05u5ch
    Revenue flat (+0.7%) but gross margin +3.1pt and operating income
    +21.1% — a margin-bridge shows ~92% of the gross-profit gain was
    rate, not volume. Reported EPS fell to $0.08 from $0.11 anyway,
    entirely below the operating line: a $240K swing in a ~7-bitcoin
    treasury mark-to-market plus the permanent loss of $50K/quarter
    Progressive Beef dividend income after that stake was sold in 2025.
  - **REF** (Reformation) — Q2 2026 (10-Q, 13 weeks ended 2026-06-27,
    filed 2026-09-11): https://financial-reports-web.vercel.app/reports/cmu5qcn4p000104jp4921mt0v
    Q2 revenue +24.1%, gross margin +230bps (underlying — the filing
    states no IEEPA tariff-refund amount hit Q2, unlike Q1's 381bps of
    refunds on prior-year sales), net income +79.4%. First-half GAAP net
    income of just $0.26M is separately distorted by a $23.8M non-cash
    stock-comp modification charge and an $89.7M debt-funded pre-IPO
    dividend recap (partly repaid from August IPO proceeds). Active
    Customers +22.9% but DTC revenue per customer -1.4%.
  - **RENT** (Rent the Runway) — Q2 2026 (10-Q, fiscal quarter ended
    2026-07-31, filed 2026-09-11): https://financial-reports-web.vercel.app/reports/cmu5qcqgb000204jplfb6tt7w
    Revenue +20.8%, gross margin 36.1% vs 30.0%, Adjusted EBITDA more
    than tripled — but ending Active Subscribers fell 3.8%; essentially
    all growth is a 2025 price increase plus a June 2026 shipping charge
    management calls temporary, both due to lap out from fiscal Q3
    onward. Liquidity remains tight: $29.0M cash, $(65.5)M stockholders'
    deficit, no remaining borrowing availability.
  - **RSSS** (Research Solutions) — FY2026 ANNUAL (10-K, period end
    2026-06-30, filed 2026-09-11): https://financial-reports-web.vercel.app/reports/cmu5qdp62000304jp3tswu16d
    Revenue -1.5% but net income +123% to $2.82M, driven by mix shift
    from lower-margin transaction/resale revenue into higher-margin
    platform subscriptions. Adjusted EBITDA +10.6% (record) is the
    cleanest underlying read; growth is decelerating (net new B2B
    deployments 105 vs 150 a year ago, B2C ARR turned negative), which
    matters because a $15.4M earnout tied to a since-declined B2C-ARR
    benchmark still has three installments left through May 2027.
  - Skipped: none this sub-batch.
  - Tier worked: 0 (fresh filings) — 3 of tonight's 8 tier-0 candidates
    (SMBC, USAU, VNCE, all seen in the original 09-17 scan but not yet
    dispatched) remained; picked up in the next sub-batch below rather
    than being left for a future firing, since the window and budget
    both still had headroom.
- Running total after this sub-batch: **61 companies done, 77
  report-periods published** (56/72 before this sub-batch + 5 in this
  sub-batch).
- **Fifth sub-batch, same firing (~01:20 JST 09-18):** re-ran
  `npm run scan-recent-filings` to confirm what remained — 3 candidates
  (SMBC, USAU, VNCE), all from the 09-11 filing-date group, all already
  scoped from the earlier scan. Published **3 more report-periods across
  3 companies**, via 3 parallel opus subagents, all independently
  re-verified live by the orchestrating session before being marked done:
  - **SMBC** (Southern Missouri Bancorp) — FY2026 ANNUAL (10-K, period
    end 2026-06-30): https://financial-reports-web.vercel.app/reports/cmu5qkmky000204lchk1y1lkf
    Net income +22.6% to $71.8M, but the gap between that and pre-tax
    income's +17.7% is a lower effective tax rate from higher
    low-income-housing tax credits (~$0.25/share); NIM widened 22bp
    entirely on falling funding costs while credit quality deteriorated
    (provision +75.6%, NPAs 0.47%→0.64%, driven by agricultural credits).
  - **USAU** (U.S. Gold Corp.) — Q2 2026 (10-Q, fiscal Q1 FY2027, period
    end 2026-07-31): https://financial-reports-web.vercel.app/reports/cmu5qkgmk000104lcemuqyqfs
    Pre-revenue gold/copper explorer; net loss more than doubled but
    ~59% of the swing is the absence of a prior-year non-cash warrant
    gain, and actual cash burn barely moved. CK Gold is fully permitted
    with a March 2026 feasibility study ($632M after-tax NPV) but needs
    ~$394M of capex against $27.1M cash; construction is paused pending
    financing, and the state permit now requires proof of financial
    capacity by December 2027.
  - **VNCE** (Vince Holding) — Q2 2026 (10-Q, fiscal quarter ended
    2026-08-01): https://financial-reports-web.vercel.app/reports/cmu5qlitp000004l3yzm9pbov
    Reported gross margin jumped 10.5 points to 60.9%, but a one-time
    $10.4M IEEPA tariff-refund credit to COGS accounts for more than the
    entire improvement — ex-refund margin was actually ~2 points lower
    than last year. Both years' operating income are further distorted
    by one-offs in opposite directions (this year's OVO deal costs,
    last year's pandemic-era Employee Retention Credit); underlying
    operating margin was roughly flat. DTC comparable sales +18.4%.
  - Skipped: none this sub-batch.
  - Tier worked: 0 (fresh filings) — this clears tonight's entire tier-0
    candidate list down to 0 remaining, confirmed by a final
    `scan-recent-filings` re-run.
  - Operational note: the SMBC subagent wrote its own tracker entry
    directly (full read-modify-write, default 2-space JSON.stringify)
    despite the prompt instructing it not to — same pattern flagged on
    09-17 night with the WSBK subagent. This time it silently reformatted
    every existing `—` em-dash escape in the file to a raw UTF-8
    character, producing an 8-line unrelated diff; caught and fixed by
    diffing old vs. new parsed JSON (confirmed zero content changes,
    SMBC the only added key) before re-serializing the whole file with a
    consistent non-ASCII-escaping pass. Worth tightening the subagent
    prompt further (explicit "do not open or write
    report-tracker.json under any circumstances") since asking nicely
    has now failed twice.
- Running total after tonight: **64 companies done, 80 report-periods
  published** (61/77 before this sub-batch + 3 in this sub-batch). This
  firing is stopping here — tier-0 fully cleared for tonight, all 8
  originally-scanned candidates published (5 in the first sub-batch, 3 in
  this one), all 8 independently re-verified live before being marked
  done in the tracker.

### 2026-09-18 night (23:00 JST 2026-09-18 → 05:00 JST 2026-09-19)

- Mechanism: cloud routine (`trig_01GNdUY59Na4x3JxMr6p7mxK`), firing at
  ~23:07 JST.
- Setup notes this firing: `npm install` failed on `postinstall` (`prisma
  generate`) with `Missing required environment variable: DATABASE_URL` —
  worked around with a dummy `DATABASE_URL` value (publishing needs no
  real DB credentials, only `SITE_URL`/`ADMIN_PASSWORD`, so this is safe).
  Chromium/TLS proxy cert was present but with the wrong trust bits
  (`certutil -M -n "ccr-agent-proxy" -t "CT,C,C" -d sql:/root/.pki/nssdb`
  fixed it — the second of the two failure modes CLAUDE.md already
  documents). Also found the container's `master` branch ref stale/
  detached relative to `origin/master` at session start — turned out to
  be a local ref-cache artifact, not an actual divergence; a fresh
  `git fetch` showed origin already had everything (including an
  unrelated real commit from the user, "Add Vercel Web Analytics for
  visitor tracking", made outside this routine). No data was at risk;
  documented here in case it recurs.
- Network check: initial `curl https://www.sec.gov/` returned 403, but
  confirmed via verbose headers that this was SEC's own Akamai
  rate-limit/UA response (`SEC.gov | Request Rate Threshold Exceeded`),
  not a proxy/policy block — retrying with the required `User-Agent`
  header returned 200 immediately. Network access is fine tonight.
- Published: **5 report-periods across 5 companies** — VOGX Q2 2026, PZG
  FY2026 ANNUAL, MO Q2 2026, GOOGL Q2 2026, GOOG Q2 2026:
  - **VOGX** (Vogenx Inc) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-09-17): https://financial-reports-web.vercel.app/reports/cmu71ha4b000004jmd6ftyb44
    Pre-revenue clinical-stage biotech (mizagliflozin for post-bariatric
    hypoglycemia); net loss widened 30.4% to $384,430 entirely on
    non-cash fair-value marks on related-party convertible notes/warrants
    that were extinguished at the August 2026 IPO, while reported cash
    burn ($323,119) understates real spend — accrued officer compensation
    payable roughly doubled to $719,043. The IPO raised ~$84.9M net
    (~50x the current annual spend rate), but the EMERGE Phase 2b trial
    hadn't started yet and two material weaknesses (already forcing a
    FY2024/FY2025 restatement) remain unremediated.
  - **PZG** (Paramount Gold Nevada Corp.) — FY2026 ANNUAL (10-K, period
    end 2026-06-30, filed 2026-09-17): https://financial-reports-web.vercel.app/reports/cmu71ixei000004l9szztj7ar
    Net loss +72% to $15.56M, but 81% of the increase is two non-cash
    fair-value marks that moved *because* gold/silver prices rose (a
    Sprott embedded-royalty derivative and liability-classified pre-
    funded warrants); opex rose only 19.8%. The real story is a
    well-timed ATM raise (1.86x the shares of FY2025 for 5.9x the cash)
    alongside the January 2026 BLM Record of Decision at Grassy Mountain
    and an updated feasibility study. Going-concern doubt persists —
    management's own runway estimate is ~March 2027 against $189.8M of
    initial capital needed, ~19x year-end cash.
  - **MO** (Altria) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-07-30): https://financial-reports-web.vercel.app/reports/cmu71qxj7000004jpmppz4a9i
    Reported diluted EPS fell 2.8% to $1.37 while adjusted EPS rose 2.8%
    to $1.48 — the gap is litigation, a $78M plant-consolidation charge,
    and ABI special items. Cigarette pricing (+$309M) barely outran
    volume/mix drag (-$279M); discount-brand volume +67.3% is propping up
    share while Marlboro volume fell 7.4%. Oral tobacco is the real
    deterioration: `on!` shipped 4.2% fewer cans and lost 1.7pp of
    pouch-category share even as the category grew 8.1pp of total oral
    tobacco. Buybacks collapsed to $55M from $274M with only $665M left
    on an authorization expiring 2026-12-31; FY26 guidance narrowed to
    $5.61-$5.72 adjusted EPS.
  - **GOOGL** (Alphabet Inc., Class A) — Q2 2026 (10-Q, period end
    2026-06-30, filed 2026-07-23): https://financial-reports-web.vercel.app/reports/cmu71rfto000104jp8b3edoqp
  - **GOOG** (Alphabet Inc., Class C) — same filing/analysis as GOOGL,
    published to the separate Class C listing: https://financial-reports-web.vercel.app/reports/cmu71rnpo000204jpgnt18inw
    Net income +298% to $112.2B is not an operating result — it includes
    a $99.0B unrealized gain on SpaceX/private-company equity holdings;
    excluding that, pre-tax income was +22%, roughly matching +30%
    operating profit growth. Cloud revenue +82% to $24.8B is the first
    quarter to include Wiz ($32.9B deal, closed March 2026) and TPU
    hardware sales, so organic growth isn't derivable from the filing —
    flagged rather than implied. Most consequential: Q2 capex ($44.9B)
    exceeded operating cash flow ($39.1B) for the first time, funded by a
    full capital-allocation reversal — zero buybacks, a $30.5B common
    raise (incl. $10.0B from Berkshire Hathaway), Alphabet's first-ever
    preferred stock ($19.0B), and $51.8B of new notes.
  - Skipped: none this batch.
- Tier worked: 0 (fresh filings — both scanned candidates, PZG and VOGX,
  cleared; confirmed 0 remaining on a post-batch `scan-recent-filings`
  re-run) then 1 (2026 S&P 500 backlog, file order — MO, then GOOGL/GOOG
  as one subagent call since both are the same underlying Alphabet
  filing published to two separate site listings).
- Running total after batch 1: **69 companies done, 85 report-periods
  published** (64/80 before tonight + 5 in batch 1).

**Batch 2** (this session, invoked ~15:08 UTC / ~00:08 JST 2026-09-19 via
the automated scheduled-task mechanism — most likely
`trig_01GNdUY59Na4x3JxMr6p7mxK` firing again, though this session had no
`RemoteTrigger` tool available to confirm the trigger ID directly):

- Network re-check: same as batch 1, `curl https://www.sec.gov/` 403 was
  SEC's own Akamai UA/rate-limit block, not a proxy/policy denial —
  retried with required `User-Agent` header, got 200. Confirmed via
  `$HTTPS_PROXY/__agentproxy/status`: no recent relay failures, proxy
  healthy. `npm install` needed the same dummy-`DATABASE_URL` workaround
  as batch 1 (postinstall `prisma generate` requires it, publishing
  itself does not).
- Ran `scan-recent-filings` fresh: 0 new tier-0 candidates (7-day window,
  09-12 through 09-18). Moved to tier 1 backlog, file order, from AMZN
  (next ticker after MO/GOOGL/GOOG in `sp500.json`).
- Published: **1 report-period** — AMZN Q2 2026:
  - **AMZN** (Amazon.com) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-07-31, accession 0001018724-26-000026): https://financial-reports-web.vercel.app/reports/cmu73nxp3000004l7qmx98ypj
    AWS revenue +36.8% to $42.2B (18-quarter high, 5th straight quarter
    of acceleration), AWS operating margin 32.9%→39.4%, now 61% of
    company operating income. The $62.6B net income / $5.75 diluted EPS
    is mostly non-cash: $50.5B of it is an upward revaluation of
    Amazon's Anthropic preferred stake (private-investment carrying
    value $16.2B→$122.3B in six months); pre-tax income excluding all
    non-operating income was +39% (vs. reported net income +245%).
    North America's apparent margin expansion reverses to a decline
    once a disclosed $640M one-off IEEPA tariff refund is backed out.
    Trailing-12-month free cash flow swung from +$18.2B to **-$7.6B** on
    64% higher capex; long-term debt nearly doubled to $128.9B in six
    months. Q3 guidance midpoint is *below* Q2 actuals, confirming a
    Prime Day timing shift flattered the quarter just reported.
  - **AMCR** (Amcor plc) — FY2026 ANNUAL (10-K, period end 2026-06-30,
    filed 2026-08-14, accession 0001748790-26-000022): https://financial-reports-web.vercel.app/reports/cmu73v8a3000104l7p17gums1
    Net sales +57% to $23.5B and net income +116% to $1,106M almost
    entirely reflect the Berry Global merger (+$7,864M of the $8,497M
    revenue increase) plus FX (+$649M) and cost pass-through (+$240M) —
    underlying sales actually fell ~2% on lower volumes in both segments.
    All of the profit improvement traces to ~$240M of realized Berry
    merger synergies (against a $530M target by June 2028); GAAP EPS
    +49% vs. adjusted EPS +13% reflects a depressed FY2025 base
    (transaction costs, inventory step-up), not underlying acceleration.
    Also flagged: 1-for-5 reverse stock split (Jan 2026), fiscal year end
    moving from June 30 to December 31 (creating a 6-month transition
    period), a LatAm segment recast, no buybacks in FY2026, and goodwill
    now exceeding shareholders' equity.
  - **AEE** (Ameren) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-08-03, accession 0001002910-26-000023): https://financial-reports-web.vercel.app/reports/cmu7456aq000204l79wn0lvco
    Revenue fell 5.8% while diluted EPS rose 11.9% to $1.13 — the gap is
    a MISO capacity-auction price collapse ($720/MW-day to $70/MW-day)
    that passes through to customers via the fuel adjustment clause,
    earnings-neutral. The load-bearing finding: reaffirmed full-year
    guidance of $5.25-$5.45 (midpoint identical to FY2025's $5.35 actual)
    arithmetically implies second-half 2026 EPS 7-13% *below* second-half
    2025, given H1 2026 already running 33 cents ahead of H1 2025 — driven
    by a fall Callaway nuclear refueling outage, forward-sale share
    settlement, and normal-weather assumption. Also flagged: 44% of the
    quarter's net income increase came from equity-method gains on
    non-regulated investments, not the regulated utility segments.
  - **AEP** (American Electric Power) — Q2 2026 (10-Q, period end
    2026-06-30, filed 2026-07-30, accession 0000004904-26-000059): https://financial-reports-web.vercel.app/reports/cmu74erbh000304l7l5avtkj4
    GAAP diluted EPS fell 41.8% to $1.30 while operating (non-GAAP) EPS
    fell only 3.1% to $1.36 — the entire gap is a June 2025 FERC order
    worth $480M to the year-ago quarter (mostly a one-time transmission
    revenue/excess-ADIT item), not a 2026 deterioration; backing it out,
    underlying revenue growth was ~13% versus the reported 7.0%.
    Data-center-driven load growth is real and already in the numbers:
    combined retail volumes +8.2%, commercial +14.9-17.4% and industrial
    +15.0%, achieved despite milder weather; AEP Texas collected ~$2B in
    financial security in July against 40 GW of contracted ERCOT load.
    Funding strain flagged: a ~$3.2B six-month cash shortfall funded with
    new debt (debt-to-cap up to 61.4%) and ~$5.0B of unsettled forward
    equity (8% of shares outstanding), while allowed ROEs are settling
    below what AEP requested in recent rate cases (Ohio 9.84% vs. 10.9%
    asked).
  - **AXP** (American Express) — Q2 2026 (10-Q, period end 2026-06-30,
    filed 2026-07-24, accession 0000004962-26-000322): https://financial-reports-web.vercel.app/reports/cmu74m7au000404l77eqkwncr
    Revenue net of interest expense +10% to $19.64B on 9% billed-business
    growth (highest in three years, FX-adjusted) and EPS +11% to $4.53,
    but 62% of the $521M pretax income increase came from a $190M credit
    reserve *release* versus a $198M *build* a year ago — actual net
    write-offs rose 8% with the write-off rate flat at 2.0%.
    Pre-provision profit (revenue minus expenses) grew only 4% against
    10% revenue growth because Card Member services expense jumped 50%
    on the refreshed U.S. Platinum benefits, outstripping the entire
    increase in net card fees. Net card fee growth is price-led, not
    volume-led (fee per card +12%, new cards acquired actually down
    slightly). FY26 revenue guidance raised to 10% but EPS guidance held
    at $17.30-$17.90, explicitly to reinvest the beat.
  - **AIG** (American International Group) — Q2 2026 (10-Q, period end
    2026-06-30, filed 2026-08-07, accession 0000005272-26-000076): https://financial-reports-web.vercel.app/reports/cmu74veaf000004jp5k3giul5
    GAAP diluted EPS fell 10% to $1.78 (prior-year quarter had $464M of
    pre-tax Corebridge/equity marks vs. $173M this year) while adjusted
    EPS rose 10% to $2.00 even though adjusted after-tax income grew only
    2.4% — the gap is almost entirely a 7.7% lower share count. Combined
    ratio improved 0.3pts to 89.0%, but that rests on higher favorable
    prior-year reserve development; North America Commercial's
    accident-year ratio actually worsened and International Commercial's
    accident-year ratio deteriorated 2.3pts with cat losses tripling on
    Middle East conflict exposure. Corebridge fully exited (final stake
    sold May 2026); AIG added stakes in Convex (35%) and Onex (9.9%) in
    February 2026, which explains part of the quarter's NPW growth.
  - **AMT** (American Tower) — Q2 2026 (10-Q, period end 2026-06-30,
    filed 2026-07-28, accession 0001053507-26-000133): https://financial-reports-web.vercel.app/reports/cmu756pr1000504l77godudcu
    Net income more than doubled to $867.5M (diluted EPS $0.78→$1.86) on
    a $526M non-cash swing in euro-debt currency translation — larger
    than the entire increase in net income; AFFO, which strips FX out,
    grew only 3.8-4.2% to $2.71/share. Organic tenant billings growth
    halved to 1.7% from 4.7%: U.S. & Canada revenue fell 2.5% on DISH
    churn (Chapter 11 filed 2026-06-30) plus a $44.0M straight-line
    accounting reversal, and Latin America's headline +13.4% masks
    negative 2.4% organic growth once FX and lower revenue reserves are
    excluded. CoreSite data centers (+13.4%) and leverage falling to
    4.9x from 5.1x are the genuine bright spots; two-thirds of the raised
    FY2026 AFFO/share guidance is currency, not operations.
  - **AWK** (American Water Works) — Q2 2026 (10-Q, period end
    2026-06-30, filed 2026-07-29, accession 0001410636-26-000120): https://financial-reports-web.vercel.app/reports/cmu75h52m000604l75u8q5a1p
    Revenue +6.2% to $1,355M and diluted EPS +8.8% to $1.61, but only
    $52M of the $90M regulated-segment revenue increase came from
    authorized rate increases — the rest was volume/weather (a favorable
    comp against a poor Q2 2025). The consolidated result also lost the
    Homeowner Services seller-note interest income (repaid February
    2026), cutting interest income from $22M to $3M and masking 14.9%
    net income growth at the regulated utility itself. Regulators keep
    awarding ROEs below AWK's asks (Pennsylvania 9.55% vs. requested
    10.50-10.75% on a $6.6B rate base, West Virginia 9.80%, Maryland/
    Virginia 9.75%); a $958M half-year gap between operating cash flow
    and capex/acquisitions was plugged partly by the one-time note
    repayment and equity forward settlements, with ~2.4% of dilution
    still pending.
  - Skipped: none this batch.
- Tier worked: 0 (confirmed empty) then 1 (2026 S&P 500 backlog, file
  order — AMZN, AMCR, AEE, AEP, AXP, AIG, AMT, AWK).
- Running total after tonight: **77 companies done, 93 report-periods
  published** (69/85 after batch 1 + 8 in batch 2). This firing is
  stopping here for now with the operating window still open (~01:05 JST,
  4 hours of runway left); a later firing tonight can continue the S&P
  500 backlog from AMP onward (next in file order after AWK).

**Batch 3** (this session, invoked ~16:07 UTC / ~01:07 JST 2026-09-19 via
the automated scheduled-task mechanism):

- Network check: `curl https://www.sec.gov/` alone returned 403; checked
  `$HTTPS_PROXY/__agentproxy/status` (no recent relay failures, proxy
  healthy) and confirmed with the required `User-Agent` header the
  request returns 200 — SEC UA/rate-limit response, not a proxy/policy
  block. `npm install` again hit the `postinstall` `prisma generate`
  failure (missing `DATABASE_URL`) — harmless, publishing needs no DB
  credentials; left node_modules as installed by npm despite the
  postinstall failure (418 packages present, tsx/Playwright work fine).
  Repo was in a detached-HEAD state at session start (matching
  origin/master exactly) — reset local `master` to track `origin/master`
  rather than investigate further, no data at risk.
- Ran `scan-recent-filings`: 0 fresh tier-0 candidates (7-day window,
  09-12 through 09-18). Moved to tier 1 backlog, file order, from AMP
  (next ticker after AWK in `sp500.json`).
- Published: **5 report-periods across 5 companies** — AMP Q2 2026, AME
  Q2 2026, AMGN Q2 2026, APH Q2 2026, ADI Q3 2026 (ADI runs an offset
  fiscal year ending late October; its Q3 FY2026 10-Q, period end
  2026-08-01, is the latest filed period — confirmed from EDGAR/XBRL,
  not assumed):
  - **AMP** (Ameriprise Financial) — Q2 2026 (10-Q, period end
    2026-06-30, filed 2026-08-04, accession 0000820027-26-000043): https://financial-reports-web.vercel.app/reports/cmu75suds000004l5ffq2xevh
    Adjusted operating EPS +22% to $11.07 on 13% revenue growth, but the
    gain leans on a 27% rise in the average Weighted Equity Index and a
    6% smaller diluted share count from buybacks while both
    asset-gathering segments saw negative organic flows (Asset
    Management -$6.5bn; Advice & Wealth Management total client flows
    down to $3.1bn from $4.3bn on Comerica-related advisor departures).
    GAAP net income ($1,113M) exceeded adjusted ($1,028M) — the inverse
    of a year ago — because of a $106M hedging/market-risk-benefit mark;
    AWM margin held flat at 28.9% (down 110bps sequentially on falling
    net investment income); Asset Management's 370bp margin gain is
    partly Seligman performance-fee-linked; RPS earnings fell 6% despite
    20% sales growth; only ~1 quarter of runway left on the buyback
    authorization at the current pace.
  - **AME** (Ametek) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-08-04, accession 0001037868-26-000175): https://financial-reports-web.vercel.app/reports/cmu7600p2000104l56o24jgum
    Record Q2 sales of $2,044.4M (+15.0%: 10 points organic, 5 points
    acquired), GAAP EPS $1.77 and adjusted EPS $2.09 (+17.4%). The two
    segments diverged: EMG's margin rose 290bps on 15% organic volume
    growth, while EIG's GAAP margin fell 170bps purely on FARO/LKC
    integration costs (110bps) and acquisition dilution (120bps) — EIG's
    core margin was actually up 60bps. Orders (+28.2%: organic +25%,
    acquired +6%, FX -3%) far outpaced the 10% organic sales growth, a
    1.12 book-to-bill and record $4,110.2M backlog, yet guidance implies
    only ~7% second-half sales growth against that backlog. A one-time
    $10.0M Indicor bridge-loan fee inflated interest expense 78.6%, and
    roughly 3.5 cents of the 22-cent EPS gain came from the tax rate
    falling to 17.4% from 19.0% rather than operations. The pending
    $5.0B all-cash Indicor Instrumentation acquisition (~4.5x sales)
    takes debt-to-capital from 15.3% to roughly 38%.
  - **AMGN** (Amgen) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-08-05, accession 0000318154-26-000126): https://financial-reports-web.vercel.app/reports/cmu7677tl000204l5nog9ado6
    Revenue +10% to $10,054M, but GAAP EPS's 65% jump ($2.65→$4.37) is
    largely non-operating — $523M of the $858M operating-income increase
    is Horizon-acquisition amortization rolling off, plus a prior-year
    $394M BeOne equity mark; non-GAAP EPS rose just 4% to $6.29 and
    non-GAAP cost of sales worsened 1.9pp on profit-share/mix. Portfolio
    is two-directional: Prolia -32%/XGEVA -34% (denosumab patent
    expiry, "accelerated erosion" guided), ENBREL's -22% net price
    (IRA Part D price-setting) masked by a sales-deduction true-up, vs.
    Repatha +37%, EVENITY +38%, TEZSPIRE +42%, UPLIZNA +90%, IMDELLTRA
    +115%, PAVBLU +121%. Raised guidance ($38.2-39.4B revenue) implies
    H2 revenue growth of only ~4% vs. +8% in H1. Flagged: MariTide's
    nine Phase 3 studies, the $3.6B/$5.1B+~$2.0B-penalty IRS Puerto Rico
    dispute (Tax Court decision expected late 2026-early 2027), FDA's
    request to withdraw TAVNEOS, and a partial clinical hold on
    subcutaneous blinatumomab.
  - **APH** (Amphenol) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-07-31, accession 0001104659-26-089194): https://financial-reports-web.vercel.app/reports/cmu76h46g000704l7hqd7g1st
    Net sales +55% reported to $8,758.1M but only +30% organic (+24pts
    from acquisitions, mainly CommScope's connectivity/broadband
    business closed Jan 9, 2026 — $2,100.9M of sales, ~14% of the
    quarter, and $190.2M of net income since close); GAAP diluted EPS
    $1.37 vs $0.86, adjusted $1.35 vs $0.81, operating margin +4.4pts to
    29.5%. AI/IT-datacom demand drove organic growth unevenly by
    segment: Communications Solutions +85% reported/+42% organic, Harsh
    Environment +28%/+22%, Interconnect & Sensor Systems +17%/+13%. An
    $80.0M non-recurring IEEPA tariff recovery added $0.04/share, and a
    China tax dispute ($230M paid in Q2 plus a $160M reassessment)
    pushed the H1 GAAP effective rate to 32.4% and the adjusted rate to
    27.0% from 24.5% going forward; GAAP EPS exceeded adjusted EPS on
    $80.5M of stock-option tax benefits. Q3 guidance ($9.3-9.4B sales,
    $1.40-1.42 adjusted EPS) excludes further tariff recoveries; the
    CommScope contribution outlook was raised to $4.6B sales/$0.30
    accretion from $4.1B/$0.15; book-to-bill 1.23:1.
    (First publish attempt this ticker hit a transient "page couldn't
    load" browser error — not a data/validation issue — a bare retry
    with the same JSON succeeded immediately.)
  - **ADI** (Analog Devices) — fiscal Q3 2026 (10-Q, period end
    2026-08-01, filed 2026-08-19, accession 0000006281-26-000073): https://financial-reports-web.vercel.app/reports/cmu76n5oc000004kwkjko4jzx
    Record revenue $4,021.9M (+40%), led by Communications +84% (MD&A
    attributes this explicitly to data-center/AI-infrastructure
    investment) and Industrial +53%, while Automotive (+16%) and
    Consumer (+6%) lagged and lost revenue share. Gross margin +520bps
    on fab utilization, achieved on only $392.7M of nine-month capex
    (~3.6% of revenue, below management's own 4-6% guide). GAAP EPS's
    163% jump is mostly a comp artifact: the prior-year quarter carried
    a one-off $153.8M OBBBA-related deferred tax charge (~60pts of the
    growth rate), and GAAP still trails adjusted EPS by $0.71 on
    acquisition-intangible amortization. Inventory days flat at 131 but
    WIP-heavy; receivables +66% with DSO 44→50. Closed the $1.5B Empower
    Semiconductor acquisition (integrated voltage regulators, an AI
    power-delivery bottleneck) July 7; capital returns exceeded free
    cash flow, partly funded with commercial paper. Q4 guidance $4.3B
    ±$100M / adjusted EPS $3.86 implies a full FY2026 of ~$15.1B against
    the prior $12.31B (FY2023) peak.
- Skipped: none this batch.
- Tier worked: 0 (confirmed empty) then 1 (2026 S&P 500 backlog, file
  order — AMP, AME, AMGN, APH, ADI).
- Running total after tonight: **82 companies done, 98 report-periods
  published** (77/93 before tonight + 5 in batch 3). This firing is
  stopping here for now with the operating window still open (~01:40
  JST, over 3 hours of runway left); a later firing tonight can continue
  the S&P 500 backlog from AON onward (next in file order after ADI:
  AON, APA, APO, AMAT, APP, APTV, ACGL, ADM, ARES, ANET, ...).

### 2026-09-19 night (23:00 JST 2026-09-19 → 05:00 JST 2026-09-20)

- Batch 1 (~23:25 JST): **1 report-period published, 1 company.**
- Tier worked: **0** (fresh EDGAR filings — from
  `scripts/data/recent-filings-candidates.json`, S&P 500 entry, filed
  2026-09-18).
- Published:
  - **KR** (Kroger) — **Q2 FY2026** (10-Q, period end 2026-08-15, filed
    2026-09-18, accession 0001104659-26-108926): https://financial-reports-web.vercel.app/reports/cmu8hbgby000004l5bdxg6m1j
    Note the fiscal-calendar trap: Kroger's FY2025 ended 2026-01-31, so
    the quarter ended 2026-08-15 is Q2 of **fiscal 2026**, not a 2025
    period. Total sales +2.0% to $34,621M, but the entire increase is
    fuel — supermarket fuel sales +25.6% to $4,105M on a 25.3% higher
    average retail fuel price, while sales to retail customers excluding
    fuel fell 0.5% to $30,189M. Identical sales ex-fuel +0.2% vs +3.4%
    a year ago, with the MD&A quantifying ~264bps of drag (Inflation
    Reduction Act −138bps, brand→generic Rx shift −61bps, Cyclospora
    outbreak ~−35bps, egg deflation −30bps) and conceding "increased
    spend per item, partially offset by a reduction in the number of
    units sold." Reported operating profit +12.5% to $971M and GAAP EPS
    +15.4% to $1.05, but adjusted FIFO operating profit *fell* 1.4% to
    $1,076M and adjusted net earnings fell 4.0% — the reported gain is a
    prior-year comp artifact ($129M after-tax of Q2 FY2025 merger-
    litigation/severance charges vs $52M this year), a lower LIFO charge
    ($39M vs $62M), 16bps of D&A relief from the Q4 FY2025 fulfillment-
    network closures, and an 8.6% smaller diluted share count (608M vs
    665M; $1.0B repurchased in the quarter). Underlying: FIFO gross
    margin ex-fuel +13bps against OG&A ex-fuel +33bps. Guidance was
    **cut on sales and held on profit** — identical sales ex-fuel
    1.0–2.0% → 0.2–0.8%, while adjusted FIFO operating profit
    ($5.0–5.2B), adjusted EPS ($5.10–5.30), FCF and capex were all
    reaffirmed. Also covered: the ~$1.65B Giant Eagle acquisition
    announced 2026-07-01 (expected to close FY2027), leverage rising to
    1.91x from 1.63x despite total debt falling $569M, and the
    2026-10-20 investor update where longer-term targets land.
- Skips: none this batch.
- Post-publish sanity check: `/reports/cmu8hbgby000004l5bdxg6m1j`
  re-fetched cache-busted; full content present through the closing
  paragraph, no truncation, no stale-CDN issue this time.
- Running total after this batch: **83 companies done, 99 report-periods
  published** (82/98 before this batch + 1).

- Batch 2 (~23:45 JST): **1 report-period published, 1 company.**
- Tier worked: **0** (fresh EDGAR filings — us-listed catch-all entry,
  filed 2026-09-18).
- Published:
  - **BLSM** (BlossomHill Therapeutics, Inc.) — **Q2 2026** (10-Q, period
    end 2026-06-30, filed 2026-09-18, accession
    0001193125-26-395043): https://financial-reports-web.vercel.app/reports/cmu8hhj87000004jn1otxfb9v
    Clinical-stage oncology biotech, pre-revenue; first 10-Q as a public
    company, covering a quarter that predates its 2026-08-10 IPO. R&D
    +70% YoY to $21.4M (external BH-30643 clinical/manufacturing spend
    $9.0M of that, up from $3.8M), net loss +79% to $23.8M. Cash fell
    $136.7M → $95.4M over H1 (H1 operating burn $44.2M, +120% YoY),
    ~13 months of runway on balance-sheet cash alone — extended by the
    $151.7M net IPO proceeds to management's stated "into the second
    quarter of 2028." Flagged: reported EPS $(8.75) divides by pre-IPO
    weighted-average shares only (excludes 18.26M preferred converted at
    IPO) — against the 31.78M shares outstanding on the 10-Q cover page,
    the same loss is closer to $(0.75)/share. Management's Q2 2028
    runway guidance implies burn accelerating ~40% above the H1 pace
    (pivotal Phase 2 first dose expected Q1 2027, ahead of that
    runway's end), so another raise is likely before pivotal data reads
    out. Milestones: Q4 2026 end-of-Phase-1 FDA meeting, Q1 2027 pivotal
    Phase 2 start + BH-501284 IND, H1 2027 durability data.
- Skips: none this batch.
- Post-publish sanity check: `/reports/cmu8hhj87000004jn1otxfb9v`
  re-fetched cache-busted; full content present, Takeaway callout intact,
  no truncation.
- Running total after this batch: **84 companies done, 100 report-periods
  published** (83/99 before this batch + 1).

- Batch 3 (~00:10 JST): **1 report-period published, 1 company.**
- Tier worked: **0** (fresh EDGAR filings — us-listed catch-all entry,
  10-Q/A filed 2026-09-18).
- Published:
  - **GRDX** (GridAI Technologies Corp.) — **Q2 2026** (10-Q/A filed
    2026-09-18, accession 0001104659-26-108635; original 10-Q filed
    2026-08-21, accession 0001104659-26-099751, period end
    2026-06-30): https://financial-reports-web.vercel.app/reports/cmu8hp94l000004l9z8b3f655
    The amendment was diffed against the original and confirmed
    non-financial: an SEC-comment-driven rewrite of the goodwill
    disclosure in Notes 3/7 (withdrawing the original's "expected
    synergies" rationale in favor of "continues to operate as a
    separate business," plus newly quantified impairment-test inputs)
    and expanded Critical Accounting Policies — no reported figures
    changed. Analyzed the unchanged Q2 numbers as authoritative. Net
    loss $13.04M (vs $998K a year earlier), including a $10.07M
    non-cash goodwill impairment — 45% of the goodwill from the Grid AI
    Corp. acquisition (closed 2025-09-30) written off within three
    quarters, attributed to delays in commercialization and customer
    contracts. Revenue just $85,876 against $122,390 of cost of
    services (gross margin −42.5%); goodwill + acquired intangibles are
    93.8% of total assets; ~$11.8M working-capital deficit; management
    states going-concern doubt is not alleviated. Also flagged, via the
    2026-09-11 8-K: after an ~$8.5M July capital raise, the company
    lent ~$2.96M to Pronghorn Resources, an unrelated party in which one
    of its own shareholders holds an interest.
- Skips: none this batch.
- Post-publish sanity check: `/reports/cmu8hp94l000004l9z8b3f655`
  re-fetched cache-busted; full content present through the closing
  metrics table, no truncation.
- Running total after this batch: **85 companies done, 101 report-periods
  published** (84/100 before this batch + 1).

- Batch 4 (~00:35 JST): **1 report-period published, 1 company.**
- Tier worked: **0** (fresh EDGAR filings — us-listed catch-all entry,
  10-K filed 2026-09-18).
- Published:
  - **MGLD** (The Marygold Companies, Inc.) — **FY2026 ANNUAL** (10-K,
    fiscal year ended 2026-06-30, filed 2026-09-18, accession
    0001493152-26-043341): https://financial-reports-web.vercel.app/reports/cmu8hvovx000004jwx3uzcdhf
    June-30 fiscal year end confirmed from the EDGAR company record and
    the filing's own cover page. Revenue from continuing operations
    +8% to $25.3M, net loss narrowed 25% to $4.4M ($0.10/share vs
    $0.14) — both headlines undersell a much better underlying year:
    USCF Investments' average AUM +41% to $4.1B on commodity moves was
    masked by a $2.5M USO oil-futures trading-error reimbursement
    booked as a *revenue reduction* (ex that, fund-management revenue
    would have been +38% not +23%, segment operating income +65% not
    -11%) and by the July 2025 sale of the Brigadier security segment
    (to related party/director Scott Schoenberger) out of the base.
    $3.6M of impairments (UK financial-services goodwill/intangibles
    $2.7M, private-bank stake $0.9M) also hit the year; goodwill and
    intangibles are now carried at zero. The profitable New Zealand
    Food Products segment was reclassified to discontinued operations
    2026-03-31 pending sale. Flagged: $19.5M cumulative fintech
    investment since 2019 against only $19.2M total stockholders'
    equity, with both the US and UK consumer apps now paused.
- Skips: none this batch.
- Post-publish sanity check: `/reports/cmu8hvovx000004jwx3uzcdhf`
  re-fetched cache-busted; full content present (three tables, Takeaway
  callout, closing source footnote), no truncation.
- Running total after this batch: **86 companies done, 102 report-periods
  published** (85/101 before this batch + 1).

- Batch 5 (~01:00 JST): **1 report-period published, 1 company.**
- Tier worked: **0** (fresh EDGAR filings — us-listed catch-all entry,
  10-K filed 2026-09-18).
- Published:
  - **NEUP** (Neuphoria Therapeutics Inc.) — **FY2026 ANNUAL** (10-K,
    fiscal year ended 2026-06-30, filed 2026-09-18, accession
    0001193125-26-395536): https://financial-reports-web.vercel.app/reports/cmu8i2tmh000104jwi3tvdafs
    Clinical-stage biotech. Phase 3 AFFIRM-1 (BNC210, social anxiety
    disorder) missed its primary endpoint on 2025-10-20; the company
    then terminated its leases and nearly all staff (down to 1 FTE)
    and put its PTSD program on hold. Revenue -92.5% to $1.17M (FY2025
    included a one-off $15.0M Merck milestone); net loss widened from
    $0.37M to $13.45M, mostly a $5.36M non-cash goodwill impairment
    after Merck ended the MK-1167 Alzheimer's Phase 2 for futility,
    plus $1.28M restructuring — underlying R&D+G&A spend actually fell
    34.5%. Cash rose to $19.87M purely via ATM share sales (share count
    +173.5%). On 2026-07-23 agreed to be acquired by Scancell Holdings
    plc at ~$4.55/share (~$24.6M), below the average ATM sale price and
    below Lynx1's earlier withdrawn/revised cash indications; holders
    get ~11.1% of the combined company plus one non-transferable CVR.
    Flagged in the tracker: the merger is targeted to close in late
    2026, so NEUP may stop filing as a standalone registrant before its
    next quarterly would otherwise be due.
- Skips: none this batch.
- Post-publish sanity check: `/reports/cmu8i2tmh000104jwi3tvdafs`
  re-fetched cache-busted; metrics table, Takeaway callout and closing
  source line all present, no truncation.
- Running total after this batch: **87 companies done, 103 report-periods
  published** (86/102 before this batch + 1).

- Batch 6 (~01:25 JST): **1 report-period published, 1 company.**
- Tier worked: **0** (fresh EDGAR filings — us-listed catch-all entry,
  10-K filed 2026-09-18). **This clears tonight's entire tier-0 queue**
  (all 6 candidates from `recent-filings-candidates.json` now done:
  KR, BLSM, GRDX, MGLD, NEUP, NTNX).
- Published:
  - **NTNX** (Nutanix, Inc. - Class A) — **FY2026 ANNUAL** (10-K, fiscal
    year ended 2026-07-31, filed 2026-09-18, accession
    0001193125-26-394793; also drew on the 2026-08-26 earnings-release
    8-K Ex. 99.1, accession 0001171843-26-005752, for non-GAAP
    reconciliations and FY2027 guidance): https://financial-reports-web.vercel.app/reports/cmu8ia50r000204jwvvmuk8u2
    Revenue +12% to $2,853.5M, non-GAAP operating margin +260bps to
    23.7%. GAAP net income's 8x jump to $1,506.8M ($5.17 diluted EPS)
    is almost entirely a $1,208.2M non-cash release of the US
    deferred-tax valuation allowance — pre-tax income only rose
    $211.6M→$327.1M, and GAAP EPS now *exceeds* non-GAAP EPS ($5.17 vs
    $2.04), the reverse of the usual direction, which the report flags
    explicitly. FY2027 guidance ($3.180–3.230B revenue, 24–25%
    non-GAAP op margin, $850–950M FCF) implies no growth acceleration
    despite the VMware/Broadcom displacement opportunity. An August
    2026 5%-headcount cut booked $27.6M of severance with zero cash
    paid, flattering FY2026's reported $840.7M FCF. ARR +16% and RPO
    +28% both ran ahead of revenue growth; gross margin flat at 86.8%
    (product-GM gain offset by services mix). Capital allocation:
    repurchased 9.4M shares at an average $51.24 while separately
    selling 4.14M shares to AMD at $36.26 in a May 2026 private
    placement; stockholders' equity flipped from a $694.5M deficit to
    $702.6M positive.
- Skips: none this batch.
- Post-publish sanity check: `/reports/cmu8ia50r000204jwvvmuk8u2`
  re-fetched cache-busted; both tables and the Takeaway callout render,
  content ends cleanly, no truncation.
- Running total after this batch: **88 companies done, 104 report-periods
  published** (87/103 before this batch + 1).
- Tonight's totals so far (6 batches): **6 report-periods published, 6
  companies** (KR, BLSM, GRDX, MGLD, NEUP, NTNX), all tier 0. Tier-0
  queue for tonight is now fully cleared; a later firing tonight would
  fall through to the tier-1 S&P 500 backlog (next in file order after
  ADI per the 09-18 night entry: AON, APA, APO, AMAT, APP, APTV, ACGL,
  ADM, ARES, ANET, ...) unless a re-run of `scan-recent-filings` turns up
  new tier-0 candidates first.

- Batch 7 (~00:20-00:40 JST 09-20): **1 report-period published, 1
  company.**
- Tier worked: **1** (S&P 500 backlog, file order). Re-ran
  `scan-recent-filings` first — 0 new tier-0 candidates (last 7 days
  already fully covered by tonight's earlier batches), so fell through
  to tier 1 per CLAUDE.md's "Deciding what to work on this run". Next in
  file order after ADI: AON, APA, APO, AMAT, APP, ... — started with AON.
- Published:
  - **AON** (Aon plc) — **Q2 2026** (10-Q, period ended 2026-06-30, filed
    2026-07-29, accession 0001628280-26-050610; also drew on the
    2026-07-29 earnings-release 8-K Ex. 99.1, accession
    0001628280-26-050367, for adjusted-metric reconciliations):
    https://financial-reports-web.vercel.app/reports/cmu8jebm3000004jqfainbc4y
    Revenue +2% to $4,246M (5% organic growth, 1% FX tailwind, 4%
    divestiture drag from the NFP Wealth and Stroz Friedberg
    divestitures); operating margin +80bps to 21.5%, adjusted operating
    margin +70bps to 28.9%; GAAP diluted EPS -3% to $2.58 vs adjusted EPS
    +9% to $3.81 — the GAAP decline is an artifact of a non-repeating
    $88M prior-year Blackstone deferred-consideration gain plus the
    effective tax rate jumping 650bps (15.5%→22.0%), not underlying
    deterioration. All four solution lines grew 5% organically despite a
    reinsurance-pricing headwind; fiduciary investment income fell
    $66M→$58M, the one genuine soft spot since it sits outside the
    organic-growth figure Aon leads with. H1 free cash flow +4% to
    $846M; $775M returned to shareholders; Accelerating Aon United
    restructuring program now $1.3B cumulative spend against $25M net
    quarterly savings so far.
- Skips: none this batch.
- Post-publish sanity check: `/reports/cmu8jebm3000004jqfainbc4y`
  re-fetched cache-busted; Takeaway callout, metrics table and
  restructuring detail all present, no truncation.
- Running total after this batch: **89 companies done, 105 report-periods
  published** (88/104 before this batch + 1).
- Tonight's totals so far (7 batches): **7 report-periods published, 7
  companies** (KR, BLSM, GRDX, MGLD, NEUP, NTNX, AON). Next in file
  order for the next batch: APA, APO, AMAT, APP, APTV, ACGL, ADM, ARES,
  ANET, ...

- Batch 8 (~00:40-01:00 JST 09-20): **1 report-period published, 1
  company.**
- Tier worked: **1** (S&P 500 backlog, file order, next after AON).
- Published:
  - **APA** (APA Corporation) — **Q2 2026** (10-Q, period ended
    2026-06-30, filed 2026-08-06, accession 0001841666-26-000053; also
    drew on the 2026-08-05 earnings-release 8-K Ex. 99.1, accession
    0001841666-26-000050): https://financial-reports-web.vercel.app/reports/cmu8jloyl000004jts5e8vtpk
    Net income $747M / $2.11 diluted EPS (+26% YoY), but adjusted EPS
    $1.89 vs $0.87 (+117%) once last year's $282M divestiture gain and
    both years' unrealized derivative marks are stripped out. Revenue
    +9% to $2,373M despite production falling 12% to 409,959 boe/d —
    almost entirely realized oil price (+50% to $98.24/bbl) and a
    Permian natural-gas anomaly where realized US gas flipped from
    +$1.03/Mcf to -$2.98/Mcf, turning "purchased oil and gas costs" from
    a $304M cost into $122M of net proceeds, a $426M swing. Hedges cost
    $109M in cash. FCF $738M vs $134M; total debt down to $3,743M from
    $4,493M at 2025 year-end. Flagged the durable story as flat US oil
    output on ~20% less capital plus $2.3B of debt retirement since
    2024, not the headline EPS jump, which is mostly non-repeatable.
- Skips: none this batch.
- Post-publish sanity check: `/reports/cmu8jloyl000004jts5e8vtpk`
  re-fetched cache-busted; Takeaway callout, metrics table and the
  realized-price/boe-d detail all present, no truncation.
- Running total after this batch: **90 companies done, 106 report-periods
  published** (89/105 before this batch + 1).
- Tonight's totals so far (8 batches): **8 report-periods published, 8
  companies** (KR, BLSM, GRDX, MGLD, NEUP, NTNX, AON, APA). Next in file
  order: APO, AMAT, APP, APTV, ACGL, ADM, ARES, ANET, ...

- Batch 9 (~01:00-01:20 JST 09-20): **1 report-period published, 1
  company.**
- Tier worked: **1** (S&P 500 backlog, file order, next after APA).
- Published:
  - **APO** (Apollo Global Management) — **Q2 2026** (10-Q, period ended
    2026-06-30, filed 2026-08-10, accession 0001858681-26-000040; also
    drew on the 2026-08-04 earnings-release 8-K Ex. 99.1, accession
    0001858681-26-000036): https://financial-reports-web.vercel.app/reports/cmu8jrp1t000004if333fn1zz
    GAAP revenue +63.7% to $11,153M and net income to common +120.8% to
    $1,336M ($2.15 diluted EPS) is mostly a $2.1B mark-up on
    indexed-annuity hedging derivatives (S&P 500 +14.9% in the quarter),
    largely offset elsewhere by a $2.3B rise in interest-sensitive
    contract benefits, plus a one-off $673M gain on the early call of AP
    Grange. The cleaner operating measure, Segment Income, rose a more
    modest 12.2% to $1,678M — FRE +25.2% to $785M (margin 58.5%) but
    ~76% of the fee-revenue growth traces to the Bridge and
    Athora/PIC acquisitions, not organic fundraising; net flows halved
    to $25.2B as redemptions and realizations both roughly doubled.
    Athene's SRE +6.8% to $877M despite investment spread compressing
    11bps to 1.47% — growing because the balance sheet is bigger, not
    because each dollar earns more. Six-month net LOSS of $(594)M /
    $(1.06) EPS is a Q1 non-cash $1.7B valuation allowance against
    Bermuda deferred tax assets following the OECD's Pillar Two
    guidance (6-month effective tax rate 75.5%) — flagged as a one-off,
    not an operating deterioration.
- Skips: none this batch.
- Post-publish sanity check: `/reports/cmu8jrp1t000004if333fn1zz`
  re-fetched cache-busted; Takeaway callout, metrics table and
  "What to watch" section all present, no truncation.
- Running total after this batch: **91 companies done, 107 report-periods
  published** (90/106 before this batch + 1).
- Tonight's totals so far (9 batches): **9 report-periods published, 9
  companies** (KR, BLSM, GRDX, MGLD, NEUP, NTNX, AON, APA, APO). Next in
  file order: AMAT, APP, APTV, ACGL, ADM, ARES, ANET, ...

- Batch 10 (~01:20-01:45 JST 09-20): **1 report-period published, 1
  company.**
- Tier worked: **1** (S&P 500 backlog, file order, next after APO).
- Published:
  - **AMAT** (Applied Materials) — **fiscal Q3 2026** (13 weeks ended
    2026-07-26; AMAT's fiscal year is non-calendar, ending the last
    Sunday of October — labeled year=2026/period=Q3 here since the
    period-end date and the company's own cover-page label both agree;
    report includes an explicit fiscal-calendar note for readers) (10-Q
    filed 2026-08-20, accession 0001628280-26-058235; also drew on the
    2026-08-13 earnings-release 8-K Ex. 99.1, accession
    0001628280-26-056699, and the FY2025 10-K, accession
    0001628280-25-056742, for the prior-year comparison base):
    https://financial-reports-web.vercel.app/reports/cmu8jz5it000004l58h2epjhi
    Revenue +24.8% to $9,115M, operating income +37.7% to $3,075M, GAAP
    EPS +43% to $3.17 — but the EPS jump is mostly a ~$580M favorable
    swing in unrealized marks on listed-equity stakes plus an 18-point
    tax-rate drop from a prior-year one-off CAMT valuation-allowance
    charge, not operating improvement of that scale (operating income
    still grew a real 38% on 25% revenue growth, the more meaningful
    figure). China revenue fell 2% to $2,506M, dropping from 35% to 28%
    of total revenue even as total revenue grew — the growth came from
    the US (more than doubled to $1,367M) and Europe (+202%). Q4 FY2026
    guidance: $10.25B revenue ±$500M, non-GAAP EPS $4.02 ±$0.20.
    Flagged the $253M BIS export-controls settlement paid this fiscal
    year, receivables growing 48% against 11% nine-month revenue growth,
    and a 71% cut to buybacks in favor of capex.
- Skips: none this batch.
- Post-publish sanity check: `/reports/cmu8jz5it000004l58h2epjhi`
  re-fetched cache-busted; Takeaway callout, fiscal-calendar note and
  China/segment detail all present, no truncation.
- Running total after this batch: **92 companies done, 108 report-periods
  published** (91/107 before this batch + 1).
- Tonight's totals so far (10 batches): **10 report-periods published,
  10 companies** (KR, BLSM, GRDX, MGLD, NEUP, NTNX, AON, APA, APO,
  AMAT). Next in file order: APP, APTV, ACGL, ADM, ARES, ANET, ...

- Batch 11 (~01:45-02:10 JST 09-20): **1 report-period published, 1
  company.**
- Tier worked: **1** (S&P 500 backlog, file order, next after AMAT).
- Published:
  - **APP** (AppLovin) — **Q2 2026** (10-Q, period ended 2026-06-30,
    filed 2026-08-05, accession 0001751008-26-000059; also drew on the
    2026-08-05 earnings-release 8-K Ex. 99.1, accession
    0001751008-26-000057): https://financial-reports-web.vercel.app/reports/cmu8k4yoo000104ifaf29bbjt
    Revenue +52.8% to $1,923.7M, operating margin +1.6pp to 77.7%, net
    income from continuing operations +64.1% to $1,266.5M ($3.76
    diluted EPS) — growth is genuinely like-for-like (the 2025-06-30
    Apps-business divestiture means prior-year figures were already
    restated to exclude it) but is entirely a pricing story on a
    shrinking base: installs fell 2% while revenue per install rose
    58%. Headline net income growth actually understates the operating
    improvement, since Q2 2025 included $47.7M of discontinued-ops
    income (a $106.2M divestiture gain net of costs, against a $125.6M
    deferred-tax write-off) that isn't repeated this year. Q3 2026
    guidance ($2.055-2.085B revenue, $1.710-1.740B Adjusted EBITDA,
    ~83% margin) implies orderly deceleration from 53% growth toward
    ~47%, with guided margin below what was just delivered. R&D +127%
    is almost entirely stock compensation, widening the GAAP-vs-
    Adjusted-EBITDA gap; effective tax rate rose to 15.9% from 12.7%.
- Skips: none this batch.
- Post-publish sanity check: `/reports/cmu8k4yoo000104ifaf29bbjt`
  re-fetched cache-busted; Takeaway callout, metrics table and guidance
  section all present, no truncation.
- Running total after this batch: **93 companies done, 109 report-periods
  published** (92/108 before this batch + 1).
- Tonight's totals so far (11 batches): **11 report-periods published,
  11 companies** (KR, BLSM, GRDX, MGLD, NEUP, NTNX, AON, APA, APO, AMAT,
  APP). Next in file order: APTV, ACGL, ADM, ARES, ANET, ...
