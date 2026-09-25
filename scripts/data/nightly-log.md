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

- Batch 12 (~02:10-02:35 JST 09-20): **1 report-period published, 1
  company.**
- Tier worked: **1** (S&P 500 backlog, file order, next after APP).
- Published:
  - **APTV** (Aptiv PLC) — **Q2 2026** (10-Q, period ended 2026-06-30,
    filed 2026-08-04, accession 0001521332-26-000061; also drew on the
    2026-08-04 earnings-release 8-K Ex. 99.1, accession
    0001521332-26-000057): https://financial-reports-web.vercel.app/reports/cmu8kbr0v000104jtznphwbgz
    Aptiv spun off its Electrical Distribution Systems segment as
    Versigent PLC (NYSE: VGNT) on 2026-04-01 (1 VGNT share per 3 APTV
    shares); EDS is now discontinued operations with prior periods
    restated, and the two remaining segments were renamed (Advanced
    Safety & User Experience → Intelligent Systems; Engineered
    Components Group → Engineered Components) — flagged explicitly
    since reported net income fell 37% purely from the disc-ops line
    while continuing operations actually grew 12.5%. Revenue +2.3% to
    $3,274M, operating income +12.9% to $367M (margin +105bps),
    continuing EPS $1.40 vs $1.21. But quality was weak: the filing's
    own bridge shows $38M of the $44M gross-margin gain came from
    currency, not operations; H1 volume-net-of-price was negative $12M
    against +$115M FX, meaning all H1 growth was exchange-rate driven;
    and Intelligent Systems' GAAP operating income actually fell to
    $100M from $116M, rescued at the adjusted level by a $35M peso
    tailwind and $15M of SG&A cuts. Free cash flow -94.5% to $12M in
    Q2, YTD FCF -$196M against $625-725M full-year guidance, implying
    H2 must generate $821-921M.
- Skips: none this batch.
- Post-publish sanity check: `/reports/cmu8kbr0v000104jtznphwbgz`
  re-fetched cache-busted; Takeaway callout, Versigent spin-off note and
  free-cash-flow detail all present, no truncation.
- Running total after this batch: **94 companies done, 110 report-periods
  published** (93/109 before this batch + 1).
- Tonight's totals so far (12 batches): **12 report-periods published,
  12 companies** (KR, BLSM, GRDX, MGLD, NEUP, NTNX, AON, APA, APO, AMAT,
  APP, APTV). Next in file order: ACGL, ADM, ARES, ANET, ...

- Batch 13 (~02:35-03:10 JST 09-20): **1 report-period published, 1
  company.** Research subagent hit SEC's ~10-minute per-IP rate block
  mid-download (from the volume of SEC requests across 6 prior batches
  tonight) and had to retry — its own monitors caught it, no manual
  intervention needed, just ran longer than usual (~6.5 min).
- Tier worked: **1** (S&P 500 backlog, file order, next after APTV).
- Published:
  - **ACGL** (Arch Capital Group) — **Q2 2026** (10-Q, period ended
    2026-06-30, filed 2026-08-04, accession 0000947484-26-000124; also
    drew on the 2026-07-28 earnings-release 8-K Ex. 99.1, accession
    0000947484-26-000118): https://financial-reports-web.vercel.app/reports/cmu8kkw7a000204if35b87wio
    Underwriting income -19.7% to $657M, combined ratio worsened to
    83.5% from 81.2% (82.5% vs 80.9% ex-catastrophe/ex-prior-year); net
    premiums earned -8.1% to $3,985M; net income to common -14.7% to
    $1,047M, diluted EPS $3.00 vs $3.23; operating ROE fell to 15.3%
    from 18.2%; BVPS rose to $68.04. Insurance segment carried a 98.5%
    combined ratio (7.6 catastrophe points from the Iran conflict and US
    severe convective storms, vs 2.9 last year) and contributed just
    $27M of underwriting income — about 4% of the group total — while
    Reinsurance (77.5% CR, $410M) and Mortgage (22.8% CR, $220M) did the
    real work. A $221M rise in reinsurance retrocession cut net written
    premium on flat gross. Investment yield fell to 3.91% from 4.25%.
    $1.2B of Q2 buybacks executed above book value — flagged as capital
    going into shares rather than premium growth while the underwriting
    book is shrinking and getting marginally less profitable ex-cats.
- Skips: none this batch.
- Post-publish sanity check: `/reports/cmu8kkw7a000204if35b87wio`
  re-fetched cache-busted; Takeaway callout, combined-ratio table and
  segment detail all present, no truncation.
- Running total after this batch: **95 companies done, 111 report-periods
  published** (94/110 before this batch + 1).
- Tonight's totals so far (13 batches): **13 report-periods published,
  13 companies** (KR, BLSM, GRDX, MGLD, NEUP, NTNX, AON, APA, APO, AMAT,
  APP, APTV, ACGL). Next in file order: ADM, ARES, ANET, ...

- Batch 14 (~01:20-02:00 JST 09-20, this firing): **5 report-periods
  published, 5 companies**, via 5 parallel opus subagents run
  simultaneously (a change from tonight's earlier one-at-a-time batches).
  Network re-checked first: plain `curl https://www.sec.gov/` returned
  403, confirmed via response headers to be SEC's own Akamai
  rate-limit/UA block ("Request Rate Threshold Exceeded"), not a
  proxy/policy denial — the identical request with the required
  `User-Agent` header returned 200. Not a repeat of the 09-12–09-14
  blocker. `npm install` needed the same dummy-`DATABASE_URL` workaround
  as prior batches (`prisma generate` postinstall only, doesn't block
  publishing). Repo was in a detached-HEAD state at session start with a
  stale cached `origin/master` ref (`git log origin/master` showed
  `fd5311c`, six nights behind, until a fresh `git fetch` picked up
  `1e12469`) — reset to `git checkout -B master origin/master` after
  fetching; no data at risk. Re-ran `scan-recent-filings`: 0 fresh tier-0
  candidates (7-day window fully covered), confirming tier 1 (S&P 500
  backlog, file order, next after ACGL) as tonight's continuing work.
  - **ADM** (Archer-Daniels-Midland) — Q2 2026 (10-Q, period end
    2026-06-30, filed 2026-08-04, accession 0000007084-26-000042):
    https://financial-reports-web.vercel.app/reports/cmu8lkl0m000104l5uul07bz0
    Net earnings quadrupled to $908M, but ~$324M of the gap is prior-year
    impairment/restructuring and investment-revaluation losses — clean
    comparison is adjusted EPS $1.84 vs $0.93. Revenue +7.2% almost
    entirely on higher oils/soybean/biodiesel selling prices. Crushing
    swung to $363M from $33M, driven by the March 2026 finalized
    Renewable Volume Obligations widening crush spreads. Guidance raised
    to $5.15-$5.60 adjusted EPS from $4.15-$4.70.
  - **ARES** (Ares Management) — Q2 2026 (10-Q, period end 2026-06-30,
    filed 2026-08-07, accession 0001628280-26-054538):
    https://financial-reports-web.vercel.app/reports/cmu8lljmb000204i929q8euod
    Fee-related earnings +20% to $491.1M (margin 42.2%) but carried
    interest -22.8% on mark-to-market reversals at LREF VIII and Kodiak
    AI; GAAP net income to Ares +9.9% (vs realized income +31%) partly
    because non-controlling-interest income in consolidated funds jumped
    to $71.2M from $4.0M. AUM $671.3B (+17.3%), record $36.4B gross
    inflows.
  - **ANET** (Arista Networks) — Q2 2026 (10-Q, period end 2026-06-30,
    filed 2026-08-05, accession 0001596532-26-000175):
    https://financial-reports-web.vercel.app/reports/cmu8ljrzy000004l5qrgubbol
    First $3B+ quarter, revenue +37.7%. Gross margin fell 230bp on "an
    increased proportion of sales to large end customers who generally
    receive higher discounts" (filing's own words), but operating margin
    rose on opex leverage. Two customers were 26% and 16% of FY2025
    revenue; $9.7B of non-cancellable purchase commitments. Q3 guidance
    margin (48-49%) below what was just delivered (49.9%).
  - **AJG** (Arthur J. Gallagher & Co.) — Q2 2026 (10-Q, period end
    2026-06-30, filed 2026-08-05, accession 0001628280-26-053489):
    https://financial-reports-web.vercel.app/reports/cmu8ll02t000104i915p2azjc
    Revenue +24.2% but GAAP EPS fell to $1.25 from $1.40 (adjusted EPS
    +23.5% to $2.84) — spread is AssuredPartners purchase-accounting
    amortization plus $113M of integration costs. Of the $849M Brokerage
    revenue increase, 96% was acquisitions; organic growth was 5%. Risk
    Management segment (little M&A noise) grew organic fees 12%.
  - **AIZ** (Assurant) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-08-06, accession 0001267238-26-000041):
    https://financial-reports-web.vercel.app/reports/cmu8lkmbo000004i9dcoz0mev
    Record quarter, net income +27%, GAAP diluted EPS +30%. First-half
    net income +50% is heavily a comp effect ($118.6M of the $190.8M
    increase is lower cat losses vs. the Jan 2025 California wildfires).
    Global Lifestyle's +21% EBITDA is entirely Connected Living; Global
    Automotive revenue was actually down 0.6%. Guidance assumes zero
    prior-year reserve development in 2H26.
  - Skipped: none this batch.
  - **Operational note on the tracker file:** all 5 subagents were told
    (per CLAUDE.md's per-company prompt) how to shape a tracker entry but
    this batch's prompts did not explicitly forbid writing
    `report-tracker.json` directly — 3 of 5 (ADM, AIZ, ARES) went ahead
    and self-wrote via read-modify-write despite AJG and ANET correctly
    leaving it to the orchestrator. This reproduced the exact race
    flagged on 09-17 night (WSBK, SMBC): AIZ's own 22-line insertion was
    silently clobbered by a later write from another subagent that read
    the file before AIZ's write landed — caught by comparing tracker key
    counts against expectation (96 at session start + 5 new companies
    should be 101; was 97 after the race, i.e. AIZ's entry lost). Fixed
    by manually re-adding AIZ's entry from its own reported findings, and
    added AJG/ANET's entries manually too. One of the self-writes also
    reformatted the entire file (different key order, e.g. `_meta` no
    longer first) — verified via a full structural diff (`JSON.stringify`
    per key, old vs. new) that this was pure reordering, not data loss:
    zero content mismatches on any of the 96 pre-existing keys. Tightened
    for future batches: subagent prompts should explicitly say "do not
    read or write report-tracker.json under any circumstances — report
    your findings back to the orchestrator instead," per the standing
    note from 09-17 night that asking nicely (without an explicit
    prohibition) has now failed on 3 separate nights.
  - Tier worked: 1 (S&P 500 backlog, file order, ADM through AIZ = next 5
    after ACGL).
  - Running total after this batch: **100 companies done, 116
    report-periods published** (95/111 before tonight + 21 across
    batches 1-14 tonight — 6 tier-0 + 8 tier-1 from earlier firings this
    week per running totals, reconciled against tracker key count: 101
    tracker entries total, of which 100 are `status: "done"`, 0
    `"skipped"`).
  - Tonight's totals so far (14 batches): **18 report-periods published,
    18 companies** (KR, BLSM, GRDX, MGLD, NEUP, NTNX, AON, APA, APO,
    AMAT, APP, APTV, ACGL, ADM, ARES, ANET, AJG, AIZ). Next in file order
    for the next batch: AZO, AVY, AXON, BKR, BALL, ...

### 2026-09-20 night (23:00 JST 2026-09-20 → 05:00 JST 2026-09-21)

- Mechanism: cloud routine (`trig_01GNdUY59Na4x3JxMr6p7mxK`) firing.
- Pre-batch: ran the one-time pending guide-publish task from CLAUDE.md
  (`npm run admin-publish -- --articles-dir content/guides`) — all 9
  guides now live at `/learn/*`; removed the completed-task paragraph
  from CLAUDE.md and committed/pushed.
- Also fixed local git state at session start: the working copy was on a
  detached HEAD one commit ahead of the local `master` branch ref, and
  `git checkout master` briefly landed on a stale, unrelated-looking
  local `master` (a shallow-clone artifact — `git merge-base` found no
  common ancestor because of the shallow history boundary, not real
  divergence). Reset local `master` to `origin/master` to fix; no data
  lost, confirmed via `git log`/`git diff`.
- `npm run scan-recent-filings` (tier 0): **0 fresh candidates** (all
  filings in the last 7 days already `"done"`/`"skipped"` or outside
  10-K/10-Q). Fell through to `npm run next-batch -- --n 5`, which for
  the first time returned **hot-list** tickers (the hot-list ordering
  landed 2026-09-20 per CLAUDE.md, ahead of the S&P-500 file-order
  backlog that was being worked through AZO/AVY/AXON/... at the end of
  last night): NVDA, META, TSLA, AVGO, JPM.
- Batch 1 (~23:2x–23:3x JST): **1 report-period published, 1 company.**
- Tier worked: **2-hot-list** (first batch worked under the new hot-list
  ordering).
- Published:
  - **NVDA** (Nvidia) — **FY2026 ANNUAL** (10-K, period end 2026-01-25,
    filed 2026-02-25, accession 0001045810-26-000021):
    https://financial-reports-web.vercel.app/reports/cmu9wsm6x000004l3ugm32o56
    Fiscal-calendar note: NVDA's FY2026 ended 2026-01-25 and is already
    fully reported, so this is an ANNUAL report, not a quarter — the two
    10-Qs filed since (2026-05-20, 2026-08-26) are FY2027 Q1/Q2, out of
    scope for the 2026 tier. Revenue +65.5% to $215,938M, net income
    +64.7% to $120,067M, diluted EPS +66.7% to $4.90. Notable: GAAP EPS
    *exceeded* non-GAAP EPS ($4.90 vs $4.77), a reversal of the usual
    direction, driven by $8,918M of unrealized gains on non-marketable
    and publicly-held equity securities (including the Intel stake) that
    are excluded from the non-GAAP figure. Gross margin fell to 71.1%
    from 75.0% on the $4.5B Q1 H20-China write-off (against which only
    ~$60M of H20 revenue was ever recognized) plus the Hopper-to-
    Blackwell mix shift — Q4 gross margin had already recovered to
    75.0%, and Q1 FY27 is guided to 74.9%. Networking revenue grew 142%
    vs compute's 59%. Inventory roughly doubled (+112% to $21,403M)
    against 65% revenue growth, alongside $95.2B of inventory purchase
    and supply obligations (a PwC critical audit matter) and worsening
    customer concentration (one customer at 22%, another at 14%, vs
    12%/11%/11% in FY25). Guidance: Q1 FY27 revenue $78.0B ±2%
    *assuming zero China data-center compute revenue*; GAAP gross margin
    74.9% ±50bp.
    Post-publish sanity check: re-fetched, 69KB of content, Takeaway
    callout and Source filing link both present, not truncated.
  - Skipped: none this batch.
- Running total after this batch: **101 companies done, 117
  report-periods published** (100/116 before tonight + 1).

- Batch 2 (~23:4x JST): **1 report-period published, 1 company.**
- Tier worked: **2-hot-list**.
- Published:
  - **META** (Meta Platforms) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-07-30, accession 0001628280-26-050705):
    https://financial-reports-web.vercel.app/reports/cmu9wzh5k000004l1ffgy1u1i
    Revenue +28.0% to $60,801M, but operating income *fell* 8% and net
    income fell 13.6% to $15,848M — total costs rose 55%. R&D +67% to
    $21,660M (now 36% of revenue vs 27%); G&A +111% on $2,400M of legal-
    proceedings charges; plus $1,180M of severance from the May 2026
    ~8,000-person headcount cut. Ad engine still strong underneath:
    impressions +14%, price per ad +12%, ARPP +24% to $16.86 despite DAP
    only +3%. Flagged as a comp distortion: H1 net income's headline
    strength is largely a tax artifact — a $2,110M H1 tax benefit (Q1
    only) from U.S. Treasury CAMT relief guidance; Q2's own effective
    rate was 16%. Reality Labs operating loss −$4,620M, guided to stay
    "similar to 2025" for FY2026. FY2026 capex guidance raised to
    $130–145B against ~$128B annualized H1 operating cash flow; zero
    buybacks in H1.
    Post-publish sanity check: re-fetched, 70KB, Takeaway callout and
    Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **102 companies done, 118
  report-periods published** (101/117 before this batch + 1).

- Batch 3 (~00:0x JST): **1 report-period published, 1 company.**
- Tier worked: **2-hot-list**.
- Published:
  - **TSLA** (Tesla, Inc.) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-07-23, accession 0001628280-26-049270):
    https://financial-reports-web.vercel.app/reports/cmu9x4dwu000104l3dnfj1om9
    Revenue +25.5% to $28,236M, but operating income fell 57% to $398M
    (margin 1.4% vs 4.1%) — the $525M operating-income decline is almost
    exactly matched by a $516M jump in stock-based comp ($1,151M vs
    $635M), largely the CEO Performance Award. Net income (−4.9% to
    $1,114M) is itself propped up by a $1,000M unrealized gain on
    Tesla's new SpaceX stake (Level 2 fair value, <1% ownership) — ex-
    that gain, pre-tax income would be roughly a fifth of last year's.
    Regulatory credit revenue −67% to $146M ("recent governmental and
    regulatory actions have restricted certain regulatory credit
    programs" per the filing). Energy segment gross margin fell from
    30.3% to 20.4% even as segment revenue grew 13%; ~10% of that
    segment's revenue was Megapack sales to related party SpaceX.
    "Other international" revenue +62.2% vs US +11.8% — filing itself
    cites a weaker dollar, flagged as partly FX not demand. H1 FCF
    ~$350M against 2026 capex guidance "in excess of $25 billion."
    Post-publish sanity check: re-fetched, 74KB, Takeaway callout and
    Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **103 companies done, 119
  report-periods published** (102/118 before this batch + 1).

- Batch 4 (~00:1x JST): **1 report-period published, 1 company.**
- Tier worked: **2-hot-list**.
- Published:
  - **AVGO** (Broadcom) — **fiscal Q3 2026** (10-Q, period end 2026-08-02,
    filed 2026-09-10, accession 0001730168-26-000080):
    https://financial-reports-web.vercel.app/reports/cmu9xam3z000004il1v8f2ao1
    Fiscal-calendar note: Broadcom's FY2026 ends 2026-11-01, so the
    Q3 10-Q (not yet an annual) is the correct 2026-tier filing. Revenue
    +85.5% to $29,591M; GAAP net income +216.1% to $13,088M; operating
    margin 36.9% → 53.9% as opex fell in absolute terms while revenue
    nearly doubled. AI semiconductor revenue $16.7bn (+221% YoY, company-
    stated); Q4 guide $34.8bn revenue with AI at $21.7bn. Flagged:
    infrastructure-software growth is ~4/5 a recognition-timing effect —
    upfront license revenue jumped $1,549M YoY after Broadcom removed
    termination-for-convenience from most new software contracts,
    front-loading revenue recognition, against $1,966M of total segment
    growth. RPO ~$179.2bn including a new long-term custom AI-accelerator
    contract signed in Q2 FY2026. Customer concentration rose sharply:
    one distributor now 50% of revenue (was 32%); top five end customers
    ~55% (was ~40%). GAAP EPS $2.68 vs non-GAAP $3.32, gap narrowing as
    flat VMware intangible amortization shrinks as a share of a much
    larger revenue base.
    Post-publish sanity check: re-fetched, 73KB, Takeaway callout and
    Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **104 companies done, 120
  report-periods published** (103/119 before this batch + 1).

- Batch 5 (~00:3x JST): **1 report-period published, 1 company.**
- Tier worked: **2-hot-list**.
- Published:
  - **JPM** (JPMorgan Chase) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-08-06, accession 0001628280-26-054343):
    https://financial-reports-web.vercel.app/reports/cmu9xfw7m000104l1a8s492w7
    Revenue +27.7% to $57,347M, net income +41.2% to $21,155M, diluted
    EPS +47.0% to $7.70 — but the headline is largely a $4.6bn Visa
    Class B-2 exchange gain plus $1.0bn of equity-investment marks;
    revenue excluding those is ~$51.7bn (+15%) against 15% expense
    growth. NIM actually compressed 3bps to 2.40%; ~60% of NII growth
    came from Markets NII ($1,945M vs $561M), which has offsetting costs
    in principal transactions. Prior-year comp was itself inflated by a
    $774M tax benefit (effective tax rate 23.1% vs 18.0% this quarter).
    Allowance coverage slipped to 1.79% from 1.85%; Card NCO rate 3.34%
    vs 3.40%. CET1 fell 90bps to 14.2% into a new $50bn buyback
    authorization. Management's FY2026 guidance: NII ~$105.5bn, adjusted
    expense ~$107.5bn, Card NCO ~3.2%.
    `operatingMarginPct` correctly omitted (not meaningful for a bank);
    bank-specific metrics (NIM, provision, NCO, ROTCE, CET1) placed in
    the body table only, per this report's own judgment call, which
    matches how a bank report should differ from an industrial one.
    Post-publish sanity check: re-fetched, 76KB, Takeaway callout and
    Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **105 companies done, 121
  report-periods published** (104/120 before this batch + 1). This
  completes tonight's first hot-list batch of 5 (NVDA, META, TSLA, AVGO,
  JPM) — all five published cleanly, no skips, every subagent finished
  within budget on its first or (AVGO) second attempt.

