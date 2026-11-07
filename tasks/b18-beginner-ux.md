# B18 beginner UX polish and technical QA

Branch `codex/mvp-b18-ux-polish`, exact base `ba1c8115aa241143053085089132807c48f0bc10`. Existing nested user checkout remains untouched. No engine/economics/board/save-schema changes; no merge/deploy.

- [x] Reproduce stale saved-game UI at320/390 and capture before screenshots; baseline334 tests,2 SSR,68 replays,13 parity/2306 snapshots, lint/builds confirmed.
- [x] P1: progressive course detail, profile-aware tile help, factual financial feedback, current save on return to Setup; unit/SSR/browser regression tests.
- [x] P2: plain-language goal, concise onboarding, optional zero-cash warning, mobile/focus/action accessibility.
- [x] Full verification:339 product tests,3 SSR,77 replays,13 parity/2306 snapshots, lint/builds;5 full UI games on320/390/1440; old imports, funding, quota failure and same-session save regression.
- [x] Vietnamese handoff report, reproducibility and manifest. Implementation commit0dc4c40; push and remote SHA verification are the final delivery step.
