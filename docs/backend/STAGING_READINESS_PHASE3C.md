# Phase 3C · Triển khai và nghiệm thu staging

Đích duy nhất là `exe-staging` (`yqikecqeijeaygmmjdyg`, Singapore). Checkpoint đầu phase là `1c3fcf5af2043c0baee5281ec4c9a135f3df53c3`. Database staging đã có journal Drizzle 0000–0004 và runtime role. Dùng kiểm tra chỉ đọc để xác nhận journal và schema trước khi triển khai ứng dụng.

## Kiến trúc đề xuất

Dùng một host staging được Owner duyệt, ưu tiên gần `ap-southeast-1` và có outbound IPv6. Caddy phục vụ bản build Vite và proxy nguyên đường dẫn `/v1/*` đến một tiến trình Fastify dài hạn trên loopback. PostgreSQL và Auth ở Supabase staging. Dùng hostname HTTPS riêng, ví dụ `exe-staging.example.com`. Cùng origin cho Mobile và Fastify nên API không cần CORS cross-origin. Browser gọi Supabase Auth qua HTTPS đến đúng project, với publishable key. [Reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy) · [Kết nối Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)

```caddyfile
exe-staging.example.com {
  root * /srv/exe-staging/mobile
  header Referrer-Policy no-referrer

  @api path /v1 /v1/* /health /ready
  handle @api {
    reverse_proxy 127.0.0.1:3109
  }
  handle {
    try_files {path} /index.html
    file_server
  }
}
```

