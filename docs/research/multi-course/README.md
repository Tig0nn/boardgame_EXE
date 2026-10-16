# B18 multi-course research — methods and reproduction

Research only; production source and UI are unchanged from00e77a19691c109e8cb7079b83591463c3eb6136. That B18 branch was verified and pushed before study. Non-course policies and accounting helpers are reused without logic changes from risk/allocation d04b8ad in temporary adapters. Source bundles and source hashes normalize CRLF to LF; Git refs retain the original tracked bytes. Git source refs, individual source hashes, complete source bundles, configurations, raw rows, summaries and sampled full-state research replays are retained.

## Protocol and count

Phase1:43,904 primary screening games (14 curricula ×7 layouts ×32 seeds ×14 policies), then9,408 matched-total controls (3 curricula ×7 layouts ×32 seeds ×14 policies), same screening seeds. The matched-total amendment was registered before interpreting screening results.

Phase2:34,020 games (6 promising designs +3 baseline layout controls ×180 new seeds ×21 policies);16,128 strengthened matched-total controls (3 curricula ×2 layouts ×128 of those same seeds ×21 policies). Phase3:3 candidates +3 baseline layouts ×448 new seeds ×24 policies =64,512. Total167,972 main study games, plus small verification/replay reruns, within170,000 budget. Seeds use disjoint SCREEN/SHORTLIST/HOLDOUT prefixes; the128 control seeds are a prespecified subset of shortlist seeds. A repeated seed across policies/configs is a paired experimental unit, not a new independent human observation.

`holdout-lock.json` was committed in ce24f64 before any holdout execution. Candidate parameters,448 seeds,24 policies and analysis rules were locked; no retuning or result-based stopping after reading holdout. The finite sample reallocates some budget from holdout to matched economics and reserve isolation. Intervals near50% win are roughly±4.6 percentage points at448 seeds, so close rankings remain uncertain.

## Model boundaries

Each adapter copies current `src/game`/`src/data` into a verified temporary directory and copies six archived policy/accounting modules from d04b8ad. Only `boardFor` in the private clone is overridden to supply the declared18-tile research layout. An external research course action deducts voluntary cash, adds cumulative recurring income and logs the declared cost/boost. Baseline uses the actual production `decide(upgrade)` action. All markets, credit, fees/spread, trading, living, Business, personal events, funding, START and victory selectors remain the B18 engine.

One successful course per encounter, each course once, encounter-only, cash-only, no fee refund or new borrowing. Sequential courses require the previous level; independent courses permit either order. Declining boosts are explicit course parameters, never hidden order-dependent calculations. All games begin with0M savings/50M cash and default term3 to match B18 research setup; this is an experimental control, not a proposed forced player allocation.

Existing non-course policies retain10M financial investment reserve (novice0). Cash reserve guards0/5/10/15 are separate learning strategies. Extra holdout `savings-course-reserve0/5/15` strategies change only the voluntary course cash floor; bank investment/trading behavior stays at10M, with `savings-roi` as the10M learning-floor control. Tests explicitly verify identical bank actions. Personal payment selection and funding sources remain unchanged.

Policies use current cash, holdings, quoted prices/credit, published scenario, fixed remaining START count and observed price history. ROI assumes scheduled wages will be received if the game survives; it is not a forecast of prices or future events. Synthetic course and novice randomness is keyed separately from engine RNG; no policy reads future prices, engine draws or future path. Novice chooses uniformly among legal menu entries, so a larger menu itself changes its behavior; it is not a validated human model.

## Metrics

