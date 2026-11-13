# REST API V1

Môi trường Phase 2C2 dùng `http://127.0.0.1:3104` theo `.env.example`. Các route `/v1` yêu cầu `Authorization: Bearer <access-token>` và trả `Cache-Control: no-store`. Dữ liệu phản hồi dùng JSON và timestamp ISO 8601 UTC.

| Method và path | Input | Thành công |
| --- | --- | --- |
| `GET /health` | Công khai | 200 `{"status":"ok"}` khi tiến trình HTTP hoạt động |
| `GET /ready` | Công khai | 200 `{"status":"ready"}` khi PostgreSQL thực thi được `SELECT 1` |
| `GET /v1/me` | Access token | 200 `{ "profile": { "userId", "createdAt" } }`. Tạo profile từ JWT ở lần đầu. |
| `GET /v1/game-sessions` | `limit` 1–100, mặc định 20. `offset` 0–10.000, mặc định 0. | 200 `{ "sessions": [...], "limit": 20, "offset": 0 }`. Sắp xếp mới nhất trước theo `createdAt`, rồi `id` giảm dần. |
| `POST /v1/game-sessions` | Header `Idempotency-Key` là UUID. JSON `{"scenarioId":"b18"}`. | 201 `{ "session": {...} }`, kèm `Location`. Gửi lại cùng khóa và owner trả 200, cùng resource. |
| `POST /v1/game-sessions/:id/actions` | UUID session, UUID `Idempotency-Key` và JSON theo mục Actions. | 200, trạng thái tại version mà action đã commit. |
| `POST /v1/game-sessions/:id/trade-quote` | JWT owner, UUID session, JSON `{ expectedStateVersion, payload }` với payload trade. | 200 `{ sessionId, stateVersion, payload, quote }`. |
| `POST /v1/game-sessions/:id/bank-quote` | JWT owner, UUID session, JSON `{ actionId, expectedStateVersion, payload }` theo mục Bank. | 200 `{ sessionId, stateVersion, actionId, payload, quote }`. |
| `GET /v1/game-sessions/:id` | UUID session | 200 `{ session, state, result }` cho owner hiện tại, cùng một version đã commit. |

Session gồm `id`, `scenarioId`, `scenarioVersion`, `gameplayProfile`, `engineVersion`, `resultVersion`, `tiles`, `laps`, `status`, `stateVersion`, `createdAt` và `updatedAt`. Session mới có `status=active` và `stateVersion=0`. Seed, trạng thái RNG và snapshot được giữ trong backend. POST tạo session từ chối mọi trường ngoài `scenarioId`, gồm `userId`, seed, tiền, portfolio và kết quả.

Lỗi có dạng `{"error":{"code":"INVALID_REQUEST","message":"Invalid request"}}`. Thông báo công khai có nội dung cố định.

| HTTP | Code | Điều kiện |
| --- | --- | --- |
| 400 | `INVALID_REQUEST` | Input, JSON, UUID hoặc pagination không hợp lệ |
| 401 | `UNAUTHORIZED` | Access token vắng mặt hoặc không hợp lệ khi auth đã cấu hình |
| 404 | `NOT_FOUND` | Session không tồn tại, thuộc owner khác hoặc route không tồn tại |
| 413 | `PAYLOAD_TOO_LARGE` | Request body vượt 16 KiB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Content-Type không được Fastify hỗ trợ. Dùng `application/json` cho POST. |
| 500 | `INTERNAL_ERROR` | Lỗi ngoài dự kiến khi phục vụ request |
| 503 | `AUTH_UNAVAILABLE` | Chưa cấu hình issuer hoặc JWKS không khả dụng |
| 503 | `DATABASE_UNAVAILABLE` | Readiness probe không kết nối hoặc truy vấn được PostgreSQL |

## Actions B18 · Phase 2C2

Gửi `POST /v1/game-sessions/:id/actions` với access token của owner và header `Idempotency-Key` là UUID. Body phải có đủ ba trường sau.

```json
{ "actionId": "advance", "payload": {}, "expectedStateVersion": 0 }
```