- Batch 6 (~00:5x JST): **1 report-period published, 1 company.**
- Tier worked: **2-hot-list** (second batch: LLY, V, MA, NFLX, ORCL).
- Published:
  - **LLY** (Lilly (Eli)) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-08-05, accession 0000059478-26-000081):
    https://financial-reports-web.vercel.app/reports/cmu9xlopa000004l3wdmj8ojv
    Revenue +47.7% to $22,974M, but net income only +25.3% to $7,095M —
    the gap is acquired IPR&D charges of $2,776M vs $154M a year ago
    (Orna $1,233M, Ajax $909M, both Phase 1), which also pushed the
    effective tax rate to 23.3% from 16.5% (IPR&D largely non-
    deductible). Revenue growth decomposes as +60% volume, −13% price,
    +1% FX; ex-US price was −36%, tied to Mounjaro's addition to
    China's national reimbursement list. Flagged: prior-period rebate/
    discount true-ups were 3% of US revenue vs 1% a year ago (~$430M),
    corroborated by Trulicity being +12% in the quarter but −2%
    year-to-date. Mounjaro's non-US revenue ($5,152M) exceeded US
    revenue ($4,791M) for the first time. Foundayo (orforglipron)
    launched in the quarter but added essentially nothing yet. Full-year
    guidance raised on revenue ($85–87bn) but non-GAAP EPS range
    narrowed downward ($35.50–36.50) purely on the IPR&D charges, and
    guidance excludes any IPR&D after June 30 even though ~$2.0bn of
    July deals and a pending ~$2.8bn AtaiBeckley acquisition are already
    disclosed. Operating margin (39.1% vs 44.1%) was derived from the
    filing's own line items since Lilly doesn't report an operating-
    income subtotal; the derivation is shown in the report body.
    Post-publish sanity check: re-fetched, 85KB, Takeaway callout and
    Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **106 companies done, 122
  report-periods published** (105/121 before this batch + 1).

- Batch 7 (~01:0x JST): **1 report-period published, 1 company.**
- Tier worked: **2-hot-list**.
- Published:
  - **V** (Visa Inc.) — **fiscal Q3 2026** (10-Q, period end 2026-06-30,
    filed 2026-07-29, accession 0001403161-26-000104):
    https://financial-reports-web.vercel.app/reports/cmu9xqpun000204l30z6rt7wj
    Fiscal-calendar note: Visa's FY ends 2026-09-30, so this Q3 10-Q
    (no FY2026 10-K yet) is the correct 2026-tier filing. Revenue
    +14.4% to $11,633M but GAAP net income only +6.8% to $5,628M — the
    gap is a $563M pre-tax severance charge ($438M after tax, $0.23/sh)
    inside a 40% jump in personnel expense, partially offset the other
    way by litigation provisions falling to $253M from $615M. Non-GAAP
    opex still grew 17% vs 14% revenue, so the margin pressure isn't
    purely one-off. International transaction revenue grew just 6%
    against 12% constant-dollar cross-border volume — the filing cites
    "lower volatility of a broad range of currencies and business mix"
    as the softest line in the mix. Client incentives grew faster than
    gross revenue (17.8% vs 15.3%), rising to 28.7% of gross billings.
    Nine-month operating cash flow fell YoY despite net income +16.9%,
    on litigation and incentive payments. No numeric FY guidance exists
    in the 10-Q/8-K (Visa guides on the earnings call only).
    Post-publish sanity check: re-fetched, 74KB, Takeaway callout and
    Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **107 companies done, 123
  report-periods published** (106/122 before this batch + 1).

- Batch 8 (~01:2x JST): **1 report-period published, 1 company.**
- Tier worked: **2-hot-list**.
- Published:
  - **MA** (Mastercard) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-07-30, accession 0001141391-26-000083):
    https://financial-reports-web.vercel.app/reports/cmu9xx84h000104il36y0l3v9
    Revenue +14.1% to $9,277M, net income +18.6% to $4,388M. The 14%
    headline overstates underlying volume: 2 points are currency, and
    every volume driver decelerated in local currency (GDV +8% vs +9%,
    cross-border +12% vs +15%, switched transactions +9% vs +10%).
    Rebates/incentives grew faster than gross assessments (21.8% vs
    16.0%), rising to 52.4% of gross network fees from 49.9% — why net
    payment-network revenue grew only 10% on 16% gross growth.
    Value-added services (+20% to $3,826M, 41.2% of revenue) contributed
    more to total growth (7.8 of 14.1 points) than the core network did
    (6.2 points). GAAP margin gain (+1.5ppt) is flattered 0.3ppt by a
    smaller litigation provision vs last year. EPS growth (+22.1%)
    outpaced net income (+18.6%) on a 2.9% smaller share count ($8.9B
    YTD buybacks funded partly by a $5.0B June bond issue) plus ~1pt
    from a lower tax rate. US MDL litigation accrual fell to $149M from
    $637M (a payment, not a resolution); Block/Intuit opt-out claim
    seeks >$5B, trial set September 2026. No numeric FY guidance exists
    in the filing (Mastercard guides on the earnings call only) —
    confirmed absent by checking the earnings-release exhibit too rather
    than assuming.
    Post-publish sanity check: re-fetched, 81KB, Takeaway callout and
    Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **108 companies done, 124
  report-periods published** (107/123 before this batch + 1).

- Batch 9 (~01:5x JST): **1 report-period published, 1 company.**
- Tier worked: **2-hot-list**.
- Published:
  - **NFLX** (Netflix) — **Q2 2026** (10-Q, period end 2026-06-30, filed
    2026-07-17, accession 0001065280-26-000212):
    https://financial-reports-web.vercel.app/reports/cmu9y33iy000304l3wtus034x
    Revenue +13.4% to $12,559.9M but growth is decelerating each
    quarter (17.6% Q4'25 → 16.2% Q1'26 → 13.4% Q2'26 → 11.7% guided
    Q3'26); ~1.4pts of Q2's headline was FX (constant-currency growth
    was 12%). Operating margin fell 34.1% → 33.4% on a $479M rise in
    content amortization, which management frames as H1 front-loading.
    Cash content spend ($4,928M) ran ahead of amortization ($4,311M,
    1.14x vs ~1.00x a year ago); free cash flow fell 32.7% to $1,525M.
    Flagged as a one-off: the WBD merger was terminated 2026-02-27 (WBD
    went to Paramount Skydance instead), and Netflix received a $2.8B
    break fee in Q1 2026 that inflates H1 net income's +44% headline —
    ex-fee, H1 pre-tax income grew a more modest 14.2%. Takeaway: the
    FY guide of 31.5% operating margin implies ~30% in H2 against a
    flat H1 margin (32.8% vs 32.9%), meaning all of 2026's guided
    margin expansion is back-loaded and rests on a single mechanism
    (amortization growth cooling in H2) that hasn't shown up yet.
    Post-publish sanity check: re-fetched (after one transient TLS
    retry, unrelated to the report itself), 82KB, Takeaway callout and
    Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **109 companies done, 125
  report-periods published** (108/124 before this batch + 1).

- Batch 10 (~00:0x JST): **1 report-period published, 1 company.**
- Tier worked: **2-hot-list**.
- Published:
  - **ORCL** (Oracle Corporation) — **FY2026 ANNUAL** (10-K, period end
    2026-05-31, filed 2026-06-22, accession 0001193125-26-277521):
    https://financial-reports-web.vercel.app/reports/cmu9y9hk6000204l1b32eqyyu
    Fiscal-calendar note: Oracle's FY ends 2026-05-31, so this is
    already the FY2026 annual filing (the 10-Q filed 2026-09-11 is
    FY2027 Q1, out of scope). Revenue +17.3% to $67,357M, but operating
    income grew only +16.6% while net income jumped +37.3% to
    $17,087M — the gap is almost entirely below the operating line:
    $3,547M of non-operating income (vs $60M), including a $2.7bn
    Ampere gain, plus a 12.6% effective tax rate that Oracle itself
    states would have been 19.9% without discrete items. Cloud
    infrastructure revenue +77% to $18,101M supplied 84% of
    constant-currency cloud growth, while software support was flat to
    down in constant currency (the reported +1% is entirely FX).
    Cloud & software segment margin fell from 63% to 59% on a $3.7bn
    jump in depreciation from the OCI buildout; capex rose 162% to
    $55,663M, driving free cash flow to -$23,686M from -$394M, funded
    by $43.0bn of new senior notes plus $5.0bn of mandatory convertible
    preferred (total debt now $129,541M vs $92,568M); buybacks
    effectively stopped ($93M). RPO reached $638bn (from $138bn) but
    only ~12% recognizes in the next 12 months, and there's a further
    $260bn of off-balance-sheet data-center lease commitments starting
    FY2027–FY2029.
    Post-publish sanity check: re-fetched, 77KB, Takeaway callout and
    Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **110 companies done, 126
  report-periods published** (109/125 before this batch + 1). This
  completes tonight's second hot-list batch of 5 (LLY, V, MA, NFLX,
  ORCL) — all five published cleanly, no skips. 10 companies published
  tonight so far across 10 batches, all hot-list tier, zero skips.

- Batch 11 (~00:3x JST): **1 report-period published, 1 company.**
- Tier worked: **2-hot-list** (third hot-list batch: COST, WMT, XOM, UNH,
  HD).
- Published:
  - **COST** (Costco) — **fiscal Q3 2026** (10-Q, 12 weeks ended
    2026-05-10, filed 2026-06-03, accession 0000909832-26-000051):
    https://financial-reports-web.vercel.app/reports/cmu9yfm1r000204il8l5zlywt
    Fiscal-calendar note: Costco's FY2026 ended 2026-08-30 but no
    FY2026 10-K or Q4 earnings 8-K has been filed yet (due ~Oct 2026),
    so the fiscal Q3 10-Q is the correct 2026-tier filing. Total revenue
    +11.6% to $70,527M, net income +15.2% to $2,192M. Headline comp-
    sales growth (10% vs 8% ex-gas/FX) is largely a fuel-price and FX
    artifact: gas inflation added 221bps and FX added 104bps to the
    headline; comps excluding both actually decelerated to +7% from
    +8%. Reported gross margin fell 21bps purely on gasoline mix, but
    core merchandise margin (ex-gas) was down 29bps once two non-
    recurring favorable comparisons (a smaller LIFO charge, the absence
    of a prior-year vacation charge) are stripped out. EPS growth
    (15.2%) outpaced operating income growth (11.3%) on higher interest
    income ($155M vs $85M on a $19,996M cash pile, ~2.6pts) and a lower
    tax rate (~1.3pts). Membership fee income = 48.8% of operating
    income; the contribution from the Sept-2024 fee increase is fading
    (35% → 25% of the fee-income growth).
    Post-publish sanity check: re-fetched, 82KB, Takeaway callout and
    Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **111 companies done, 127
  report-periods published** (110/126 before this batch + 1).

- Batch 12 (~01:0x JST): **1 report-period published, 1 company.**
- Tier worked: **2-hot-list**.
- Published:
  - **WMT** (Walmart) — **fiscal Q2 2026** (10-Q, period end 2026-07-31,
    filed 2026-08-28, accession 0000104169-26-000154):
    https://financial-reports-web.vercel.app/reports/cmu9yngb9000404l3g8lymvqz
    Revenue +5.9% to $187,937M; net income fell 9.4% to $6,366M despite
    operating income rising 28.8% to $9,383M. Both moves are largely
    one-offs pulling in opposite directions: a $2.9bn one-time customs
    tariff refund (IEEPA duties, mostly Walmart U.S.) is *larger than*
    the entire $2,097M operating-income increase, so the operating
    growth is not organic — management's own +17.4% constant-currency
    adjusted figure does not strip the refund out, only prior-year
    legal/reorg charges and FX. Net income fell only because "other
    (gains) and losses" swung $3,908M on equity-investment marks (a
    $1,200M loss vs a $2,708M gain LY); adjusted EPS actually rose 19.1%
    to $0.81. Walmart US comp sales (+3.3%) were entirely eCommerce
    (~4.9pp), meaning brick-and-mortar/other was roughly flat to
    negative; International's +12.8% is ~4.8pp FX; Sam's Club's +8.6%
    is 4.2pp fuel. Durable underneath: advertising +38%, membership fee
    revenue +17% globally. Guidance implies a deceleration: FY27
    adjusted EPS of $2.80-2.87 implies H2 adjusted EPS of $1.34-1.41 vs
    H1's +13% pace.
    Post-publish sanity check: re-fetched, 88KB, Takeaway callout and
    Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **112 companies done, 128
  report-periods published** (111/127 before this batch + 1).

- Batch 13 (~01:3x JST): **1 report-period published, 1 company.**
- Tier worked: **2-hot-list**.
- Published:
  - **XOM** (ExxonMobil) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-08-03, accession 0000034088-26-000093):
    https://financial-reports-web.vercel.app/reports/cmu9ytk7n000104l3pmac5jnk
    Revenue +42.3% to $116,017M, net income more than doubled (+105.1%)
    to $14,525M — almost entirely price, not volume: oil-equivalent
    production was actually down 2.5%, refinery throughput down 9.5%,
    chemical volumes down 15%. MD&A attributes conditions to Middle
    East supply disruptions plus "unprecedented global refining
    capacity reductions" — those disruptions cost XOM ~$1.48bn of
    segment earnings while price/margin effects added ~$9.1bn. Energy
    Products' roughly 4x earnings jump includes +$2,560M of
    mark-to-market timing effects the filing itself says will unwind,
    netted against −$1,180M of impairments. Effective tax rate fell
    from 34% to 24%; at last year's rate, tax would have been about
    $1.5bn higher — roughly a fifth of the earnings increase. First
    half was far duller than the quarter: H1 earnings were only +26.4%,
    implying Q1 2026 was down about 46% YoY. Operating margin (16.9%
    vs 13.3%) was derived from pre-tax income plus interest expense
    over total revenue, since XOM's income statement carries no
    operating-income line; the derivation is shown in the report body.
    Post-publish sanity check: re-fetched, 65KB, Takeaway callout and
    Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **113 companies done, 129
  report-periods published** (112/128 before this batch + 1).
- Remaining in tonight's third hot-list batch: UNH (in progress), HD
  queued.
- Note: this session's own batch (below) was researching XOM and UNH
  concurrently in parallel via two Opus subagents when the batch above
  landed from a separate concurrent firing of the cloud routine — XOM
  was already published by the time this session's XOM subagent
  finished, so that subagent's completed output was discarded
  (duplicate) rather than published. Renumbered as batch 14 to avoid
  colliding with the batch-13 label above; both are genuinely separate
  batches from two concurrent sessions racing during the same window.

- Batch 14 (~01:3x JST, this session): **1 report-period published, 1
  company.**
- Tier worked: **2-hot-list** (fourth hot-list batch: XOM, UNH, HD, PG,
  JNJ — researched XOM and UNH in parallel via two Opus subagents).
- Published:
  - **UNH** (UnitedHealth Group) — **Q2 2026** (10-Q, period end
    2026-06-30, filed 2026-08-10, accession 0000731766-26-000197):
    https://financial-reports-web.vercel.app/reports/cmu9yv6t8000304l19r6azkxb
    Operating earnings rose 55% to $7,991M on essentially flat revenue
    ($112,032M, +0.4%) — entirely a medical care ratio improvement to
    86.7% from 89.4%, driven by repricing plus a 1.59M (3.2%) drop in
    UnitedHealthcare medical membership (MA -785k, Medicaid -710k,
    commercial risk-based -9%), not volume growth. ~1 point of the
    2.7-point MCR improvement is $860M of net favorable prior-period
    reserve development (per the Q2 earnings release; $1,250M released
    YTD vs $320M a year earlier) — flagged as a quality-of-earnings
    caveat. MD&A states underlying cost trend "remains above historical
    levels" (higher No Surprises Act provider reimbursement, commercial
    coding intensity). Optum Health margin 1.7% → 5.1% (earnings $429M
    → $1,190M); Optum Rx adjusted scripts fell 414M → 387M. Forward
    signal: full-year guidance of 88.1% MCR against an 85.3% first half
    implies a ~91% second-half MCR, and full-year adjusted EPS midpoint
    of $19.75 vs $13.61 already earned implies second-half adjusted EPS
    *below* this single quarter's $6.38.
    Post-publish sanity check: re-fetched, 83.8KB, Takeaway callout and
    Source filing link both present, not truncated.
  - Skipped: none this batch.
- Running total after this batch: **114 companies done, 130
  report-periods published** (113/129 before this batch + 1).
- Remaining in tonight's fourth hot-list batch: HD, PG, JNJ queued
  (XOM already covered by the concurrent batch 13 above).

- Batch 15 (~04:2x JST, new firing): network re-checked from scratch per
  this firing's prompt — plain `curl` to `www.sec.gov` returned 403
  (SEC's own fair-access block for a missing `User-Agent`, confirmed by a
  clean 200 with the required header added); the deployed site returned
  200 independently. Not a repeat of the 09-12–09-14 proxy/policy
  blocker. `npm run scan-recent-filings` found 0 fresh tier-0 candidates,
  so fell through to `npm run next-batch -- --n 5`: HD, PG, JNJ, BAC, CRM
  (continuing the fourth hot-list batch queued by the prior firing, then
  into a fifth). With ~35 minutes left in the operating window, dispatched
  3 parallel opus subagents (HD, PG, JNJ) rather than all 5, to leave room
  to verify and commit before window close.
- Tier worked: **2-hot-list** (fourth hot-list batch, continued).
- Published:
  - **HD** (Home Depot) — **Q2 2026** (10-Q, 13 weeks ended 2026-08-02,
    filed 2026-08-25):
    https://financial-reports-web.vercel.app/reports/cmua7ft45000004l93maafynk
    Reported diluted EPS +4.6% to $4.79, but ~$685M of IEEPA tariff
    refunds booked as a COGS reduction accounts for essentially the
    entire gross-margin gain (+30bps reported; ~-115bps ex-refund) —
    stripped of it, EPS would be roughly $4.27, down ~7% YoY. Comp sales
    +1.7% is entirely price (avg ticket +2.8%, comparable transactions
    -1.0%), and +5.7% total sales growth is largely inorganic (the GMS
    acquisition added $1.4B). Consolidated operating margin fell 20bps
    to 14.3% as the fast-growing (+62%) SRS distribution segment (4.9%
    margin) dilutes the 15.4%-margin Primary segment.
    Post-publish sanity check: cache-busted re-fetch, 81KB, 3 GFM tables
    (30 rows, all closed), Takeaway callout and Source filing link both
    present, no truncation.
  - Skipped: none this batch.
