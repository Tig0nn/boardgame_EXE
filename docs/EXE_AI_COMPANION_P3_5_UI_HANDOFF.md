# EXE P3.5 — UI handoff for Phat

Date: 2026-10-29 (Asia/Bangkok). **Final review PASS; Owner-authorized local commit. Feature OFF; not integrated into UI or production.**

AI worktree: `E:/Fall25_Ki8/EXE-boardgame/_exe-workstreams/b18-ai-companion`, branch `feat/b18-ai-companion`, baseline P3 `89437d5e14da8738478daafd4f655ebfef5190b0`. The local commit containing this handoff is the reviewed22-file P3.5 handoff unit. Pin that commit SHA when arranging an approved transfer before Phat imports the interface. Do not assume this code is on GitHub.

See [implementation report](EXE_AI_COMPANION_P3_5_IMPLEMENTATION_REPORT.md), [wire types](../src/ai/companion/question-types.ts), [public entry](../src/ai/companion/question-index.ts), [policy phrases](../tests/fixtures/ai-companion/question-policy-v1.json) and [complete wire fixtures](../tests/fixtures/ai-companion/question-wire-v1.json). The older proposal and P3 report describe earlier checkpoints; this handoff documents implemented P3.5 behavior.

## Contract and scope

New route module: `POST /api/ai-companion-question`.
- questionApiVersion:1
- questionPolicyVersion:`b18-repair-question.v1`
- contextVersion:`b18-advice.v1`
- locale:`vi-VN`
- source:`deterministic`
- integrity:`rules-checked-client-state-unverified`

The route has not been mounted by this task. Existing Vite only mounts legacy Coach. Do not send real UI requests until a separately reviewed Node/raw-body ingress and server enable configuration are in place. Default route export returns the disabled error for POST.

Scope:25 whole supported phrases across rules/cost/compare/liquidity/risk/learning, listed in the policy fixture; the existing [P3 evaluation fixture](../tests/fixtures/ai-companion/questions-p3.json) records the authored scope. Existing36 authored P3 cases and6 unfamiliar paraphrases are retained; those6 remain unsupported. Accent/case/whitespace/trailing ?!. normalization is routing only, not broad language understanding.

Only a naturally revealed repair at tile3, pinned B18 Multi-Course profile, before decision/funding/settlement, can project a context. No income, future events, hidden state, RNG, funding-source costs or other tile mechanics are available. No AI response executes a game action. Player continues using existing choices.

Request has exactly11 fields: version/policy/contextVersion/locale, requestId, sessionEpoch, revision, context, contextDigest, question, questionDigest. Use factories and runtime parsers; do not cast a UI object to the request type. No game-state spread, logs, seed or feature flag field may enter the request.

Question:1–400 UTF-16 code units with nonblank content, no forbidden control characters or unpaired surrogates. Valid emoji pairs are preserved. Hash exact accepted raw UTF-8 text; never normalize first. Context digest uses existing canonical context serialization. Both checksums are recomputed; they do not authenticate client state.

Identity cross-checks: stateRevision=epoch:revision; decisionId=epoch:repair:encounterSequence. Controller uses a crypto UUID epoch, fresh UUID per ask and revision for each observed new immutable snapshot. Reset/import creates a new epoch; reuse of an epoch within the controller is rejected.

Response is a public envelope with full correlation and a discriminated `result`:
- answered: six intents, canonical explanation, labeled canonical statements, grounded reflection and exact evidence.
- fallback: explicit reason/explanation; statements=[], reflectionQuestion=null, evidenceRefs=[].

Fallback is not a completed financial explanation. Show its reason/clarification/example without an answer-success claim, quiz, amounts or evidence panel. Never show raw server/provider error text; safe messages are fixed and runtime validated. All responses must pass complete schema and exact canonical validation; reject the whole bad response.

## Default OFF and local UI testing

