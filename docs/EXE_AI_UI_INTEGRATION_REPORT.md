# EXE — AI Companion × B18 UI integration

Date: 2026-10-30 (Asia/Bangkok). Status: IMPLEMENTED FOR OWNER/PHAT REVIEW, NOT COMMITTED, NOT DEPLOYED. One existing legacy UI assertion prevents a completely green broad diagnostic suite; see QA below.

## Isolation and pinned history

- Worktree: E:/Fall25_Ki8/EXE-boardgame/_exe-workstreams/b18-ai-ui-integration
- Branch: codex/b18-ai-ui-integration
- Remote repository: Tig0nn/boardgame_EXE, origin HTTPS URL verified.
- Remote UI HEAD verified with ls-remote before work: 6294fbe3e65c4c723297aa8e624ae5e322f90cad. This is the current integration HEAD; no local Phat edits were copied.
- AI source: 90c03ff17fd35df4d3c57691658c6fe16cceaa90, containing approved C59dae580, B78f4d733, P389437d5e and P3.590c03ff1 commits.
- Common base: 27a05fb4694407342c69ed7dd76dbad1f4908093. UI changed74 paths, AI changed61 paths, zero overlapping paths.
- Git2.37 does not support merge-tree --write-tree. Compatible changed-path precheck found no overlap. The actual merge --no-commit --no-ff completed without conflicts in this new worktree.
- MERGE_HEAD remains AI90c03ff; the61 approved imported AI files are staged automatically by the pending merge. No authored integration edits were staged. No commit or history rewrite was performed. Owner must review the complete index PLUS working diff before a future integration commit.
- No operations changed Phat's original checkout, either AI/UI branch head, or their uncommitted source. Only Git metadata/objects needed for the explicitly requested worktree/fetch/merge were written through the AI/integration worktrees.

## Integration changes

| File | Change |
| --- | --- |
| [App.tsx](../mobile_app/src/App.tsx) | Pass the actual session into GamePhase; one-line presentation wiring |
| [GamePhase.tsx](../mobile_app/src/components/GamePhase.tsx) | Optional typed session forwarded only into EventModal |
| [EventModal.tsx](../mobile_app/src/components/EventModal.tsx) | Construct pure binding per session, project eligibility, insert inline panel after cash before choices; clear before choosing/help; gate modal sizing on feature |
| [RepairAiPanel.tsx](../mobile_app/src/components/RepairAiPanel.tsx) | Examples, question form, loading/answered/fallback/safe error, back and disable actions; final render freshness guards |
| [repair-ai.css](../mobile_app/src/components/repair-ai.css) | Scoped Phat green/gold styling,44px targets,16px input, small viewport/scroll support; no global modal changes |
| [repair-ai.ts](../mobile_app/src/game/repair-ai.ts) | Read-only binding to real subscribe/getSnapshot, lazy commit-time subscription, unsubscribe/dispose, independent session controller identity |
| [repair-ai-feature.ts](../mobile_app/src/game/repair-ai-feature.ts) | Explicit DEV AND repairAi=1 opt-in; production always OFF; no storage/network/provider configuration |
| [binding tests](../tests/repair-ai-integration.test.ts) |9 tests with real mobile adapter and public deterministic controller |
| [browser runner](../scripts/diagnostics/repair-ai-browser.mjs) | Self-contained loopback Vite + Chromium14-scenario regression; external traffic blocked |
| [browser harness](../tests/browser/repair-ai-harness.tsx), [HTML](../tests/browser/repair-ai.html) | Test-only StrictMode mount of real App/GameExperience and real session; naturally revealed repair, plus explicit zero-cash fixture variant |
| [plan](EXE_AI_UI_INTEGRATION_PLAN.md), [checklist](EXE_AI_UI_INTEGRATION_CHECKLIST.md), this report | Integration scope and review evidence |

Three existing UI files changed; four new presentation/binding files, four test/runner files and three documents added. Existing tasks/plan.md and tasks/todo.md were preserved (planning text was moved to the dedicated integration docs). GamifiedModal, BoardView, assets, engine, session transitions, saved-game format, legacy Coach, API1, P3.5 contracts and goldens were not changed.

## Player flow and gate

Only a context accepted by buildRepairContext shows “✨ Hỏi AI trước khi quyết định”: naturally revealed supported B18 repair, before payment/funding. The trigger is immediately below “Tiền mặt hiện có”, above both existing payment choices. Panel expands in the same scroll body; it never creates a second modal. Sổ tay remains available and both choices remain usable, including while loading. Choosing a payment or opening the guide clears AI first.

Use the normal mobile development server in THIS integration worktree, then add ?repairAi=1 to its URL. Example local URL: http://127.0.0.1:5174/?repairAi=1. This is a development opt-in, not a production enable switch. “Tắt AI ở phiên này” disables the shared gate until a new page load/explicit opt-in. No persistent preference, environment key or remote provider is added.

Execution is the existing public P3.5 local deterministic transport/controller. Scope remains25 approved phrases/six repair intents; unsupported questions receive an explicit unanswered fallback. No arbitrary-chat or model-quality claim is made. No /api request is sent, no new endpoint/proxy mounted, no Gemini/credentials read.

## Actual lifecycle

