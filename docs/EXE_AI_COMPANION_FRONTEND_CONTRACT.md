# AI Companion — contract cho frontend P1/P2a

Ngày28/10/2026. **Implemented locally / PRIVATE PROTOTYPE** trên B18 Multi-Course. API version **1**, context version **`b18-advice.v1`**, rules **`b18-repair.v1`**.

**`/api/ai-companion` chưa được triển khai trong P1/P2a.** Dùng mock transport/offline fallback bên dưới; không gửi HTTP tới route này. Không có Gemini integration, API key, UI component mới hoặc thay đổi engine. [Proposal](EXE_AI_COMPANION_ARCHITECTURE_PROPOSAL.md) là baseline lịch sử; tài liệu này và source/fixtures mô tả contract thực đã freeze.

## 1. Shared types và entry point

Import browser-safe từ [index.ts](../src/ai/companion/index.ts). Toàn bộ types ở [types.ts](../src/ai/companion/types.ts); runtime contracts ở [contracts.ts](../src/ai/companion/contracts.ts), response validation ở [advice.ts](../src/ai/companion/advice.ts). Không import `src/ai/server` hoặc endpoint Coach. Không thêm dependency.

```typescript
type AdviceMode = 'explain' | 'compare' | 'guide'
type AdviceTransport = (
  request: CompanionRequest, signal: AbortSignal
) => Promise<CompanionSuccess>
```

| Export | Công việc |
| --- | --- |
| `buildRepairContext(game, {sessionEpoch, revision})` | Pure projector; chỉ nhận repair đã reveal và chưa chọn, đúng B18 Multi-Course |
| `createCompanionRequest(context, mode, requestId)` | Async: clone/validate context, tạo canonical SHA-256 digest, trả detached request |
| `parseCompanionRequest(unknownOrJson)` | Strict input + versions + quote/goal rules + digest; JSON string≤8KiB UTF-8 trước parse |
| `parseRepairContext(unknown)` | Sync context schema + official quote consistency; từ chối keys ngoài schema |
| `serializeContext`, `contextDigest` | Sort object keys recursively, giữ array order, safe integers, JSON UTF-8/SHA-256 |
| `deterministicAdvice(request, reason?)` | Offline fallback đủ hai options/risks/reflection, nguồn deterministic |
| `createAdviceCandidate`, `renderMockAdvice` | Candidate template/fact bindings; renderer từ chối toàn candidate sai; không gọi model |
| `parseCompanionSuccess(raw, request)` | Async full schema/correlation và **exact text/evidence equality** với deterministic renderer |
| `createMockTransport(options?)` | Contract transport không network, có loading delay/errors/timeout/abort |
| `createRevisionTracker(epoch)`, `matchesAdvice(response, pending, current)` | Revision theo snapshot identity và kiểm correlation trước render |
| `CompanionContractError`, `CompanionTransportError` | Lỗi contract có `.code`; lỗi mock HTTP có `.status`, `.response` |

Web Crypto cần `globalThis.crypto.subtle` (HTTPS/localhost trong browser); nếu không có, helper báo `SERVICE_UNAVAILABLE`, không chuyển sang hash yếu hoặc dùng seed game làm ID.

## 2. Modes và data boundary

- **Explain:** giải thích thanh khoản, cash khác net worth, chi phí hiện tại và cam kết trả sau.
- **Compare:** so sánh cả `full` và `temporary`, tổng chi/cash giữ lại/nghĩa vụ; không chọn phương án thắng.
- **Guide:** câu hỏi gợi mở về nhu cầu cash và chuẩn bị khoản hẹn trả; không điều khiển gameplay.

Cả ba modes có cùng response shape: `summary`, hai nhóm `tradeoffs`, hai `risks`, `reflectionQuestion`, `evidenceRefs`, `limitations`. Số tiền chỉ do renderer nội suy từ validated fact registry. Candidate không được chứa raw prose, amount, probability hoặc instruction. P2a dùng **closed teaching plan** theo mode và funding condition; chưa có tự do hội thoại/chọn template tùy ý.

