# Core MVP lab evidence

Research-only. Base production commit: `4b0be454a8dd24bb65f00517f598f751ab333980`.
Start with [`../../CORE_MVP_BALANCE_RESEARCH.md`](../../CORE_MVP_BALANCE_RESEARCH.md).

Each financial phase stores:

- `*-manifest.json`: explicit seed list, policies, source SHA, LF-normalized source hashes, Node version and start time (UTC).
- `*-source.json.gz`: exact source text matching every manifest hash, including uncommitted research files present at run time. The SHA is the checkpoint ancestor; this bundle identifies the complete executed source.
- `*-results.json`: summaries and wall-clock elapsed time for the whole phase.
- `phase/id.config.json`: full BoardSpec, EconomySpec, GoalSpec, PolicySpec and assumptions; summary includes SHA-256 of the compact parsed config.
- `phase/id.rows.json.gz`: one metric row per policy/seed. All policies in a config use the same initial capital/savings/term.
- `phase/id.examples.json.gz`: complete state/log for the first seed of each policy, under a private `research-only-core-mvp-v1` wrapper. Later phases verify both action-driven replay and policy rerun. Broad examples precede the action-replay increment; original production historical logs remain unchanged.

`dice-nN-hH.json.gz` contains the raw landing paths of 10,000 independent dice-only trials. It omits the terminal landing/roll value but counts that roll, matching the engine's terminal behavior. The stopping rule makes the stored *processed* dice values a conditioned sample; they must not be used as an IID uniformity test. A separate unconditioned million-draw test checks D6 conversion.

`layout-configs.json` and `dice-screen.json` retain all 240 layouts, including rejected layouts and explicit screening constraints. These constraints are research choices, not owner-approved product requirements. The 50,000-path preliminary numpy experiment in the request used a different seed generator; this lab does not claim bitwise reproduction of it.

`broad-configs.json` records the fixed anchor and OFAT factors. `shortlist-configs.json` was selected before shortlist runs. `frozen-configs.json` records the exact Pareto criteria and candidates selected *before* holdout. Holdout is never used to tune or replace them.

Metric definitions:

- `proceeds`: engine `liquidatableFunds`, after fees/spread and liabilities; active savings principal counts, unsold Business does not, defaulted bond claims without quotes do not.
- `won`: the engine's goal plus reserve test and no insolvency. `loss` is its complement; it is not identical to `insolvent`.
- `lockedBusiness` / `lockedBond`: unsold Business value / remaining defaulted bond principal with no executable quote. `locked` is either >0. Delayed but executable bonds are discounted by actual quotes, not called wholly locked.
- `meaningfulOpportunities`: distinct encounters with more than one currently feasible option. Bank terms are separate options; macro acknowledgement is not a meaningful choice. Business can be bought, upgraded or sold only if the current state permits it.
- `meaningfulDecisions`: each actual encounter decision with >1 feasible option, plus a funding decision with >1 legal source. It may include skip, and a Business upgrade followed by sell/skip can produce more than one decision. These are model proxies, not measured understanding.
- `modalsProxy`: encounters + two dialogs/START + forecast periods + funding actions. It approximates the current UI structure, not a measured mobile candidate UI.
- `incomeReceived`: actual salary and Business cash receipts. `creditCoupon`: paid coupon only. Later phases additionally store `savingsInterest` and `totalIncome` = those four sources. Principal recovery/maturity is not income.
- `drawdown`: peak-to-trough *net worth* across log snapshots, including consumption, course cost and market changes; not a pure asset-price drawdown.
- `capitalLoss`: final lawful proceeds below initial capital. `creditLoss`: written-off principal plus lost due coupon, already reflected in state (never subtracted twice).
- `missedBusinessExit`: bought Business but had no later Business encounter; it is a missed-opportunity proxy, not a proof that a later sale would have been optimal.

Quantiles use the lower order statistic at `floor((n-1)*p)`, including the median. Wilson intervals are per fixed policy. Paired intervals require matching seed IDs and include observed dice/encounter hash agreement. Common seed IDs across different board sizes or activation rules are not a guarantee of common economic trajectories. Overall intervals resample seed clusters, not independent policy rows. No interval incorporates heuristic or human-behavior uncertainty.

No production source, balance constant, board UI, artwork, historical replay schema, AI provider, or deployment was changed. Full product QA is intentionally deferred until owner approval of a configuration.
