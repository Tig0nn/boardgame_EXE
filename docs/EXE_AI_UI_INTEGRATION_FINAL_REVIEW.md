# B18 AI UI integration — final review

Date: 2026-10-30 (Asia/Bangkok). Verdict: **AI SCOPE REVIEW PASS; PROPOSE LOCAL MERGE COMMIT; WAIT FOR OWNER APPROVAL**. Broad legacy QA remains708/710 and is not reported as fully green. No product source or existing test was changed in this review. Only this report is newly proposed for the commit; supplemental review tools/evidence remain ignored.

## Git and merge safety

Workspace: E:/Fall25_Ki8/EXE-boardgame/_exe-workstreams/b18-ai-ui-integration
Branch: codex/b18-ai-ui-integration
HEAD/UI parent:6294fbe3e65c4c723297aa8e624ae5e322f90cad
MERGE_HEAD/AI parent:90c03ff17fd35df4d3c57691658c6fe16cceaa90

The prior --no-commit merge remains pending. No merge was repeated or completed. The index contains exactly61 added AI paths; each index object AND normalized working object matches the approved AI commit. No unmerged entries. Only App.tsx, GamePhase.tsx and EventModal.tsx have meaningful unstaged tracked changes. The14 authored integration files match all prior SHA256 records. Engine, old contracts/goldens, saved games, rules, assets and legacy Coach are unchanged.

Observed status nuance: tasks/plan.md and tasks/todo.md display M in short status although their staged/unstaged diffs are empty and normalized working blob IDs match the index. They are LF working files with the repository's CRLF checkout policy. No content change has been demonstrated; this review does not rewrite files, refresh/reset the index or stage them. They are excluded from the exact proposed commit set. Their cosmetic status must not be treated as permission to add them.

No original Phat checkout operation, reset/clean/rebase, staging, commit, push, deployment, endpoint mount or production enable occurred in this review. Fetch/merge history already present from the prior authorized isolation step is preserved.

## Review matrix

| Group | Verdict | Evidence and practical limit |
| --- | --- | --- |
| Git isolation and conflict safety | PASS | Correct branch/two parents, no unmerged entries, exact61 imported objects; no commit yet |
| Approved AI source preservation | PASS | All61 imported files equal AI90c03ff; canonical contracts/goldens and browser graph unchanged |
| Integration source review | PASS |14/14 files unchanged, independent read-only reviewer found no Critical/Required source finding |
| Scope/placement | PASS | Projector requires eligible revealed repair before funding; DEV opt-in; trigger below cash and before payment choices |
| Inline panel/guide/decisions | PASS | One event backdrop, panel inside body; guide closes AI; both payment controls survive guide/back; no new popup |
| Answer/fallback/error and grounding | PASS | Public parser reconstructs canonical output; honest fallback with no reflection; safe fixed error; no free-form claims |
| Gameplay ownership | PASS | AI binding exposes no dispatch; actual App saved-game data identical before/after asking and closing |
| Identity/stale/cancellation | PASS |37 targeted tests plus browser edit/close/disable/restart/unmount; final ticket guard retained |
| Same-phase change | PASS in covered tests | Binding unit test and supplemental real-browser host notification clear a rendered answer. Browser host creates a synthetic immutable snapshot; it is not a new engine action |
| StrictMode duplicate behavior | PASS | Harness runs StrictMode; actual App one submit creates exactly one fresh request UUID and one reflection block; commit-time subscribe/dispose reviewed |
| Feature OFF and disable | PASS | DefaultOFF has no controller mount even without randomUUID; pure DEV opt-in; actual production build ignores repairAi=1. Local/remote disable validated by public transport tests; integration uses local only |
| Mobile/keyboard automation | PASS in covered checks |320/768/1440 widths, horizontal bounds, scroll to payment,360px reduced-height viewport, input→submit Tab, Shift+Tab/Escape and back focus verified |
| Actual device/IME/Safari/screen reader | NOT RUN | No physical device, real virtual keyboard, composition input, Safari or assistive-technology certification available |
| Broad product/diagnostic suite | FAIL, pre-existing |708/710; one old onboarding child assertion and its propagated parent record; exact baseline match below |
| Lint/typecheck/ESM/replays | PASS evidence retained | Unchanged source hashes; prior executed checks and81 frozen replays remain valid; no repeated broad suite after unchanged source |

No claim is made that the controller covers every possible host integration or that all accessibility behavior of the shared GamifiedModal is certified. Focus restoration after a disappearing disable control and a full modal-wide Tab trap are not established by these tests; Phat should review them on device. No shared-modal refactor was made.

## Exact classification of708/710

Test file: scripts/diagnostics/mobile-final-ui.test.ts.

1. Failed child: “fresh player sees onboarding without creating a game; returning player sees setup”. Executed failing assertion is **assert.match(first, /Hướng dẫn chơi/)** (line39 of the unchanged test). This expects onboarding/help copy in the fresh initial App SSR. The next old assertion would expect no initial-savings marker; it is not the second recorded failure because execution stops at the first assertion.
2. Failed parent: “Mobile final UI contracts use the official engine, board and financial previews”. Node marks this parent failed because its child failed. It is not a second independent AI/product bug.