When the feature is OFF, the panel never mounts and no controller/UUID is created (also checked in a browser without randomUUID). The binding constructor has no subscriptions; React useSyncExternalStore starts subscriptions at commit and releases them when its last subscriber leaves. This avoids leaked render-time controllers in StrictMode. It subscribes directly to every session notification, observes snapshot identity, closes/clears even for same-phase snapshots, and disposes on session replacement/unmount. Each new controller obtains an independent epoch.

The existing public controller retains request/digest/revision/generation guards. UI renders answered/fallback only while delivery.isCurrent(); errors also require isCurrent. The view subscription causes React to reread current store state, rather than enqueueing a captured answer. Payment clicks close synchronously before the existing onChoose transition. Edits, Escape/back, feature disable, guide, phase change, restart/import and unmount clear/cancel advice. No engine action is available from AI.

## QA actually executed

| Check | Result |
| --- | --- |
| New session-binding tests |9/9 PASS; expected initial RED recorded before implementation |
| StrictMode real Chromium development scenarios |14/14 PASS; no uncaught page exceptions; zero AI/API/provider network requests |
| Actual production mobile bundle in Chromium |PASS: repairAi=1 ignored even after restoring an eligible repair; button absent |
| Root TypeScript, strict API/server/browser/binding TypeScript |PASS |
| Final mobile TypeScript and full ESLint |PASS |
| Emitted Question browser/server graph |PASS:46browser files,0backend/external runtime imports;50server files;12 pinned wire examples |
| Frozen historical corpus |81/81 PASS, replayed actual working files; Git-blob SHA256 checked and CRLF-only checkout equivalence proven |
| Broad tests: all tests/*.test.ts plus every diagnostics/*.test.ts |710 tests:708 PASS,2 failure records,0skip/cancel. One failed legacy child assertion plus its parent, described below |
| Mobile production build/shared React diagnostic |PASS; normal large-chunk warning remains |
| Preservation |All61 imported AI file objects identical to approved AI commit; no engine/golden/API changes; final inventory in ignored evidence |

### Existing regression blocker (not fixed or hidden)

scripts/diagnostics/mobile-final-ui.test.ts expects fresh App SSR to contain “Hướng dẫn chơi” before a click. Latest UI deliberately shows Entrance first and opens onboarding after Play. The child “fresh player sees onboarding without creating a game; returning player sees setup” fails; its containing parent also fails, producing2 Node failure records. All other tests pass.

This was reproduced with original App/GamePhase/EventModal source loaded directly from verified UI6294fbe via a test-only Vite transform. Evidence baseline-failure.json records the exact SHA and observed Entrance output. No old assertion was skipped, edited or weakened. A fresh sequential broad run after final polish reproduced only this same failure. Owner/Phat should reconcile this older expectation with the approved entrance-first flow before requiring a completely green broad suite. It is not an AI/engine failure.

### Browser scenarios and evidence

14 development scenarios: defaultOFF; actual App saved restore + comparison; honest unsupported fallback; false free-repair premise; zero-cash conditional funding; payment while pending; close while pending + focus/choices; disable while pending; restart/import session replacement; safe local failure; edit/Escape; layout/scroll/keyboard-height emulation at320/768/1440px. Real App uses valid save/restore and natural repair. The zero-cash variation is a test-only state fixture, not a new gameplay action. SHA computation is delayed only by browser test instrumentation to expose pending-work races; responses still come from actual deterministic implementation, not fabricated provider outputs.

Ignored evidence is under node_modules/.tmp/b18-ai-ui-20261030/: browser-results.json, production-result.json, baseline-failure.json, full-tests-final.txt, lint-final.txt, mobile-typecheck-final.txt, root/strict typecheck logs, historical-replays.json, final-verification.json and screenshots. Logs include intermediate expected RED, runner-path/selector fixes and the existing baseline failure; these are not source commit candidates.

Screenshots: actual-app-answer-390.png, initial-mobile.png, insufficient-cash.png, layout-320/768/1440.png, keyboard-viewport-320/768/1440.png, production-off-390.png. Physical virtual keyboard/IME, iOS Safari, screen reader and hardware testing remain unverified; Chromium viewport-height emulation is not a physical keyboard test. Existing external font requests were blocked in browser QA; font rendering may vary on a device.

## Phat/Owner review before official integration

1. Review exact61 imported AI paths and14 authored integration paths, and preserve both parents in any later approved merge commit. This task leaves the merge pending; no push or commit was made.
2. Review button placement, panel copy, scrolling/back/choice interaction and guide coexistence on actual devices. Keep the25-phrase repair-only promise.
3. Confirm real session subscription and render guards on every future UI adapter/import path; never replace them with phase-only dependency checks or mutate snapshots in place.
4. Reconcile the pre-existing onboarding test expectation with entrance-first UI. Do not change financial goldens/engine to resolve a UI expectation.
5. Approve any future code transfer/commit separately. User-visible production rollout remains OFF. Remote ingress/model experiments are separate and are not needed to review this local deterministic integration.

Stop point: implementation and QA complete with the documented baseline diagnostic blocker; waiting for Owner review. No commit/push/merge into Phat's branch, deployment, production flag, paid API call or original-checkout cleanup.