Use **one shared feature object** for controller and its chosen local/mock/remote transport. No automatic remote-to-local failover exists.

```typescript
import {
  createQuestionFeature, createQuestionController,
  createMockQuestionTransport, createRemoteQuestionTransport,
} from '../src/ai/companion/question-index.ts'

const feature = createQuestionFeature() // OFF
const controller = createQuestionController({
  feature,
  getSnapshot: readCurrentGameSnapshot, // Phat supplies a synchronous immutable GameState adapter
  transport: createMockQuestionTransport({ feature, delayMs: 250 }),
})

// Only explicit approved LOCAL testing:
// feature.setEnabled(true)
// const delivery = await controller.ask('So sánh trả ngay và sửa tạm')

// Once real ingress is separately approved, choose transport at construction:
// createRemoteQuestionTransport({ feature })
```

Mock transport is entirely offline and returns actual deterministic public responses, not fake Gemini output. It supports success, unavailable, rate-limited and timeout scenarios with bounded delay. The default controller also uses local deterministic execution when explicitly enabled. Merely constructing any transport does not send a request.

Controller API:
- observe(): call on every host game snapshot notification, including same phase. getState also detects a changed live snapshot.
- ask(question): supersedes older work, builds/validates a new request, returns a delivery ticket or null for cancelled/stale/error/disabled cases. Inspect getState for error/disabled status.
- editQuestion(text): clear/abort current output as soon as the input changes, not only when the next ask starts.
- close(): abort pending work and clear displayed controller state; a later explicit ask can reopen it.
- resetSession(): new independent epoch for restart/import/new game, even if the host reuses a snapshot reference.
- setEnabled(false): disables the shared gate; cancels remote/local/mock work and clears state.
- subscribe(listener): receive idle/loading/answered/fallback/error/disabled state notifications.
- dispose(): abort, clear subscribers and detach the gate listener on unmount.

No subscription to the real host game session is installed by this library. Phat must connect the session adapter to observe() and connect controller changes to view updates. The repository contains no general session API with these example adapter names; they are host responsibilities, not existing functions silently added to the app.

## Actual render boundary

Delivery has immutable response, isCurrent(), and synchronous render(apply). The ticket checks snapshot reference, exact question, generation, epoch/revision, active request ID, feature and abort state.

Read the current controller state at the actual view-application boundary instead of queuing a captured old loading/error/answer state. Example host-neutral flow:

```typescript
function renderCurrentQuestionState() {
  const state = controller.getState()
  if (state.status === 'answered' || state.status === 'fallback') {
    state.delivery.render(response => applyQuestionView(response))
  } else if (state.status === 'error') {
    if (state.isCurrent()) applySafeQuestionError(state.error)
  } else {
    applyQuestionStatus(state.status) // idle/loading/disabled clears any financial answer
  }
}
const stopView = controller.subscribe(() => scheduleActualViewUpdate(renderCurrentQuestionState))
const stopSession = subscribeToEveryGameSnapshot(() => controller.observe())
// These host adapter functions must be supplied by Phat.
```

If applying the view queues a deferred state updater, repeat ticket.isCurrent() **inside that updater and at final component render**, not only before calling a setter. There must be no await between the final check and applying the answer. A simple safe updater shape is `setAdvice(() => delivery.isCurrent() ? delivery.response : null)`; final rendering must still hide an invalid ticket. Error state has the same isCurrent check. Do not use an old request/snapshot as “current”.

Clear pending and already-visible advice on any game snapshot change, choice execution, leaving event phase/entering funding, question edit/new ask, close, unmount, restart/import/new session and feature disable. Invalidate even when phase is unchanged. Keep gameplay controls usable; AI must not disable options or choose for the player.

Controller tests cover these races headlessly, including response-old-after-new, delayed render, synchronous subscribe/abort callback reentrancy and transports that ignore cancellation. **Real UI lifecycle subscription, rendering and accessibility have not been tested end to end.**

