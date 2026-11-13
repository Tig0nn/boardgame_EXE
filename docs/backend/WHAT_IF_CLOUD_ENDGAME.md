# B18 Cloud Save What-if

Source: `codex/exe-render-free-backend` at `2892fbafb9236332552dfb52ee0f9eb590eb1ea4`. This branch targets the Fastify API and the Phase 3A React/Vite online result screen. The separate React Native workstream consumes the HTTP contract below.

| Existing implementation | Audit at the source checkpoint |
| --- | --- |
| Repair What-if (`src/game/what-if.ts`, demo report) | Canonical immediate comparison, useful in local play; it does not run to lap 4. |
| Historical Bank/Gold, EG1/EG2 endgame and EG3 | Present in the checkpoint through `98b4198`. The demo and handoff reports distinguish local source/Worker replay, fixed/flexible choices and mock provider UI. The EG3-AI-10 evidence records two 305/305 regressions and 59 Chromium cases for that scope. |
| Gemini provider work | Later commits, including `0123edc`, are ancestors of the Render checkpoint. Those paths do not provide a Fastify Cloud Save What-if route. This feature does not call a provider or activate any AI flags. |
| Cloud Save before this change | Fastify already owns seed, authenticated actions, schema 7 snapshots and official results. The online result screen did not expose What-if. Browser save files and Journey Code are not valid server replay inputs. |

The Cloud Save path carries over the verified paired replay rules: keep the same historical prefix, retain later commands only in their original context, verify lot identity before reusing a lot ID, compare exogenous streams, and explain only engine-derived differences. It calls the existing Fastify `transitionB18` and `officialB18Result`; it does not use a browser save parser, Worker or a duplicate financial model. Every original action is replayed from canonical setup. SHA-256 of schema 7 bytes must match at version zero, the selected pre-action state, and the terminal state. The stored official result must also match. No client seed, raw engine state or writable simulation history crosses the API.

## HTTP contract

Both operations require the same Bearer JWT as Cloud Save and return `Cache-Control: no-store`. A caller who does not own the session gets `404`. Only a B18 original completed through lap four can be analyzed. The APIs do not insert or update any rows.

- `GET /v1/game-sessions/:id/what-if` returns `stateVersion`, `policy`, and `decisions`. Entries use the **server action sequence** (not the journal entry number) and include lap, turn, original decision, event alternatives, legal example trades, omission availability and funding options.
- `POST /v1/game-sessions/:id/what-if` takes `{"stateVersion":52,"sequence":5,"alternative":{"mode":"omit"}}`. Omission applies to optional trades. To replace a decision use `"alternative":{"mode":"replace","action":{"actionId":"trade","payload":{"kind":"deposit","amount":1234567,"term":2}}}`. Replacement accepts the same strict choose/fund/trade payloads and canonical legality as the official action endpoint. No idempotency key is needed; this POST only computes a comparison.
- `status: "completed"` includes both terminal outcomes, four completed laps on each side, canonical portfolio and financial metrics, signed alternative-minus-actual deltas, decision effects, START line differences, and continuation details. `lawfulProceedsVnd` is a decimal string.
- `status: "limited"` includes a reason and completed laps, without publishing comparable financial metrics. Used for early insolvency or when market, credit, RNG, or encounter/roll paths differ. Invalid JSON/fields use `400`; a stale version or unfinished original uses `409`; an invalid decision uses `422`; an exceeded analysis/SQL budget uses `503 WHAT_IF_BUDGET_EXCEEDED`. An integrity mismatch fails closed with `500`.
- Policy `retain-legal-then-required-v1` retains legal suffix actions at matching lap/turn/tile/phase/payment context. Otherwise it skips optional trades, uses Skip (if legal) or the first canonical event option, and uses the first available canonical funding source in engine order. Roll/advance are mandatory. This is a reproducible scenario, not personalized advice or an optimal strategy. The result identifies fallback decisions and counts omitted suffix actions. Reload the completed session and submit the same selection to reproduce it; the analysis itself is not saved.
- Reads use a PostgreSQL read-only transaction and the existing runtime SELECT grants. The statement timeout is 1.5 seconds for this transaction, the analysis work budget is 2.5 seconds including reads, and the Web request aborts after 12 seconds. No global timeout or grants changed.

## Local verification

`apps/api/tests/start.integration.ts` drives a natural four-lap B18 game through HTTP and local PostgreSQL. It checks SHA-256 at every official version, independently replays two alternative histories, tests omitted asset purchase and explicit continuation, checks non-owner/stale/invalid requests, induces and recovers from SQLSTATE 57014 using a local test lock, and verifies that action history, snapshots, official result and row counts remain unchanged. `apps/api/tests/phase3a-browser.integration.ts` adds the 390px Chromium route from the official result through What-if, failed request/retry, refresh and reproduction. The browser acceptance uses a local JWKS issuer and local PostgreSQL.

On one 52-action run, changing a 1,234,567 VND deposit from term 1 to term 2 increased lawful proceeds by 74,074 VND. Omitting the final sale gave zero delta in lawful proceeds; the terminal selector still quoted liquidation of the unsold asset. The separate omitted-purchase case retained a valid four-lap ending with one explicit fallback decision. The 390px browser run replayed a completed 52-action session, recovered from a lost analysis request, and reproduced the same comparison after refresh.

Render, Supabase cloud, React Native, Mascot and Semantic P4 are outside this change. Hosted acceptance remains a separate release step after approval.
