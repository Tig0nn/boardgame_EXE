# Phase 3B · Supabase Auth và Cloud Save staging

## Kiến trúc

Mobile React/Vite dùng email và mật khẩu qua Supabase Auth SDK. Đăng ký có thể yêu cầu xác nhận email. Link quay về origin staging đã allowlist, SDK dùng PKCE để trao đổi code trong trình duyệt đăng ký. SDK lưu và tự làm mới phiên đăng nhập. Đây là dữ liệu xác thực, còn trạng thái ván chỉ được đọc và ghi qua Fastify. Đăng xuất scope local kết thúc phiên thiết bị hiện tại. JWT đã phát hành vẫn có thể hợp lệ tới lúc hết hạn. [Đăng ký](https://supabase.com/docs/reference/javascript/auth-signup) · [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow) · [Phiên Auth](https://supabase.com/docs/guides/auth/sessions)

Yêu cầu `/v1` đi qua proxy HTTPS cùng origin. Fastify xác thực issuer, audience, ES256/RS256 qua JWKS và lấy owner UUID từ `sub`. Browser chỉ nhận publishable key và access token từ SDK. Một phản hồi 401 cho phép thử làm mới một lần, gộp refresh đồng thời và giữ nguyên body cùng idempotency key. Nếu tài khoản đổi hoặc phiên hết hạn, yêu cầu dừng. Sau đăng nhập lại, Mobile đọc danh sách và snapshot đã commit. Code phiên ván và tệp cũ không cấp quyền truy cập.

## Chuẩn bị staging

1. Owner cung cấp project staging riêng và xác nhận project ref thuộc staging. Bật email/password, chọn chính sách xác nhận email, đặt Site URL và allowlist chính xác URL Mobile staging. Chuẩn bị hai tài khoản thử nghiệm và cách nhận thư xác nhận.
2. Tắt Supabase Data API nếu project dành riêng cho EXE. Nếu Data API phục vụ hệ thống khác trong staging, giữ EXE ngoài quyền truy cập. Migration 0004 bật RLS và thu hồi quyền bảng EXE của `PUBLIC`, `anon`, `authenticated`, `service_role`. RLS cấp truy cập bảng cho `exe_runtime` để Fastify kiểm tra quyền theo owner. [Supabase Data API](https://supabase.com/docs/guides/api/securing-your-api)
3. Cấp thông tin kết nối bằng secret manager của môi trường staging. Migration dùng `postgres`. API dùng login riêng `exe_runtime` không có `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `BYPASSRLS` hoặc membership được thừa hưởng. Provision login qua quy trình quản trị database của Owner và áp dụng [runtime grants](../../apps/api/drizzle/runtime-grants.sql) sau migration. Giữ quyền migration ngoài tiến trình API.
4. Dùng kết nối trực tiếp hoặc Supavisor session mode cổng 5432. Tải CA từ Dashboard. Cấu hình API xác minh TLS và hostname. Runtime mặc định tối đa bốn kết nối mỗi tiến trình. Nhân số đó với số tiến trình để kiểm tra ngân sách kết nối của project. Migration dùng một kết nối và giữ advisory lock trong cùng session. [Kết nối PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres)
5. Dùng [mẫu cấu hình staging](../../apps/api/.env.staging.example) cho các biến môi trường. Chạy `npm run db:staging:check` trong `apps/api` sau khi được cấp quyền truy cập. Preflight đọc journal và từ chối lịch sử sai hash hoặc schema EXE có sẵn mà thiếu journal. Chỉ chạy `npm run db:staging:migrate` khi đã được duyệt áp dụng migration cho đích đó và đã đặt `EXE_CONFIRM_STAGING_MIGRATION` bằng ref được duyệt. Lệnh local `db:migrate` vẫn dành riêng cho PostgreSQL loopback.
6. Khi được phê duyệt triển khai staging, đặt `VITE_EXE_ONLINE=1`, `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY`. Giữ `VITE_MASCOT_LEARNING_ENABLED=0`. Dùng reverse proxy HTTPS cùng origin chuyển `/v1` vào Fastify trên loopback 3109. Kiểm tra `/health`, `/ready`, sau đó kiểm tra JWT thực qua `/v1/me`.

## Backup và khôi phục

Trước migration có dữ liệu, lưu backup theo chính sách dự án và ghi nhận version Drizzle. Với backup logic, dùng direct/session connection và bảo vệ bản dump ở nơi lưu đã được duyệt. Bản sao của các bảng EXE cần giữ nguyên `profiles.user_id` và lịch sử migration. Sao lưu app riêng không phục hồi tài khoản Auth. Nếu khôi phục sang môi trường khác, khôi phục hoặc ánh xạ Auth UUID theo quy trình được duyệt trước khi cấp truy cập. Diễn tập restore trên database tách biệt, kiểm tra foreign keys, quyền `exe_runtime`, số phiên bản, replay schema 7 và kết quả chính thức. Owner chốt RPO/RTO theo gói hiện có. [Supabase backup và restore](https://supabase.com/docs/guides/platform/backups)

## Kịch bản nghiệm thu

Dùng hai browser context tách biệt. Đăng ký và xác nhận email, đăng nhập A, tạo ván và ghi action. Đóng context rồi đăng nhập A ở context mới và tiếp tục đúng version. Đăng nhập B và kiểm tra danh sách cũng như GET/action ván A. Gửi đồng thời hai lệnh cùng version, kiểm tra một commit và một 409. Làm hết hạn access token và kiểm tra refresh, rồi thu hồi refresh token để kiểm tra quay về đăng nhập. Mô phỏng mất phản hồi sau commit, gửi lại cùng idempotency key, chơi hết bốn vòng và đối chiếu từng snapshot cùng official result. Kiểm tra sau khi đổi thiết bị từ đúng tài khoản. Ghi kết quả staging riêng với local JWKS.

PostgreSQL local Phase 3B dùng 55441, Fastify dùng 3109. Test Chromium tiếp tục dùng issuer JWKS chỉ dành cho test. What-if online tới cuối vòng bốn cần nghiệm thu riêng.
