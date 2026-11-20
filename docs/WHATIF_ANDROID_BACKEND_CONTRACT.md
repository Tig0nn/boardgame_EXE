# Android What-if backend contract and release gate

Verified locally on 2026-11-20. This document records the existing contract; it does not authorize a push, deployment, migration, cloud write, or Gemini call.

## Source and the hosted 404

| Revision | Evidence |
| --- | --- |
| Render baseline `2892fbafb9236332552dfb52ee0f9eb590eb1ea4` | `apps/api/src/routes/v1.ts` has no What-if routes. The Android catalog request was logged as HTTP 404, route `unmatched`. A valid Cloud Save JWT cannot make an absent route available. |
| Local `6b166dd318032bc48fe0798af0949c6cd5e96c21` | Adds saved-game full-endgame What-if. |
| Local `329a173e75e16182788e7a989b38a4ec381ba31f` | Contains catalog/simulation and optional Cloud Save assistant integration. The object and clean worktree were verified in the local backend repository. Its existence on a GitHub remote has not been assumed. |
| Android `3e2d8f510d1d6d1ed2ec915eb32ca8ea86c00562` | Published `mobile_app/src/game/server-session.ts`, `cloud-contract.ts`, `what-if-choices.ts`, and `native/src/coach-and-what-if.tsx` use the routes and shapes below. |

The fix candidate inherits the existing implementation from `329a173`; it does not recreate What-if or alter the canonical engine. It descends from the Render baseline. A future deployment must include the candidate's backend dependency closure, including the existing deterministic What-if/Fox services and their shared modules.

## Wire contract

All requests use HTTPS to the approved API origin and an actual Supabase access token in the `Authorization: Bearer` header. Tokens are never body fields. JSON POSTs use `Content-Type: application/json`. What-if responses use `Cache-Control: no-store`.

### History catalog

`GET /v1/game-sessions/:id/what-if`

Returns `{ stateVersion, policy, decisions }`, with policy `retain-legal-then-required-v1`. Each decision includes its recorded `sequence`, context, original decision, eligible `eventChoices`, `tradeAlternatives`, `canOmit`, and `fundingOptions`. The source must be an owned, supported B18 game completed through all four laps; an insolvent result is ineligible.

Loading the catalog verifies the actual replay. Selecting a catalog entry does not simulate an alternative branch or persist a game action.

### Canonical simulation

`POST /v1/game-sessions/:id/what-if`

```json
{
  "stateVersion": 60,
  "sequence": 5,
  "alternative": {
    "mode": "replace",
    "action": { "actionId": "choose", "payload": { "optionId": "skip" } }
  }
}
```

The numbers and option above illustrate shape only; the client must use the current catalog's version, recorded sequence, and an alternative valid at that historical state. `replace` accepts the existing `choose`, `trade`, or `fund` payload contracts. `{ "mode": "omit" }` is permitted only for an optional trade.

The server checks canonical legality and that a replacement changes the original decision. Catalog choices are not an exhaustive literal allowlist: existing clients also derive bank terms 1–3, edited valid amounts, and funding choices from the catalog context. Restricting input to exact suggested `tradeAlternatives` objects would break those supported paths. The engine remains the authority for validity and calculations.

Returns an evaluation with the requested `stateVersion` and `sequence`. A `completed` evaluation contains actual/alternative official financial metrics, both completed-lap lists, delta, continuation evidence, deterministic explanation, and grounded coach cards. A `limited` evaluation must remain explicitly limited; it is not a final like-for-like comparison.

### Native assistant/explanation path

Android first sends the same chosen alternative to:

`POST /v1/game-sessions/:id/what-if/assistant`

```json
{
  "operation": "explain",
  "stateVersion": 60,
  "sequence": 5,
  "alternative": { "mode": "omit" },
  "allowGemini": false
}
```

The reply is version 1 with `operation: "explain"`, the requested `stateVersion`, an `evaluation` using the simulation contract, `assistance`, and a grounded `claim` or `null`. With Gemini unrequested, valid evaluation and deterministic coach evidence remain available. `assistance` can be `not-requested` or `not-applicable`; neither means live Gemini was used.

The other existing operations are `{ operation: "interpret" | "propose", stateVersion, question, allowGemini }`. A proposal includes the canonical simulation request, preview, and `requiresConfirmation: true`. A proposal never executes a financial transaction.