| Action | Payload | Điều kiện |
| --- | --- | --- |
| `advance` | `{}` | Phase `forecast`, `summary` hoặc `rebalancing` theo engine |
| `roll` | `{}` | Phase `rolling`. Server tự gieo và xử lý landing/START. |
| `choose` | `{"optionId":"course-basic"}` | Phase `event`. Dùng option ID canonical của event hiện tại, gồm mua `course-basic` và `course-advanced`, `pay`, `full`, `temporary`, `defer`, `acknowledge` và `skip` khi engine cho phép. |
| `fund` | `{"source":"debt","amount":1000000}` | Phase `funding`. `amount` là số nguyên VND dương an toàn. Giới hạn theo `fundingOptions` và engine. |
| `trade` | `{"kind":"buy","asset":"gold","amount":1000000}` | Phase `event` tại đúng ô Gold, Stocks hoặc Bonds, tối đa một giao dịch thành công mỗi lượt ghé. Cũng nhận `deposit` tại Bank và `repay` tại checkpoint START. |

`fund` hỗ trợ `savings`, `stocks`, `bonds`, `gold` và `debt`. Với `savings`, gửi toàn bộ gốc của lot và `lotId` để chỉ định khoản. Nếu bỏ `lotId`, engine chọn khoản đang active đầu tiên. `bonds` yêu cầu `lotId` và số tiền bán gộp của lot. `stocks` và `gold` nhận số tiền bán gộp. `debt` nhận số tiền muốn vay, giới hạn bởi khoản thiếu và hạn mức còn lại. Backend tính số tiền thực nhận, phí và số còn thiếu qua engine.

`expectedStateVersion` là số nguyên PostgreSQL không âm, bắt đầu từ 0. Input từ chối trường thừa, gồm số dư, kết quả, seed và state. Dùng state version trong response làm expected version của lệnh mới.

HTTP 200 trả `{ sessionId, stateVersion, state, result }`. `state` gồm profile và bàn, phase/lap/turn/position/dice, scenario và event hiện hành, danh mục, thu nhập, nghĩa vụ, khóa học, tổng kết START, thông tin chờ thanh toán và các thao tác khả dụng. `availableActions` liệt kê ID action, `options` liệt kê lựa chọn event, `fundingOptions` liệt kê `{ source, lotId?, minAmount, maxAmount }` theo từng nguồn hoặc lot. `tradingAsset` cho biết ô có giao dịch hoặc `null`. `holdings` trả số lượng và cost basis của stocks/gold, cùng ID lot, số lượng, gốc, trạng thái và issuer/cost basis của bonds. `market` gồm giá hiện tại của cổ phiếu, vàng và trái phiếu theo tổ chức phát hành, các cú sốc đã áp dụng và các vòng đã cập nhật. `result` là `null` khi ván đang chạy. Kết quả chính thức có `outcome` là `victory`, `defeat` hoặc `insolvent`, và `lawfulProceedsVnd` là chuỗi số nguyên có dấu.

Retry sau timeout hoặc mất response cần giữ nguyên key và cả body. Retry đã commit trả lại version, state và result của action gốc, kể cả sau các action khác hoặc sau khi ván kết thúc. Key có phạm vi theo session. Đọc `GET /v1/game-sessions/:id` để lấy `session.status`, `session.stateVersion`, `state` cùng projection như POST và kết quả chính thức đã lưu. Session kết thúc hoặc bị bỏ trả danh sách action khả dụng rỗng.

| HTTP | Code | Điều kiện |
| --- | --- | --- |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Key đã commit cho action ID, payload hoặc expected version khác |
| 409 | `STATE_VERSION_CONFLICT` | Key mới với expected version khác version hiện tại |
| 409 | `SESSION_NOT_ACTIVE` | Lệnh mới trên session đã kết thúc hoặc bị bỏ |
| 409 | `SCENARIO_UNSUPPORTED` | Session dùng scenario, engine hoặc rules ngoài phạm vi Phase 2C2 |
| 422 | `ACTION_NOT_ALLOWED` | Lệnh đúng schema nhưng engine từ chối ở phase/event hiện tại |

Các lỗi chung trong bảng trên vẫn áp dụng, gồm 404 cho session thuộc người khác và 400 cho action/payload ngoài schema. Lỗi DB khi xử lý action trả 500. Sau khi DB phục hồi, gửi lại cùng key và body.