- `courseVisits`: actual self-investment encounters. `courseAvailable`: a remaining unlocked course exists, regardless of cash. `courseAffordable`: a remaining course can be paid now. `courseReserveAffordable`: also preserves that policy's learning reserve. `courseExhausted`: all courses already bought. These are distinct conditions.
- `courseProfitable`: at least one currently affordable course has strictly positive scheduled net salary within remaining START. An unbought but unrecoverable course does not count. ROI policy permits zero-net break-even courses; this ignores alternative investment yield, which paired no-course controls help reveal.
- Encounter rates use summed encounters as denominator, per policy. Aggregate overview gives equal weight to five stated heuristics (cash-roi, savings-roi, diversified-roi, risk-aware-roi, novice); it is a synthetic suite, not a population estimate. Overview P10/worstDecile are averages of policy-specific quantiles, not quantiles of a pooled population. Primary win/proceeds/tail results are reported separately by strategy.
- `courseSpend` is tuition; `courseSalaryReceived` is the sum of actual subsequent salary boosts in the log; `courseNet` is their difference, with no terminal refund. Per-course rows include cost/boost, purchase lap/turn, cash immediately after purchase, START actually paid, break-even START and realized recovery. Direct net is not the total economic effect: paired proceeds differences include missed asset returns, funding and other downstream choices.
- Mean/median/P10 use proceeds from the production lawful-funds selector; worst-decile is the mean of the lowest `max(1,floor(n/10))` observations. Mean CIs use empirical standard errors; win/funding use Wilson95%; holdout P10/worst-decile use400 deterministic bootstrap resamples. Intervals are nominal, exploratory and not corrected for the many comparisons.
- Paired contrasts require unique matched seeds within a policy. Mixed-size matched-total analyses restrict to the prespecified common128 seeds and report pair counts. Comparisons across layouts also report dice, encounter, main-RNG and market alignment; synchronized dice do not imply the same encounters or decisions. When pooling multiple policies, inference must cluster by seed rather than treat every policy run as independent.
- Personal adversity is prespecified as at least3 personal encounters, analyzed within layout; report its sample size. `personalShortfalls` also counts inability to cover the cheap immediate personal option even when a more expensive deferral avoids the funding dialog. Funding counts, savings withdrawals/lost interest, debt and insolvency are separate.
- `cashAfterCourseMin` is each game's minimum cash immediately after a course, conditional on a purchase; null when none. Its aggregate is conditional on such games, not mean cash after every individual course. `visitsByTile` counts event-policy steps and may repeat Business after an upgrade; course entries complete immediately, so its course slots are exact encounter counts. Actual encounter coverage by type is retained separately in `coverage`. `decisions` and modal counts are simulation proxies, not measured learning or elapsed play time.

## Validation and artifacts

Six focused research unit tests cover course ownership/order, cash-only/one-encounter guards, immutable input, START income/no refund, baseline dispatch, quantiles/Wilson, pairing and seed clustering.48 foundation research replays include12 full production baseline replays, with no ignored financial/version/RNG fields (JSON normalization only removes optional undefined keys and negative zero). Additional reserve tests hold bank behavior fixed. Each study game runs cash reconciliation, course salary reconciliation, per-encounter financial trade and Bond principal/coupon audits. Saved replay examples are separately reexecuted before final sealing.

Every phase has protocol/config/source/manifest, compressed raw `.rows.json.gz`, summaries and sampled `.replays.json.gz`. Research replay wrapper `b18-multi-course-research-v1` declares the private curriculum/layout; it is not an importable production schema6 save. Historical production replays and previous research artifacts are not rewritten. No production Final QA, deployment, merge or human playtest is part of this task.

## Reproduce

Use Node22 with `--experimental-strip-types` for direct TS imports. From this branch:

```powershell
node --experimental-strip-types --test scripts/research/multi-course/courses.test.mjs scripts/research/multi-course/stats.test.mjs
node --experimental-strip-types scripts/research/multi-course/verify-foundation.mjs
$env:MULTI_COURSE_OUTPUT='docs/research/multi-course-independent-reproduction'
$env:MULTI_COURSE_REPLAY_FROZEN='1'
node scripts/research/multi-course/run.mjs screen
node scripts/research/multi-course/run.mjs screen-control
node scripts/research/multi-course/run.mjs shortlist
node scripts/research/multi-course/run.mjs shortlist-control
node scripts/research/multi-course/run.mjs holdout
```

Completed phase manifests prevent overwriting the original experiment; use a separate output path for full reproduction. Frozen mode uses each phase's exact archived source rather than the latest research module metadata. Frozen lock files supply exact policies/configs/seeds. Analysis and reporting scripts operate on the original artifact directory, separately from the runner. `verify-frozen-reproduction.mjs` checks one448-game screening arm and its replay byte-for-byte against the original compressed artifacts. `verify.mjs` verifies sampled full-state replays, counts, hashes and protected production without a new full study. Do not point these research outputs at production or deploy them.