`question` optional≤400 ký tự, không control characters. **Mọi câu hỏi tự do hiện trả scope-boundary + deterministic comparison**, `question-out-of-scope`; chưa có intent understanding. Không chuyển câu hỏi thành fact, không echo câu hỏi/hidden data vào response. Explain/Compare/Guide không cần nhập question.

Không gửi state/log/seed/RNG/debug/future outcomes hoặc real financial profile. `revealedDecisions` và `publicMarket` bắt buộc mảng rỗng ở version này. Context chỉ chứa profile metadata, encounter identity, các số tài chính công khai và quotes repair; object spread từ game không được dùng.

## 3. Profile, repair và funding

Supported profile: `core-mvp-b18-multi-course-v1`, `b18-l3-bonds-v1`, goal `single-90m-v1`, encounter `b18-tile-trading-v1`, courses `b18-i2-choice-v1`, bond `v2.5-credit-risk`, living `b18-periodic-start-v1`, savings `v2.2-c20`.

Projector còn kiểm `B18`, `experimental-b`,4 vòng, business `v2.4-customer-preferences`, stock catalog `vn-v1`; tileIndex3 (ô hiển thị4), `phase=event`, `eventId=repair`, latest log entry đúng encounter/turn/lap/tile. Không có pending payment/settlement/landing/termination. Thiếu cash vẫn là lựa chọn hợp lệ, không tự disable option bằng AI.

| Quote | full | temporary |
| --- | --- | --- |
| `costNowVnd` |4.000.000|1.000.000|
| `obligationAddedVnd` |0|4.000.000|
| `totalCommittedCostVnd` |4.000.000|5.000.000|
| Due |none/null|next-start-settlement/current lap|

Đây là giá trị source hiện hành; code lấy từ `eventsForGame`, không hardcode tiền trong prompt. Golden fixtures khóa con số để báo lỗi nếu source rules đổi ngoài version. Với cash50M: cash sau trả ban đầu46M/49M. `fundingShortfallVnd=max(cost−cash,0)` không phải nợ đã vay.

- `cashAfterImmediateVnd`: cash còn sau phần có thể trả ngay, **trước funding**, không dự báo cash sau rút savings/bán tài sản hoặc tại Xuất phát.
- **`obligationsAfterImmediateVnd`**: nghĩa vụ engine thực sự ghi nhận ngay; nếu funding chưa xong thì giữ nghĩa vụ cũ.
- `obligationsAfterResolutionVnd`: tổng nghĩa vụ **nếu hoàn tất thanh toán ban đầu**. Không khẳng định chắc chắn có thể funding thành công.
- Nghĩa vụ deferred thu tại lần quyết toán qua Xuất phát kế tiếp, ngay cả vòng4; không tạo vòng5 hoặc quy đổi APR.

Khi thiếu cash, trả deterministic fallback, `funding-not-modeled`, có limitation `funding-costs-not-included`. Có thể vay/rút savings/bán theo engine nhưng AI chưa định giá funding chưa chọn. **Khi đã vào `phase=funding`, không dựng lại pre-decision context**: projector ném `DECISION_UNAVAILABLE`; hủy advice cũ, để flow funding hiện có tiếp tục. Không tái sử dụng số liệu pre-decision như trạng thái hiện tại.

## 4. Golden JSON dùng độc lập với backend

[golden-v1.json](../tests/fixtures/ai-companion/golden-v1.json) chứa **9 examples**, **4 errors**, **3 invalid candidates**; đây là output generated bằng implementation thật rồi khóa, không provider response. Các tests đọc so sánh goldens, không tự regenerate.

| JSON path | Cách dùng |
| --- | --- |
| `examples[name=compare].request` | Golden request đầy đủ, context, quote và digest thật |
| `examples[name=compare].candidate` | Template IDs/binding roles hợp lệ, không text/số tiền từ model |
| `examples[name=compare].success` | Golden success, **source=mock** |
| `examples[name=compare].fallback` | Golden fallback, source=deterministic, offline-prototype |
| `examples[name=explain/guide]` | Hai modes còn lại, khác summary/reflection có chủ đích |
| `existing-obligations`, `low-cash`, `zero-cash`, `temporary-cash-sufficient` | Obligations/funding và safe numeric examples |
| `final-lap`, `signed-net-worth` | Natural final-lap encounter và signed financial edge case |
| `errors.invalidOptions`, `.rateLimited`, `.unavailable`, `.unsupported` | Strict error JSON + correlation |