Old flow expectation: fresh initial render shows guide/onboarding before play and omits the hidden setup marker; returning player sees the marker and no guide. Latest approved UI intentionally renders Entrance first, with Play opening first-time onboarding. Both baseline and integration render Entrance at initial SSR, without “Hướng dẫn chơi”, and include the existing hidden initial-savings marker.

Fresh AND returning initial SSR were compared using original App/GamePhase/EventModal loaded from UI6294fbe versus current integration. All four HTML byte streams have the same SHA256:

276489fb3fd6d652a9e5cf2971e8662217bbb496c7a94cdcabf3d86e07ba5d63

Thus the actual failed assertion and rendered result are the same on both baselines. Evidence: ../node_modules/.tmp/b18-ai-ui-final-review-20261030-01/baseline-comparison.json, baseline-fresh.html, baseline-returning.html, integration-fresh.html and integration-returning.html. These are review artifacts, not replacement fixtures. No old onboarding source, assertion or expected value was altered; no tests were skipped. **Phat must confirm how this legacy test should match the approved entrance-first UX in a separate change.**

## QA execution and browser evidence

Fresh review execution:
- 37/37 binding/controller/transport tests PASS,0fail/skip/cancel. Covers local+remote disabled gate, same-phase invalidation, supersession and render guards.
- 16/16 browser scenarios PASS,0uncaught page errors and0AI/API/provider network requests.14 existing scenarios were exercised with stronger assertions, plus same-phase synthetic host notification and true React unmount while pending.
- Actual App additional assertions: one submit→one request UUID in StrictMode; one answer/reflection; button ordering; exact saved-game equality after ask/close; guide open/close preserves decisions; enabled submit participates in Tab/Shift+Tab, Escape restores trigger focus.

Previous execution retained because all product/test sources are byte-identical:
- Broad suite710 tests:708PASS/2FAIL/0skip/0cancel, with only the child/parent above.
- Root/mobile/strict typechecks, full lint and emitted ESM PASS. Browser graph46files with0backend/external runtime imports; server graph50files,12canonical wire examples.
- 81/81 frozen historical replays PASS. Git-blob SHA256 verified; four text files differ only through Windows CRLF in working checkout. No corpus rewrite.
- Actual production build in Chromium PASS: query repairAi=1 does not show AI on an eligible restored repair. Large bundle warning is retained; no performance claim was added.

[Actual App mobile answer](../node_modules/.tmp/b18-ai-ui-final-review-20261030-01/actual-app-answer-390.png)
[320px panel and payment controls after scrolling](../node_modules/.tmp/b18-ai-ui-final-review-20261030-01/layout-320.png)
[Reduced-height320px input viewport](../node_modules/.tmp/b18-ai-ui-final-review-20261030-01/keyboard-viewport-320.png)
[Same-phase response cleared](../node_modules/.tmp/b18-ai-ui-final-review-20261030-01/same-phase-cleared.png)
[Production OFF screenshot from implementation QA](../node_modules/.tmp/b18-ai-ui-20261030/production-off-390.png)

The reduced-height screenshots emulate available viewport height; they do NOT prove real phone keyboard/IME behavior. Test-only restart/import controls in some screenshots are harness controls, not new game UI. Same-phase host changes are simulated immutable notifications. Pending delays affect test hashing only; canonical responses are produced by the real deterministic core. No mocked Gemini/model-quality score is claimed.

Local evidence: ../node_modules/.tmp/b18-ai-ui-final-review-20261030-01/browser-results.json, lifecycle-tests.txt, baseline-comparison.json, source-verification.json and review-verification.json. Initial supplemental harness routing/disabled-submit assertions were corrected inside ignored review tools; they did not expose a product defect or change product sources. Earlier implementation logs remain under node_modules/.tmp/b18-ai-ui-20261030/. Evidence/cache/builds/images must not be staged.

## Proposed commit — approval required, NOT executed

Propose exactly ONE merge commit on codex/b18-ai-ui-integration preserving both current parents:

**feat(mobile): integrate grounded repair AI into B18 event modal**

Proposed body: Integrate the approved versioned repair question controller into the inline B18 repair event flow. Keep production disabled, allow explicit development-only local mode, and cancel advice on game/session changes. Document the pre-existing entrance-first onboarding diagnostic failure and physical-device verification limits.

Scope:61 already-staged imported AI files +14 unchanged authored integration files +this final-review report = **76 exact paths**. This is a proposal, not authorization to commit. After Owner approval, stage only the15 authored/report paths listed below, recheck exact cached76-path set, source hashes, both parents, no conflicts/secrets and diff, then commit in a separate approved action. Do not use git add . or include task files/evidence/historical docs. Do not rerun merge or alter either source branch.

### 61 approved imported AI paths (already in index)

