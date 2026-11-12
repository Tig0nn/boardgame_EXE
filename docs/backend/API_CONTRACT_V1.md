# REST API V1

Địa chỉ mặc định `http://127.0.0.1:3100`. Các route `/v1` yêu cầu `Authorization: Bearer <access-token>` và trả `Cache-Control: no-store`. Dữ liệu phản hồi dùng JSON và timestamp ISO 8601 UTC.

| Method và path | Input | Thành công |
| --- | --- | --- |
| `GET /health` | Công khai | 200 `{"status":"ok"}` khi tiến trình HTTP hoạt động |
| `GET /ready` | Công khai | 200 `{"status":"ready"}` khi PostgreSQL thực thi được `SELECT 1` |
| `GET /v1/me` | Access token | 200 `{ "profile": { "userId", "createdAt" } }`. Tạo profile từ JWT ở lần đầu. |
| `GET /v1/game-sessions` | `limit` 1–100, mặc định 20. `offset` 0–10.000, mặc định 0. | 200 `{ "sessions": [...], "limit": 20, "offset": 0 }`. Sắp xếp mới nhất trước theo `createdAt`, rồi `id` giảm dần. |
| `POST /v1/game-sessions` | Header `Idempotency-Key` là UUID. JSON `{"scenarioId":"b18"}`. | 201 `{ "session": {...} }`, kèm `Location`. Gửi lại cùng khóa và owner trả 200, cùng resource. |
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

Scope V1 gồm tạo và đọc metadata phiên chơi. Phase 2 sẽ thêm giao thức đọc trạng thái dùng cho gameplay và xác minh action.
