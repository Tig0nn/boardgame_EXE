# EXE — approved AI Companion synchronized with latest B18 UI

Date: 2026-10-30 (Asia/Bangkok). Status: INTEGRATED LOCALLY / QA PASS / MERGE PENDING OWNER REVIEW. No commit, push, official-branch merge, deployment or production enable.

## Verified refs and isolation

- Repository: Tig0nn/boardgame_EXE, origin HTTPS URL verified.
- Remote UI HEAD verified before work: f63a4354be7a26118b01d82e9563c11467170b3a.
- Remote approved AI integration HEAD: aeaae9521254d184ff1fdaffdf0d4062d0eca2dd.
- Sync branch: codex/b18-ai-ui-sync.
- New worktree: E:/Fall25_Ki8/EXE-boardgame/_exe-workstreams/b18-ai-ui-sync.
- HEAD remains the UI SHA; MERGE_HEAD is the AI SHA. Merge base is6294fbe3e65c4c723297aa8e624ae5e322f90cad.

The new branch was created from the fetched exact UI remote commit. Git merge --no-commit --no-ff completed successfully. No conflict markers or unmerged entries; no ours/theirs selection. No changes to Phat's original checkout or old branch history. No uncommitted files from old worktrees were copied; dependency installations were copied into isolated ignored node_modules directories without their caches/evidence.

## Conflict and file review

**No conflicts required manual resolution.** App.tsx was automatically combined. Its complete diff against latest UI is one line: session={session} forwarded into GamePhase. All new MapScreen/navigation/onboarding code therefore remains UI-authored. This preserves returnToMap, saved-game continuation, fresh node selection, Map overlays and the AI session lifecycle together.

Git imported78 paths relative to the new UI parent. They contain the reviewed AI/backend/contracts/fixtures, integration glue, two-tab UX and its historical reports. The index copies all approved AI objects except App.tsx, whose object combines the latest UI with the one-line AI session forwarding. The complete imported path manifest is in ignored final-verification.json; source is not recopied manually.

Only one existing file was edited after the automatic merge:

- [repair-ai-browser.mjs](../scripts/diagnostics/repair-ai-browser.mjs): adapt actual App test to Entrance→Map→node before accessing AI; add fresh onboarding completion, Map return/continue, locked node and Map guide checks; add actual Map screenshots at320/375/390px.

One new document: this report. The test edit is unstaged;78 automatic-merge paths remain staged. Owner must inspect both index and working diff before any later approved merge commit. No commit is created here.

Preserved: EntranceScreen, MapScreen, Map Node definitions/assets, new tutorial helpers/onboarding, B18 engine, Sổ tay, management modals, end-game Coach, two-tab AI, all contracts/goldens and saved-game format. No new engine action, financial rule, migration, provider mode or production ingress was introduced.

## Actual flow verification

The real App is mounted under StrictMode, not a replacement product flow. Browser QA performs:

1. Fresh initial tutorial over Entrance, all tutorial steps and completion; Map appears and node1 opens the board. This is the latest UI's intended initial state.
2. Returning player sees Entrance; Play opens Map; active node1 opens a valid saved B18 repair that was naturally revealed by the unchanged engine.
3. Repair defaults to Quyết định. Hỏi AI accepts a supported question and produces canonical grounded statements; tab switches retain the valid question/result without a duplicate request or game mutation.
4. Payment is clicked in Quyết định; old AI content is removed before the unchanged game transition.
5. Quay lại Bản đồ opens Map; node1 resumes the saved state. Snapshot equality is asserted, with no old AI response appearing.
6. Existing locked nodes remain locked and show the update toast; Map Sổ tay opens/closes normally. No chapter progression or unlocking behavior is changed.
7. Additional fixture-host tests cover restart/import session replacement, same-phase changes, hidden-tab stale cancellation, unmount, edit supersession, disabled gate, funding conditions and safe errors.

Saved-repair restoration is a test setup using the existing save/load codec and a natural engine-revealed fixture. The zero-cash variation is test-only. The existing import/new-session path is covered by controller/binding tests and the harness session replacement; no currently hidden setup/import navigation was added to Map. No future events or game state are sent to an AI provider.

## QA results