## Errors and retry

| Condition | Meaning |
| --- | --- |
| answered / fallback | HTTP200; fallback is explicitly unanswered |
| INVALID_JSON / INVALID_REQUEST |400; repair input; malformed Unicode/digest format is invalid |
| UNSUPPORTED_VERSION / UNSUPPORTED_PROFILE |409; do not cast/down-convert |
| CONTEXT_MISMATCH / DECISION_UNAVAILABLE |409; clear old output; rebuild only from current eligible snapshot |
| INVALID_FINANCIAL_CONTEXT / INVALID_OPTIONS |422; no amounts from invalid payload |
| PAYLOAD_TOO_LARGE |413; request≤8KiB, response≤12KiB |
| METHOD_NOT_ALLOWED |405; POST only |
| RATE_LIMITED |429, Retry-After/retryAfterMs; manual retry only with current context |
| SERVICE_UNAVAILABLE |503; transient, no automatic retry or local failover |
| QUESTION_FEATURE_DISABLED |503, retryable=false; remote client latches the shared gate OFF |
| INVALID_RESPONSE |502-style local safe error; show none of the raw response |
| cancelled/stale |No delivery; idle/current state, not semantic fallback or gameplay-error toast |

A forged/miscorrelated disabled error is rejected instead of switching off the feature. A valid disabled error disables local execution too. Disable/re-enable never revives old work. Server-only route disable cannot notify an offline client instantly; full rollback also requires delivery of the shared client flag/config update. No distributed kill-switch/control plane is implemented here.

## Integration acceptance checklist

- Obtain reviewed/pinned P3.5 code and fixtures after Owner approval; preserve API1/golden-v1/legacy Coach.
- Confirm25-phrase repair-only scope and honest fallback UX with Owner; do not advertise arbitrary chat.
- Keep feature OFF by default; share one gate across controller/transport; no payload field enables the server.
- Supply immutable current GameState; wire every session notification to observe, reset epoch on import/restart.
- Wire question edit, close, unmount, actual engine choice and every snapshot to clearing/cancellation.
- Guard deferred setters and actual render; do not render old tickets or raw network text.
- Test answered, each fallback reason, zero cash/conditional funding, invalid response, rate limit, transient failure, server/client disable and re-enable.
- Verify real browser/host UI races and accessibility; these remain integration work for Phat.
- For remote use, separately approve/mount the new Node raw-body route and its server feature config. Process-local5/minute limit is not distributed/authenticated quota.
- Never add credentials, Gemini, engine mutations or financial rules to UI glue.

## Actual wire examples

The following are captured from the real deterministic implementation and pinned separately from golden-v1. They are not model outputs. Complete fixtures contain12 examples,3 safe errors and10 authored invalid request/response mutations; valid outputs are never regenerated by tests.


### Request