Dùng `handle` để giữ prefix `/v1`. Kiểm tra chứng chỉ của hostname thực, HTTP chuyển sang HTTPS, `/health`, `/ready`, API thiếu bearer trả 401 JSON, và SPA callback vẫn đến `index.html`. Tránh ghi query string của callback, authorization header hoặc body vào access log. Giữ các response `/v1` ở `Cache-Control: no-store`. Kiểm tra khi qua proxy thật với timeout response đủ cho giới hạn client 12 giây. [Caddy routing](https://caddyserver.com/docs/caddyfile/directives/route)

| Nơi cấp | Cấu hình |
| --- | --- |
| Build Mobile | `VITE_EXE_ONLINE=1`, `VITE_SUPABASE_URL=https://yqikecqeijeaygmmjdyg.supabase.co`, `VITE_SUPABASE_PUBLISHABLE_KEY` của đúng project, `VITE_MASCOT_LEARNING_ENABLED=0`. Biến `VITE_*` được đưa vào bundle. |
| Fastify | `EXE_ENV=staging`, `EXE_STAGING_PROJECT_REF=yqikecqeijeaygmmjdyg`, `AUTH_ISSUER=https://yqikecqeijeaygmmjdyg.supabase.co/auth/v1`, `AUTH_AUDIENCE=authenticated`, `API_PORT=3109`, `EXE_DB_POOL_MAX=4`. |
| Secret manager của host | `DATABASE_URL` của `exe_runtime`, CA ở `EXE_STAGING_DB_CA_FILE`. Import credential do Owner quản lý. DPAPI Windows phục vụ operator trên máy hiện tại. Giữ credential migration ở phiên quản trị riêng. |
| Supabase Auth | Bật email/password và email confirmation. Đặt Site URL và redirect allowlist theo chính xác URL Mobile, kể cả dấu slash cuối của callback. Chốt chính sách cho phép cùng tài khoản đăng nhập từ hai thiết bị. Dùng ES256 và xác minh JWT mới thực sự ký bằng key có trong JWKS. |
| Gửi email | Dùng hai hộp thư đã duyệt. SMTP mặc định chỉ gửi tới địa chỉ được phép của team và có hạn mức thấp. Trước phát hành cho người ngoài team, cấu hình và thử SMTP riêng, tắt link rewriting và theo dõi deliverability. |

Giữ direct PostgreSQL TLS verify-full nếu host có IPv6. Chỉ dùng Supavisor session mode cổng 5432 khi kết nối custom role và hostname verification đã được thử từ host đích. Tổng pool bằng số tiến trình nhân giới hạn mỗi tiến trình. Theo dõi CPU, I/O, pool saturation, số byte snapshot, thời gian action, SQLSTATE 57014 và 409 theo request ID, không ghi payload hoặc credential. [Supabase TLS](https://supabase.com/docs/guides/platform/ssl-enforcement) · [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [JWT signing keys](https://supabase.com/docs/guides/auth/signing-keys)

## Kiểm chứng snapshot

`snapshotPayloadForInsert()` gửi snapshot nhỏ dưới dạng text. Với snapshot lớn có dữ liệu lặp, driver dùng hai tham số PostgreSQL, một template và một `text[]`. `format(... VARIADIC ...)` tái tạo toàn bộ text trước khi chạy constraints. Các đường đọc state và action dùng primary key `(session_id, state_version)` và vẫn nhận snapshot canonical. Không cần migration. Trong action transaction, hàng session được khóa tới khi action, snapshot, version và result cùng commit. Retry cùng idempotency key trả lại snapshot của action đã commit. Driver có 2 giây cho connect và staging đặt 5 giây cho statement.

Benchmark chỉ chạy trên container PostgreSQL 17.11 riêng, publish loopback cổng 55442. Script xác minh đích, tự tạo database thử và bỏ database sau khi chạy. Chạy một mình để lấy baseline ổn định. Thống kê client gồm truyền dữ liệu, thời gian server và nhận response. p95 cần ít nhất 20 mẫu, p99 cần ít nhất 100 mẫu. Các số đo local không đại diện cho tài nguyên Free hoặc đường mạng tới staging.

```powershell
# Từ root repo. Dùng PostgreSQL 17.11 riêng ở loopback 55442.
$env:DATABASE_URL = 'postgresql://exe_v1@127.0.0.1:55442/exe_v1'
node --experimental-strip-types apps/api/tests/snapshot-performance.ts
```

Kết quả local trên PostgreSQL 17.11, pool 4, statement timeout 5 giây. Bốn ván chạy đồng thời, mỗi ván đủ bốn vòng. Toàn bộ 214 action và 218 snapshot khớp replay và official result. Snapshot B18 thử từ 161.783 đến 15.634.625 byte. Mẫu lớn nhất dùng 849.026 byte tham số theo mã hóa driver. SHA-256 khớp cho mẫu Unicode và mẫu 2,1 MB đi qua đường text thường.

| Phép đo local | Mẫu | p50 | p95 | p99 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ghi snapshot với hai tham số | 108 | 373 ms | 1.216 ms | 1.389 ms | 1.723 ms |
| Đọc snapshot gốc | 192 | 53 ms | 570 ms | 679 ms | 691 ms |
| Transaction action của bốn ván đồng thời | 214 | 842 ms | 1.521 ms | 1.575 ms | 1.739 ms |

Ca kiểm thử PostgreSQL local giữ khóa trên `game_snapshots` đến khi lệnh INSERT hết timeout. Version, action và snapshot mới đều rollback. Cùng idempotency key sau khi bỏ khóa ghi đúng một action và một snapshot. Phase 3C chỉ đọc catalog và JWKS staging. Lượt B18 staging của checkpoint trước có lần ghi 4,98 giây, nên cần kiểm tra lại từ host triển khai.

Sau phê duyệt, chạy đúng một ván B18 staging từ host dự kiến, giữ cùng timeout, ghi thời gian ghi/đọc từng snapshot và wait event nếu chậm. So sánh với mốc 5 giây và thông báo rõ biên, gồm tối đa của lượt đo. Đề xuất lấy 3,5 giây làm ngưỡng tối đa cho lượt kiểm tra này để chừa 1,5 giây dự phòng. Một ván chỉ cho thấy hành vi quan sát được của đường chạy đó. Dùng số liệu local nhiều mẫu và số liệu host thật trước khi quyết định rollout rộng.

## Nghiệm thu người dùng

| Gate | Thao tác và bằng chứng |
| --- | --- |
| PKCE và phiên đăng nhập | A và B đăng ký bằng giao diện staging HTTPS. Đọc email thật, mở link trong browser đã đăng ký, xác nhận app trao đổi code rồi bỏ code khỏi URL. Kiểm tra link lỗi hiển thị hướng xử lý. Đăng xuất scope local, đăng nhập lại, reload và xác nhận session khôi phục. |
| JWT và token hết hạn | Fastify staging nhận token ES256 thật, kiểm tra issuer, audience, signature, exp và role. Xác nhận token hết hạn trả 401, refresh thành công với cùng người dùng, và phiên bị thu hồi quay về đăng nhập. Token access còn hạn sau sign-out có thể vẫn hợp lệ đến `exp`. |
| Tạo ván, lưu và reconnect | A chọn tiết kiệm và kỳ hạn, tạo B18, chơi qua Trading, Bank, Business, Funding, START và Rebalance. Reload sau action đã commit. Đăng nhập A trong thiết bị hoặc context riêng và xác nhận version, balance, lịch sử. |
| Ownership | B chỉ thấy ván của B. GET, action và quote của ván A đều trả 404 khi dùng token B. Dùng hai tài khoản độc lập, và mở thêm context A để kiểm tra tiếp tục ván. |
| Race và mất mạng | Hai thiết bị A gửi hai action hợp lệ cùng expected version, một commit và một 409 rồi tải lại đúng version. Mất phản hồi sau commit, gửi lại cùng key và body, xác minh một action, một snapshot và một tác động tài chính. Ngắt mạng, reconnect và reload state từ server. |
| Kết quả chính thức | Hoàn tất 4 vòng. Đọc action history bằng phiên kiểm chứng đã duyệt, replay từ seed và setup đã lưu. Đối chiếu SHA-256 tất cả snapshot schema 7, version, balances, outcome và lawful proceeds của result row. Xác nhận UI hiển thị cùng kết quả. |
| Kết thúc | Ghi SHA build, hostname, thời gian, số action, snapshot, kết quả và phạm vi account thử. Dọn dữ liệu thử theo quyết định Owner, xác minh không còn transaction mở và không tác động dữ liệu người dùng. |

PKCE cần verifier từ thiết bị bắt đầu luồng. Cross-device được thử sau xác nhận bằng đăng nhập riêng trên thiết bị thứ hai. `phase3c-auth-browser.integration.ts` dùng GoTrue và Mailpit local để thử callback thực. `phase3a-browser.integration.ts` dùng Chromium và Fastify/PostgreSQL local với issuer thử cho hành trình gameplay đầy đủ. Chỉ đặt `STAGING_E2E_PASS` khi cả Auth, API và database đều là staging thật. [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow) · [Supabase sessions](https://supabase.com/docs/guides/auth/sessions)

### Chạy Auth browser test local

Dùng GoTrue `v2.192.0` và Mailpit trên một Docker network riêng. GoTrue dùng PostgreSQL local riêng với schema `auth`, role bootstrap `postgres` và `search_path=auth,public` cho login Auth trước lần migrate đầu tiên. Bật email/password, email confirmation, SMTP tới Mailpit và tạo khóa ES256 dành riêng cho test. Đặt `GOTRUE_JWT_AUD=authenticated`, `GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated`, `API_EXTERNAL_URL=http://127.0.0.1:58244/auth/v1`, `GOTRUE_JWT_ISSUER` bằng cùng issuer và `GOTRUE_SITE_URL=http://127.0.0.1:58244/`. Đặt `GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify`. Chỉ publish GoTrue ở loopback 58243 và Mailpit HTTP ở 58245.

Trong `apps/api`, chạy lệnh dưới đây với `DATABASE_URL` trỏ PostgreSQL EXE loopback. Test tạo database game riêng và serve Mobile cùng reverse proxy local tại 58244. Playwright chuyển request HTTPS Auth đến GoTrue local qua gateway chỉ trong test. Phản hồi refresh đến từ GoTrue, còn lần API 401 ban đầu được mô phỏng để kích hoạt luồng refresh. Các test API local kiểm tra JWT hết hạn thật.

```powershell
$env:EXE_PLAYWRIGHT_MODULE = '<đường dẫn tuyệt đối đến package playwright>'
node --env-file=.env --experimental-strip-types --test tests/phase3c-auth-browser.integration.ts
```

Owner cần duyệt host và hostname, cấu hình Auth cùng SMTP, cấp publishable key và hai hộp thư staging, rồi duyệt riêng deploy staging và lượt kiểm chứng có giới hạn. Giữ bản build trước để rollback ứng dụng trên cùng schema. What-if full endgame là gate phát hành riêng. Semantic P4 giữ HOLD.