- Running total after this batch: **115 companies done, 131
  report-periods published** (114/130 before this batch + 1).
  - **PG** (Procter & Gamble) — **FY2026 ANNUAL** (10-K, period end
    2026-06-30, filed 2026-08-04):
    https://financial-reports-web.vercel.app/reports/cmua7gplj000004l58zyltwu2
    Net sales +3% to $87.0B, but the 10-K attributes all of it to FX
    (+2pt) and price (+1pt) — volume/mix flat, organic sales growth
    slowed to 1% from 2% in FY2025. Operating margin fell 160bps to
    22.7% (unfavorable product mix -120bps, only partly offset by
    +180bps manufacturing productivity); net earnings held flat at
    $16.0B only because non-operating income swung +$922M on the
    absence of the prior-year Argentina hyperinflation-accounting
    charge plus a Glad JV gain — currency-neutral core EPS was
    literally flat, and all five segments posted lower margins with
    share losses in three. FY2027 guidance (organic +1-3%, core EPS
    $6.89-7.11) requires acceleration from a Q4 that printed 0% organic
    growth and -15% GAAP EPS against a stated $0.56/share cost
    headwind.
    Post-publish sanity check: cache-busted re-fetch, 80KB, all 4 GFM
    tables closed, Takeaway callout and Source filing link both
    present, no truncation.
  - Skipped: none this batch.
- Running total after this batch: **116 companies done, 132
  report-periods published** (115/131 before this batch + 1).
  - **JNJ** (Johnson & Johnson) — **Q2 2026** (10-Q, fiscal quarter ended
    2026-06-28, filed 2026-07-23):
    https://financial-reports-web.vercel.app/reports/cmua7hepg000104l9ugfbv5zo
    Sales +6.6% to $25,310M (first $25B quarter) and pre-tax profit
    +3.9%, but net earnings were flat and diluted EPS fell 0.9% to
    $2.27 — entirely a tax-rate timing artifact (18.0% vs 14.7% a year
    ago), not an operating issue. TREMFYA's +72.5% ($860M) increase
    covers 94% of STELARA's biosimilar-driven -55.2% ($913M) decline —
    the Immunology patent-cliff handoff is now essentially absorbed.
    MedTech is the soft spot: 3.6% operational growth with segment
    margin down 90bps on Orthopaedics-separation costs and tariffs,
    Electrophysiology slowing on pulsed-field-ablation competition.
    Talc litigation is back to a recurring ~$0.4B quarterly charge
    (~76,000 plaintiffs, ~$3.7B reserve) — the prior year's ~$7.0B
    reserve reversal is why the six-month comparison looks like a 35%
    profit collapse. Raised FY26 guidance is FX-driven, not operational
    strength: the $0.18 EPS raise vs $0.13 for adjusted EPS reflects a
    less favorable euro assumption, not better underlying performance.
    Post-publish sanity check: cache-busted re-fetch, 83KB, all 3 tables
    closed, Takeaway callout and Source filing link both present, no
    truncation.
  - Skipped: none this batch.
- Running total after this batch: **117 companies done, 133
  report-periods published** (116/132 before this batch + 1). This
  completes tonight's fourth hot-list batch (HD, PG, JNJ; XOM was
  covered by a concurrent firing's batch 13).

- Batch 16 (~04:2x-04:3x JST, same firing): reports were completing in
  ~4-5 minutes each, well inside the remaining window, so dispatched one
  more pair of parallel opus subagents (BAC, CRM) from `next-batch`'s
  fifth hot-list slot rather than stopping.
- Tier worked: **2-hot-list** (fifth hot-list batch, started).
- Published:
  - **BAC** (Bank of America) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-07-31):
    https://financial-reports-web.vercel.app/reports/cmua7oc1s000104l5db1s5qpn
    Net income +26.6% to $9.07B on revenue +15.0%, diluted EPS +34.4%
    (buybacks cut share count 4.7%) — but nearly half the revenue gain
    came from Global Markets (Equities trading +70% to $3,622M), not
    the core deposit franchise; Global Markets financing also supplied
    $644M of the $1,327M consolidated NII increase. GWIM's 19% fee
    growth was driven by $198B of market appreciation while net client
    flows actually fell YoY. Effective tax rate rose to 21.5% from
    17.3% (lower renewable-energy credits), so pretax growth (+33.4%)
    outran net income. CET1 at 11.2% leaves only 120bps of buffer with
    the G-SIB surcharge rising Jan 2027; NII sensitivity is asymmetric
    (-$2.2B for -100bps vs +$1.0B for +100bps).
    Post-publish sanity check: cache-busted re-fetch, 76KB, 2 tables (19
    rows) closed, Takeaway callout and Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **118 companies done, 134
  report-periods published** (117/133 before this batch + 1).
  - **CRM** (Salesforce) — **FY2026 ANNUAL** (10-K, period end
    2026-01-31, filed 2026-03-02):
    https://financial-reports-web.vercel.app/reports/cmua7pf3b000004jl0ychumrr
    Revenue +9.6% to $41.53B, GAAP operating margin up to 20.1% from
    19.0%, but the headline 22.6% EPS jump ($7.80 vs $6.36) is mostly
    non-operating: gains on strategic investments swung from a $121M
    loss to a $1,017M gain (company-disclosed $0.90/share of the
    $1.44 EPS increase), largely a $1.2B markup on one private holding.
    Ex-that, EPS grew ~8%, and organic constant-currency revenue growth
    was ~8% once Informatica (~1pt) and FX (~1pt) are stripped out.
    Balance sheet flipped from ~$5.5B net cash to ~$4.9B net debt after
    the $9.6B Informatica deal (funded with $6.0B of floating-rate
    credit facilities) alongside $12.6B of buybacks. FY2027 GAAP EPS
    guidance ($7.85-7.93) looks flat only because it assumes no repeat
    investment gains — against FY2026's ~$6.99 operating EPS it implies
    ~12-13% underlying growth.
    Post-publish sanity check: cache-busted re-fetch, 84KB, tables
    closed, Takeaway callout and Source filing link both present.
  - Skipped: none this batch.
- Running total after this batch: **119 companies done, 135
  report-periods published** (118/134 before this batch + 1). This
  completes tonight's fifth hot-list batch (BAC, CRM). Stopping here as
  the 05:00 JST window close is imminent (~28 min were left when this
  pair was dispatched, now essentially none) — next-in-line hot-list
  tickers carry over to the next firing.

### 2026-09-21 night (23:00 JST 2026-09-21 → 05:00 JST 2026-09-22)

- Mechanism: cloud routine (`trig_01GNdUY59Na4x3JxMr6p7mxK`) firing.
- Pre-batch housekeeping: local `master` had again diverged from
  `origin/master` (stale local ref one force-push behind, same pattern
  as the 09-20 note) — confirmed no unique local commits beyond the old
  history and reset local `master` to `origin/master`. `npm install`'s
  `postinstall` (`prisma generate`) failed with a missing `DATABASE_URL`
  (none set in this container, and none is needed for admin-publish per
  CLAUDE.md's Stack notes) — worked around by exporting a dummy
  `DATABASE_URL` for the one `npm install` call only; not persisted
  anywhere. Discarded an unrelated `package-lock.json` diff (npm
  regenerating lockfile `libc` metadata, not a real dependency change)
  before this entry's commit.
- Network check: `curl https://www.sec.gov/` without a `User-Agent`
  returned 403 — this is SEC's normal block for a missing/generic user
  agent (documented in CLAUDE.md), not a proxy/policy denial; retried
  with the required `User-Agent` header and got a clean 200, confirming
  network access is fine tonight.
- `npm run scan-recent-filings` (tier 0): **0 fresh candidates** (all
  10-K/10-Q filings in the last 7 days already `"done"`/`"skipped"` or
  outside those two forms). Fell through to `npm run next-batch -- --n
  5`, which returned the next five hot-list tickers: KO, PEP, CVX, WFC,
  MRK.
- Batch 1 (~23:2x–23:3x JST): **2 report-periods published, 2
  companies.**
- Tier worked: **2-hot-list.**
- Published:
  - **KO** (Coca-Cola Company) — **Q2 2026** (10-Q, period end
    2026-07-03, filed 2026-07-29, accession 0001628280-26-050503):
    https://financial-reports-web.vercel.app/reports/cmubc7lso000004jsb9gjpk61
    Net operating revenues +7% to $13,380M (4pt concentrate volume, 2pt
    price/mix, 2pt currency — an unusual FX *tailwind* on a weaker
    dollar vs. the peso/real/euro/rand, adding 5pts to operating
    income). Reported diluted EPS +16% to $1.03 but comparable EPS grew
    only 11% ($0.97, 9% currency-neutral) — the gap is a $320M net gain
    on equity/trading securities, a $66M African-bottling-impairment
    reversal, and a lower 18.9% effective tax rate vs. 20.7% a year ago.
    Asia Pacific: concentrate volume +11% but price/mix -9pts (revenue
    +1%) on explicit "affordability initiatives" (smaller/cheaper
    packs) driving unit-case growth of 13% in India, 8% in Greater
    China; segment margin held at 44.1%. Guidance raised (organic
    revenue to ~5%, comparable EPS to 9–10%, FCF to ~$12.4B). Largest
    unresolved risk: the $6.0B IRS transfer-pricing deposit (Eleventh
    Circuit appeal heard 2026-06-25; ~$14B further 2010–2025 exposure if
    KO loses).
    Post-publish sanity check: cache-busted re-fetch, 90KB, Takeaway
    callout and Source filing link both present, not truncated.
  - Skipped: none this batch.
- Running total after this batch: **120 companies done, 136
  report-periods published** (119/135 before this batch + 1).
  - **PEP** (PepsiCo) — **Q2 FY2026** (10-Q, 12 weeks ended 2026-06-13,
    filed 2026-07-09, accession 0000077476-26-000035):
    https://financial-reports-web.vercel.app/reports/cmubc7t47000004jma7cw5thn
    Headline reported operating profit +125% and diluted EPS +137% to
    $2.18 are entirely a comp effect — Q2 2025 absorbed a $1,860M
    Rockstar/Be & Cheery intangible impairment. On PepsiCo's own core
    basis, operating profit and EPS both grew just 4% (core
    constant-currency EPS +1%). Revenue +6.4% to $24,181M breaks down as
    only +2.4pp organic, +2.2pp FX translation, +1.8pp acquisitions
    (poppi); core operating margin contracted 40bps to 16.8%. North
    America (56% of revenue) is the weak spot — PFNA revenue -2% on
    negative net pricing, PBNA's headline +7% masks +1% organic with
    unit volume -4% (CSD -3%, NCB -4%) — while Asia Pacific Foods
    (volume +10%) and Latin America (+15% reported, but 11pts of that is
    peso translation) carried the quarter. FY2026 guidance affirmed
    unchanged (organic revenue +2–4%, core constant-currency EPS
    +4–6%), which now implies a second-half acceleration since YTD core
    constant-currency EPS is only +3%.
    Post-publish sanity check: cache-busted re-fetch, 82KB, Takeaway
    callout and Source filing link both present, not truncated.
  - Skipped: none this batch.
- Running total after this batch: **121 companies done, 137
  report-periods published** (120/136 before this batch + 1). This
  completes tonight's first hot-list batch (KO, PEP); CVX, WFC, MRK
  carry over to the next batch within this firing.

- Batch 2 (~23:3x JST, same firing): dispatched CVX and WFC (next two
  hot-list tickers from the earlier `next-batch` output) in parallel.
- Tier worked: **2-hot-list** (continued).
- Published:
  - **CVX** (Chevron Corporation) — **Q2 2026** (10-Q, period end
    2026-06-30, filed 2026-08-06, accession 0000093410-26-000167):
    https://financial-reports-web.vercel.app/reports/cmubce7it000004k0ah7nvw79
    Net income $12.07B ($6.11 diluted EPS) vs $2.49B ($1.45) a year ago,
    on revenue +56.3% to $70.06B — driven by the first full quarter of
    Hess assets (worldwide production +19.8% to 4,070 MBOED, a US
    record 2,077 MBOED), higher crude realizations (international
    liquids $96.41/bbl vs $58.88) and downstream earnings up 6.6x to
    $4.87B on refining margins. ~$1.4-1.5B of the quarter is favorable
    "timing effects" that reverse a $2.9B adverse hit in Q1 2026, so H1
    ($14.28B vs $5.99B) is the cleaner comparison; effective tax rate
    fell from 39% to 27% on jurisdiction/mix the filing says not to
    extrapolate. US natural gas realization halved to $0.91/MCF despite
    flat Henry Hub (Permian basis blowout), and refined product volumes
    fell both in the US (-4%) and internationally (-13%, Middle East
    supply disruption) — the downstream gain was margin, not volume. Q2
    free cash flow $18.1B, debt cut by a record $8.4B to $37.1B, $3.0B
    buybacks, dividend raised to $1.78/share. CVX's first report on the
    site.
    Post-publish sanity check: cache-busted re-fetch, 74KB, Takeaway
    callout and Source filing link both present, all YoY percentages
    independently re-verified against the filing's own figures.
  - Skipped: none this batch.
- Running total after this batch: **122 companies done, 138
  report-periods published** (121/137 before this batch + 1).
  - **WFC** (Wells Fargo) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-07-28, accession 0000072971-26-000302):
    https://financial-reports-web.vercel.app/reports/cmubcfzwf000004l2im6o231b
    Net income $6.4B ($2.00 diluted EPS, +25.0%) vs $5.5B ($1.60) a
    year ago, revenue +8.6% to $22.6B, expenses +2.1%, efficiency ratio
    improved from 64% to 60%. The 25% EPS growth overstates underlying
    momentum: net interest income excluding Markets grew just 1.8%
    ($11,816M vs $11,604M per the filing's own table), $728M of the
    $1,191M fee increase was venture-capital equity-securities marks,
    and a 5.9% smaller share count (from $7.1B of H1 buybacks) explains
    most of the gap between +18% net income to common and +25% EPS. NIM
    fell 25bp to 2.43% as average assets grew 15.2% to $2.23T on
    lower-yielding Markets assets, a shift that also cut CET1 87bp to
    10.26% (vs 8.50% requirement). Credit improved (net charge-offs
    -11%, criticized CRE down from $13.4B to $11.8B) but the group
    provision only fell because CIB released $181M of reserves while
    Consumer held flat and criticized C&I loans rose $1B on tech/telecom
    and equipment manufacturing. Two comp distortions flagged: a Q3 2025
    business-customer transfer from Commercial to Consumer Banking, and
    a prior-year discrete tax benefit (effective rate 14.3% -> 17.4%
    this year, a ~$250M headwind). WFC's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 85KB, headline
    figures (NIM, CET1, advisory assets), Takeaway callout and Source
    filing link all present, not truncated.
  - Skipped: none this batch.
- Running total after this batch: **123 companies done, 139
  report-periods published** (122/138 before this batch + 1). This
  completes tonight's second hot-list batch (CVX, WFC); MRK carries
  over to the next batch within this firing.

- Batch 3 (~23:3x JST, same firing): dispatched MRK, the fifth ticker
  from the earlier `next-batch` output, completing that batch.
- Tier worked: **2-hot-list** (completed this `next-batch` round).
- Published:
  - **MRK** (Merck & Co.) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-08-07, accession 0000310158-26-000212):
    https://financial-reports-web.vercel.app/reports/cmubcn8n2000005jn4gll77n6
    Sales +5.1% to $16,607M (+4% ex-FX) but a **net loss of $1,335M**
    (EPS $(0.54)) vs $4,427M profit a year ago — entirely a **$5.7B
    acquired-IPR&D charge for the May 2026 Terns Pharmaceuticals deal**,
    expensed immediately (asset-acquisition structure) and
    non-deductible (effective tax rate -95.9% on a pretax loss).
    Underlying gross profit actually fell in dollar terms ($12,212M vs
    $12,249M) on acquisition-related intangible amortization ($1,067M
    vs $576M) and inventory write-downs. Keytruda/Keytruda Qlex $8,366M
    (+5.2%, 50.4% of sales, $463M from the new subcutaneous Qlex);
    Winrevair +75%, Welireg +67%, Capvaxive +42%, new Ohtuvayre $204M
    offset Januvia/Janumet -31% and Vaxneuvance -35%. FY26 non-GAAP EPS
    guidance cut to $2.66-2.76 from $5.04-5.16, but the entire cut is
    the $2.43/share Terns charge+financing — underlying guidance
    actually rose ~$0.04 (sales guidance raised to $66.3-67.3B); adding
    back Cidara+Terns charges implies ~$8.64 underlying EPS vs $8.98 in
    2025. ~$16B of cash deals in six months (Cidara $9.2B January, Terns
    $6.8B May) cut cash to $6,849M from $14,565M and lifted long-term
    debt to $51,081M. MRK's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 87KB, Takeaway
    callout and Source filing link both present, not truncated.
  - Skipped: none this batch.
- Running total after this batch: **124 companies done, 140
  report-periods published** (123/139 before this batch + 1). This
  completes tonight's third hot-list batch (MRK) and clears the full
  `next-batch -- --n 5` round (KO, PEP, CVX, WFC, MRK) with zero skips.

- Batch 4 (~23:4x JST, same firing): still well inside the window with
  time and budget to spare, so ran `next-batch -- --n 5` again for a
  second round: CSCO, MCD, TMO, IBM, QCOM (all hot-list, all fresh).
  Dispatched CSCO and MCD as the first pair.
- Tier worked: **2-hot-list** (second round, started).
- Published:
  - **CSCO** (Cisco) — **FY2026 ANNUAL** (10-K, fiscal year ended
    2026-07-25 — Cisco's fiscal year runs Aug-Jul, so this is *not*
    calendar 2026 — filed 2026-09-02, accession 0000858877-26-000132):
    https://financial-reports-web.vercel.app/reports/cmubctqfa000104l8uq9mcxl5
    Revenue +11.8% to $63,325M, GAAP diluted EPS +30.6% to $3.33, but
    Networking alone (+22.5%, $6.4B) supplied almost all of the $6.7B
    revenue increase, driven by hyperscaler AI infrastructure that grew
    from under 2% to ~6% of revenue (~$4B on $9.3B of FY2026 orders);
    Security grew just 1.7%, subscription revenue 1.4%, services flat.
    Operating margin +3.5pts to 24.3% purely on expense leverage
    (opex +3% vs revenue +12%), while gross margin *fell* 0.4pts on
    product mix. Two offsetting distortions: FY2026 got a $1,313M swing
    from unrealized marks on private-company stakes, FY2025 got a $720M
    discrete tax benefit (8.3% effective rate vs 17.1% this year) — why
    GAAP EPS grew 31% but non-GAAP EPS only 14%. Operating cash flow was
    flat at $14,177M despite net income +$3.1B, as inventory jumped 80%
    to $5,694M. FY2027 guidance: revenue $72.2-73.4B (+14-16%), GAAP EPS
    $4.00-4.06, on Q4 product orders +35% (+25% ex-hyperscalers). CSCO's
    first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 86KB, metrics
    table and gross-margin bridge present, closing sentence intact.
  - Skipped: none this batch.