```json
{
  "questionApiVersion": 1,
  "questionPolicyVersion": "b18-repair-question.v1",
  "contextVersion": "b18-advice.v1",
  "locale": "vi-VN",
  "requestId": "wire-compare",
  "sessionEpoch": "golden-compare",
  "revision": 1,
  "context": {
    "profile": {
      "gameplayProfile": "core-mvp-b18-multi-course-v1",
      "boardRevision": "b18-l3-bonds-v1",
      "goalRulesVersion": "single-90m-v1",
      "encounterRulesVersion": "b18-tile-trading-v1",
      "courseRulesVersion": "b18-i2-choice-v1",
      "bondRulesVersion": "v2.5-credit-risk",
      "livingExpenseRulesVersion": "b18-periodic-start-v1",
      "savingsProfileId": "v2.2-c20",
      "adviceRulesVersion": "b18-repair.v1"
    },
    "decision": {
      "decisionId": "golden-compare:repair:3",
      "stateRevision": "golden-compare:1",
      "phase": "event",
      "eventId": "repair",
      "encounterSequence": 3,
      "turn": 1,
      "lap": 1,
      "totalLaps": 4,
      "tileIndex": 3,
      "tileType": "personal"
    },
    "financial": {
      "cashVnd": 50000000,
      "savingsPrincipalVnd": 0,
      "assetLiquidationQuoteVnd": 0,
      "netWorthVnd": 50000000,
      "debtVnd": 0,
      "obligationsVnd": 0,
      "goalTargetVnd": 90000000
    },
    "options": [
      {
        "optionId": "full",
        "engineAction": "choose",
        "allowed": true,
        "costNowVnd": 4000000,
        "obligationAddedVnd": 0,
        "totalCommittedCostVnd": 4000000,
        "cashAfterImmediateVnd": 46000000,
        "obligationsAfterImmediateVnd": 0,
        "obligationsAfterResolutionVnd": 0,
        "fundingShortfallVnd": 0,
        "execution": "cash-sufficient",
        "due": "none",
        "dueLap": null
      },
      {
        "optionId": "temporary",
        "engineAction": "choose",
        "allowed": true,
        "costNowVnd": 1000000,
        "obligationAddedVnd": 4000000,
        "totalCommittedCostVnd": 5000000,
        "cashAfterImmediateVnd": 49000000,
        "obligationsAfterImmediateVnd": 4000000,
        "obligationsAfterResolutionVnd": 4000000,
        "fundingShortfallVnd": 0,
        "execution": "cash-sufficient",
        "due": "next-start-settlement",
        "dueLap": 1
      }
    ],
    "revealedDecisions": [],
    "publicMarket": []
  },
  "contextDigest": "sha256:779830f3d68b5970d0d5ebe73d236026bc68dd923010350ad6bd1ec15087cfea",
  "question": "Tôi muốn so sánh hai lựa chọn sửa xe",
  "questionDigest": "sha256:76cb04dbd8d6bb8f3d077dab1e88a431633c25124d87b98ca885662c47c3713b"
}
```


### Answered