Ví dụ đọc fixture trong môi trường test/tooling:

```typescript
const golden = fixtures.examples.find(item => item.name === 'compare')!
const request = await parseCompanionRequest(golden.request)
const success = await parseCompanionSuccess(golden.success, request)
const fallback = await parseCompanionSuccess(golden.fallback, request)
const error = parseCompanionError(fixtures.errors.rateLimited)
```

Đừng copy digest giữa context khác nhau. Hash thay khi revision/lap/cash/options thay; chỉ dùng để match/cache, không là chữ ký chứng thực ván thật. Raw user financial claims vẫn có thể bị giả bằng devtools.

## 5. Success, fallback và errors

`CompanionSuccess` echo `apiVersion`, `contextVersion`, `requestId`, `decisionId`, `stateRevision`, `contextDigest`, `mode`. `integrity` luôn **`rules-checked-client-state-unverified`**. Mỗi statement chứa `templateId`, `bindings`, `text`, `evidenceRefs`; renderer tạo `text`, validator không chấp nhận user/model tự viết câu khác dù cùng evidence ID.

| source | Hiển thị |
| --- | --- |
| `mock` | “Bản mô phỏng trợ giúp” — chưa gọi AI |
| `deterministic` | “Giải thích theo luật trò chơi” — có fallbackReason |
| `model` | Dành cho P2b; **P1/P2a không phát ra nguồn này**. Schema chấp nhận để freeze giao diện tương lai, không chứng thực network provenance |

Fallback reasons gồm `offline-prototype`, `provider-unavailable`, `provider-timeout`, `output-rejected`, `budget-exhausted`, `funding-not-modeled`, `question-out-of-scope`. Funding/question overrides generic reason để không giả successful model. Không tự retry deterministic response.

Error shape thực: `{apiVersion:1,error:{code,message,retryable,retryAfterMs?},correlation:{requestId,decisionId,stateRevision}}`. Xem full JSON fixture; message là chuỗi tiếng Việt cố định, không raw provider error/stack/caller text. Chỉ `RATE_LIMITED` nhận `retryAfterMs` nguyên dương.

| Code | Mapping chuẩn bị cho P2b / xử lý UI |
| --- | --- |
| INVALID_JSON / INVALID_REQUEST |400, sửa input, không auto retry |
| UNSUPPORTED_VERSION / UNSUPPORTED_PROFILE |409, không ép profile/save vào B18 mới |
| CONTEXT_MISMATCH / DECISION_UNAVAILABLE |409, hủy output cũ, đọc snapshot hiện tại |
| INVALID_FINANCIAL_CONTEXT / INVALID_OPTIONS |422, không hiển thị số liệu từ payload sai |
| PAYLOAD_TOO_LARGE |413, không gửi lại body đó |
| RATE_LIMITED |429, respect retryAfterMs; retry thủ công |
| SERVICE_UNAVAILABLE |503, local fallback nếu snapshot vẫn hợp lệ |
| METHOD_NOT_ALLOWED |405, reserved endpoint contract |
| INVALID_RESPONSE |502 mapping **local validation**; không coi là HTTP response thật đang tồn tại |

## 6. Mock transport và loading/cancellation

```typescript
const transport = createMockTransport({ scenario: 'success', delayMs: 300 })
const controller = new AbortController()
const response = await transport(request, controller.signal)
// To close/restart/move/change mode: controller.abort()
```

Scenarios: `success` (source mock), `fallback`, `rate-limited` (throws typed429), `unavailable` (throws typed503), `timeout` (throws `DOMException` name `TimeoutError`). `delayMs`0–30.000 chỉ mô phỏng loading; không là SLA. Có thể truyền `candidate` sai để nhận deterministic `output-rejected`; không partial-salvage candidate. Không có HTTP/network trong transport.

