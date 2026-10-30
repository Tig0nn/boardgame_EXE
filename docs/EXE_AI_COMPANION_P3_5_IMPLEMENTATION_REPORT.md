# EXE P3.5 — public repair question contract and transport

Date: 2026-10-29 (Asia/Bangkok). Status: **FINAL REVIEW PASS / OWNER-AUTHORIZED LOCAL COMMIT / FEATURE OFF / NOT LIVE**.
Owner authorized one local P3.5 commit after final review and fresh QA. This report and the handoff are included in that exact22-file scope. No push, merge, deployment or real Gemini call is authorized or performed.

Workspace: `E:/Fall25_Ki8/EXE-boardgame/_exe-workstreams/b18-ai-companion`
Branch: `feat/b18-ai-companion`
Pre-commit baseline HEAD/P3: `89437d5e14da8738478daafd4f655ebfef5190b0`
C: `59dae580df4a3407dc00e8a94828192f825b0403`
B: `78f4d733bb607c1c6066cb94746651b638ef99e2`

Read the [UI handoff](EXE_AI_COMPANION_P3_5_UI_HANDOFF.md) and [separate browser entry](../src/ai/companion/question-index.ts). The approved design and historical P3 report are local untracked references (EXE_AI_COMPANION_P3_5_MIGRATION_PROPOSAL.md and EXE_AI_COMPANION_P3_REPORT.md); they are excluded from this commit and are not dependencies of the public interface.

## Implemented additive files

| File | Purpose |
| --- | --- |
| [question-types.ts](../src/ai/companion/question-types.ts) | Public request/correlation/answered/fallback/error wire types, constants and limits |
| [question-contract.ts](../src/ai/companion/question-contract.ts) | Closed request runtime parser/factory; exact raw question Unicode/digest and context/rule/identity checks |
| [question-errors.ts](../src/ai/companion/question-errors.ts) | Separate closed safe error policy, status/correlation validation, disabled code |
| [question-feature.ts](../src/ai/companion/question-feature.ts) | Shared default-OFF execution/delivery gate; cancellation race |
| [question-response.ts](../src/ai/companion/question-response.ts) | Explicit public envelope, strict union, canonical reconstruction and whole-response validation |
| [question-transport.ts](../src/ai/companion/question-transport.ts) | Local/offline mock/fixed-route remote transport, bounded JSON, safe errors, deadlines; no automatic failover/retry |
| [question-controller.ts](../src/ai/companion/question-controller.ts) | UUID identity, snapshot revision, immutable request/delivery, abort/generation/render guards and reentrant lifecycle |
| [question-index.ts](../src/ai/companion/question-index.ts) | Separate browser-safe exports; old public index untouched |
| [server/question-handler.ts](../src/ai/companion/server/question-handler.ts) | Server-only strict POST/raw JSON handler, deterministic core, limits/deadline/feature checks |
| [api/ai-companion-question.ts](../api/ai-companion-question.ts) | Route module export, default OFF, no environment/credential/provider lookup |
| [contract tests](../tests/ai-companion-question-contract.test.ts) |4 tests |
| [response tests](../tests/ai-companion-question-response.test.ts) |46 tests including all25phrases and17 semantic abstentions |
| [handler tests](../tests/ai-companion-question-handler.test.ts) |8 tests covering loopback/body/method/errors/rate/deadline/disconnect |
| [transport tests](../tests/ai-companion-question-transport.test.ts) |8 tests covering off/local/remote/mock, bounded validation, errors and cancellation |
| [controller tests](../tests/ai-companion-question-controller.test.ts) |20 race/identity/rollback/host-callback tests |
| [wire fixture tests](../tests/ai-companion-question-wire-fixtures.test.ts) |23 positive/error/negative fixtures; never regenerate during tests |
| [question test helper](../tests/helpers/question.ts) |Naturally revealed repair test context; no production state mutation |
| [policy fixture](../tests/fixtures/ai-companion/question-policy-v1.json) |25 approved whole phrases |
| [wire fixture](../tests/fixtures/ai-companion/question-wire-v1.json) |12 real deterministic examples (7answered/5fallback),3 safe errors,10 authored invalid mutations |
| [emitted ESM diagnostic](../scripts/diagnostics/ai-companion-question-deployment.test.ts) |Browser/server transitive graph emission/import and route/wire validation |
| This report and [UI handoff](EXE_AI_COMPANION_P3_5_UI_HANDOFF.md) |Current implementation/readiness/acceptance documentation |