Android validates reply version/operation and both evaluation identifiers. On transport or server failures it may call the canonical simulation endpoint for deterministic recovery; a 4xx response does not trigger this second endpoint. Concurrent identical simulations share a request, and completed results are cached per session/version/sequence/alternative. No endpoint accepts or requires `proposalId`. Unknown body fields are rejected by strict schema validation.

## Auth, confirmation, and integrity

- `registerV1` applies the same JWT issuer/audience/signature guard used for Cloud Save, before any analysis or optional provider call. Identity comes from the verified JWT, never a client-supplied owner ID.
- Queries enforce ownership before loading session history. Foreign or missing sessions return 404 without revealing game data. This status alone cannot distinguish ownership failure from an absent route; inspect the logged route during capability checks.
- A stale `stateVersion` returns 409 `STATE_VERSION_CONFLICT`. Ineligible games return 409 `WHAT_IF_REQUIRES_FOUR_LAPS`; malformed/extra fields return 400 `INVALID_REQUEST`; invalid forks or alternatives return 422. Interrupted analysis uses 503 `WHAT_IF_BUDGET_EXCEEDED`.
- Native requires the player to select a historical decision and alternative, then press **Xem kết quả giả lập**. The explicit POST is confirmation to analyze. No additional confirmation token is part of this contract.
- Analysis loads a repeatable-read, read-only source, verifies genesis, the complete action sequence, version metadata, final snapshot digest and official result, then uses canonical transitions to finish the alternative branch. It does not insert official actions, snapshots, or results.
- Gemini is optional language assistance only. `allowGemini: false` prevents provider use even if one is configured. Server enablement requires both existing What-if flags; Fox Gemini has separate flags and remains OFF. A provider response never determines financial calculations or official results.

## Regression evidence to run locally

Do not duplicate the existing full-game journey solely for a new client name. Use the real PostgreSQL suites already covering the same wire contract:

| Suite | Coverage |
| --- | --- |
| `apps/api/tests/what-if.test.ts` | Catalog/simulation/assistant routes require JWT, independent default-OFF flags, mock output grounding. A missing route would return 404 rather than the asserted 401. |
| `apps/api/tests/start.integration.ts` | Authenticated HTTP four-lap journey, catalog reload, foreign-owner 404, stale-version 409, invalid requests/alternatives, multiple full-endgame alternatives, independent canonical numerical parity, assistant operations and fallback, immutable rows/history/state/snapshots, lock timeout and recovery. |
| `apps/api/tests/phase3a-browser.integration.ts` | Player selection/confirmation, provider error recovery and deterministic What-if UI through real local Fastify/PostgreSQL. This is browser evidence, not Android hosted acceptance. |
| Published `mobile_app/native/tests/native-parity.test.ts` | Native default `allowGemini: false`, response identifiers, caching/deduplication, and no secondary endpoint on ownership errors. This is client contract evidence, not a substitute for hosted Android E2E. |

Local JWKS fixtures are test-only and must never be described as real Supabase Auth acceptance. Use only an isolated disposable local PostgreSQL database for these suites. Run no Gemini live calls.

## Future staging release gate — not executed by this change

1. Obtain separate approval for the exact backend publication/deployment commit; verify dependency closure and that its route source includes all three routes above. Retain the previous deployment for rollback. Do not rerun applied migrations. Any new maintenance migration needs separate approval, baseline backup, preflight, and rollback rehearsal; none is applied to staging by this local change.
2. Keep Render Free and Auto-Deploy Off, staging project/issuer/audience/JWKS unchanged, `exe_runtime` with TLS verification, and both Gemini workstreams OFF. Do not log keys, tokens, passwords, or credential-bearing URLs.
3. Before any gameplay mutation, check `/health` and `/ready`, then send unauthenticated catalog, simulation, and assistant requests for a synthetic UUID. All must return 401, not `unmatched` 404. This catches missing routes without accessing a player's game or invoking a provider.
4. With an actual staging session and its owner's valid JWT, load the completed game's catalog. Confirm a foreign account cannot access it. Check a stale version returns 409. Do not use a production account or fake JWT.
5. On Android, select a real catalog decision and valid alternative, confirm simulation, and verify the completed four-lap comparison and deterministic coach evidence with `allowGemini: false`.
6. Compare official version, action/snapshot/result counts and hashes before/after analysis. They must remain unchanged. Check snapshot persistence/retry telemetry separately; route availability does not prove Cloud Save reliability.
7. Declare Android What-if E2E PASS only after the hosted request and actual Android UI complete successfully. Local contract/regression PASS establishes readiness for that test, not its result.