UI states: `idle → loading → success/fallback/error`. Abort/stale trở về idle context hiện tại, không tạo thông báo lỗi gameplay. Hủy khi close sheet, chọn option thật, đổi mode, snapshot thay, import/restart/new game. Retry chỉ khi decision còn hợp lệ; source=deterministic không kích retry loop. Contract module không render UI hoặc tự khóa nút gameplay.

## 7. Revision và response matching

```typescript
const tracker = createRevisionTracker(crypto.randomUUID())
const snapshot = session.getSnapshot()
const identity = tracker.observe(snapshot)
const context = buildRepairContext(snapshot, identity)
const request = await createCompanionRequest(context, 'compare', crypto.randomUUID())
// Hashing is async: reject if snapshot already changed during request construction.
if (session.getSnapshot() !== snapshot) return
const response = await transport(request, controller.signal)
// Check both active request identity and snapshot again immediately before rendering.
if (session.getSnapshot() !== snapshot || activeRequest !== request) return
if (matchesAdvice(response, request, activeRequest)) {
  // render the validated response; user still chooses via existing engine UI
}
```

Đây là đoạn tích hợp minh họa, không component được thêm. Gọi tracker trên **mọi** snapshot session mới, kể cả cùng phase; official engine trả object mới. Không mutate snapshot in-place. `sessionEpoch` độc lập RNG/seed,1–48 ký tự `[A-Za-z0-9_-]`; `revision` nonnegative safe integer; `requestId` độc lập và mới mỗi ask. New/imported game tạo tracker/epoch mới. Decision ID gồm epoch + `repair` + encounter log sequence; không chỉ eventId.

`matchesAdvice` dùng **sau validation**, so requestId/mode/decision/revision/digest/version với pending và request hiện hành. Không gọi nó với old request làm “current” sau state change. Nếu không có current valid encounter, hủy/render nothing. Mock có thể phản hồi sau async hashing; AbortController không thay việc kiểm snapshot/request identity.

## 8. Compatibility và limits

- Unknown keys bị từ chối ở mọi object boundary: request/context/profile/decision/financial/options/candidate/response/error; unknown profile/version có lỗi riêng. Không cast `CoachFacts.version=1` sang Companion.
- Safe integer VND; cash/nợ/nghĩa vụ/quotes≥0; **netWorthVnd signed safe integer** để giữ đúng selector. Reject NaN/Infinity/fraction/unsafe integer và overflow obligations+later.
- Request≤8KiB UTF-8, final response≤12KiB; summary≤300 chars, statement≤400, reflection≤240;≤16 distinct evidence refs; đúng hai option groups. Output evidence refs sorted để ổn định qua thứ tự object keys.
- Quote IDs cố định full/temporary, canonical option array order fixed. Unknown future fields/enums không tự được nhận; thay required field/meaning cần version mới và compatibility fixtures.
- Chưa có server attestation/auth/quota/telemetry/storage/memory. Không dùng client claims/digest làm reward/ranking hoặc hồ sơ hành vi đã chứng thực.

## 9. Chênh lệch đã chốt so với proposal

Trước freeze, source và implementation làm rõ: thêm `obligationsAfterImmediateVnd`; net worth có dấu; thêm nguồn `mock` và reason `offline-prototype`; dành `INVALID_RESPONSE` cho local output validation; evidence refs sorted; nhiều templates riêng cho funding/modes/obligations; pending funding bị từ chối pre-decision projection; mọi free question hiện scope fallback. Không đổi engine/rules để ép proposal. Bản proposal/evidence lịch sử giữ nguyên.

Chỉ regenerate golden khi chủ động đổi contract được review: `node --experimental-strip-types scripts/diagnostics/generate-ai-companion-fixtures.ts --write`; xem diff và chạy tests. Không ghi đè historical gameplay/replay fixtures. Phát có thể làm UI bằng types+goldens+mock hiện tại mà không cần merge backend/Gemini/admin branch.