22 new files total:10 production TypeScript modules,7 test/helper files,2 fixtures,1 diagnostic,2 documents. These are the exact22 approved local-commit paths; no other source or document is included. The existing7 historical/planning documents remain untracked and untouched; no automatic cleanup occurred.

## Public wire policy

Route: `POST /api/ai-companion-question`.
questionApiVersion=1; questionPolicyVersion=`b18-repair-question.v1`; contextVersion=`b18-advice.v1`; locale=vi-VN. source is deterministic; integrity remains rules-checked-client-state-unverified.

Request validates every approved field, rejects unknown keys/getters/prototypes, enforces8KiB UTF-8 body, exact question≤400UTF-16 code units, nonblank/control-free/well-formed Unicode. SHA256 is over raw accepted UTF-8 question, independent of normalization. Verify both digests, epoch/revision/stateRevision/encounter identity and rule-derived repair quotes/profile/goal.

Response does not return the P3 internal envelope. It has version/source/integrity/correlation/limitations plus result=answered or fallback. It validates closed nested shapes, canonical labels/roles/text/evidence, exact correlation and content reconstruction; no partial salvage. Maximum12KiB; answered has1–4statements and grounded reflection. Semantic fallback is explicitly unanswered, with[]statements, null reflection and[]evidence.

Scope remains repair-only at tile3 before decision/funding. Six intents,25controlled whole phrases,36existing authored cases;6unfamiliar paraphrases remain unsupported. No income/funding-source costs/other tile mechanics/hidden future/model reasoning or state execution was added. Quoted funding answers remain conditional and carry funding-costs-not-included.

Client digests/rule checks do not authenticate game state or prove the latest server-owned revision. No auth/session store/cache/telemetry/user memory is added.

## Default-OFF and rollback proof

The same QuestionFeature object gates local answer reconstruction, mock/remote transport and controller delivery. Factories default OFF and never read credentials. The wire does not accept a feature-enable field.

Disabled means no local answer, no remote send, pending work cancelled, controller response cleared and no retry. A valid remote QUESTION_FEATURE_DISABLED503 nonretryable error latches the shared client gate OFF. A transient SERVICE_UNAVAILABLE503 stays distinct and does not trigger local answering, retry or gate disable. Forged/miscorrelated disable errors are rejected first.

A disable/re-enable cycle cannot revive a previous request. Process-local server gate and browser gate are separate compositions; full rollout rollback still requires the client feature/config update. Route-only disable cannot instantly notify offline clients. No distributed control plane is claimed.

Server check order is method -> enabled -> local rate admission -> bounded raw body/request validation -> deterministic response. While OFF, POST returns disabled rather than processing an invalid body. No provider option, Gemini adapter or external credential path exists in the new server graph.

## Lifecycle and review fixes

Controller requires synchronous immutable getSnapshot; Phat must subscribe every real game snapshot to observe(), including same-phase changes. It generates independent crypto UUIDs, tracks revision and refuses reused epochs on reset/import. Requests passed to injected transports are deep-frozen so responses cannot retarget the validation baseline.

The ticket/current checks cover request building, in-flight work, response parsing, new/edit question, close/unmount, restart/import, feature disable and response-old-after-new. The actual render guard checks the live snapshot/generation/identity immediately before applying output. Deferred host state updates must repeat that guard at application/render time.

Independent read-only review found and helped correct:
1. Mutable transport request could retarget canonical validation: freeze before dispatch.
2. Disable side effect could precede safe error/correlation validation: validate first.
3. Body-read completion could race cancellation: recheck abort after await, before gate mutation.
4. Host notification could close/supersede before generation setup: reserve active identity before loading callbacks.
5. AbortController listeners run synchronously: detach old active state before abort, reserve generation/token and reject reentrant close/supersession. Close blocks its own abort callback from restarting answering.