| Check | Actual result |
| --- | --- |
| Full regression + every TS diagnostic |710/710 PASS;0fail/skip/cancel |
| Browser integration |18/18 PASS;0uncaught exceptions;0AI/API/provider requests |
| Explicit AI binding/controller/transport lifecycle |37/37 PASS;0fail/skip/cancel |
| Root/mobile/strict typecheck |PASS |
| Full lint and final browser-script lint |PASS |
| Emitted ESM |PASS:46 browser files,0backend/external runtime imports;50 server files,12 pinned wire examples |
| Frozen historical replay corpus |81/81 PASS,read-only; Git-blob hashes and CRLF-only working checkout equivalence checked |
| Actual mobile production build |PASS; normal >500kB bundle warning retained |
| Actual production bundle in Chromium |PASS: Entrance→Map→node→eligible repair does NOT show AI even with repairAi=1 |
| Independent merge-source review |No merge-caused Critical/Required finding |

### Previously failing onboarding tests

The two former failure records are now BOTH PASS:

- Child: fresh player sees onboarding without creating a game; returning player sees setup.
- Parent: Mobile final UI contracts use the official engine, board and financial previews.

The unchanged assertion assert.match(first, /Hướng dẫn chơi/) now succeeds because UI commit f63a435 initializes first-time tutorial state again. Fresh baseline and sync initial SSR both show guide content and omit initial-savings; returning SSR shows Entrance/initial-savings without guide. Exact HTML comparison against original UI App/GamePhase/EventModal loaded from Git is identical for baseline and sync in each case. Evidence: baseline-comparison.json and the four SSR HTML files in the QA folder. No test expectation was changed, skipped or weakened. This is an upstream UI fix, not a new integration workaround.

## Mobile evidence

| Flow | Screenshot |
| --- | --- |
|Actual Entrance|[390px](../node_modules/.tmp/b18-ai-sync-20261030/actual-app-entrance-390.png)|
|Actual Map|[320px](../node_modules/.tmp/b18-ai-sync-20261030/actual-app-map-320.png), [375px](../node_modules/.tmp/b18-ai-sync-20261030/actual-app-map-375.png), [390px](../node_modules/.tmp/b18-ai-sync-20261030/actual-app-map-390.png)|
|Fresh onboarding|[tutorial](../node_modules/.tmp/b18-ai-sync-20261030/fresh-onboarding.png)|
|Map node→actual App grounded AI|[answer](../node_modules/.tmp/b18-ai-sync-20261030/map-to-grounded-answer.png)|
|Payment→Map|[return](../node_modules/.tmp/b18-ai-sync-20261030/return-map-after-payment.png)|
|Two-tab mobile states|Decision/AI/answered/fallback and reduced-height screenshots at320/375/390px in the QA folder|
|Production disabled|[production OFF](../node_modules/.tmp/b18-ai-sync-20261030/production-off-390.png)|

Ignored evidence: node_modules/.tmp/b18-ai-sync-20261030/. Includes browser-results.json, browser-final.txt, lifecycle-tests.txt, full-tests.txt, qa-exits.json, final-checks.json, historical-replays.json, production-result.json, baseline-comparison.json and final-verification.json. Raw logs/screenshots/build output are not source commit candidates. Historical imported reports describe old checkpoints and are not current QA claims.

## Remaining risks and readiness

- Local preview and production build are ready for Owner/Phat review. No remote Preview URL was created. Commit, push and any deployment require separate approval; pending merge must not be mistaken for published code.
- Production AI remains OFF. Local development only uses explicit repairAi=1 and deterministic transport. No new endpoint mount, Gemini call, credentials or paid key use occurred.
- Map interactions were exercised with pointer/touch emulation. Baseline Map nodes are clickable divs without button role/tabIndex/key activation; complete keyboard navigation of Map is not certified. This UI-source accessibility limitation was preserved and should be reviewed by Phat; AI tab keyboard/ARIA navigation passes.
- Physical keyboard/IME, Safari, screen reader, real-device focus/scroll/safe-area/orientation and complete modal focus trapping remain untested. Reduced-height Chromium viewport checks do not certify a real virtual keyboard.
- Two baseline source observations remain: initial tutorial checks hasSeenTutorial but not the disabled preference; the finished-game return path removes localStorage without catching storage failure. They are not merge regressions and were not silently changed. Phat should confirm intended behavior.
- Map chapter availability remains the latest UI behavior: node1 is playable and later chapters show Đang cập nhật. No new game mode/financial rules/progression were added.

Stop point: integration and QA complete, no commit/push/deploy. Owner reviews this sync worktree and evidence before authorizing the next action.