```json
{
  "questionApiVersion": 1,
  "questionPolicyVersion": "b18-repair-question.v1",
  "contextVersion": "b18-advice.v1",
  "source": "deterministic",
  "integrity": "rules-checked-client-state-unverified",
  "correlation": {
    "requestId": "wire-compare",
    "sessionEpoch": "golden-compare",
    "revision": 1,
    "decisionId": "golden-compare:repair:3",
    "stateRevision": "golden-compare:1",
    "contextDigest": "sha256:779830f3d68b5970d0d5ebe73d236026bc68dd923010350ad6bd1ec15087cfea",
    "questionDigest": "sha256:76cb04dbd8d6bb8f3d077dab1e88a431633c25124d87b98ca885662c47c3713b"
  },
  "limitations": [
    "simulated-game-only",
    "client-state-unverified",
    "future-outcomes-unknown"
  ],
  "result": {
    "status": "answered",
    "intent": "compare",
    "explanation": "Trong tình huống sửa chữa của trò chơi: So sánh tổng chi phí với tiền mặt giữ lại ngay. Không có lựa chọn tự động tốt nhất cho mọi nhu cầu.",
    "statements": [
      {
        "label": "Giải thích",
        "optionId": null,
        "statement": {
          "templateId": "repair.cash-sufficient-overview.v1",
          "bindings": {
            "extraCost": "comparison.extraCost",
            "retainedCash": "comparison.retainedCash"
          },
          "text": "Sửa tạm giữ thêm 3.000.000 đ tiền mặt ngay và có tổng chi phí cao hơn 1.000.000 đ so với trả ngay.",
          "evidenceRefs": [
            "comparison.extraCost",
            "comparison.retainedCash"
          ]
        }
      },
      {
        "label": "Trả ngay",
        "optionId": "full",
        "statement": {
          "templateId": "repair.full-breakdown.v1",
          "bindings": {
            "now": "full.now",
            "after": "full.cashAfter",
            "later": "full.later",
            "total": "full.total"
          },
          "text": "Trả ngay 4.000.000 đ; tiền mặt còn 46.000.000 đ, nghĩa vụ sửa xe mới 0 đ, tổng chi phí 4.000.000 đ.",
          "evidenceRefs": [
            "full.cashAfter",
            "full.later",
            "full.now",
            "full.total"
          ]
        }
      },
      {
        "label": "Sửa tạm",
        "optionId": "temporary",
        "statement": {
          "templateId": "repair.temporary-breakdown.v1",
          "bindings": {
            "now": "temporary.now",
            "after": "temporary.cashAfter",
            "later": "temporary.later",
            "total": "temporary.total",
            "due": "rule.obligationDue"
          },
          "text": "Sửa tạm trả 1.000.000 đ ngay; tiền mặt còn 49.000.000 đ, hẹn 4.000.000 đ tại lần quyết toán qua Xuất phát kế tiếp; tổng chi phí 5.000.000 đ.",
          "evidenceRefs": [
            "rule.obligationDue",
            "temporary.cashAfter",
            "temporary.later",
            "temporary.now",
            "temporary.total"
          ]
        }
      },
      {
        "label": "Khoản hẹn sửa tạm",
        "optionId": "temporary",
        "statement": {
          "templateId": "repair.deferred-obligation-risk.v1",
          "bindings": {
            "later": "temporary.later",
            "due": "rule.obligationDue"
          },
          "text": "Khoản hẹn 4.000.000 đ chỉ ghi nhận sau khi hoàn tất thanh toán ban đầu và đến hạn tại lần quyết toán qua Xuất phát kế tiếp. Chưa biết tiền mặt lúc đó có đủ hay không.",
          "evidenceRefs": [
            "rule.obligationDue",
            "temporary.later"
          ]
        }
      }
    ],
    "reflectionQuestion": {
      "templateId": "repair.reflection-liquidity.v1",
      "bindings": {
        "concept": "concept.liquidity"
      },
      "text": "Bạn muốn giữ thêm tiền mặt lúc này để làm gì, và sẽ chuẩn bị cho khoản hẹn trả ra sao?",
      "evidenceRefs": [
        "concept.liquidity"
      ]
    },
    "evidenceRefs": [
      "comparison.extraCost",
      "comparison.retainedCash",
      "concept.liquidity",
      "full.cashAfter",
      "full.later",
      "full.now",
      "full.total",
      "rule.obligationDue",
      "temporary.cashAfter",
      "temporary.later",
      "temporary.now",
      "temporary.total"
    ]
  }
}
```


### Fallback

```json
{
  "questionApiVersion": 1,
  "questionPolicyVersion": "b18-repair-question.v1",
  "contextVersion": "b18-advice.v1",
  "source": "deterministic",
  "integrity": "rules-checked-client-state-unverified",
  "correlation": {
    "requestId": "wire-ambiguous",
    "sessionEpoch": "golden-compare",
    "revision": 1,
    "decisionId": "golden-compare:repair:3",
    "stateRevision": "golden-compare:1",
    "contextDigest": "sha256:779830f3d68b5970d0d5ebe73d236026bc68dd923010350ad6bd1ec15087cfea",
    "questionDigest": "sha256:deadb0150cb8a0ae3933142368ecf5aeff81aecbf140021e556d2661a3705a1e"
  },
  "limitations": [
    "simulated-game-only",
    "client-state-unverified",
    "future-outcomes-unknown"
  ],
  "result": {
    "status": "fallback",
    "reason": "clarification-needed",
    "explanation": "Chưa xác định được bạn muốn hỏi điều gì. Bạn muốn tìm hiểu chi phí, thanh khoản hay rủi ro của hai lựa chọn sửa xe?",
    "statements": [],
    "reflectionQuestion": null,
    "evidenceRefs": []
  }
}
```
