# Kiến trúc EXE Backend V1

Backend chạy dưới dạng package Node.js riêng tại `apps/api`. Fastify phục vụ REST `/v1` trên loopback. Drizzle dùng driver `pg` kết nối PostgreSQL 17 qua Docker Compose. Backend dùng TypeScript strict và import trực tiếp các module canonical trong `src/game` và `src/data`. Entry point Fastify và Vercel serverless hiện tại độc lập.

| Đường dẫn | Trách nhiệm |
| --- | --- |
| `src/config.ts`, `src/server.ts`, `src/app.ts` | Cấu hình, vòng đời HTTP, health và readiness |
| `src/auth.ts`, `src/routes/v1.ts` | Xác minh access token và lấy user ID cho các route V1 |
| `src/validation.ts`, `src/errors.ts` | Zod, giới hạn input và lỗi API |
| `src/services/` | Khởi tạo B18 và ranh giới transaction |
| `src/repositories/`, `src/db/` | Truy vấn theo owner, kết nối, schema và migrations |
| `drizzle/`, `tests/` | Migrations SQL có phiên bản, kiểm thử Node và PostgreSQL |

Backend lấy khóa công khai từ JWKS của issuer cấu hình trước. JOSE kiểm tra chữ ký ES256 hoặc RS256, issuer, audience, expiry và `nbf` khi có. API yêu cầu `sub` là UUID, `role=authenticated` và từ chối token đánh dấu đăng nhập ẩn danh. Dùng UUID đã xác minh làm khóa `profiles` và điều kiện owner trong SQL. Các test ký JWT bằng cặp khóa ES256 sinh trong bộ nhớ và phục vụ JWKS qua loopback. [Supabase Auth JWT](https://supabase.com/docs/guides/auth/jwts) · [JOSE JWT verify](https://github.com/panva/jose/blob/main/docs/jwt/verify/functions/jwtVerify.md)

## Khởi tạo B18

Route POST nhận duy nhất scenario `b18` và khóa idempotency. Trong transaction, backend đọc phiên bản đã đăng ký, tạo ván bằng `createMultiCourseGame()` và lưu profile, session cùng snapshot state version 0. Factory dùng seed sinh từ Web Crypto của Node và các tham số mặc định canonical, gồm phân bổ tiết kiệm 0 VND và kỳ hạn 1. B18 multi-course có 18 ô, 4 vòng, profile `core-mvp-b18-multi-course-v1`, kết quả theo `single-90m-v1` và snapshot canonical schema 7. `engineVersion` ghi SHA nguồn để xác định engine của session. API chỉ trả metadata công khai của phiên chơi.

Idempotency theo cặp owner và khóa. Ràng buộc unique của PostgreSQL xử lý các POST đồng thời. Lần ghi thắng trả 201. Lần gửi lại trả 200 và cùng ID. PostgreSQL rollback profile, session và snapshot nếu một bước ghi thất bại. [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql) · [Fastify Server](https://fastify.dev/docs/latest/Reference/Server/)

## Lộ trình từ V1

Thêm endpoint nhận lệnh canonical và `expectedStateVersion`. Xác minh owner, khóa idempotency và version trong cùng transaction. Phục hồi snapshot bằng engine tương ứng, áp dụng lệnh hợp lệ, ghi action, tăng state version bằng compare-and-swap và ghi snapshot theo chính sách đã chọn. Khi kết thúc, lưu final snapshot và kết quả chính thức trong cùng transaction. Kiểm thử retry, cạnh tranh, replay xác định và kết quả B18 trước khi nối frontend. Chuẩn bị kế hoạch chuyển từng serverless route khi có thay thế được nghiệm thu. Semantic P4 ở trạng thái HOLD.

Phase 2A đã triển khai luồng action B18 và kết quả terminal. [Thiết kế, phạm vi và replay Phase 2A](./ACTIONS_V2A.md)