## Trading và quote · Phase 2C1

`trade.payload` dùng `kind: "buy" | "sell"`, `asset: "gold" | "stocks" | "bonds"`, `amount` là số nguyên VND dương an toàn, và tùy chọn `completeEncounter` theo command canonical. Gold không có định danh bổ sung. Stocks nhận `symbolId` tùy chọn. Khi bỏ mã, mua dùng mã đầu tiên, bán giảm tỷ lệ các holding. Bond buy yêu cầu `issuerId`, còn bond sell yêu cầu `lotId`. `amount` là tiền bỏ ra khi mua hoặc giá trị gộp muốn bán.

`POST /v1/game-sessions/:id/trade-quote` đọc theo owner và version hiện tại, không ghi database và không cần `Idempotency-Key`. Ví dụ body:

```json
{ "expectedStateVersion": 2, "payload": { "kind": "buy", "asset": "gold", "amount": 1000000 } }
```

`quote` gồm `unitPrice` (giá niêm yết mỗi đơn vị), `maxAmount` (giới hạn gộp VND theo yêu cầu), `quantity` (số đơn vị thực chuyển), `gross`, `fee`, `spread`, `cashPaid`, `cashReceived` và `cashAfter`. Với bán stocks gộp nhiều mã, `unitPrice` và `quantity` là `null`. Quote và action dùng 400 cho payload sai schema, 409 cho version cũ hoặc session không active, 422 cho trade ngoài phase, vượt số dư, thiếu tài sản hoặc định danh không khả dụng.

Dùng `stateVersion` của quote làm `expectedStateVersion` trong action, với cùng payload và một UUID `Idempotency-Key`. Server kiểm tra lại version và tính từ snapshot có thẩm quyền khi execute. Giá, fee, số dư và state do client gửi bị từ chối.

[Thiết kế Phase 2C1](./ACTIONS_V2C1.md) · [Thiết kế Phase 2B](./ACTIONS_V2B.md)

## Bank · Phase 2C2

| Action và payload | Điều kiện |
| --- | --- |
| `trade` với `{"kind":"deposit","amount":1000000,"term":2}` | Encounter Bank. `term` là 1, 2 hoặc 3, mặc định 1. Một lot mỗi lượt ghé, yêu cầu đủ tiền mặt. |
| `trade` với `{"kind":"repay","amount":1000000}` | Phase `rebalancing`. `amount` là gốc muốn trả, giới hạn bởi dư nợ và tiền mặt đủ trả cả gốc và lãi. |
| `fund` với `{"source":"debt","amount":1000000}` | Funding. Giới hạn theo khoản thiếu và hạn mức còn lại. |
| `fund` với `{"source":"savings","amount":1000000,"lotId":"deposit-1"}` | Funding. Phải rút toàn bộ gốc của một lot đang active. |

`POST /v1/game-sessions/:id/bank-quote` nhận body như action ở bảng trên, gồm `expectedStateVersion`. Đây là phép đọc, không cần `Idempotency-Key`. Quote trả `cashAfter`, `savingsAfter`, `debtAfter`, `phaseAfter`, `pendingPaymentAfter`, `terminationAfter` và chi tiết theo loại. `deposit` có lot dự kiến, lãi khi đáo hạn và cờ `withinGame`. `repayment` có gốc, lãi và tổng tiền trả. `funding` có nguồn, lot nếu rút tiết kiệm, số tiền, phần trả nghĩa vụ hiện tại và lãi mất. Quote Funding có thể gồm tác động tiếp nối từ settlement. Khi gửi action, dùng version trong quote và cùng payload. Server tính lại theo state đã khóa.

`state.bank` cung cấp `canDeposit`, `canRepay`, `savingsRates`, `deposits`, `borrowingLimit`, `borrowingAvailable`, `netWorth`, `totalWorth` và `liquidatableFunds`. `state.fundingOptions` cho biết các nguồn có thể dùng để trả khoản thiếu. Payload sai schema trả 400, version cũ hoặc session inactive trả 409, hành động sai phase hoặc vượt khả năng tài chính trả 422.

[Thiết kế Phase 2C2](./ACTIONS_V2C2.md)
