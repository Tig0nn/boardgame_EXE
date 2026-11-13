# REST API V1

Môi trường Phase 2A dùng `http://127.0.0.1:3101` theo `.env.example`. Các route `/v1` yêu cầu `Authorization: Bearer <access-token>` và trả `Cache-Control: no-store`. Dữ liệu phản hồi dùng JSON và timestamp ISO 8601 UTC.

| Method và path | Input | Thành công |
| --- | --- | --- |
| `GET /health` | Công khai | 200 `{"status":"ok"}` khi tiến trình HTTP hoạt động |
| `GET /ready` | Công khai | 200 `{"status":"ready"}` khi PostgreSQL thực thi được `SELECT 1` |
| `GET /v1/me` | Access token | 200 `{ "profile": { "userId", "createdAt" } }`. Tạo profile từ JWT ở lần đầu. |
| `GET /v1/game-sessions` | `limit` 1–100, mặc định 20. `offset` 0–10.000, mặc định 0. | 200 `{ "sessions": [...], "limit": 20, "offset": 0 }`. Sắp xếp mới nhất trước theo `createdAt`, rồi `id` giảm dần. |
| `POST /v1/game-sessions` | Header `Idempotency-Key` là UUID. JSON `{"scenarioId":"b18"}`. | 201 `{ "session": {...} }`, kèm `Location`. Gửi lại cùng khóa và owner trả 200, cùng resource. |
| `POST /v1/game-sessions/:id/actions` | UUID session, UUID `Idempotency-Key` và JSON theo mục Actions. | 200, trạng thái tại version mà action đã commit. |
| `GET /v1/game-sessions/:id` | UUID session | 200 `{ "session": {...} }` cho owner hiện tại. |

Session gồm `id`, `scenarioId`, `scenarioVersion`, `gameplayProfile`, `engineVersion`, `resultVersion`, `tiles`, `laps`, `status`, `stateVersion`, `createdAt` và `updatedAt`. Session mới có `status=active` và `stateVersion=0`. Seed, trạng thái RNG và snapshot được giữ trong backend. POST từ chối mọi trường ngoài `scenarioId`, gồm `userId`, seed, tiền, portfolio và kết quả.

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

## Actions B18 · Phase 2A

Gửi `POST /v1/game-sessions/:id/actions` với access token của owner và header `Idempotency-Key` là UUID. Body phải có đủ ba trường sau.

```json
{ "actionId": "advance", "payload": {}, "expectedStateVersion": 0 }
```

| Action | Payload | Điều kiện |
| --- | --- | --- |
| `advance` | `{}` | Phase `forecast`, `summary` hoặc `rebalancing` theo engine |
| `roll` | `{}` | Phase `rolling`. Server tự gieo và xử lý landing/START. |
| `choose` | `{"optionId":"skip"}` | Phase `event`. Chấp nhận `skip`, `acknowledge`, `defer` hoặc `temporary` nếu engine cho phép tại event hiện tại. |

`expectedStateVersion` là số nguyên PostgreSQL không âm, bắt đầu từ 0. Input từ chối trường thừa, gồm số dư, kết quả, seed và state. Dùng state version trong response làm expected version của lệnh mới.

HTTP 200 trả `{ sessionId, stateVersion, state, result }`. `state` gồm profile và bàn, phase/lap/turn/position/dice, scenario và event hiện hành, danh mục, thu nhập, nghĩa vụ, khóa học, tổng kết START, thông tin chờ thanh toán và `options` mà Phase 2A có thể thực hiện tại event đó. `market` gồm giá hiện tại của cổ phiếu, vàng và trái phiếu theo tổ chức phát hành, các cú sốc đã áp dụng và các vòng đã cập nhật. `result` là `null` khi ván đang chạy. Kết quả chính thức có `outcome` là `victory`, `defeat` hoặc `insolvent`, và `lawfulProceedsVnd` là chuỗi số nguyên có dấu.

Retry sau timeout hoặc mất response cần giữ nguyên key và cả body. Retry đã commit trả lại version, state và result của action gốc, kể cả sau các action khác hoặc sau khi ván kết thúc. Key có phạm vi theo session. Đọc `GET /v1/game-sessions/:id` để lấy metadata và version hiện tại.

| HTTP | Code | Điều kiện |
| --- | --- | --- |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Key đã commit cho action ID, payload hoặc expected version khác |
| 409 | `STATE_VERSION_CONFLICT` | Key mới với expected version khác version hiện tại |
| 409 | `SESSION_NOT_ACTIVE` | Lệnh mới trên session đã kết thúc hoặc bị bỏ |
| 409 | `SCENARIO_UNSUPPORTED` | Session dùng scenario, engine hoặc rules ngoài phạm vi Phase 2A |
| 422 | `ACTION_NOT_ALLOWED` | Lệnh đúng schema nhưng engine từ chối ở phase/event hiện tại |

Các lỗi chung trong bảng trên vẫn áp dụng, gồm 404 cho session thuộc người khác và 400 cho action/payload ngoài schema. Lỗi DB khi xử lý action trả 500. Sau khi DB phục hồi, gửi lại cùng key và body.