- `api/ai-companion-question.ts`
- `api/ai-companion.ts`
- `docs/EXE_AI_COMPANION_FRONTEND_CONTRACT.md`
- `docs/EXE_AI_COMPANION_P3_5_IMPLEMENTATION_REPORT.md`
- `docs/EXE_AI_COMPANION_P3_5_UI_HANDOFF.md`
- `scripts/diagnostics/ai-companion-deployment.test.ts`
- `scripts/diagnostics/ai-companion-question-deployment.test.ts`
- `scripts/diagnostics/ai-companion-question-intent-experiment.test.ts`
- `scripts/diagnostics/generate-ai-companion-fixtures.ts`
- `src/ai/companion/advice.ts`
- `src/ai/companion/client.ts`
- `src/ai/companion/context.ts`
- `src/ai/companion/contracts.ts`
- `src/ai/companion/errors.ts`
- `src/ai/companion/facts.ts`
- `src/ai/companion/index.ts`
- `src/ai/companion/question-contract.ts`
- `src/ai/companion/question-controller.ts`
- `src/ai/companion/question-errors.ts`
- `src/ai/companion/question-feature.ts`
- `src/ai/companion/question-index.ts`
- `src/ai/companion/question-response.ts`
- `src/ai/companion/question-transport.ts`
- `src/ai/companion/question-types.ts`
- `src/ai/companion/questions/answer.ts`
- `src/ai/companion/questions/lesson.ts`
- `src/ai/companion/questions/routing.ts`
- `src/ai/companion/questions/session.ts`
- `src/ai/companion/repair-quotes.ts`
- `src/ai/companion/schema.ts`
- `src/ai/companion/serialization.ts`
- `src/ai/companion/server/body.ts`
- `src/ai/companion/server/gemini.ts`
- `src/ai/companion/server/handler.ts`
- `src/ai/companion/server/limits.ts`
- `src/ai/companion/server/provider.ts`
- `src/ai/companion/server/question-handler.ts`
- `src/ai/companion/templates.ts`
- `src/ai/companion/types.ts`
- `tests/ai-companion-advice.test.ts`
- `tests/ai-companion-client.test.ts`
- `tests/ai-companion-context.test.ts`
- `tests/ai-companion-contract.test.ts`
- `tests/ai-companion-endpoint.test.ts`
- `tests/ai-companion-fixtures.test.ts`
- `tests/ai-companion-provider.test.ts`
- `tests/ai-companion-question-answer.test.ts`
- `tests/ai-companion-question-contract.test.ts`
- `tests/ai-companion-question-controller.test.ts`
- `tests/ai-companion-question-handler.test.ts`
- `tests/ai-companion-question-response.test.ts`
- `tests/ai-companion-question-routing.test.ts`
- `tests/ai-companion-question-session.test.ts`
- `tests/ai-companion-question-transport.test.ts`
- `tests/ai-companion-question-wire-fixtures.test.ts`
- `tests/fixtures/ai-companion/golden-v1.json`
- `tests/fixtures/ai-companion/question-policy-v1.json`
- `tests/fixtures/ai-companion/question-wire-v1.json`
- `tests/fixtures/ai-companion/questions-p3.json`
- `tests/helpers/companion.ts`
- `tests/helpers/question.ts`

### 14 authored integration paths (not staged by this review)

- `docs/EXE_AI_UI_INTEGRATION_CHECKLIST.md`
- `docs/EXE_AI_UI_INTEGRATION_PLAN.md`
- `docs/EXE_AI_UI_INTEGRATION_REPORT.md`
- `mobile_app/src/App.tsx`
- `mobile_app/src/components/EventModal.tsx`
- `mobile_app/src/components/GamePhase.tsx`
- `mobile_app/src/components/RepairAiPanel.tsx`
- `mobile_app/src/components/repair-ai.css`
- `mobile_app/src/game/repair-ai-feature.ts`
- `mobile_app/src/game/repair-ai.ts`
- `scripts/diagnostics/repair-ai-browser.mjs`
- `tests/browser/repair-ai-harness.tsx`
- `tests/browser/repair-ai.html`
- `tests/repair-ai-integration.test.ts`

### One additional review document proposed

- docs/EXE_AI_UI_INTEGRATION_FINAL_REVIEW.md

## Phat/Owner sign-off

- Owner approves the exact76-path local merge commit, message, parents and known baseline diagnostic failure. No commit until that approval.
- Phat reviews style/placement, Sổ tay/payment coexistence, panel return/clear behavior, and acceptance of the25-phrase repair-only promise.
- Phat confirms the intended onboarding flow/test expectation; this review does not change it.
- Phat/QA validates real keyboard open/close, focus after disable, Vietnamese IME/composition, device scroll/safe areas/orientation, iOS Safari, screen-reader announcements and inherited modal focus behavior. None are claimed PASS without a device.
- Existing payment copy says “cuối vòng”, while canonical AI says the next START settlement; Phat should confirm that wording is clear. This baseline copy and the financial rules were preserved.
- Production remainsOFF; no remote ingress, provider, deployment or official branch integration is included in this approval proposal.

Stop point: review report and concrete commit proposal complete. Await Owner decision; no commit/push/production operation performed.
