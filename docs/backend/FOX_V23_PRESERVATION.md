# Fox V2.3 preservation and optional Gemini

Base `ad2bc15b7fa3b0c8b5a9276d73272f1bb45acd1f`. Audit covered the V2.3 implementation and curriculum at `f729e57`, the integrated V2.3 and readiness commits `4fecec3` and `e30bbd0`, the Fastify Fox integration, and the source of the Render checkpoint `2892fbafb9236332552dfb52ee0f9eb590eb1ea4`.

| V2.3 requirement | At the base | In this branch |
| --- | --- | --- |
| Proactive warnings | PRESERVED | The V2.3 controller still observes canonical transitions in local play and authoritative action responses in Cloud Save. |
| Decision consequences and “Vì sao?” | PARTIAL | The V2.3 button already ran locally. The broader decision and portfolio cards previously fetched Coach on opening. They now render immediately from the canonical state already displayed. |
| START settlement | PARTIAL | Saved-game Coach cards and evidence ship with the gameplay response. An open game can explain its latest START without a separate request. |
| Endgame result | PARTIAL | The Web coach renders the already loaded official result and canonical selectors. The practice UI uses the local engine. |
| What-if explanation | PRESERVED | The Cloud Save replay returns the same Fox evidence. The comparison can still be explained after the evaluated response has loaded, including limited outcomes. |
| Financial learning | PRESERVED | V2.3 curriculum and its evidence rules are reused. |
| Vietnamese “Hỏi Cáo” | PARTIAL | The Cloud Save form used a server call even for questions the local matcher could answer. The Web form now runs the matcher locally, then offers optional assistance for questions with no local match. React Native can call the same owner-scoped Fastify API. |
| Offline fallback | PARTIAL | Offline Web practice remains playable. An already loaded Cloud Save screen can use portfolio, decision, START, final and Q&A evidence during a connection loss. Opening a Cloud Save session after reload and running a new server What-if evaluation require the backend. The loaded evidence is memory-only. |
| Optional Gemini for Fox | MISSING in Fastify | Implemented as optional public curriculum selection in Fastify, off by default. Live verification is INTENTIONALLY DEFERRED. The Web UI no longer invokes the legacy development learning endpoint. |
| UX and HTTP contracts | PARTIAL | Mascot signal cadence, “Vì sao?”, versioned Coach reads, Q&A and What-if evidence retain their roles. The Q&A form has an explicit “Hỏi Cáo” action. New response fields are additive. |

## React Native contract

Use the Cloud Save Bearer JWT and a session owned by its subject. Both routes retain `Cache-Control: no-store`. They do not write game data and do not require an idempotency key.

- `GET /v1/game-sessions/:id/coach?stateVersion=19&journalSequence=23`. Both query fields are optional. The result stays at `version: 1` with canonical cards and structured evidence. Gameplay reads and action responses additionally include `state.fox` with the current Coach evidence and a bounded `learningContext`. That context is suitable for an on-device deterministic matcher. A version of the client talking to the pre-Fox checkpoint will not find these fields or endpoints.
- `POST /v1/game-sessions/:id/coach/learn` accepts `{"question":"Thanh khoản là gì?","stateVersion":19}`. A question is 3–280 characters and must omit control characters. The optional version protects against stale context. The only new input is `allowGemini: true`, which clients should set only after the user chooses to send that specific question. The 4 KiB body limit applies to this route.
- The response keeps `version: 1`, `stateVersion`, `source: "deterministic"`, `status: "answered" | "insufficient"`, `cards`, `message`, and `evidence`. All displayed cards are server-owned text. The additive `assistance` field reports `not-requested`, `disabled`, `not-needed`, `used`, `no-match`, `unavailable`, `timeout`, or `rate-limited`. `used` means the provider selected approved curriculum cards. Gemini never supplies displayed prose, game evidence or financial values. On provider failure, use the returned limitation or the device's deterministic cards.
- API errors retain the existing envelope and authentication semantics. Invalid input is `400` or `413`, unauthenticated requests are `401`, foreign sessions are `404`, stale versions are `409`, and unavailable Coach reads are `503`. Reload the owned session before retrying a stale request. What-if keeps its original contract.

### Fastify configuration

`EXE_FOX_GEMINI_ENABLED=1` explicitly enables the provider when `EXE_FOX_GEMINI_MODEL` and `EXE_FOX_GEMINI_API_KEY` are valid. Only the backend should hold these settings. Local and offline answers run before any provider request. Provider input contains the explicitly submitted question and public curriculum only. The UI reminds players to remove personal information before sending. The backend never attaches session or player identifiers, balances, journal text, snapshots, What-if evidence or official results. The provider returns up to three allowlisted IDs. Per instance the limits are four requests per authenticated player per minute, sixteen per minute overall, two concurrent requests, a 2.5-second deadline, and an 8 KiB response envelope. Provider errors are converted to the response statuses above. [Gemini GenerateContent REST contract](https://ai.google.dev/api/generate-content)

## Separate What-if Gemini audit

`4abba6e996a95e96bab5c94136e9bc1f437f479c` is the parallel checkpoint. Its What-if modules match the integrated checkpoint `0123edc`. The previous `/api/what-if-provider` flow uses the DEV server, the local history binding, and Workers. The Gemini adapter implements `interpret`, `propose`, and `explain`. It validates intent parameters against trusted input, proposal IDs against the catalog, and explanation claim IDs against engine facts. The controller supports deadlines, retry and manual selection. The canonical replay in that flow is tied to the local history capture.

Cloud Save uses authenticated `GET/POST /v1/game-sessions/:id/what-if`, its persisted action history and canonical replay. Its catalog selection, deterministic explanations, retry, limited response and numerical grounding work in the Fastify path. Natural-language interpretation, Gemini proposal selection, and Gemini explanation are **NOT_INTEGRATED** with Cloud Save. Render checkpoint source also predates the Cloud Save What-if implementation.

A separate migration would first move the provider DTOs and ID validators into a shared package that does not depend on Workers. Add a separate, default-off What-if feature flag and authenticated owner-scoped interpretation endpoint. Build its candidate IDs from the Fastify catalog at a pinned state version and validate each returned ID and amount. Require player confirmation before submitting the existing replay request. If explanation assistance is added, pass only a minimized, approved claim catalog after replay verification. Preserve manual selection, stale-version rejection, request cancellation, retry and the deterministic result. Verify mock transport, cross-user requests, timeout recovery, limited responses and the unchanged official result before considering a separately approved live test.

## Local acceptance scope

PostgreSQL tests compare the new embedded Coach data with the dedicated endpoint, exercise deterministic, disabled and mock-provider paths, enforce ownership and state versions, replay all schema 7 snapshot hashes and confirm unchanged official data. Chromium exercises the real Web client and local Fastify with network disabled at START, endgame and after a completed What-if response. It also covers offline Vietnamese Q&A and explicit assistance retry with Gemini off. The original practice-mode Chromium diagnostic covers board, “Vì sao?”, offline curriculum, save/replay and endgame at 320, 390 and 1440 px. React Native UI, hosted rollout and real provider acceptance are outside this local result.

Verified locally on 13 November 2026. PostgreSQL 46/46, API 30/30 and the combined B18, Fox, What-if and provider transport regression 165/165 passed. The Cloud Save Chromium journey completed four laps with 58 official actions, then reproduced the same What-if response after reload. TypeScript, scoped ESLint, API and online Mobile builds, staged Gitleaks and diff checks passed. The browser build contained neither the Fox provider credential variable nor the Gemini service hostname. Provider tests used injected mock transport.
