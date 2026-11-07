# B18 language cleanup

Base:10cdaa984bcdeddc8337eab945a98c939b405fec. Branch:codex/mvp-b18-language-cleanup.
UI only; preserve engine/economics/schemas/logs/research. Leave pre-existing nested checkout untouched.

- [x] Capture paired wallet/setup/bank screenshots at 320/390/1440 from exact base.
- [x] Regression tests for stable savings/bond labels and absolute maturity dates; shared presentation helpers.
- [x] Replace visible START and leaked IDs, preserve technical values; improve wallet layout and savings-period explanation.
- [x] Scan static and actual visible text; verify interactions and state invariance.
- [x] Product/SSR tests, 81 frozen replay, 13 parity games/2306 snapshots, lint/builds; report and manifest.

Implementation: b9606a905b84465f6e648770916961e498d57bfd. QA: 349 product, 46 SSR (5 required B18), 61 browser checks. Exact handoff SHA is supplied after the evidence commit and push; Owner review remains pending.
