# What-if Gemini for Cloud Save

Base `33f130ed4cc9a668ddd9e99d72558c177718942a` on `codex/exe-fox-v23-preservation`. The prior Gemini checkpoint `4abba6e996a95e96bab5c94136e9bc1f437f479c` is on a parallel history. Its What-if implementation matches integrated ancestor `0123edc` before the later shared bounded JSON extraction. The dedicated local branch starts at the requested base.

The Fastify integration reuses the Gemini transport, structured prompts, provider envelope checks, intent grammar and numerical grounding, proposal ID checks, explanation claim checks, bounded JSON reader and local limiter. The pure intent and provider contracts now live under `src/ai/what-if`. Vite and the prior DEV UI still import them through the original entry points. Fastify's API build does not need browser Workers or Vite source to run the provider.

## React Native HTTP contract

Use the Cloud Save Bearer JWT. The Fastify endpoint is `POST /v1/game-sessions/:id/what-if/assistant`. It requires an owned, completed B18 session and its current `stateVersion`. Replies are `Cache-Control: no-store`. This endpoint and the existing evaluation endpoint are read-only, so neither needs an idempotency key.

| Operation | Request | Response |
| --- | --- | --- |
| `interpret` | `{"operation":"interpret","stateVersion":58,"question":"Bỏ mua vàng tại quyết định 7","allowGemini":true}` | `interpretation` contains a structured `intent` or a refusal such as `ambiguous`, `unsupported` or `multiple-changes`. A history locator uses the server action sequence. |
| `propose` | Same fields with `operation: "propose"` | The server interprets the question, verifies original action history and builds a catalog against historical engine state. If exactly one legal candidate is grounded, the reply contains `status: "proposal"`, a Vietnamese `preview`, `requiresConfirmation: true`, and `proposal: {stateVersion, sequence, alternative}`. When no candidate qualifies, the response gives the reason, including `needs-details` and `missing` for incomplete financial parameters. |
| `explain` | `{"operation":"explain","stateVersion":58,"sequence":7,"alternative":{"mode":"omit"},"allowGemini":true}` | Runs the same canonical evaluation as manual What-if. Returns `evaluation` and a `claim` grounded in the sign of canonical final cash delta. A limited comparison returns `claim: null` and skips the provider. Unsupported decision categories still return the original deterministic evaluation. |

Every successful assistant reply has `version: 1`, `operation`, `stateVersion`, `status` and `assistance`. Assistance can be `not-requested`, `disabled`, `used`, `not-applicable`, `unavailable`, `timeout`, `rate-limited` or `output-rejected`. On a provider failure, the endpoint can still return a deterministic interpretation, a locally validated proposal, or the verified explanation. The client should display the assistance status separately from game facts.

After the player confirms the preview, send `proposal` to the existing `POST /v1/game-sessions/:id/what-if`. Only that request (or the explicit replay for `explain`) runs the comparison to the end of lap four. Manual catalog selection and evaluation retain their existing contract. The UI can retry an interrupted assistant request and can reload the catalog after a stale version error. The authenticated game history remains the source of truth after reload.

The assistant retains the shared error envelope `{error:{code,message}}`. Invalid fields, contact details, or malformed input return `400`, oversized bodies return `413`, invalid JWTs return `401`, a missing or foreign session returns `404`, and a stale version or ineligible game returns `409`. Replay validation uses the existing `422` or budget `503` behavior.

## Provider boundary and live acceptance

Questions are limited to 240 characters and the route body to 4 KiB. Only an explicitly submitted question, canonical candidate IDs and explicit user-entered parameters for proposal, or a decision category and cash direction for explanation can reach the provider. User and session IDs, tokens, seed, snapshots, full journal, final amounts and official results stay in the API. Preview amounts are validated against the historical engine state. Structured output may choose only an allowed pair of IDs or the verified claim ID. All visible explanations use server templates and canonical evidence. A provider cannot set financial values or change game state.

This branch uses the independent server settings `EXE_WHATIF_GEMINI_ENABLED=1`, `EXE_WHATIF_GEMINI_ALLOW_LIVE_TRAFFIC=1`, `EXE_WHATIF_GEMINI_MODEL` and `EXE_WHATIF_GEMINI_API_KEY`. The provider is off unless both flags and valid model and key are present. Each request also requires `allowGemini: true`. A call has a 2.5-second deadline, a bounded 32 KiB provider envelope, a bounded 4 KiB JSON result and 256 output tokens. Limits per API instance are six calls per player per minute, 24 per instance per minute, 100 per instance per 24 hours and two concurrent calls. A proposal can consume two calls. These in-memory limits reset with the process and do not constitute a billing cap.

The live acceptance step requires separate Owner approval, a backend-only secret and an approved model, an approved test environment and spend limit, and test-only questions and games. Run one bounded interpret, propose, confirm and explain journey. Verify the actual provider statuses, exact action parameters, canonical replay, fallback and unchanged official result. The present test uses injected transport and carries no provider credentials in Web or React Native. Fox V2.3 uses its own separate configuration and existing endpoints.

## Local verification

PostgreSQL integration passed 46/46. Its four-lap START journey verified exact schema 7 replay hashes, JWT and foreign-owner denial, all three mock provider operations, timeout and quota fallback, and the same result and row counts after assistance. API tests passed 32/32. The combined B18, Fox, What-if and provider regression passed 165/165. The prior Fox offline Chromium diagnostic passed at 320, 390 and 1440 px. Cloud Save Chromium passed a 58-action four-lap game, manual What-if, offline Fox, reload, opt-in, assistant network retry, confirmation and verified explanation. TypeScript, ESLint for the changed scope, API, Web and online Mobile builds and the staged secret scan passed. The Web bundle was checked for absence of the provider hostname and key variable.