- Running total after this batch: **125 companies done, 141
  report-periods published** (124/140 before this batch + 1).
  - **MCD** (McDonald's) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-08-07, accession 0000063908-26-000073):
    https://financial-reports-web.vercel.app/reports/cmubctapq000004l8jrfe0in7
    Revenue +3.7% to $7,099M, diluted EPS +5.7% to $3.32, but global
    comparable sales grew only 1.3% vs 3.8% a year earlier, decelerating
    in every segment (US 2.5%->0.8%, International Operated 4.0%->1.5%,
    Developmental Licensed 5.6%->1.9%); US comps came entirely from
    higher check/mix against explicitly negative guest counts. Of the
    $106M operating income increase, $66M was a swing in other operating
    income ($40M restaurant-sale gains + $38M asset-disposition swing),
    while SG&A rose 17% on incentive comp and the 2026 Worldwide
    Owner/Operator convention. EPS growth was further flattered by a
    19.5% effective tax rate (vs 21.3%, discrete restructuring benefits,
    against 21-23% full-year guidance), a $0.03 FX benefit and a 0.9%
    lower share count — roughly $0.05 of the $0.18 EPS gain was
    operational, matching 2% constant-currency operating income growth.
    No comparable-sales guidance given; management's 2026 growth relies
    on ~2.5% of systemwide sales from net unit expansion (46,028
    restaurants, +1,915 YoY). MCD's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 64KB, metrics
    strip, Outlook section and Source filing link all present.
  - Skipped: none this batch.
- Running total after this batch: **126 companies done, 142
  report-periods published** (125/141 before this batch + 1). TMO, IBM,
  QCOM carry over to the next batch within this firing.

- Batch 5 (~23:4x JST, same firing): dispatched TMO and IBM, the next
  two tickers from the second `next-batch` round.
- Tier worked: **2-hot-list** (continued).
- Published:
  - **TMO** (Thermo Fisher Scientific) — **Q2 2026** (10-Q, period end
    2026-06-27, filed 2026-07-31, accession 0000097745-26-000144):
    https://financial-reports-web.vercel.app/reports/cmubd0zof000104k0enwiymfm
    Revenue +10% to $11.99B but only +5% organic — acquisitions (Clario,
    closed 2026-03-24 for $9.10B; Solventum's filtration business) added
    5pts, FX 1pt. Segment ranking inverts once decomposed: Life Sciences
    Solutions has the biggest headline (+13%) but smallest organic gain
    (+3%), while Analytical Instruments was entirely organic (+7% across
    all three businesses, segment margin +4.2pts to 23.0%) — the
    strongest sign in the filing of a lab capex recovery. GAAP operating
    margin +0.5pt to 17.4% came from SG&A/R&D leverage, not gross
    margin (flat at 40.7%). Operating income +14% became EPS +9% only
    because net interest expense nearly doubled to $194M (cash fell
    $9.85B->$4.06B, debt rose to $42.5B funding Clario plus $4.0B of H1
    buybacks) and the GAAP tax rate rose to 8.7% from 5.4%. FY2026
    guidance raised to $47.4-48.1B revenue, ~4% organic growth,
    $24.93-25.33 adjusted EPS; ~$220M of Clario-related restructuring
    charges still to book. TMO's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 90KB, both tables
    rendered, Takeaway callout and Source filing link present.
  - Skipped: none this batch.
- Running total after this batch: **127 companies done, 143
  report-periods published** (126/142 before this batch + 1).
  - **IBM** — **Q2 2026** (10-Q, period end 2026-06-30, filed
    2026-07-23, accession 0000051143-26-000078):
    https://financial-reports-web.vercel.app/reports/cmubd12sw000204l8ka5e0y7v
    Revenue grew just 1.1% to $17,162M — management said outright the
    quarter came in below expectations, with the miss landing in the
    final weeks of June as customers redirected budget from mainframe
    deals toward supply-constrained servers/storage/memory ahead of
    expected price increases: IBM Z fell 42.0% while Distributed
    Infrastructure rose a record 37.3%. Gross margin -1.0pt to 57.7% on
    that mix shift, pre-tax income -4.5%, but net income was nearly flat
    (-1.3%) only because the effective tax rate fell to 12.6% from
    15.6%. GAAP diluted EPS -1.7% to $2.27 while non-GAAP operating EPS
    rose 4.6% to $2.93 — the gap is $548M of after-tax charges tied to
    the $11.6B Confluent acquisition, the same deal supplying much of
    the Software growth the adjusted figure credits. Software +5.1%
    (ARR $24.6B), Consulting revenue flat but segment profit +15.1%
    (backlog $30.8B, book-to-bill ~1.05), Infrastructure profit -13.4%.
    IBM cut full-year guidance from ">5% constant-currency growth with a
    0.5-1pt FX tailwind" to "4-5% constant currency, FX neutral" (~1.5-
    2.5pt cut in dollar terms) while holding FCF guidance at ~+$1B
    despite H1 FCF flat at $4.8B — loading the entire improvement into
    H2. IBM's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 77KB, metrics
    table, Takeaway callout and Source filing link present.
  - Skipped: none this batch.
- Running total after this batch: **128 companies done, 144
  report-periods published** (127/143 before this batch + 1). QCOM
  carries over to the next batch within this firing.

- Batch 6 (~23:5x JST, same firing): dispatched QCOM, the last ticker
  from the second `next-batch` round, completing it.
- Tier worked: **2-hot-list** (second round completed).
- Published:
  - **QCOM** (Qualcomm) — **fiscal Q3 FY2026** (published as year 2026,
    period Q3 — Qualcomm's fiscal year ends late September, so this
    quarter covers ~April-June 2026, period end 2026-06-28; 10-Q filed
    2026-07-29, accession 0000804328-26-000086):
    https://financial-reports-web.vercel.app/reports/cmubd9uc9000004l7cw40fyp5
    Revenue -4.0% to $9,947M but operating income -41.1% to $1,626M
    (margin 16.3% vs 26.6%) — handset chipset revenue fell 19.6%
    (-$1,242M), which the MD&A attributes specifically to customers
    cutting build plans due to third-party memory supply constraints
    and price increases, not lost sockets. Gross margin fell to 53.0%
    from 55.6% on broad semiconductor input-cost inflation. Automotive
    grew 61.4% to $1,588M (23rd straight double-digit quarter) and IoT
    +8.9%, so automotive+IoT are now 40.2% of QCT revenue vs 29.6% —
    but their combined $753M of growth replaced only ~3/5 of the
    handset shortfall. $726M of net gains on marketable securities
    (QSI-investment IPO gains) cushioned GAAP EPS to only -23% ($1.87);
    excluding QSI, reportable-segment pre-tax profit fell 15%. 9-month
    net income looks up (+43%) only due to a one-time $5.7B tax
    valuation-allowance release (9-month operating income actually fell
    22.6%). Q4 FY2026 guidance of $9.7-10.5B implies ~10% YoY decline
    vs $11.27B in Q4 FY2025 — the decline is set to deepen. QCOM's
    first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 94KB, both
    Takeaway callouts, figures strip and Source filing link present.
  - Skipped: none this batch.
- Running total after this batch: **129 companies done, 145
  report-periods published** (128/144 before this batch + 1). This
  clears the second `next-batch -- --n 5` round (CSCO, MCD, TMO, IBM,
  QCOM) with zero skips — 9 companies published so far tonight across
  two full rounds.

- Batch 7 (~23:5x-00:0x JST, same firing): still well inside the
  window, ran a third `next-batch -- --n 5` round: INTU, NOW, GE, DIS,
  CAT (all hot-list, all fresh). Dispatched INTU and NOW as the first
  pair.
- Tier worked: **2-hot-list** (third round, started).
- Published:
  - **INTU** (Intuit) — **FY2026 ANNUAL** (10-K, fiscal year ended
    2026-07-31 — Intuit's fiscal year covers the whole 2026 US
    tax-filing season, not calendar 2026 — filed 2026-09-09, accession
    0000896878-26-000037):
    https://financial-reports-web.vercel.app/reports/cmubdgv37000304l8e717p0w7
    Revenue +13.9% to $21,448M, operating income +19.5% to $5,884M
    (margin 27.4% vs 26.1%), net income +18.0% to $4,566M, diluted EPS
    +20.4% to $16.46. Growth came from monetization, not expansion:
    Online Ecosystem ARPC +15% while paying customers grew only 3%, and
    TurboTax revenue +7% while filing 2% *fewer* federal returns (39.0M
    vs 39.9M) — offset by TurboTax Live growing 37% to 53% of TurboTax
    revenue. Mailchimp becomes a separate reportable segment from
    2026-08-01; restated, it subtracts 8pts from Online Services growth
    (+16% reported vs +24% ex-Mailchimp), with FY2027 Mailchimp guided
    to -1% to 0%. $8.8B operating cash flow (+42%) was boosted by OBBBA
    R&D expensing cutting cash taxes; $293M of 2026 Plan restructuring
    suppressed reported operating income (~25% growth ex-restructuring).
    FY2027 guidance: revenue decelerating to +9-10% (TurboTax only
    +2-3%) but operating income +26-27%; non-GAAP EPS will stop
    excluding stock comp from 2026-08-01, so FY2027 non-GAAP EPS will
    look like a decline against FY2026's $24.27 despite real growth.
    INTU's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 90KB, Takeaway
    callout, metrics tables and Source filing link present.
  - Skipped: none this batch.
- Running total after this batch: **130 companies done, 146
  report-periods published** (129/145 before this batch + 1).
  - **NOW** (ServiceNow) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-07-23, accession 0001373715-26-000076):
    https://financial-reports-web.vercel.app/reports/cmubdhyt6000105jnv2z2q5me
    Revenue +24.0% to $3,987M (subscription $3,877M, +24.5%) but GAAP
    operating income fell 54.7% to $162M (margin 4.1% vs 11.1%) — the
    entire $196M swing traces to acquisition accounting and comp:
    purchased-intangible amortization $25M->$219M, deal costs
    $14M->$75M, severance $29M->$62M, stock comp $499M->$655M, against
    a non-repeating $30M prior-year impairment; non-GAAP operating
    margin was essentially flat (29.4% vs 29.7%). Driver: $8.8B of
    security M&A in H1 2026 (Armis $7.6B closed 2026-04-20, Veza $1.2B
    closed 2026-03-02), funded by a $4.0B term loan refinanced into
    $4.0B of senior notes plus $2.1B commercial paper, flipping net
    interest from a $110M quarterly tailwind to $4M. Subscription gross
    margin fell from 80% to 73%, roughly half from non-amortization
    hosting cost (third-party cloud spend +$63M) that management guides
    to persist (FY26 guided to 75%). Demand looks intact: cRPO $13.20B
    and RPO $29.0B both +21%, $5M+ ACV customers +23.5% to 658, renewal
    rate steady at 98% — though $149M of upfront self-hosted revenue and
    pulled-forward US Federal on-premise revenue flattered the quarter,
    and $273M of unrealized strategic-investment gains (excluded from
    non-GAAP) propped up GAAP net income. FY2026 subscription revenue
    guidance raised to $15,760-15,780M (+22.5%). NOW's first report on
    the site.
    Post-publish sanity check: cache-busted re-fetch, 76KB, metrics
    strip and Source filing link present, not truncated.
  - Skipped: none this batch.
- Running total after this batch: **131 companies done, 147
  report-periods published** (130/146 before this batch + 1). GE, DIS,
  CAT carry over to the next batch within this firing.

- Batch 8 (~00:0x JST, same firing): dispatched GE and DIS, the next
  two tickers from the third `next-batch` round.
- Tier worked: **2-hot-list** (continued).
- Published:
  - **GE** (GE Aerospace) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-07-16, accession 0000040545-26-000049):
    https://financial-reports-web.vercel.app/reports/cmubdou2k000104l7pnic4eiz
    Revenue +21.1% to $13,349M on services +23.6% (internal shop-visit
    revenue +25%, spare parts +25%) and commercial engine shipments +25.5%
    to 659 units (LEAP +24.4%). GAAP profit margin fell 70bps to 21.0%
    (non-GAAP operating margin -130bps to 21.7%) because low-margin
    new-engine deliveries — the 10-Q names "install engine growth
    (including GE9X), investments, and inflation" — outgrew services;
    the margin decline is the cost of backlog growth, not cost
    deterioration. Diluted continuing EPS +23% to $2.30 outran 17%
    pre-tax profit growth on a lower 14.5% tax rate (OBBBA benefits) and
    $2.0B of Q2 buybacks; GAAP EPS sits *above* adjusted EPS of $2.02
    because run-off insurance (+$0.13), non-operating pension income
    (+$0.13) and equity gains (+$0.05) are excluded from the adjusted
    figure. Backlog (RPO) $210,790M, 85% contracted services. Full-year
    guidance raised across the board: adjusted EPS to $7.65-7.85 from
    $7.10-7.40, FCF to $8.9-9.2B from $8.0-8.4B. One flagged non-repeat:
    2026 IEEPA tariff refunds plus a Q1 reversal of the prior-year
    tariff charge flatter the YoY comparison. GE's first report on the
    site.
    Post-publish sanity check: cache-busted re-fetch, 100KB, Takeaway
    callout, metrics tables and Source filing link present.
  - Skipped: none this batch.
- Running total after this batch: **132 companies done, 148
  report-periods published** (131/147 before this batch + 1).
  - **DIS** (Walt Disney Company) — **fiscal Q3 2026** (published as
    year 2026, period Q3 — Disney's fiscal year ends early October, so
    this quarter is the three months ended 2026-06-27, a 53-week
    FY2026; 10-Q filed 2026-08-05, accession 0001744489-26-000057):
    https://financial-reports-web.vercel.app/reports/cmubdptyk000404l89mindi02
    Revenue +6.8% to $25,248M, total segment operating income +21.4% to
    $5,555M (margin 19.3%->22.0%), but reported net income fell 49.9%
    to $2,638M and diluted EPS fell 48.3% to $1.51 — almost entirely a
    comp distortion: the year-ago quarter had a $3,277M non-cash tax
    benefit from reclassifying Hulu for US tax purposes (prior-year
    effective tax rate -85.1% vs 22.0% now), while this quarter absorbed
    an $812M non-cash impairment of the A+E investment; adjusted EPS
    rose 28% to $2.06. Entertainment SVOD (Disney+/Hulu on-demand)
    operating income more than doubled to $712M on 11.3% revenue growth
    (margin 6.6%->12.9%, subscription fees +~15% on 9pts of subscriber
    growth) — Disney no longer discloses a Disney+ subscriber count.
    Sports was the weak segment: operating income -17.3% to $858M
    (missing its own ~14% decline guidance) on NBA-renewal programming
    costs shifting into Q3, NBA playoff sweeps, and the unresolved NFL
    Network/Comcast Xfinity carriage dispute. Experiences grew operating
    income 19.9% to $3,017M (domestic parks +27% OI, 91% hotel
    occupancy, new cruise ships) but international parks OI fell 13% on
    Asia softness expected to persist into Q4. Guidance: FY2026 adjusted
    EPS growth ~12% ex-53rd week (~16% including), Q4 segment OI ~$4.9B,
    buybacks raised to at least $9B. DIS's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 81KB, Takeaway
    callout, metrics/tables and Source filing link present.
  - Skipped: none this batch.
- Running total after this batch: **133 companies done, 149
  report-periods published** (132/148 before this batch + 1). CAT
  carries over to the next batch within this firing.

- Batch 9 (~00:1x JST, same firing): dispatched CAT, the last ticker
  from the third `next-batch` round, completing it.
- Tier worked: **2-hot-list** (third round completed).
- Published:
  - **CAT** (Caterpillar) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-08-05, accession 0000018230-26-000046):
    https://financial-reports-web.vercel.app/reports/cmubdvggi000504l8svaisbr9
    Caterpillar's first $20B quarter — sales and revenues $20.543B,
    +24% YoY ($3.1B volume, $595M price, only $199M currency); diluted
    EPS $7.77 vs $4.62, profit $3.593B vs $2.179B. Reported operating
    margin 20.9% (vs 17.3%) is flattered by a one-off **$392M of
    expected IEEPA tariff recoveries** booked into cost of goods sold
    after the Supreme Court's 2026-02-20 ruling struck down those
    tariffs; excluding it, operating profit was ~$3.90B (+36%) on a
    ~19.0% margin, with ~$2.2B of 2026 tariff cost still expected and no
    further recoveries assumed in the H2 outlook. Construction
    Industries drove the quarter (sales +35%, segment profit +57%,
    margin 23.3% vs 20.1%), but **$1.9B of H1 sales went into dealer
    inventory** (H1 dealer build $2.6B vs $0.2B last year), which
    management expects to unwind with a $1.0B+ Q4 destock. Firm backlog
    reached **$72.1B, up 92% from $37.5B a year ago** (+$9.4B QoQ,
    largest increase in Power & Energy on data-centre-driven Power
    Generation demand, +29%); full-year guidance set at mid-to-high-
    teens revenue growth. CAT's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 77KB, Takeaway
    callout, metrics table and Source filing link present.
  - Skipped: none this batch.
- Running total after this batch: **134 companies done, 150
  report-periods published** (133/149 before this batch + 1). This
  clears the third `next-batch -- --n 5` round (INTU, NOW, GE, DIS,
  CAT) with zero skips — **15 companies published so far tonight**
  across three full rounds, still comfortably inside the operating
  window (00:12 JST, ~4h48m left) with no signs yet of the account's
  5-hour session limit. Continuing with a fourth round since research
  quality is holding and there's no signal to stop.

- Batch 10 (~00:1x JST, same firing): ran `next-batch -- --n 5` a fourth
  time: GS, MS, T, VZ, UBER. Dispatched GS and MS as the first pair —
  both required careful company-name disambiguation, since the admin
  dropdown has several unrelated same-name-prefix entries (Goldman
  Sachs BDC / STRATS trust; several Morgan Stanley closed-end funds).
  Both subagents verified they published against the correct ticker.
- Tier worked: **2-hot-list** (fourth round, started).
- Published:
  - **GS** (Goldman Sachs) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-08-03, accession 0000886982-26-000297):
    https://financial-reports-web.vercel.app/reports/cmube1sg6000604l8pbkchyqy
    Net revenues +39.5% to $20.34B, net earnings +78.0% to $6.63B,
    diluted EPS +92.3% to $20.98, annualized ROE 23.5% vs 12.8%. Global
    Banking & Markets drove nearly all of it ($15.52B, +53%): Equities
    $7.42B (+72%, prime financing +91% into a 15% S&P 500 rally),
    investment banking fees $3.40B (+55%, equity underwriting more than
    doubled, advisory only +17%). Quality-of-earnings flags: the
    prior-year quarter carried $384M of credit-card provisions vs $102M
    this year (~6pts of profit growth); FICC gains are management's own
    "improved market-making conditions on our inventory," not client
    flow; AWM's Investments line tripled on private-equity marks;
    Platform Solutions fell 64% on Apple Card markdowns against a
    $19.5B held-for-sale book being transitioned to another issuer. H1's
    18.5% effective tax rate was flattered by ~$965M of share-based-
    award benefits, but Q2's own rate was a clean 22.6% so the quarter's
    EPS isn't inflated by it. Quarterly dividend raised to $5.00 from
    $4.50 (2026-07-13). GS's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 66KB, figures
    strip matches body table exactly, Takeaway callout and Source
    filing link present.
  - Skipped: none this batch.
