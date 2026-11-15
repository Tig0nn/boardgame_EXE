# Implement Core MVP B18 + single90M

Owner approved candidate implementation only; no merge/deploy/production-ready claim or further human playtest.

## Sources and base

- Research refs verified and pushed: balance45b0c4dd03ce2b8fa198891968f4016f4982298a; trading33de1229e36fb5fb8a0df63cf4cf6899720cd3f4; riskd04b8adf8f5173a3a0c21fa0106afba7f6bd3f53.
- Branch `codex/mvp-b18-implementation` from gameplay/UI4b0be454a8dd24bb65f00517f598f751ab333980. Research files remain unchanged on their original branches; no research adapter used as production engine.
- Integrate six-tab Rulebook experience from UI277d2dc concept, preserving newer4b0be45 credit/market/customer preference flows and correcting content to versioned B18.

## Contract

- Optional gameplay profile `core-mvp-b18-v1` on state/snapshot/export. Absence retains all legacy semantics. New board B18/revision, encounter trading version, periodic living version, goal version. No shared historical constants mutated.
- New-player entry point creates B18; existing historical factories remain explicit compatibility APIs. 50M freely allocated cash/savings (default0M savings matches B research, no forced deposit).
- rulesForGame/eventsForGame/livingCostForGame resolve8M/+4M course and5M living. Financial models/RNG/credit/fees/savings unchanged.
- Single90M through canonical lawful-proceeds selector. Victory only after completed four START, not insolvent. No auto liquidation/Business exit, no early victory.
- New encounter policy allows buy OR sell OR skip for stocks/bonds/gold, max one successful financial trade per visit, errors retain right. Legacy policy unchanged; START/funding rights unchanged.
- New18-position board drawn in code/SVG without20-tile artwork. Mobile labels/order/pawn/inspection match engine; historical boards retain original art.
- Save/load validates declared versions, preserves C20 as C20; deterministic replay and archived logs tested. New and legacy snapshots never silently migrate.

## Slices

- [x] Versioned rules/board/events/goals/trading + boundary, settlement, historical replay tests.
- [x] Shared buy/sell views, single-goal desktop/mobile, course completion, setup/onboarding/rulebook, B18 rendering.
- [x] Save/load, deterministic production vs frozen B parity on a small fixed sample, end-to-end browser games/screenshots320/390.
- [x] Tests/lint/build/review/handoff with differences and remaining release risks. Commit candidate; no merge/deploy.
