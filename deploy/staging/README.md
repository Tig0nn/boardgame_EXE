# EXE Staging HTTPS

Đích được ghim vào Supabase `exe-staging` (`yqikecqeijeaygmmjdyg`, Singapore). Manifest chạy một Fastify production process và một Caddy phục vụ Mobile static. Chỉ Caddy publish cổng. PostgreSQL và Auth dùng project hiện có. Cần Owner duyệt host, hostname, chi phí, cấu hình Auth và phạm vi nghiệm thu trước khi chạy trên host.

## Host và chi phí cần duyệt

- Bắt đầu với Linux x86-64, 2 vCPU, 4 GiB RAM và ít nhất 20 GiB dung lượng trống cho Docker build, hai cặp image và logs. Docker Engine với Compose v2 hỗ trợ IPv6 bridge. Ưu tiên host gần Singapore có IPv6 outbound. Kiểm tra DNS và TCP 5432 **từ container**, TLS verify-full và kết nối role `exe_runtime`. Nếu host chỉ có IPv4, dùng Supavisor **session** pooler cổng 5432 sau khi kiểm tra hostname và custom role. Pool khởi điểm 4 kết nối cho một tiến trình. [Docker IPv6](https://docs.docker.com/engine/daemon/ipv6/) · [Supabase kết nối](https://supabase.com/docs/guides/database/connecting-to-postgres)
- Cần hostname phụ dành riêng cho staging, DNS A hoặc AAAA trỏ đúng host, TCP 80/443 và UDP 443 nếu dùng HTTP/3. Caddy tự lấy và gia hạn chứng chỉ công khai. Giữ volume `caddy_data` qua các lần nâng cấp. Nếu dùng domain sẵn có, Owner xác nhận phí DNS phát sinh. Domain mới, IPv4, backup storage, SMTP và thuế cần được báo giá riêng. [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- Mốc dự toán ngày 13-11-2026. Host sẵn có có thể dùng ngân sách hiện tại nếu còn tài nguyên. Tham chiếu Hetzner Singapore CPX22 **€26,49/tháng** theo bảng niêm yết, trước thuế và IPv4. Đây là lựa chọn để Owner so sánh. Supabase Free hiện niêm yết **$0**, 500 MB database, CPU dùng chung và 5 GB egress. Xác nhận giá, quota và availability thực tế trước khi duyệt. [Hetzner Singapore](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/#singapore-sin) · [Supabase pricing](https://supabase.com/pricing)

## Auth trước khi chạy

Trong Dashboard của **đúng project**, ghi nhận settings và hạn mức thực tế vào biên bản trước khi gửi thư.

1. Xác minh email/password signup và Confirm email đang bật, anonymous signup tắt. Lấy publishable key `sb_publishable_…` từ project này. Kiểm tra ES256 đang ký JWT mới, issuer `https://yqikecqeijeaygmmjdyg.supabase.co/auth/v1`, audience `authenticated` và JWKS chứa key đang dùng. Kiểm tra session policy cho phép A đăng nhập từ hai thiết bị.
2. Đặt Site URL và redirect allowlist chính xác `https://<hostname>/`. Cấu hình Mobile build khớp đúng project. Giữ đường dẫn PKCE mặc định. Hai email thử nghiệm A và B phải nhận được thư riêng. Mở link trong browser context đã đăng ký để có verifier. Tránh link rewriting của mail provider.
3. Trong Authentication, kiểm tra **SMTP provider đang dùng**, trạng thái Confirm email, rate limit dự án, thời hạn link/JWT, resend cooldown và log gửi thư. Built-in SMTP hiện theo tài liệu chỉ gửi đến email thuộc team dự án và tối đa 2 email/giờ toàn project. Nếu chọn built-in cho lượt nghiệm thu, xác nhận cả hai hộp thư đủ điều kiện và đủ quota trước khi bắt đầu. Nếu dùng custom SMTP, xác minh sender/domain, TLS, quota thực và quyền sử dụng trước khi chạy. Ghi nhận một thư xác nhận thật của mỗi tài khoản.

Đã xác minh project đang hoạt động, URL, publishable key qua connector Supabase, JWKS công khai ES256 và catalog staging. Cần xác minh Dashboard Auth/SMTP, allowlist và quota thực tế trước khi gửi email nghiệm thu. [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits) · [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)

## Chuẩn bị và triển khai sau phê duyệt

1. Chuyển đúng checkout đã duyệt tới host qua kênh nội bộ. Ghi SHA, image IDs, release tag và image tags của release trước. Tạo file env host ngoài repo từ `.env.staging.example`. Đặt `EXE_RELEASE` bằng SHA đã duyệt và `EXE_STAGING_HOSTNAME` bằng hostname thuần, không scheme hoặc dấu slash. Publishable key là tham số build của Mobile.
2. Dùng secret manager của host materialize DSN role `exe_runtime` và CA vào hai đường dẫn tuyệt đối. File DSN một dòng, username/password đã URL encode, database `postgres`, cổng 5432. Cấp quyền đọc cho UID 1000 của container API và quyền tối thiểu trên host, ví dụ file owner root, group chuyên dụng ánh xạ GID 1000, mode 0440. Compose file secrets bind mount file; thiết lập mode và owner ở host. Giữ credential `postgres`, service-role và SMTP bên ngoài image, Compose env và browser. CA phải đúng endpoint đang dùng. [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/) · [Supabase TLS](https://supabase.com/docs/guides/platform/ssl-enforcement)
3. Xác minh journal 0000–0004 và Data API vẫn OFF theo cấu hình Owner. Runtime không chạy migration. Trước khi phục vụ, xác nhận project backup hiện có và diễn tập restore gần nhất. Giữ backup logic ở nơi mã hóa, theo chính sách RPO/RTO Owner chốt. Backup có người dùng cần lưu được quan hệ Auth UUID và game ownership. Không dùng rollback ứng dụng để restore database.

```sh
# Từ root repo trên host đã duyệt. env file chỉ có hostname, tag, publishable key và đường dẫn secret.
ENV_FILE=/etc/exe-staging/staging.env
docker compose --env-file "$ENV_FILE" -f deploy/staging/compose.yaml config --quiet
docker compose --env-file "$ENV_FILE" -f deploy/staging/compose.yaml build api edge
docker compose --env-file "$ENV_FILE" -f deploy/staging/compose.yaml up -d --no-build --pull never api edge
sh deploy/staging/health.sh https://approved-staging.example.com
```

Đọc `compose ps` và logs khởi động, kiểm tra HTTP redirect sang HTTPS, chứng chỉ tin cậy, `/health`, `/ready`, Mobile assets và `/v1` trả JSON. Dùng `/health` cho liveness, `/ready` cho đường DB thật. Compose dùng `unless-stopped` để restart process khi thoát. Trạng thái unhealthy cần operator điều tra. Startup và health không sinh game data. Fastify dừng có grace period. Sau khi thay secret, recreate container API rồi chạy lại health.

Rollback tới cặp image local đã giữ, dùng cùng hostname, certificate volume và secret hiện tại. Script xác minh hostname của container edge đang chạy trước khi thay image. So sánh image IDs trước và sau, kiểm tra `health.sh`, rồi mở lại một session đã có. Lượt đổi image có thể gián đoạn ngắn với một replica.

```sh
sh deploy/staging/rollback.sh /etc/exe-staging/staging.env previous-release-tag https://approved-staging.example.com
```

## Hiệu năng và nghiệm thu hosted

Lấy mốc CPU/RAM, database size/egress, connections và số liệu logs trước lượt test. Theo dõi `docker stats`, Dashboard Supabase và structured logs của API. `X-Request-Id` do API sinh và nối các event `http_response`, `game_action`, `snapshot_query`, `request_failed`. Ghi thời gian DB theo thao tác, state version, kích thước snapshot khi ghi, idempotency outcome và SQLSTATE khi có. Đếm `57014` riêng và đối chiếu PostgreSQL log để phân biệt statement timeout với hủy lệnh khác. Caddy access log mặc định tắt để tránh lưu PKCE query string. Không ghi payload, token, credential, DSN hoặc idempotency key vào log.

- Chạy đúng **một ván** với hai tài khoản và hai context của A. Suite chặn tạo thêm ván và có trần 140 POST game gồm quote, race và retry. Dừng nếu gặp 57014, hết quota, hoặc 5xx lặp lại. Không chạy load test cloud. Giữ timeout SQL 5 giây. Đối chiếu đề xuất Phase 3C là snapshot query tối đa 3,5 giây để còn biên 1,5 giây. Ghi max, số mẫu và p50/p95 nếu đủ mẫu. Đối chiếu I/O, CPU, egress, số kết nối và dung lượng sau nghiệm thu.
- Trong phiên operator, dùng `acceptance.env.example` để cấu hình origin, xác nhận project và đường dẫn secret. Chạy từ root repo với Playwright và Chromium đã cài. Suite mở browser có UI để Owner tự nhập email/mật khẩu và mở thư. Suite xác minh real PKCE, JWT thật, A2/B, 409 cạnh tranh, mất phản hồi sau commit, retry cùng key, 401 sau JWT hết hạn và refresh thật. Replay đọc các batch nhỏ trong transaction read-only bằng role runtime.

```sh
node --experimental-strip-types apps/api/tests/staging-acceptance.ts
```

- Quan sát giao dịch Trading, Bank, Business, Funding, START và Rebalance, đủ 4 vòng. Diễn tập đóng browser rồi mở lại với cùng hồ sơ, offline/reconnect và so state version sau reload. Có thể cần chọn hành động theo tình huống ván để thực hiện đủ giao dịch. Nếu ván không có đủ coverage, ghi gate còn thiếu và xin duyệt trước lượt bổ sung. Suite so SHA-256 từng snapshot schema 7 và official result với canonical replay, đồng thời đếm một action cho key race thành công và key retry.
- Ghi hồ sơ gồm SHA, origin, thời gian, trạng thái xác nhận email, hai tài khoản test, số action/snapshot, result, 401/409, dữ liệu test còn lại và resource usage. Chỉ tuyên bố `STAGING_E2E_PASS` sau khi toàn bộ các bước hosted đạt và Owner chốt giữ hoặc dọn test data. What-if full endgame là gate phát hành riêng. Semantic P4 giữ HOLD.