- Running total after this batch: **135 companies done, 151
  report-periods published** (134/150 before this batch + 1).
  - **MS** (Morgan Stanley) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-08-04, accession 0000895421-26-000212):
    https://financial-reports-web.vercel.app/reports/cmube3ak4000204l7d7jbfocc
    Net revenues +27% to $21,348M, net income applicable to MS +58% to
    $5,581M (diluted EPS $3.46 vs $2.13, +62%), ROTCE 26.6%, expense
    efficiency ratio improved to 65% from 71%. Growth is narrow:
    Institutional Securities supplied $3,397M of the $4,556M revenue
    increase, driven by equity trading +69% to $6,300M (mostly Asia,
    +71% regionally) plus investment banking +58% to $2,437M on
    completed M&A and IPO/convertible issuance. Two comp effects
    flagged: the prior-year quarter had a $377M DCP mark-to-market gain
    no longer routed through revenue (comparable growth is 30%, not
    27%, by the firm's own disclosure), and Wealth Management's
    headline $148.1B of net new assets is over half Workplace-channel
    IPO vesting inflows — the cleaner fee-based flow measure actually
    *fell* to $39.1B from $42.8B. Investment Management AUM +17% to
    $2,004B but revenue only +6% as blended fee rate compressed to
    28bps from 31bps on mix shift into lower-fee Parametric products
    ($13B of equity net outflows). CET1 14.9% vs 11.8% requirement,
    dividend raised to $1.15 from $1.00, $1.5B of buybacks; SLR fell to
    4.9% from 5.4% as total assets grew 18% in six months to $1,675B.
    MS's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 83KB, confirmed
    correct company (`/companies/ms`, tickerSymbol MS — not any of the
    similarly-named funds), Takeaway callout and Source filing link
    present.
  - Skipped: none this batch.
- Running total after this batch: **136 companies done, 152
  report-periods published** (135/151 before this batch + 1). T, VZ,
  UBER carry over to the next batch within this firing.

- Batch 11 (~01:1x JST, this session — a fresh session picked up this
  same firing's in-progress state from disk: local `master` had again
  gone detached/diverged from `origin/master`, confirmed no unique local
  commits beyond the shared history and reset to `origin/master`, which
  matched HEAD exactly (`dbb8119`) — no data lost). Network check: bare
  `curl https://www.sec.gov/` (no `User-Agent`) returned SEC's own
  "Request Rate Threshold Exceeded" 403 (Akamai-served, confirmed via
  the proxy status endpoint showing zero relay failures, i.e. the
  request reached SEC) — not a proxy/policy denial; retried with the
  required `User-Agent` header and got a clean 200. `scan-recent-filings`
  (tier 0): 0 fresh candidates. `next-batch -- --n 6` returned T, VZ,
  UBER, PLTR, COIN, INTC (T/VZ/UBER carrying over as expected, plus 3
  new). Dispatched T and VZ in parallel.
- Tier worked: **2-hot-list** (fourth round, continued).
- Published:
  - **VZ** (Verizon) — **Q2 2026** (10-Q, period end 2026-06-30, filed
    2026-07-31, accession 0000732712-26-000046):
    https://financial-reports-web.vercel.app/reports/cmubimcf0000004l9qh092k6n
    Reported revenue -0.7% to $34,253M, operating income -12.2%, diluted
    EPS -22.0% to $0.92 — driven almost entirely by $1,810M of pre-tax
    special items ($0.38/sh after tax, vs $192M a year ago), principally
    a $746M non-deductible write-down on the international wireline
    business being contributed to a BT joint venture plus $397M of fresh
    severance; ex-items adjusted EPS actually rose 6.6% to $1.30. The
    3.5% service-revenue growth cited to validate the strategy is
    smaller than Frontier's contribution alone: fiber broadband revenue
    rose $712M "primarily due to the inclusion of Frontier results"
    while postpaid revenue fell $365M on promotional/acquisition-
    discount amortization (184k postpaid phone net adds vs -9k, but
    ARPA -1.4% — buying volume with price). FWA net adds fell 30.6%;
    interest expense +21.1% on $25.4B higher average debt from the
    $9.8B Frontier deal. Guidance raised for the second straight quarter
    (adjusted EPS $4.99-$5.04, FCF growth 9-10%). VZ's first report on
    the site.
    Post-publish sanity check: cache-busted re-fetch, full body through
    the final sentence, both GFM tables closed, Takeaway callout and
    Source filing link present, not truncated.
  - **T** (AT&T) — **no new report-period published.** The research
    subagent independently found and read the same Q2 2026 10-Q (period
    end 2026-06-30, filed 2026-07-22, accession 0000732717-26-000297)
    but the admin form's own uniqueness check rejected the submission:
    a complete AT&T Q2 2026 report already existed on the live site
    (https://financial-reports-web.vercel.app/reports/cmube9nmp000204k0a2ky69ed,
    published earlier today, 2026-09-21) — evidently from **a second,
    concurrent firing of the nightly routine racing this one**, since
    `report-tracker.json` had no `T` entry yet when this batch started
    (confirmed by both this session's and the subagent's independent
    read) and `origin/master` had not moved past `dbb8119` when this
    batch began. The subagent verified the live report against its own
    independently-read figures (revenue $31,558M, operating income
    $7,038M, net income $4,627M, diluted EPS $0.66, adjusted EPS $0.65
    vs $0.54) — they matched line-for-line, so the existing report is
    correct and complete; left it as-is rather than overwriting via
    `--edit`. **Flagging this race for the user/orchestration:** if two
    sessions are firing on `trig_01GNdUY59Na4x3JxMr6p7mxK` concurrently
    tonight, that wastes a research pass per duplicate (as CLAUDE.md
    warns) and risks a tracker/nightly-log write conflict — this session
    could not check `RemoteTrigger` run history to confirm (tool not
    available in this session's toolset) and proceeded carefully
    (re-fetching `origin/master` before each commit) rather than
    stopping outright, since AT&T's own report is intact and no data
    was lost.
    Backfilled the tracker entry for T (previously missing) using the
    subagent's verified filing details, since a live-site report
    existed but nothing had recorded it yet.
- Skipped: none this batch (T needed no action — already covered).
- Running total after this batch: **137 companies done** (136 + T
  backfilled since it was already live but untracked), **153
  report-periods published** (152 + VZ). PLTR, COIN, INTC carry over to
  the next batch within this firing (UBER also still pending — see
  below for whether the concurrent run touches it first).

- Batch 12 (~02:2x JST, same session): re-ran `admin-publish -- --list`
  to confirm clean dropdown entries for UBER, PLTR, COIN, INTC (no
  further collisions found this time) and dispatched UBER and PLTR in
  parallel, each instructed to check for an existing live report before
  doing any research (to avoid wasting a pass if the suspected
  concurrent firing had already covered either).
- Tier worked: **2-hot-list** (fourth round, continued).
- Published:
  - **UBER** (Uber Technologies) — **Q2 2026** (10-Q, period end
    2026-06-30, filed 2026-08-05, accession 0001543151-26-000032):
    https://financial-reports-web.vercel.app/reports/cmubivbmp000204l9m5vy44cg
    Reported revenue +12% to $14.19B badly understates the business — a
    2026-01-02 UK business-model change moved driver payments from cost
    of revenue to a reduction of revenue, cutting reported revenue by
    $1.1B (8pts of growth), while Gross Bookings grew 24% to $58.02B and
    Trips +18% to 3.87B on 208M MAPCs (+16%). Net income +77% to $2.39B
    ($1.17 diluted EPS) is three-quarters a $1.6B pre-tax paper
    revaluation of equity stakes (Delivery Hero +$1.1B, Aurora +$899M,
    Didi -$437M) that reversed against Uber only one quarter earlier —
    H1 net income actually fell YoY. Cleaner margin read: operating
    income as % of Gross Bookings 3.10%->3.26%, Adjusted EBITDA
    4.5%->4.9%. Delivery overtook Mobility on growth (bookings +26%);
    S&M/G&A costs (+25%/+40%, the latter on legal accruals) outpaced
    trip growth. Q3 guidance $58.25-60.25B bookings, $0.84-0.88 non-GAAP
    EPS. UBER's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 76KB, Takeaway
    callout, metrics tables, Source filing link and closing sentence all
    present, not truncated.
  - **PLTR** (Palantir Technologies) — **Q2 2026** (10-Q, period end
    2026-06-30, filed 2026-08-04, accession 0001321655-26-000041):
    https://financial-reports-web.vercel.app/reports/cmubivqoa000304l90zvv7b3s
    Revenue +92.8% to $1,935.5M, operating margin 47.1% vs 26.8%, net
    income +225.0% to $1,061.9M, diluted EPS $0.41 vs $0.13 — but this
    was an expansion quarter, not new-logo growth: 98% of the $437M
    government revenue increase and 82% of the $495M commercial increase
    came from customers already on the books at 2025-12-31 (S&M grew
    only 39% against 93% revenue growth). Three distortions flagged: a
    ~1.4% effective tax rate ($15.4M on $1,081.3M pretax), $66M of
    unrealized mark-to-market gains buried in other income (16% of
    pretax income came from below the operating line), and adjusted net
    income ($1,047.0M) sitting *below* GAAP net income on a $297.4M tax
    adjustment. Soft spot: stripping the record $2.132B US commercial
    TCV out of the $3.373B total leaves ~$1.24B elsewhere vs ~$1.42B a
    year ago (~13% decline); international revenue grew just 34% vs 115%
    in the US. FY2026 guidance raised (revenue $8.150-8.158B) but implies
    deceleration to ~83% YoY in Q3, ~72% in Q4. PLTR's first report on
    the site.
    Post-publish sanity check: cache-busted re-fetch, full body through
    the closing "Sources and definitions" bullet, both GFM tables,
    Takeaway callout and Source filing link present, figures strip
    matches body table exactly.
  - Skipped: none this batch.
- Running total after this batch: **139 companies done, 155
  report-periods published** (137/153 before this batch + 2). COIN,
  INTC carry over to the next batch within this firing.

- Batch 13 (~02:3x JST, same session): dispatched COIN and INTC, the
  last two tickers from this round's `next-batch` output, completing
  it. No further duplicate-submission collisions this batch — both
  subagents confirmed no existing report before researching.
- Tier worked: **2-hot-list** (fourth round, completed).
- Published:
  - **COIN** (Coinbase Global) — **Q2 2026** (10-Q, period end
    2026-06-30, filed 2026-07-30, accession 0001679788-26-000088):
    https://financial-reports-web.vercel.app/reports/cmubj2gcm000004jpipmzq6zl
    Total revenue $1,220.1M (-18.5% YoY), net loss $359.5M vs $1,428.9M
    profit a year ago, diluted EPS -$1.36 vs $5.14, Adjusted EBITDA
    $207.8M (-59%). Last year's profit was almost entirely a $1.47B
    non-operating mark-up on Coinbase's Circle stake post-IPO; this
    quarter carried $209.5M of losses on its own Bitcoin/Ethereum
    holdings. Adjusting both years for one-offs (this year's $52.4M
    restructuring covering ~700 job cuts, last year's $306.7M
    data-theft costs) still shows underlying operating profit of ~$282M
    turning into a ~$55M loss. Consumer transaction revenue -31% on a
    38% drop in consumer spot volume; institutional +65% almost
    entirely from the acquired Deribit business; stablecoin revenue -5%
    on a $55.9M interest-rate headwind despite growing USDC balances.
    Assets on platform $245.9B (-42%), MTUs 7.6M (-13%); 26%-of-revenue
    single-counterparty concentration flagged; Coinbase retired Trading
    Volume as a disclosed key metric this quarter. COIN's first report
    on the site.
    Post-publish sanity check: cache-busted re-fetch, 78KB, final
    sentence, Takeaway callout, Source filing link and metrics strip
    all present, not truncated.
  - **INTC** (Intel) — **Q2 2026** (10-Q, period end 2026-06-27, filed
    2026-07-24, accession 0000050863-26-000157):
    https://financial-reports-web.vercel.app/reports/cmubj2yiy000104jpduk38f4s
    Revenue +25.4% to $16,128M, gross margin +12.9pts to 40.4%,
    operating income swung to +$1,796M from -$3,176M — but a **$12.5B
    non-cash mark-to-market loss** on shares escrowed for the US
    Department of Commerce under the August 2025 CHIPS "Secure Enclave"
    agreement (a charge that grows as Intel's stock rises) drove a net
    loss attributable to Intel of $11,033M, $(2.16)/share, vs non-GAAP
    EPS of $0.42. Growth is ASP/mix-led (client ASPs +27% on 8% lower
    volume; server ASPs +48% on 9% volume); roughly half the
    gross-profit improvement is the absence of Q2 2025 period charges
    including a $797M impairment. Foundry's narrower $(2,089)M loss
    also leans on absent charges while 18A wafers are currently
    dilutive. $14.2B buyout of Apollo's 49% Ireland SCIP (Fab 34) stake
    funded by $6.5B of new senior notes. Q3 2026 guidance: $15.8-16.8B
    revenue, GAAP EPS $0.31. INTC's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, final sentence
    present, Takeaway callout, Source filing link and figures strip
    (revenue, EPS, operating margin) all present, not truncated.
  - Skipped: none this batch.
- Running total after this batch: **141 companies done, 157
  report-periods published** (139/155 before this batch + 2). This
  clears the fourth `next-batch -- --n 5/6` round (GS, MS, VZ, UBER,
  PLTR, COIN, INTC — T needed no new work, already live) with zero
  skips. **23 companies published so far tonight** across four full
  rounds (this session continuing the same operating-window firing that
  produced batches 1-10 earlier). Still well inside the window (~02:35
  JST, ~2h25m left).

- Batch 14 (~02:3x-02:4x JST, same session): ran `next-batch -- --n 5`
  a fifth time: MU, PYPL, BA, NKE, SBUX (all hot-list, all fresh).
  Dispatched MU and PYPL as the first pair.
- Tier worked: **2-hot-list** (fifth round, started).
- Published:
  - **MU** (Micron Technology) — **fiscal Q3 FY2026** (published as year
    2026, period Q3 — Micron's fiscal year ends early September, so
    this quarter covers ~March-May 2026, period end 2026-05-28; 10-Q
    filed 2026-06-25, accession 0000723125-26-000015):
    https://financial-reports-web.vercel.app/reports/cmubjaoux000404l9phcbzmwt
    Revenue $41,456M, +346% YoY from $9,301M, operating margin 80.4%
    (vs 23.3%), diluted EPS $24.67 (vs $1.68) — the MD&A frames it
    explicitly as a pricing event, not a volume boom: DRAM ASPs up
    "low-260% range" on only a "low-20% range" bit-shipment increase,
    NAND ASPs up "mid-310%" on low-double-digit bits, so cost of goods
    sold rose only 10% against quadrupled revenue. Mobile and Client
    revenue +254% at an 86% operating margin on *lower* bit shipments —
    supply reallocated to data center. New multi-year take-or-pay
    strategic customer agreements trade cycle upside for a floor: the
    10-Q states the largest agreements' ceiling price "approximates the
    market price in the second calendar quarter of 2026" — the quarter
    just reported — against only ~$5B of disclosed remaining
    performance obligations. $9.38B of 9-month debt prepayment vs just
    $650M of buyback; structural tax-rate step-up to 15.0% from
    Singapore's Pillar Two enactment. FQ4 guidance: $50.0B ±$1.0B
    revenue, ~86% gross margin, $30.73 ±$1.00 GAAP EPS. MU's first
    report on the site.
    Post-publish sanity check: cache-busted re-fetch, metrics strip, all
    four GFM tables, Takeaway callout, Source filing link and final
    paragraph all present, not truncated.
  - **PYPL** (PayPal) — **Q2 2026** (10-Q, period end 2026-06-30, filed
    2026-07-28, accession 0001633917-26-000082):
    https://financial-reports-web.vercel.app/reports/cmubjafse000004jn3nelxhuk
    Total payment volume +10% to $486.4B but net revenues only +4.8% to
    $8,682M (3% currency-neutral); GAAP operating income -5.1% to
    $1,427M (margin -171bps to 16.4%), net income -12.5% to $1,104M,
    diluted EPS -3.1% to $1.25. Take rate compressed 1.869%->1.785%
    (-8.4bps) as mix shifted to lower-rate Braintree processing while
    branded PayPal product revenue fell ~$130M on lower co-marketing and
    FX fee revenue; transaction expense rate ticked up to 0.90% on
    unfavorable funding mix, squeezing transaction margin dollars to
    just +1.5% growth on 10% volume growth. Three distortions flagged:
    an $80M FX tailwind (~20% of the revenue increase), a $27M credit
    reserve release masking net charge-offs that rose to $101M (rate
    4.8% vs 3.6%), and a 9.7% lower diluted share count converting a
    12.5% net income decline into just a 3.1% EPS decline. FY26
    non-GAAP EPS guidance raised to ~$5.38; the April 2026
    reorganization's $1.5B run-rate savings target is still almost
    entirely ahead ($44M of charges booked so far). PYPL's first report
    on the site.
    Post-publish sanity check: cache-busted re-fetch, full 14-row
    metrics table, Takeaway callout, guidance section and source-filing
    line all present, not truncated.
  - Skipped: none this batch.
- Running total after this batch: **143 companies done, 159
  report-periods published** (141/157 before this batch + 2). BA, NKE,
  SBUX carry over to the next batch within this firing.

- Batch 15 (~02:4x JST, same session): dispatched BA and NKE, the next
  two tickers from the fifth `next-batch` round.
- Tier worked: **2-hot-list** (continued).
- Published:
  - **BA** (Boeing) — **Q2 2026** (10-Q, period end 2026-06-30, filed
    2026-07-28, accession 0001628280-26-050038):
    https://financial-reports-web.vercel.app/reports/cmubji0rh000204jpntujfdf0
    Revenue +8.0% to $24,560M, GAAP operating earnings $156M vs a
    $176M loss a year ago — but $445M of that $332M swing is just the
    absence of Q2 2025's DOJ charge; segment operating earnings only
    moved $602M->$631M and core (non-GAAP) operating earnings were $1M.
    Net loss narrowed to $444M ($0.67 diluted LPS) as $600M of quarterly
    interest expense and a swing to non-operating pension expense offset
    the operating gain. Commercial Airplanes delivered 171 aircraft (vs
    150), nearly all growth from the 737 (129 vs 104, line transitioning
    42->47/month) with ~40 uncertified 737-7/-10 still parked in
    inventory; Defense swung to a $15M operating loss on a fresh $280M
    VC-25B (Air Force One) reach-forward loss. H1 free cash flow
    improved to -$823M from -$2,490M, driven by a $4.66B customer-advance
    build against a $3.86B inventory build; total debt fell to $45.9B
    from $54.1B, backlog a record $715.3B. BA's first report on the
    site.
    Post-publish sanity check: cache-busted re-fetch, metrics table,
    Takeaway callout, Source filing link and closing sentence present,
    not truncated.
  - **NKE** (Nike) — **FY2026 ANNUAL** (10-K, fiscal year ended
    2026-05-31 — Nike's fiscal year is not calendar 2026, but FY2026
    results are already fully out, so this qualifies as the "ANNUAL"
    2026 report; filed 2026-07-15, accession 0000320187-26-000088):
    https://financial-reports-web.vercel.app/reports/cmubjik7y000304jpsu7mifjs
    Revenue flat at $46,398M (+0.2% reported, -2% currency-neutral — FX
    supplied the entire reported gain), gross margin +20bps to 42.9%,
    EBIT +1.9% to $3,850M, but net income -3.4% to $3,108M and diluted
    EPS -2.8% to $2.10 — not operational: pre-tax income was flat at
    $3,900M and the entire EPS decline is the effective tax rate rising
    17.1%->20.3% against a prior-year one-time non-cash deferred tax
    benefit. A $986M IEEPA tariff recovery booked into Q4 cost of sales
    ($965M to North America) largely offsets tariffs expensed earlier in
    the year but distorts North America's +210bps margin/+14% EBIT
    shape, with $684M still a receivable at year-end contributing to
    operating cash flow falling 22% to $2,868M (below net income).
    Deliberate channel remix: wholesale +6% to $27,453M vs Nike Direct
    -6% to $17,720M (digital -12% cn). North America recovered (+5% cn)
    while Greater China (-13% cn, EBIT -20%) and Converse (-32% cn, EBIT
    $240M->$18M) deteriorated; management says both keep hurting through
    fiscal 2027. Buybacks paused ($122M for the year, none in Q4). NKE's
    first report on the site.
    Post-publish sanity check: cache-busted re-fetch, metrics/segment
    tables, Takeaway callout, outlook section and closing sentence
    present, not truncated (confirmed the page source's `$$` is React
    Flight's escaping of a leading `$`, not a rendering defect).
  - Skipped: none this batch.
- Running total after this batch: **145 companies done, 161
  report-periods published** (143/159 before this batch + 2). SBUX
  carries over to the next batch within this firing.

- Batch 16 (~02:5x JST, same session): dispatched SBUX, the last ticker
  from the fifth `next-batch` round, completing it.
- Tier worked: **2-hot-list** (fifth round completed).
- Published:
  - **SBUX** (Starbucks) — **fiscal Q3 2026** (published as year 2026,
    period Q3 — Starbucks' fiscal year ends late September/early
    October, so this quarter is the 13 weeks ended 2026-06-28; 10-Q
    filed 2026-07-29, accession 0000829224-26-000130):
    https://financial-reports-web.vercel.app/reports/cmubjq9ek000004lbdkaa0iwu
    Revenue fell 1.4% to $9,322.7M, but only because the China retail
    business was deconsolidated mid-quarter when Boyu Capital took a 60%
    stake (removing $776M of company-operated revenue and converting
    7,991 stores to licensed). Underlying demand was the strongest of
    the "Back to Starbucks" turnaround: global comps +7.9% with
    transactions (+4.2%) leading ticket (+3.5%), North America comps
    +8.1%. GAAP EPS $0.91 (+85.7%) is distorted both ways — a $0.47/share
    divestiture gain offset by a $302.6M restructuring charge (mostly a
    $217.4M Reserve/Roastery write-down) — so non-GAAP EPS $0.85 (+70%)
    and non-GAAP operating margin 14.4% (+430bps vs GAAP's +60bps) are
    the better read; a one-off IEEPA tariff refund covering three
    quarters flattered product costs and drove ~1,370bps of Channel
    Development's 700bps margin jump. FY2026 guidance raised: non-GAAP
    EPS $2.55-$2.65, non-GAAP operating margin >11.0%, Q4 US comps
    >=6.5%. SBUX's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, full article
    through the closing "Source:" paragraph, both GFM tables, Takeaway
    callout, metrics strip and Source filing link present, not
    truncated.
  - Skipped: none this batch.
- Running total after this batch: **146 companies done, 162
  report-periods published** (145/161 before this batch + 1). This
  clears the fifth `next-batch -- --n 5` round (MU, PYPL, BA, NKE, SBUX)
  with zero skips — **10 new report-periods published this session**
  (VZ, UBER, PLTR, COIN, INTC, MU, PYPL, BA, NKE, SBUX), plus T
  backfilled into the tracker as already-live from a concurrent run.
  Still comfortably inside the window (~03:00 JST, ~2h left).

- Batch 17 (~03:0x JST, same session): ran `next-batch -- --n 5` a
  sixth time: LOW, TGT, PFE, GILD, BKNG (all hot-list, all fresh).
  Dispatched LOW and TGT as the first pair.
- Tier worked: **2-hot-list** (sixth round, started).
- Published:
  - **LOW** (Lowe's) — **fiscal Q2 2026** (published as year 2026,
    period Q2 — Lowe's fiscal year ends late January, so this quarter
    covers May-July 2026, period end 2026-07-31; 10-Q filed 2026-08-27,
    accession 0000060667-26-000117):
    https://financial-reports-web.vercel.app/reports/cmubjw9ic000004jgmtnaw6q4
    Net sales +8.3% to $25,956M, net earnings flat at $2,399M, diluted
    EPS flat at $4.27, adjusted EPS $4.40 vs $4.33, operating margin
    -81bps to 13.67%. Two distortions flagged: ~90% of the $1,997M sales
    increase came from the FBM/ADG acquisitions (new "Other" segment:
    $1,941M of sales vs $138M LY, but only $3M of operating income),
    leaving actual retail-segment sales up just 0.8% with its own margin
    *improving* 18bps; and the entire adjusted-EPS gain is an $80M
    pre-tax IEEPA tariff refund worth $0.11/share that management's
    non-GAAP adjustment does not strip out — ex-refund adjusted EPS was
    ~$4.29 vs $4.33, down ~1%. Comps +0.2% but online contributed ~195bps,
    implying physical-store comps of roughly -1.75% (transactions -2.1%,
    ticket +2.3%). FY2026 guidance collapsed to the floor of each prior
    range (sales $92.0B, diluted EPS ~$11.75). LOW's first report on the
    site.
    Post-publish sanity check: cache-busted re-fetch, full content
    through the closing Source section, metrics table and Takeaway
    callout present, not truncated.
  - **TGT** (Target) — **Q2 2026** (10-Q, period end 2026-08-01, filed
    2026-08-28, accession 0000027419-26-000042):
    https://financial-reports-web.vercel.app/reports/cmubjx0d4000004jgdcp9pte8
    Net sales +5.3% to $26.54B, diluted EPS doubled to $4.11 from $2.05
    — but $1.65 of that EPS came from a single one-off: $994M of IEEPA
    tariff refunds recognized as a reduction of cost of sales after the
    February 2026 Supreme Court ruling. Ex-refund, operating income grew
    ~19% to ~$1,566M (margin ~5.9% vs 5.2%) and EPS rose ~20% to $2.46 —
    and even that gain is mostly the absence of last year's elevated
    markdowns/PO-cancellation costs rather than structural improvement.
    Comparable traffic +3.6% (vs -1.3% a year ago) drove a +3.8% comp,
    though the two-year net sales CAGR of just 2.1% shows how depressed
    the base was; apparel (+0.1%) and home (+0.2%) flat while food, Fun
    101 hardlines and beauty supplied 83% of the merchandise sales
    increase. SG&A rate rose to 21.6% from 21.3% despite 5.3% sales
    growth. FY2026 guidance raised to ~5% sales growth, ~6% operating
    margin, $9.90-$10.90 EPS (implying ~$8.25-$9.25 ex-refund); zero
    buybacks in H1 with $8.3B authorization remaining. TGT's first
    report on the site.
    Post-publish sanity check: cache-busted re-fetch, figures strip, all
    five GFM tables, Takeaway callout, Source filing link and final
    sentence present, not truncated.
  - Skipped: none this batch.
- Running total after this batch: **148 companies done, 164
  report-periods published** (146/162 before this batch + 2). PFE,
  GILD, BKNG carry over to the next batch within this firing.

- Batch 18 (~03:0x-03:1x JST, same session): dispatched PFE and GILD,
  the next two tickers from the sixth `next-batch` round.
- Tier worked: **2-hot-list** (continued).
- Published:
  - **PFE** (Pfizer) — **Q2 2026** (10-Q, period end 2026-06-28, filed
    2026-08-04, accession 0000078003-26-000095):
    https://financial-reports-web.vercel.app/reports/cmubk3lza000104jg3hjv6e79
    GAAP net loss $248M (vs $2,910M profit) driven entirely below the
    operating line: a $4.3B intangible impairment ($3.8B sigvotatug
    vedotin IPR&D from the Seagen deal after failed Phase 3 results,
    $525M Oxbryta after the FDA path closed in July 2026) plus $842M of
    legal charges, roughly two-thirds offset by a one-time $1.87B gain
    on the ViiV stake sale — adjusted diluted EPS essentially flat at
    $0.77 vs $0.78. Revenue +2.6% to $15,034M but only ~1% operationally
    (FX contributed $217M of the $381M increase); COVID products fell to
    $282M combined (Paxlovid $21M globally, zero in the US), so the rest
    of the portfolio grew ~6.6% reported / 5% operationally. Eliquis's
    +19% operational growth is driven by US net price/lower rebates
    rather than volume; Padcev's +23% is understated by a prior-year
    wholesaler-transition benefit; Comirnaty's -34% is partly an
    accounting returns-provision comp. FY2026 revenue guidance raised
    $500M at the midpoint to $60.5-62.5B; adjusted EPS reaffirmed
    $2.80-3.00 while absorbing ~$0.10 of Innovent dilution. PFE's first
    report on the site.
    Post-publish sanity check: cache-busted re-fetch, ~66KB, Takeaway
    callout, both tables, guidance section and Source filing link
    present, not truncated.
  - **GILD** (Gilead Sciences) — **Q2 2026** (10-Q, period end
    2026-06-30, filed 2026-08-06, accession 0000882095-26-000031):
    https://financial-reports-web.vercel.app/reports/cmubk399k000004l94xpoqswa
    Revenue +10.2% to $7,803M (product sales +8.1%), HIV franchise
    $5,693M (+12%) — Biktarvy $3,772M (+7%), Descovy $967M (+48%), the
    new Yeztugo/lenacapavir PrEP launch $232M vs $15M — plus Trodelvy
    $457M (+26%). Despite that, net loss of $10,496M, diluted EPS
    $(8.45) (vs +$1,960M/$1.56), caused by $11,183M of acquired-IPR&D
    expense (Arcellx $7.0B, Tubulis $3.1B, Ouro Medicines $1.0B net of
    Lakefront's $860M) and a $1,750M impairment after EVOKE-03 was
    discontinued; non-GAAP EPS $(6.75). Biktarvy's growth is partly
    price, wholesaler inventory build and cannibalization of Genvoya
    (-23%) and Odefsey (-20%); ~$560M of the R&D/SG&A increase is
    one-off acquisition stock comp; (2.4)% effective tax rate reflects
    non-deductible IPR&D. FY2026 ex-Veklury product sales guidance
    raised to $29.8-30.1B while GAAP EPS guidance cut to
    $(3.75)-$(3.40); cash and marketable securities fell from $10.6B to
    $3.2B. GILD's first report on the site (netIncomeYoyPct/epsYoyPct
    omitted as not meaningful — profit-to-loss swing, matching the
    filing's own "n.m." labeling).
    Post-publish sanity check: cache-busted re-fetch, metrics table,
    Takeaway callout, guidance table and Source filing link present,
    not truncated.
  - Skipped: none this batch.
- Running total after this batch: **150 companies done, 166
  report-periods published** (148/164 before this batch + 2). BKNG
  carries over to the next batch within this firing.

- Batch 19 (~03:1x JST, same session): dispatched BKNG, the last ticker
  from the sixth `next-batch` round, completing it.
- Tier worked: **2-hot-list** (sixth round completed).
- Published:
  - **BKNG** (Booking Holdings) — **Q2 2026** (10-Q, period end
    2026-06-30, filed 2026-08-04, accession 0001075531-26-000037):
    https://financial-reports-web.vercel.app/reports/cmubk8dn8000204jg91kygmm8
    Revenue +8.1% to $7,352M, operating income +11.1% to $2,500M
    (margin 34.0%, +0.9pt), but net income +117.9% to $1,950M and
    diluted EPS +130.0% to $2.53 — almost the entire EPS jump is a
    $1.17B swing in "Other income (expense), net" from FX remeasurement
    of Euro-denominated debt (a $180M gain vs a $989M loss), not
    operations; stripping that line from both periods, pre-tax income
    grew ~16%, not 132%. Room nights +5.3% to 325M (down from 6% in Q1)
    on continued Middle East conflict impacts; gross bookings +9.0% to
    $50,957M; take rate slipped to 14.4% from 14.5%. Margin gains came
    from flat personnel expense (+0.5% despite 3% headcount growth) and
    D&A -18.3%, while marketing grew faster than revenue (+10.8%) as SEO
    traffic declines — flagged as the key structural cost risk. 25-for-1
    stock split (2026-04-02, all per-share figures retroactively
    adjusted); tax rate rose 18.9%->23.8% on BBB Act provisions; $7.8B of
    H1 buybacks cut diluted shares 5.5%; raised ~$650M Transformation
    Program savings target; new July 2026 FTC staff action against
    Priceline noted. BKNG's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, headline, both
    tables, Takeaway callout, Outlook section and Source filing link
    present, not truncated.
  - Skipped: none this batch.
- Running total after this batch: **151 companies done, 167
  report-periods published** (150/166 before this batch + 1). This
  clears the sixth `next-batch -- --n 5` round (LOW, TGT, PFE, GILD,
  BKNG) with zero skips — **15 new report-periods published this
  session** (VZ, UBER, PLTR, COIN, INTC, MU, PYPL, BA, NKE, SBUX, LOW,
  TGT, PFE, GILD, BKNG), plus T backfilled as already-live from a
  concurrent run. Still inside the window (~03:20 JST, ~1h40m left).

- Batch 20 (~03:1x JST, same session): sent a push notification to the
  user summarizing tonight's progress and flagging the AT&T concurrent-
  firing race as worth a look. Then ran `next-batch -- --n 5` a seventh
  time: DASH, PANW, CRWD, LRCX, KLAC (all hot-list, all fresh).
  Dispatched DASH and PANW as the first pair.
- Tier worked: **2-hot-list** (seventh round, started).
- Published:
  - **DASH** (DoorDash) — **Q2 2026** (10-Q, period end 2026-06-30,
    filed 2026-08-05, accession 0001792789-26-000050):
    https://financial-reports-web.vercel.app/reports/cmubkeslh000104l9nwjxsbt7
    Revenue +35.6% to $4,454M, Marketplace GOV +36.4% to $33,078M on
    970M Total Orders (+27.5%) at a flat 13.5% take rate, but GAAP net
    income fell 29.8% to $200M and diluted EPS to $0.46 — income from
    operations only fell $7M, with nearly all of the profit decline
    sitting below the operating line in prior-year one-offs (a
    deal-contingent FX hedge gain and a one-time valuation-allowance tax
    benefit) plus lower interest income. Roughly a third of reported
    growth is inorganic — Deliveroo closed 2025-10-02 for $3,724M and is
    absent from the Q2 2025 base; management's own ex-Deliveroo rates
    are orders +17%, GOV +23%, revenue +24%. Acquired-intangible
    amortization (+$82M), a 52% R&D increase and a $108M jump in
    legal/tax/regulatory costs consumed the operating leverage. Q3 2026
    guidance: GOV $33.0-34.0B, Adjusted EBITDA $950M-$1.10B (roughly
    flat sequentially) — management's view is Q3 is the last quarter the
    Deliveroo comparison flatters growth. Free cash flow $742M (vs
    $355M), $6.2B cash/investments. DASH's first report on the site.
    Post-publish sanity check: cache-busted re-fetch, 3 GFM tables,
    Takeaway callout, Source filing link and figures strip present, not
    truncated.
  - **PANW** (Palo Alto Networks) — **FY2026 ANNUAL** (10-K, fiscal year
    ended 2026-07-31 — Palo Alto's fiscal year is not calendar 2026, but
    FY2026 results are already fully out, so this qualifies as the
    "ANNUAL" 2026 report; filed 2026-09-10, accession
    0001327567-26-000023):
    https://financial-reports-web.vercel.app/reports/cmubkfkh2000204l9a99gk5fw
    Revenue +24.5% to $11.48B, but GAAP operating income fell 44% to
    $695M (6.1% margin) and diluted EPS fell 75% to $0.40 — almost
    entirely the accounting consequence of ~$24.5B of acquisitions, led
    by the $21.1B CyberArk deal that closed 2026-02-11. Note 6 discloses
    CyberArk and Chronosphere contributed $930M of revenue and a $797M
    operating loss, implying the pre-existing business grew only ~14%
    (management's own pro forma table shows 17% like-for-like growth
    with a net loss in both years) — so the headline acceleration and
    the 63% jump in NGS ARR to $9.1B are largely purchased rather than
    produced. GAAP decline traces to $638M of acquired-intangible
    amortization, $1,815M of stock comp (15.8% of revenue), a doubled
    G&A line, and a $562M non-cash mark-to-market loss on CyberArk's
    assumed 2030 convertible notes that rises when PANW's own share
    price rises (also pushing the effective tax rate to 42.7%), against
    $4,414M of adjusted free cash flow. FY27 guidance: revenue
    $14.10-14.20B, NGS ARR $11.075-11.175B (only 22-23% once CyberArk is
    in both sides of the comparison), non-GAAP op margin 29.5%. $22B of
    goodwill now ~60% of total assets flagged as the main risk. PANW's
    first report on the site.
    Post-publish sanity check: cache-busted re-fetch, metrics table,
    Takeaway callout, guidance section and Source filing link present,
    not truncated.
  - Skipped: none this batch.
- Running total after this batch: **153 companies done, 169
  report-periods published** (151/167 before this batch + 2). CRWD,
  LRCX, KLAC carry over to the next batch within this firing.
  (This firing ended here — apparently the account's 5-hour session
  limit, per the standing "usage budget is the bottleneck" note in
  CLAUDE.md's Growth work section. CRWD/LRCX/KLAC were never actually
  published; confirmed by the 2026-09-22 night session finding all
  three still absent from `report-tracker.json`.)

### 2026-09-22 night (23:00 JST 2026-09-22 → 05:00 JST 2026-09-23)

- Mechanism: cloud routine (`trig_01GNdUY59Na4x3JxMr6p7mxK`), firing at
  ~23:17 JST (this session IS that firing — confirmed via
  `list_triggers`, `last_run.session_id` matches this session).
- Pre-batch housekeeping: `npm install` postinstall (`prisma generate`)
  failed on missing `DATABASE_URL` as expected in this DB-credential-free
  environment (worked around with a dummy value for that one call only,
  not persisted) — doesn't block `admin-publish`/`scan-recent-filings`.
  Local `master` was in detached HEAD (stale ref from container init);
  reset via `git fetch origin master && git checkout -B master
  origin/master`, discarded an incidental `package-lock.json` diff (npm
  lockfile metadata churn, not a real dependency change).
- Network check: plain `curl https://www.sec.gov/` (no User-Agent)
  returned 403 — confirmed via verbose headers/body to be SEC's own
  Akamai "Request Rate Threshold Exceeded" fair-access page (a real TLS
  handshake to the real sec.gov, not a proxy denial), not the
  09-12–09-14 network-policy blocker. Retried with the required
  `User-Agent` header: 200. The deployed site also returned 200
  independently. Network access confirmed fine tonight.
- `npm run scan-recent-filings` (tier 0): **1 fresh candidate** — TULP
  (Bloomia Holdings, Inc.), 10-K filed 2026-09-21.
- Batch 1 (~23:2x JST): published TULP via one opus subagent (run
  synchronously), independently re-verified live (cache-busted fetch:
  title tag, metrics table, Takeaway callout, Source filing link present,
  content ends on a complete sentence) before marking done.
- Tier worked: **0 (fresh filing)**.
- Published:
  - **TULP** (Bloomia Holdings, Inc.) — **FY2026 ANNUAL** (10-K, fiscal
    year ended 2026-06-30, filed 2026-09-21):
    https://financial-reports-web.vercel.app/reports/cmucrklfo000004jv01psxa58
    First full fiscal year under the new June 30 year-end and as
    "Bloomia Holdings" (renamed from Lendway, Inc.; ticker LDWY→TULP,
    Feb 2026) — no directly comparable prior 12-month audited period, so
    the report uses the filing's own unaudited 12-months-ended
    2026-06-30 comparison, flagged as such. Revenue roughly flat (-0.6%)
    but gross margin fell 16.4% from 20.9% on a 21% jump in average bulb
    price plus a stronger euro and over $2.5M of industry-wide
    mite-related bulb waste in Q4, only partly offset by a 12% price
    increase. Net loss widened to $11.18M, driven by an $11.1M goodwill
    write-off (goodwill now zero) and a $2.0M trade-name impairment,
    partly offset by a $7.0M gain on debt settlement from a Q1
    calendar-2026 rights offering that also cut cash but raised
    ~173% share dilution. Three consecutive covenant breaches (all
    waived) led to a Sept 16, 2026 waiver/amendment — five days before
    this 10-K — resetting covenants and starting a refinancing clock;
    no going-concern qualification. Management states FY2027 bulb costs
    are contracted near FY2025 levels with margin improvement expected,
    but gives no numeric guidance.
  - Skipped: none this batch.
- Running total after this batch: **154 companies done, 170
  report-periods published** (153/169 before this batch + 1).
- Batch 2 (~23:4x JST, same firing): tier 0 now empty, so per
  `npm run next-batch -- --n 5` (which orders fresh filings, overdue
  pending, hot list, then S&P 500, then us-listed): dispatched the
  carried-over hot-list tickers from last night — **CRWD, LRCX, KLAC,
  TXN** — as 4 parallel opus subagents. All 4 succeeded; each
  independently re-verified live (cache-busted fetch: title, metrics
  table(s), Takeaway callout, Source filing link, content ends on a
  complete sentence) before being marked done.
- Tier worked: **2-hot-list** (completes the round carried over from
  09-21 night).
- Published:
  - **CRWD** (CrowdStrike Holdings) — Q2 2026 (fiscal Q2 FY2027 by the
    company's own Jan-31-FYE label; 10-Q, period end 2026-07-31, filed
    2026-08-27): https://financial-reports-web.vercel.app/reports/cmucrrun3000004la6jucr1mc
    Revenue +25.8% to $1,470.9M; GAAP flipped to a thin $5.3M profit
    ($0.01 diluted) only via $43.9M of interest income — operating loss
    was still $33.2M. About half the YoY operating-loss improvement is a
    comp artifact (absence of $38.4M prior-year restructuring charges);
    stock-based comp ($376.9M, 25.6% of revenue, growing faster than
    revenue) remains the whole GAAP/non-GAAP gap. ARR +25% to $5.84B,
    accelerating, with net new ARR +50.5% — the demand signal is
    genuinely strong even though GAAP profitability is not real yet.
  - **LRCX** (Lam Research) — FY2026 ANNUAL (10-K, fiscal year ended
    2026-06-28): https://financial-reports-web.vercel.app/reports/cmucrrbbq000004lbompuk8ci
    Revenue +26.0% to $23,232.7M on a foundry mix shift (45%→54% of
    equipment/upgrade revenue); operating margin +330bps to 35.3%; net
    income +35.6%, EPS +38.8% (buybacks cut shares 2.3%). Flagged as the
    key quality-of-earnings catch: operating cash flow *fell* 5.1%
    despite net income +35.6%, on accounts receivable +58.1% (DSO
    ~67→~84 days) and deferred revenue declining — a softer pre-funded
    pipeline into FY2027 than the income statement alone suggests.
  - **KLAC** (KLA Corporation) — FY2026 ANNUAL (10-K, fiscal year ended
    2026-06-30): https://financial-reports-web.vercel.app/reports/cmucrs5fs000204lbvnperwow
    Revenue +11.7% to $13,579.5M; net income +18.9%, diluted EPS +20.4%
    (reflects a 10-for-1 split effected June 2026, plus $2.29B buybacks).
    Computed operating margin (KLA doesn't present the line) rose to
    41.7% from 39.3%, but FY2025 carried a $239.1M PCB impairment — ex
    that, the like-for-like margin gain is only ~0.4pt, not 2.4pt. China
    revenue flat in dollars and down to 29.8% of sales from 33.3% on
    export-control limits; one customer (TSMC) now ~19% of revenue.
    Company names a DRAM component shortage as a named FY2027 gross-
    margin headwind but gives no numeric guidance.
  - **TXN** (Texas Instruments) — Q2 2026 (10-Q, period end 2026-06-30,
    filed 2026-07-24): https://financial-reports-web.vercel.app/reports/cmucrrd57000104lbsj7zszeg
    Revenue +22.8% to $5,463M, gross margin 61.4% vs 57.9%, operating
    margin 42.3% vs 35.1%, net income +52.9%, diluted EPS +51.8% —
    incremental gross margin on the extra revenue was 76.6% against flat
    opex, the fixed-cost-leverage effect of TI's owned-fab model. A $51M
    discrete tax benefit added roughly 5 cents to EPS not in original
    guidance. Capex fell 51% H1 while depreciation rose 23% (cash
    spending down, accounting cost still arriving); pending $7.5B Silicon
    Labs acquisition (cash, expected close 1H 2027) is funded partly via
    a near-halt in buybacks. Q3 2026 guidance: revenue $5.65-6.15B, EPS
    $2.23-2.57.
  - Skipped: none this batch.
- Running total after this batch: **158 companies done, 174
  report-periods published** (154/170 before this batch + 4). This
  clears the entire hot-list round carried over from 09-21 night with
  zero skips.

- Batch 3 (~23:3x JST, same firing): tier 0 still empty (re-confirmed).
  `npm run next-batch -- --n 5` returned the next hot-list round: HOOD,
  F, GM, DAL, UAL. Dispatched all 5 as parallel opus subagents. All 5
  succeeded; each independently re-verified live (cache-busted fetch)
  before being marked done.
- Tier worked: **2-hot-list**.
- Published:
  - **HOOD** (Robinhood Markets) — Q2 2026 (10-Q, period end 2026-06-30,
    filed 2026-07-30): https://financial-reports-web.vercel.app/reports/cmucrxyvv000304lbdjxxtol5
    Revenue +32.3%, net income +45.3%, diluted EPS +47.6% — but the
    pre-tax jump is inflated by $129M of one-offs (a non-cash gain on
    deconsolidating a fund plus equity-securities gains) that management
    itself excludes from Adjusted EBITDA; ex those, growth is in line
    with revenue. Composition shifted hard toward event-contract trading
    (1%→12% of revenue) while crypto revenue fell 38% on lower rebate
    rates and fewer/smaller crypto trades; net interest revenue is
    explicitly flagged by management as exposed to future Fed rate cuts.
  - **F** (Ford Motor) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-07-29): https://financial-reports-web.vercel.app/reports/cmucrz2eo000404lb1pwpoky3
    GAAP net loss $(1,327)M vs a small prior-year loss, but Company
    adjusted EBIT +17.0% to $2,503M — the gap is a $3,612M charge from
    unwinding the BlueOval SK battery joint venture (closed May 2026),
    only ~$500M of it cash. Ford Pro (the profit center) fell $600M on
    volume and aluminum-sourcing cost; Ford Blue improved on price/mix;
    Model e's loss narrowed only because volume collapsed 53%. FY2026
    guidance ($10.0-11.0B adjusted EBIT) implies a slower H2 than H1's
    run rate.
  - **GM** (General Motors) — Q2 2026 (10-Q, period end 2026-06-30,
    filed 2026-07-21): https://financial-reports-web.vercel.app/reports/cmucrz5fc000104la42gvv1d5
    GAAP operating income -31.4% and net income -31.1%, but EBIT-adjusted
    +29.8% — the gap is $2,456M of Q2 EV-strategic-realignment and China
    restructuring charges (cumulative $7.9B in 2025 + $3.4B in H1 2026).
    GMNA adjusted EBIT +42.7% on flat volume, roughly half of it simply
    the absence of last year's EV inventory write-downs/warranty costs
    rather than new earnings power. GM Financial's provision for loan
    losses +10% and falling prime-originations share flagged as an early
    credit-cycle signal. FY2026 guidance reaffirmed at $14.0-16.0B
    EBIT-adjusted.
  - **DAL** (Delta Air Lines) — Q2 2026 (10-Q, period end 2026-06-30,
    filed 2026-07-10): https://financial-reports-web.vercel.app/reports/cmucrzlpx000204jv9znusmz3
    Revenue +18.7% but operating income -11.3% and net income -24.7% —
    airline-segment operating income fell 28%, partly offset by the
    Monroe oil refinery swinging from a $10M loss to $351M profit on
    refining margins (an unplanned outage started mid-June). Fuel price
    +66%, with GAAP results flattered by $301M of hedge gains that the
    six-month total shows aren't repeatable (implies a Q1 hedge loss).
    Pricing outran volume (yield +12%, load factor down slightly);
    premium-cabin revenue outearned main cabin for the first time this
    tracker has seen Delta report it.
  - **UAL** (United Airlines) — Q2 2026 (10-Q, period end 2026-06-30,
    filed 2026-07-16): https://financial-reports-web.vercel.app/reports/cmucrywz3000104jvgw8uqdy6
    Revenue +16.0% (record quarter) but operating income -17.3% and net
    income -17.3% — fuel price +79.4% (no hedging disclosed, so it flows
    straight through) explains nearly all of the cost increase. Reported
    results are flattered twice: a $592M special-items swing to a credit
    (dominated by $351M of aircraft sale-leaseback gains) and the
    resulting higher aircraft rent expense understates the real
    deterioration — ex-special operating income fell ~46% on the
    subagent's own recomputation. Domestic capacity is the soft spot
    (only region with load factor down); buybacks essentially halted.
  - Skipped: none this batch.
- Running total after this batch: **163 companies done, 179
  report-periods published** (158/174 before this batch + 5).

- Batch 4 (~23:4x JST, same firing): `npm run next-batch -- --n 5`
  returned CMG, LULU, ISRG, SPGI, BLK. Note: the cached SEC
  `company_tickers.json` initially looked wrong for BLK (an EDGAR
  full-text company-name search for "blackrock inc" surfaced only a
  stale/inactive CIK 1364742, "BlackRock Finance, Inc.", last filed
  2024-08-06) — cross-checked by fetching `data.sec.gov/submissions/`
  directly for the ticker-mapped CIK (2012383) and confirmed it *is*
  the correct, currently-reporting "BlackRock, Inc." (ticker BLK, NYSE,
  10-Q filed 2026-08-06) before dispatching the subagent, so the
  research went to the right filer. Dispatched all 5 as parallel opus
  subagents. All 5 succeeded; each independently re-verified live
  before being marked done.
- Tier worked: **2-hot-list**.
- Published:
  - **CMG** (Chipotle Mexican Grill) — Q2 2026 (10-Q, period end
    2026-06-30, filed 2026-07-31): https://financial-reports-web.vercel.app/reports/cmucs94dl000304jvy9129qhx
    Revenue +9.3% but operating income -6.0% and net income -7.5%
    (diluted EPS flat only because buybacks cut shares 5.3%); the
    filing's own revenue bridge shows 80% of the increase came from
    restaurants not yet in the comp base versus 23% from comps, and
    restaurant-level margin fell 2.2 points on beef/freight inflation
    partly offset by menu pricing. Comps +2.2% split into +1.0%
    transactions and +1.2% price, lapping a -4.0% comp a year ago.
  - **LULU** (lululemon athletica) — Q2 2026 (fiscal Q2 FY2026, 10-Q,
    period end 2026-08-02, filed 2026-09-03): https://financial-reports-web.vercel.app/reports/cmucs9mx1000404jve8lqjgdm
    Reported gross margin rose 200bps, but the filing states 560bps of
    that is $134.5M of IEEPA tariff refunds booked in COGS after the
    Feb 2026 Supreme Court ruling — ex-refund, gross margin actually
    fell ~360bps and operating margin was ~13.2%, not the reported
    18.8%. Revenue -4.3%, Americas comps -12% on lower traffic,
    conversion, and order value simultaneously; China Mainland comps
    -8% constant-currency despite reported growth from FX and new
    stores. New CEO Heidi O'Neill started Sept 8, 2026.
  - **ISRG** (Intuitive Surgical) — Q2 2026 (10-Q, period end
    2026-06-30, filed 2026-07-21): https://financial-reports-web.vercel.app/reports/cmucs8vnw000204la6957jfzn
    Revenue +18.5%, operating margin +3.1pts to 33.6%, but roughly half
    a point of that margin gain is a net ~$15M non-repeating tariff
    credit (refunds of $35.9M against $20.8M of tariff costs charged
    this quarter) that reverses once refunds stop. Procedure growth
    (+15%) and system placements (+18%) both decelerated slightly
    versus a year ago; China named as a specific soft spot on domestic
    competition and a new national robotic-surgery price-cap framework.
  - **SPGI** (S&P Global) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-07-28): https://financial-reports-web.vercel.app/reports/cmucsazaa000504jv5pq3fp1s
    Revenue +10.4%, operating margin +2.4pts to 43.7%, but growth is
    narrow — Ratings alone supplied ~76% of the operating-profit
    increase, on bond-issuance volumes the filing itself flags as
    partly a lap of a "low base" quarter a year ago; Market Intelligence
    and Energy added almost nothing to profit growth. H1 EPS growth of
    25.1% includes ~$0.59/share of one-time disposal gains (EDM/
    thinkFolio, Centennial); ex those, H1 EPS growth is ~17%. Mobility
    segment spun off effective July 1, 2026, breaking segment
    comparability from Q3 onward.
  - **BLK** (BlackRock) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-08-06): https://financial-reports-web.vercel.app/reports/cmucsbikq000604jvx3t4mbd3
    Revenue +30.6%, AUM +22.5% to $15.345tn, but ~87% of the quarter's
    $1.450tn AUM increase was market appreciation, not new client money
    (net inflows were $191.7bn). The HPS Investment Partners acquisition
    (closed July 1, 2025) added ~$230M of base fees and roughly doubled
    intangible amortization; YTD GAAP margin expansion of 630bps is
    materially inflated by a $538M non-cash contingent-consideration
    fair-value gain tied to BLK's own share price (adjusted margin
    expansion is a more honest +200bps).
  - Skipped: none this batch.
- Running total after this batch: **168 companies done, 184
  report-periods published** (163/179 before this batch + 5).

- Batch 5 (~00:2x-01:2x JST 09-23, this same firing — continuing after this
  session's context was summarized between Batch 4 and here): `npm run
  next-batch -- --n 5` returned **SCHW, C, USB, PNC, TMUS**. Dispatched all
  5 as parallel opus subagents as usual. All 5 independently completed
  full research (downloaded and read the actual 10-Q themselves) and then
  hit the admin form's own uniqueness rejection on publish: *"A report for
  this company, year, and period already exists."* Checking the live
  URLs confirmed all 5 were already published, Q2 2026, all sourced to the
  correct filing, all around **14:49 UTC** (~90 min before this batch's
  dispatch) — i.e. an earlier round this same firing (before the context
  summarization boundary) already researched and published these 5, but
  the tracker/nightly-log update and commit for that round never happened
  before the context got summarized. Each subagent independently
  cross-checked the live report's figures against its own fresh read of
  the filing (all matched) before standing down rather than overwriting a
  good report with `--edit`. Net effect: **0 new report-periods
  published this batch** (all 5 already live), but all 5 were previously
  untracked — reconciling them into `report-tracker.json` now:
  - **SCHW** (Charles Schwab) — Q2 2026: https://financial-reports-web.vercel.app/reports/cmucsinp5000304laazp59ijx
    Net revenues +20.9% to $7,072M, net income +31.7% to $2,800M, diluted
    EPS +42.6% to $1.54, pre-tax margin 51.9% vs 47.9%. NIM +34bp to 3.00%
    almost entirely from funding-cost relief (bank deposit cost fell to
    0.19% from 0.55%, FHLB borrowings nearly eliminated) rather than
    higher asset yields, which were roughly flat. Client assets $13.08T
    (+22%), core net new assets +49% to $119.8B.
  - **C** (Citigroup) — Q2 2026: https://financial-reports-web.vercel.app/reports/cmucsiz2f000604lbp0uj9j8c
    Revenue net of interest expense +14% to $24,766M, net income +45% to
    $5,831M, diluted EPS +61% to $3.15 — EPS growth far outran profit
    growth on an 8.3% smaller diluted share count (~$10.3B H1 buybacks).
    12% lower loan-loss provision came entirely from a smaller reserve
    build even as actual charge-offs rose 8%; NIM only +3bp despite 13%
    NII growth, which was mostly balance-sheet volume plus a Markets
    NII/NIR mix shift.
  - **USB** (U.S. Bancorp) — Q2 2026: https://financial-reports-web.vercel.app/reports/cmucsia8i000704jvcu14l6gm
    Revenue +10.1% to $7,712M, net income +19.9% to $2,177M, diluted EPS
    +21.6% to $1.35, efficiency ratio improved to 57.1% from 59.2%. NIM
    +13bp to 2.79%, but earning-asset yields actually *fell* 13bp — the
    entire margin gain was cheaper funding (time deposits -18.4%, savings
    +26.7%). Capital-markets revenue (+62.5%) supplied ~49% of the fee
    increase off one month of the BTIG acquisition (closed June 1, 2026).
  - **PNC** (PNC Financial Services) — Q2 2026: https://financial-reports-web.vercel.app/reports/cmucsj1qu000404lafehpe9lu
    Revenue +21.4% to $6,875M, diluted EPS +24.9% to $4.81, NIM 2.96%
    (+16bp YoY, +1bp sequentially). A $448M Visa exchange gain was nearly
    fully offset by a $139M securities-repositioning loss, an $85M Visa
    derivative mark, FirstBank integration costs, and a foundation
    contribution — net ~$37M pre-tax drag, so growth reads as operating.
    Loans grew 13% against 5% deposit growth, funded by a 50% jump in FHLB
    borrowings; CET1 fell to 9.9% from 10.6% at year-end.
  - **TMUS** (T-Mobile US) — Q2 2026: https://financial-reports-web.vercel.app/reports/cmucsisns000504lbzr1v96zt
    Revenue +7.9% to $22,791M, Core Adjusted EBITDA +11.7% to $9.54B, but
    net income flat (+0.5%) as higher interest expense and Lumos/Metronet
    JV losses absorbed the operating gain; the 5.3% EPS rise to $2.99 is
    almost entirely the 4.6% smaller share count from H1 buybacks, not
    earnings growth. Postpaid accounts +10.2% but largely acquired
    (UScellular/Metronet/Lumos); ARPA +2%, net account adds -12.9%, churn
    +7bps; prepaid and wholesale both shrank.
  - Skipped: none this batch (all 5 reconciled as already-done).
- Tier worked: **2-hot-list** (reconciliation only — no new research
  output added to the site this batch, but 5 tracker entries backfilled).
- Running total after this batch: **173 companies done, 189
  report-periods published** (168/184 before this batch + 5 newly tracked,
  0 newly published to the site).
- Process note for future firings: when `next-batch` returns a ticker and
  the subagent finds it's already live, treat that as a signal the tracker
  fell behind a prior round in *this same* firing (e.g. across a context
  summarization boundary) rather than a second concurrent firing — checked
  `list_triggers` on `trig_01GNdUY59Na4x3JxMr6p7mxK` and confirmed only one
  `last_run` this window, session id matching this session. Reconcile by
  trusting the subagent's independent re-derivation of the live report's
  figures (all 5 cross-checked clean against their own filing reads this
  batch) rather than re-publishing.

- Batch 6 (~01:2x JST 09-23, same firing): `npm run next-batch -- --n 5`
  returned **CMCSA, CVS, MDLZ, PM, LMT**. Dispatched all 5 as parallel
  opus subagents, each explicitly instructed to check for an
  already-published duplicate first (per the Batch 5 lesson above) before
  treating a uniqueness rejection as a failure. All 5 genuinely published
  new reports — no duplicates this round. Each independently re-verified
  its own live URL (cache-busted fetch: metrics table, Takeaway callout,
  Source filing link, no truncation) before reporting success.
- Tier worked: **2-hot-list**.
- Published:
  - **CMCSA** (Comcast) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-07-23): https://financial-reports-web.vercel.app/reports/cmucw4h9w000204l6utioarty
    Reported revenue -1.2% and diluted EPS -66.9% to $0.99, but both are
    distorted by a $9.4B pre-tax Hulu gain in the year-ago quarter and the
    since-completed Versant spin-off (Jan 2026) and Sky Germany sale (May
    2026) — on a pro forma basis revenue was actually +4.7% while Adjusted
    EBITDA fell 5.3%. Domestic broadband revenue -5.5% on lower average
    rates plus continued (though slightly smaller) customer net losses,
    offset by a record 448k wireless line adds. Peacock posted its first-
    ever profitable quarter (+$189M EBITDA) but the quarter uniquely
    stacked NBA playoffs and the FIFA World Cup. Buybacks paused pending
    the announced NBCUniversal/Sky spin-off.
  - **CVS** (CVS Health) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-08-05): https://financial-reports-web.vercel.app/reports/cmucw3tn0000304jszsubd1ah
    Revenue +7.3% to $106.1B, GAAP diluted EPS $2.31 vs $0.80 — but ~56%
    of the operating-income jump is the absence of prior-year one-offs
    ($833M litigation charges, $471M Medicare Advantage reserve) plus a
    tax rate falling from ~38.5% to ~24.7%. The durable improvement is
    Aetna's medical benefit ratio down 250bps to 87.4% (~$647M of
    underlying gain ex the reserve), though membership shrank 700K after
    exiting individual exchanges. Retail same-store sales grew only 2.9%
    despite 7.0% script growth, on reimbursement pressure. FY2026 guidance
    raised to $6.84-7.04 GAAP EPS / $7.90-8.10 adjusted.
  - **MDLZ** (Mondelez) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-07-28): https://financial-reports-web.vercel.app/reports/cmucw56s4000304l6qxla5ai9
    Net revenue +4.1%, but net earnings +141.5% and diluted EPS +144.9%
    to $1.20 are almost entirely an $827M mark-to-market gain on
    commodity/FX derivatives (vs a $93M loss a year ago — a $920M swing
    bigger than the entire operating-income increase) plus a lapped
    pension charge and a lower tax rate. Adjusted EPS was flat at $0.73;
    organic growth just 2.2%. Europe (36% of revenue) posted -3.5%
    organic with negative pricing and margin down 3.8pt to 11.3%. Falling
    cocoa costs are showing up as derivative gains now while COGS still
    carries previously contracted higher prices.
  - **PM** (Philip Morris International) — Q2 2026 (10-Q, period end
    2026-06-30, filed 2026-07-24): https://financial-reports-web.vercel.app/reports/cmucw3orv000004jkdxyywpa8
    Reported diluted EPS -7.7% to $1.80 purely on a $511M non-cash
    impairment of a legacy Canadian equity stake (carrying value now just
    $51M, so this drag is nearly exhausted); adjusted EPS +15.2% to
    $2.20. Net revenue +10.4% (7.6% organic), operating margin +3.9pt to
    40.5%, driven by 10% combustible pricing with volume that actually
    grew 1.1%. Smoke-free products now 41.5% of revenue, but the U.S. is
    the weak spot — ZYN shipment growth just 1.8% with flat consumer
    offtake in a growing category, implying share loss.
  - **LMT** (Lockheed Martin) — Q2 2026 (10-Q, period end 2026-06-28,
    filed 2026-07-23): https://financial-reports-web.vercel.app/reports/cmucw5mui000404l65bbffghh
    Diluted EPS $7.94 vs $1.46 (+444%) is almost entirely a comp
    artifact: Q2 2025 carried $1,615M of reach-forward program losses
    (classified Aeronautics, CMHP, TUHP) absent this quarter. Backing
    those out, underlying sales growth was 6.2% and segment operating
    margin 9.1% vs 8.7% — real but modest improvement. Backlog hit a
    record $230.4B (+38.4%) on an undefinitized THAAD award. FY2026
    guidance raised, but the $450M FCF raise comes entirely from a capex
    cut (operating cash flow midpoint unchanged), and the sales-guidance
    raise carries only ~2.5% incremental margin.
  - Skipped: none this batch.
- Running total after this batch: **178 companies done, 194
  report-periods published** (173/189 before this batch + 5).

- Batch 7 (~01:3x JST 09-23, same firing): `npm run next-batch -- --n 5`
  returned **RTX, HON, UPS, FDX, DE**. Dispatched all 5 as parallel opus
  subagents, again with the already-published-duplicate check built into
  each prompt. All 5 succeeded as genuinely new publishes — no duplicates
  this round. Each independently re-verified its own live URL before
  reporting success.
- Tier worked: **2-hot-list**.
- Published:
  - **RTX** (RTX Corporation) — Q2 2026 (10-Q, period end 2026-06-30,
    filed 2026-07-23): https://financial-reports-web.vercel.app/reports/cmucwbnxw000004jta91u0loo
    Sales +14.5% to $24.71B (~16% organic once 2025 Collins divestitures
    are excluded), operating margin +150bps to 11.4%, GAAP EPS +28.7% to
    $1.57 (flattered partly by the absence of a Q2 2025 Pratt & Whitney
    bankruptcy charge, achieved despite a higher tax rate). Raytheon
    segment led on Patriot/Standard Missile/AMRAAM demand — 2.4x
    book-to-bill including $3.7B of Ukraine-bound Patriot GEM-T. Backlog
    +22.5% to $289B. Pratt's GTF powder-metal matter took no new charge
    this quarter; FY2026 guidance raised.
  - **HON** (Honeywell) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-07-23): https://financial-reports-web.vercel.app/reports/cmucwdusv000504js0hw7hqay
    Last quarter with Aerospace consolidated (HONA spin-off closed
    2026-06-29, one day before quarter-end; Aerospace moves to
    discontinued ops from Q3, alongside a 1-for-2 reverse split). Sales
    +4.3% but the company's own bridge shows 0 points of volume growth —
    all price. Reported diluted EPS +312% to $17.83 is almost entirely a
    $6.6B non-cash gain on deconsolidating Quantinuum after its June IPO;
    adjusted EPS actually *fell* 4% to $4.52 on $820M of separation costs.
    Building Automation the standout (+9% organic, margin +90bps);
    Process Automation & Technology fell 1% organically with margin down
    180bps.
  - **UPS** (United Parcel Service) — Q2 2026 (10-Q, period end
    2026-06-30, filed 2026-08-05): https://financial-reports-web.vercel.app/reports/cmucwc4w8000404jsh0f0zaak
    Revenue +7.6% to $22.83B but volume fell — global small-package ADV
    -3.7% — with ~$1.0B of the revenue gain from fuel surcharges on
    Middle East disruption, not growth. GAAP EPS -53% to $0.71 on ~$1.2B
    of Driver Choice Program buyout/separation costs; adjusted EPS $1.76.
    US Domestic adjusted margin actually expanded to 8.0% from 7.0% on a
    3.3% volume decline, and the deliberate Amazon volume glide-down
    "concluded during the quarter" per the filing. International margin
    fell from 15.0% to 12.4% on higher charter costs and EMEA-to-US
    de-minimis lane losses.
  - **FDX** (FedEx) — **FY2026 ANNUAL** (10-K, fiscal year ended
    2026-05-31, filed 2026-07-20): https://financial-reports-web.vercel.app/reports/cmucwdxrc000604js4m6e1pmk
    Revenue +7.7% to $94.72B, diluted EPS +10.4% to $18.55 — growth was
    price/mix (composite yield +6%) not volume (ADV +3%). Consolidated
    operating margin fell 10bps to 5.8% despite the core Federal Express
    segment expanding margin 70bps, because FedEx Freight's margin
    collapsed to 7.0% from 16.7% on $492M of spin-off separation costs
    (the Freight spin completed June 1, 2026). A $647M non-cash pension
    mark-to-market gain supplied ~31% of the net income increase. FedEx
    also changed its fiscal year end to December 31 — next filing is a
    seven-month transition 10-K covering June-December 2026.
  - **DE** (Deere & Company) — fiscal Q3 2026, filed as **2026 Q3** (10-Q,
    quarter ended 2026-08-02, filed 2026-08-27): https://financial-reports-web.vercel.app/reports/cmucwf7nc000504l64a1lela1
    Net income +7.0% to $1.379B and FY2026 guidance raised, but Production
    & Precision Ag (the core large-ag business) sales fell 6%, implying
    roughly an 11% shipment-volume drop once price and FX are backed out,
    concentrated in Brazil and Europe. All consolidated growth came from
    Small Ag & Turf (+12%) and Construction & Forestry (+18%), aided by a
    non-repeatable $110M tariff refund. Financial Services is building
    reserves against construction borrowers even as that segment carries
    the earnings growth — flagged as undercutting management's "2026 is
    the ag-cycle bottom" framing.
  - Skipped: none this batch.
- Running total after this batch: **183 companies done, 199
  report-periods published** (178/194 before this batch + 5).

- Batch 8 (~01:4x JST 09-23, same firing): `npm run next-batch -- --n 5`
  returned **SO, NEE, DUK, SMCI, ARM**. Dispatched all 5 as parallel opus
  subagents (SMCI and ARM flagged in their prompts as non-calendar-fiscal-
  year / foreign-private-issuer cases needing extra EDGAR verification
  before assuming period/form type). All 5 succeeded as genuinely new
  publishes — no duplicates this round.
- Tier worked: **2-hot-list**.
- Published:
  - **SO** (Southern Company) — Q2 2026 (10-Q, period end 2026-06-30,
    filed 2026-07-30): https://financial-reports-web.vercel.app/reports/cmucwlui6000704js4naxpu6o
    Net income +33.4% to $1,174M on essentially flat revenue — operating
    income rose only $12M, and the jump came from below the operating
    line: non-repeat of a $129M prior-year debt-extinguishment loss, a
    venture-fund mark swing, and a smaller tax valuation-allowance
    charge. Adjusted EPS +22.8% to $1.13. Real demand story: weather-
    adjusted commercial sales +7.4% (+10.9% at Georgia Power) on data
    centers, ~16GW of large-load contracts ramping through 2028.
  - **NEE** (NextEra Energy) — Q2 2026 (10-Q, period end 2026-06-30,
    filed 2026-07-24): https://financial-reports-web.vercel.app/reports/cmucwlcez000604l62n8s81rr
    GAAP EPS +53% to $1.50, but ~two-thirds of the net income increase is
    a mark-to-market swing on non-qualifying hedges; adjusted EPS +9.5%
    to $1.15. FPL rate base and NEER's renewable backlog (up to ~35.1GW)
    both genuinely growing; 2026 adjusted EPS guidance held at
    $3.92-4.02. Dominion Energy merger filings went in July 15, close
    expected 2H 2027.
  - **DUK** (Duke Energy) — Q2 2026 (10-Q, period end 2026-06-30, filed
    2026-08-04): https://financial-reports-web.vercel.app/reports/cmucwnlf5000104jtym3j0lmw
    Adjusted EPS +14.4% to $1.43 driven by rate cases and riders (+$0.22)
    against depreciation/interest drag (-$0.13); weather-normalized
    retail sales +1.3%. Six-month capex +28.2% to $8.24B against
    operating cash flow -15%, bridged by ~$5.3B of one-time asset-sale
    proceeds (Brookfield's Florida Progress stake, Piedmont's Tennessee
    gas business to Spire). 2026 guidance reaffirmed at $6.55-6.80.
  - **SMCI** (Supermicro) — **FY2026 ANNUAL** (10-K, fiscal year ended
    2026-06-30, filed 2026-08-31): https://financial-reports-web.vercel.app/reports/cmucwnk11000804js0mm53xxa
    Revenue +77.8% to $39.06B, net income +112.7% to $2.23B, but
    operations *consumed* $6.81B of cash (vs +$1.66B a year ago), funded
    by $9.48B of new financing. Gross margin fell again to 10.8% on
    deliberate price competition and lost vendor rebates. Largest
    customer now 28.1% of net sales (from 20.9%). Internal controls over
    financial reporting still not effective (one IT general-controls
    weakness remaining after remediating three others); ongoing SEC/
    SDNY/DOJ/BIS inquiries disclosed. Filing timeliness has normalized
    after a 2025 delinquency episode.
  - **ARM** (Arm Holdings) — **FY2026 ANNUAL** (20-F, fiscal year ended
    2026-03-31, filed 2026-05-26): https://financial-reports-web.vercel.app/reports/cmucwonl0000904js2rl6gjpe
    Revenue +22.8% to $4,920M, but 61% of the increase ($559M of $913M)
    came from a single SoftBank-affiliate licensing/consulting
    arrangement — third-party licence revenue actually fell 8.7%.
    Royalty revenue (the arm's-length engine) +20.5% on better Armv9
    rate-per-chip. R&D +34% for the new Arm AGI CPU cut operating margin
    2.4pt to 18.3%; stock-based comp ($1,052M) exceeded GAAP operating
    income ($900M). A newer Q1 FY2027 6-K (quarter ended 2026-06-30,
    already on EDGAR) shows the margin squeeze intensifying to 7.1%
    operating margin — flagged as a tier-2/freshness candidate since it
    postdates this ANNUAL report.
  - Skipped: none this batch.
- Running total after this batch: **188 companies done, 204
  report-periods published** (183/199 before this batch + 5).

### 2026-09-23 night (23:00 JST 2026-09-23 → 05:00 JST 2026-09-24)

- Mechanism: this firing's invocation matches the cloud routine's pattern
  (automated `[SCHEDULED TASK]` prompt, no live user).
- Network check: `curl https://www.sec.gov/` without a User-Agent returned
  403 (confirmed via verbose headers to be SEC's own Akamai response, a
  real TLS handshake to the real host — not a proxy/policy denial); retry
  with the required `User-Agent` header returned 200, as did the deployed
  site. Network access confirmed fine tonight.
- Pre-batch housekeeping: `npm install` postinstall (`prisma generate`)
  failed on missing `DATABASE_URL` as expected (doesn't block
  `admin-publish`/`scan-recent-filings`, which need no DB access);
  discarded an incidental `package-lock.json` diff from the install.
- `npm run scan-recent-filings` (tier 0): **2 fresh candidates** — AYTU
  (Aytu BioPharma) and THO (Thor Industries, Inc.), both 10-K filed
  2026-09-22.
- Batch 1: published both via two opus subagents run in parallel;
  independently re-verified each live (cache-busted fetch: title, metrics
  table, Takeaway callout, Source filing link present, content ends on a
  complete sentence) before marking done.
- Tier worked: **0 (fresh filing)**.
- Published:
  - **AYTU** (Aytu BioPharma, Inc.) — **FY2026 ANNUAL** (10-K, fiscal year
    ended 2026-06-30, filed 2026-09-22):
    https://financial-reports-web.vercel.app/reports/cmue6xdrk000004kzloyqi40d
    Revenue fell 13.3% to $57.6M — the new antidepressant EXXUA (launched
    Dec 2025) added $6.6M, but legacy ADHD drugs fell 20.4% and Pediatric
    fell 41.4% on generic competition. Net loss widened slightly to
    $14.3M, but that understates the deterioration: the prior year
    included ~$11.7M of one-time write-downs/restructuring, so the
    underlying result swung roughly $12M worse. Gross margin fell from
    69% to 64% (partly a $2.2M inventory write-down); diluted loss per
    share improved only because share count nearly doubled. No going-
    concern flag (cash $26.3M vs ~$17.0M debt), but no revenue guidance
    either, and a cheaper generic Cotempla launched July 2026 plus a
    generic-Adzenys patent trial starting Jan 2027 are named risks against
    an ADHD portfolio that's still 80% of revenue.
  - **THO** (Thor Industries, Inc.) — **FY2026 ANNUAL** (10-K, fiscal year
    ended 2026-07-31, filed 2026-09-22):
    https://financial-reports-web.vercel.app/reports/cmue6y21k000004l8njethivm
    Sales roughly flat (+0.3% to $9,608.1M), but only because a stronger
    euro added $179.4M — ex-FX sales fell ~1.6%. North American towables
    fell 16.1% (units -20.7%) while motorhomes grew 12.8% and Europe grew
    9.0%. Profit fell much more than sales: gross margin dropped from
    14.0% to 12.6% on mix shift and un-passed-through tariff/cost
    increases, and the tax rate roughly doubled (13.4%→26.8%), driving net
    income to $177.5M (-31.3%) and diluted EPS to $3.38 (-30.2%).
    Operating cash flow fell 44.4% to $321.2M. Order backlog rose 8.0% to
    $3.30B, but the mix flipped versus this year's results — towables
    +74.6%, motorhomes -27.5% — so FY2027 could see the opposite pattern
    from FY2026. No numeric FY2027 guidance given; operating margin
    (2.1%) is the subagent's own calculation since Thor's income statement
    has no operating-income line, footnoted as such in the report.
  - Skipped: none this batch.
- Running total after this batch: **190 companies done, 206
  report-periods published** (188/204 before this batch + 2).

### 2026-09-24 daytime — manual session (outside the nightly window)

- Mechanism: interactive local session at the user's request ("update all
  hot-list tickers now"), run while the cloud routine is blocked by the
  account's weekly usage limit (every firing from ~00:17 JST 09-24 exited
  in seconds with "weekly limit · resets Sep 26, 3am UTC").
- Tier worked: **1 (hot list)** — cleared the remaining 21 hot-list tickers.
  PARA in `priority-tickers.json` replaced by **PSKY** (Paramount Skydance;
  PARA no longer trades after the Aug 2025 merger).
- Research via 11 opus subagents (drafts only, no publishing); orchestrator
  published all 21 with `admin-publish` against
  https://financialreportinsights.com and re-verified each live
  (cache-busted fetch: 200, title, Takeaway callout, Source filing link,
  last sentence present).
- Year labelling: MRVL, DELL, TJX, GIS call these quarters fiscal 2027;
  published as **year 2026** (calendar year of the quarter) to match the
  existing WMT/TGT/LOW precedent. TTWO covered by its FY2026 ANNUAL (Q1
  FY2027 10-Q figures summarised in its outlook section).
- Published (21): MRVL Q2, DELL Q2, HPQ Q3, TTWO ANNUAL, WBD Q2, PSKY Q2,
  LYV Q2, RCL Q2, CCL Q2, MAR Q2, HLT Q2, ORLY Q2, AZO ANNUAL (8-K
  earnings release; 10-K due ~10-26), ROST Q2, TJX Q2, DG Q2, ULTA Q2,
  EL ANNUAL, CL Q2, KMB Q2, GIS Q1.
- Follow-up: **CCL Q3 results confirmed for 2026-09-29** — Q2 report will
  be superseded within a week.
- Skipped: none.
- Running total: **212 companies done, 228 report-periods published**
  (191/207 + 21). Hot list: 124/124 done.
- Later the same day (manual session): published **6 COMPARISON articles**
  built only from our own published reports — KO vs PEP, V vs MA, HD vs
  LOW, TJX vs ROST, GS vs MS, MAR vs HLT (`/insights/<a>-vs-<b>-q2-2026`).
  Also shipped `/earnings` (calendar from the tracker), tier-0 scan now
  re-surfaces done companies with newer filings + S&P 500 earnings 8-Ks,
  and the routine window moved to 16–22 UTC with a ~20/night cap.

### 2026-09-25 daytime — manual session (outside the nightly window)

- Mechanism: interactive local session at the user's request ("continue
  updating report data"), 03:50–05:00 UTC; the cloud routine was not
  running (outside 16–22 UTC).
- Tier worked: **0 (fresh filings)** — `scan-recent-filings` (7 days) gave
  16 candidates; all handled.
- Research via 15 opus subagents (drafts only, no publishing, no tracker
  writes); orchestrator validated each JSON (fields, Takeaway, no images,
  metrics present in text), cross-checked revenue/net income against the
  SEC source text, published with `admin-publish` against
  https://financialreportinsights.com and re-verified each live
  (cache-busted: 200, title, Takeaway, Source filing, last sentence).
- Published (15), all at the new `/companies/<slug>/<year>/<period>` URLs:
  COST ANNUAL (FY2026, from the 09-24 earnings 8-K; 10-K due ~10-08),
  DRI Q1 (8-K), PAYX Q1, CTAS Q1 (8-K), BB Q2, CPB ANNUAL, FUL Q3,
  KTCC ANNUAL, SFIX ANNUAL, RZLT ANNUAL, LGCY ANNUAL, RAVE ANNUAL,
  TRT ANNUAL, AMST ANNUAL, ESP ANNUAL. Fiscal-2027 quarters ending in
  calendar 2026 (DRI, PAYX, CTAS, BB) labelled year 2026 per precedent.
- ADBE: Q3 10-Q (filed 09-22) is the same period as the published
  8-K-based Q3 report — tracker `lastFilingSeen` updated only, no edit.
- Editorial note: RAVE's report covers the CEO's harassment/
  discrimination complaint against the board exactly as the 10-K's Legal
  Proceedings describes it (facts checked against the filing).
- Skipped: none.
- Also shipped: public pages drop NASDAQ listing suffixes from company
  names ("Stitch Fix, Inc. - Class A" → "Stitch Fix, Inc.";
  `cleanCompanyName`), and amounts under $10M show as "$365K"/"$2.9M"
  instead of "$0M"/"$3M".
- Running total: **226 companies done, 243 report-periods published**
  (212/228 + 14 new companies + COST's second period).
- **Continued (same session, user: "keep going until the 5h quota runs
  out") — tier 1, S&P 500 backlog in `next-batch` order**, batches of 5
  opus subagents, same validate → source cross-check → publish → live
  verify loop. Published so far (50): ATO Q3, ADSK FY, ADP FY, AVY Q2,
  AXON Q2, BKR Q2, BALL Q2, BAX Q2, BDX Q3, BRK.B Q2, BBY FY, TECH FY,
  BIIB Q2, BX Q2, XYZ Q2, BNY Q2, BSX Q2, BMY Q2, BR FY, BRO Q2, BF.B FY,
  BLDR Q2, BG Q2, BXP Q2, CHRW Q2, CDNS Q2, CPT Q2, COF Q2, CAH FY,
  CARR Q2, CVNA Q2, CASY FY, CBOE Q2, CBRE Q2, CDW Q2, COR Q3, CNC Q2,
  CNP Q2, CF Q2, CRL Q2, CHTR Q2, CB Q2, CHD Q2, CIEN Q3, CI Q2, CINF Q2,
  CFG Q2, CLX FY, CME Q2, CMS Q2. Tracker pushed after every batch.
  Notes: publish JSON `company` now always uses "Name (TICKER)" — "Block,
  Inc." also matched "H&R Block, Inc."; CLX's sourceUrl points at the
  10-K's Exhibit 99.1 (where Clorox puts its statements); TECH is being
  acquired by Merck KGaA (may stop filing); BSX warned it will miss July
  guidance after an Aug 25 cyberattack (Q3 date Oct 28 confirmed); COF Q3
  date Oct 20 confirmed.
- Checkpoint: **90 tier-1 reports** published this session so far (the 50
  above plus CTSH Q2, COHR FY, FIX Q2, COP Q2, ED Q2, STZ FY, CEG Q2,
  COO Q3, CPRT FY (from the 8-K; 10-K due ~09-29), GLW Q2, CPAY Q2,
  CTVA Q2, CSGP Q2, CRH Q2, CCI Q2, CSX Q2, CMI Q2, DHR Q2, DDOG Q2,
  DVA Q2, DECK FY, DVN Q2, DXCM Q2, FANG Q2, DLR Q2, DLTR Q2, D Q2,
  DPZ Q2, DOV Q2, DOW Q2, DHI Q3, DTE Q2, DD Q2, ETN Q2, EBAY Q2, ECHO Q2,
  ECL Q2, EIX Q2, EW Q2, ELV Q2). Also: "X (The)" names now display as
  "The X" (COO, KO); DD metrics use the total basis for both net income
  and EPS (the table shows both bases); ECHO's $8.5B profit is a $9.73B
  deconsolidation gain from the DISH DBS/Wireless prepackaged Chapter 11
  (checked against the 10-Q). Running total: **306 companies done.**