Regressions reproduce these cases, including a callback starting a newer question inside abort. Reviewer ran no tests and found no remaining Required source findings after final fixes. Main-agent execution evidence is below.

This is headless lifecycle verification. No actual host session subscription, App/EventModal, CSS, Board3, UI rendering or accessibility integration was implemented or tested.

## Actual QA

| Check | Result |
| --- | --- |
| P3.5-specific matrix |**110/110 PASS**,0fail/skip/cancel |
| Full product/Companion/Coach/P3 regression plus ESM diagnostics |**619/619 PASS**,0fail/skip/cancel |
| Root TypeScript build check |PASS |
| Mobile TypeScript no-emit |PASS |
| Strict API1/question/server/browser graph typecheck |PASS |
| Full ESLint |PASS |
| Emitted Question browser graph |**46files**,0backend/Node/external runtime imports |
| Emitted Question server graph |**50files**; Node builtins only, no provider/credential/environment execution |
| Emitted wire/route validation |12examples PASS; default routeOFF; explicit enabled handler returns canonical public output |
| Frozen historical replay/hash corpus |**81/81 PASS**,read-only |
| C24/B10 and committedP3 preservation |**43source hashes unchanged**; API1/index/templates/golden-v1 unchanged |
| Final Git scope |Expected baseline verified; exact22 additive paths reviewed for one local commit;7 historical documents excluded |

619=509existing+110P3.5; the focused110 are included, not extra product coverage to add again. These are real test executions, not mock model-quality scores. Separate wire fixtures were captured from actual deterministic implementation; authored invalid mutations are rejection tests, not fabricated model output. No test regenerates fixtures/goldens.

Tests used injected transports and loopback HTTP, with legacy provider key variables blanked. New code does not read environment/credentials. No Vite start/build that executes loadEnv, production ingress, Google/Gemini traffic or real paid key use occurred. No QA test is blocked by missing fixtures/dependencies.

Initial implementation evidence remains under `node_modules/.tmp/ai-companion-p35-20261029-01/`. Fresh final-review/commit evidence is under `node_modules/.tmp/ai-companion-p35-commit-20261029-01/`: full-tests.txt, the three typecheck logs, lint.txt, historical-replays.json, qa-exits.json and verification records. All evidence is ignored and excluded from the commit.

## Readiness and blockers

**Backend:** Node route/handler is ready for local review and loopback tests. **Not publicly mounted/live.** Existing tracked Vite configuration only mounts legacy Coach; this task did not add a proxy or change deployment configuration. A future approved deployment must mount the new route, preserve raw JSON ingress (preparsed object fails closed), and supply an explicit server feature configuration. Default route stays OFF. The5/minute/socket-peer limiter is process-local, not distributed or authenticated quota.

**Browser/controller:** Separate browser entry, pure contract, transports and lifecycle controller are ready for review and offline mock UI testing after approved code transfer. Phat still must wire real immutable snapshots, every session notification, edit/close/unmount/reset events and actual render-time guards. No end-to-end real UI claim is made.

**Preservation:** API1/Coach behavior, engine/economy/rules/saves, old browser index, P2/P3 templates and frozen golden are untouched. Golden SHA256:8cef73f72e4ccba503af089b4faa5af18c47a50e3becdfaf52b7c16fdd018918. Frozen frontend contract SHA256:a8460a7f523eaf8ae1e69092f57957f7b960b3ed46042042426f0a1963476b4c.

**Final review:** Main-agent review and independent read-only review found no Critical/Required production-source findings. No source fix or additional backend scope was needed. Documentation was updated for the approved local-commit checkpoint and no longer depends on links to excluded historical reports. The commit containing these22 paths is the P3.5 handoff unit; resolve its SHA from Git history rather than treating the old baseline as the implementation commit.

**Next approval boundary:** The reviewed interface is ready to hand off to Phat using the pinned local commit. Actual code transfer/UI integration, production ingress, feature rollout, push/merge/deploy and any model experiment remain separate tasks. Original Phat repository has not been operated on.
