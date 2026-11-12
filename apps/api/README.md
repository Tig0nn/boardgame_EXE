# EXE Backend V1 trên Windows

Chạy các lệnh PowerShell từ thư mục gốc của worktree. Cần Node.js 22.14 trở lên trong dòng 22 LTS, npm và Docker Desktop ở chế độ Linux containers. Mở Docker Desktop rồi kiểm tra cả phần Client và Server trong `docker version`.

```powershell
node --version
docker version
docker compose version
npm ci
Set-Location apps/api
npm ci
```

Lệnh `npm ci` ở thư mục gốc cài ESLint dùng chung. Backend có lockfile riêng.

## Cấu hình và khởi động

Tạo `.env` ở lần chạy đầu. Khối lệnh sau giữ nguyên tệp nếu đã tồn tại.

```powershell
if (-not (Test-Path -LiteralPath '.env')) {
  $exeLocalPassword = node -p "require('node:crypto').randomBytes(24).toString('hex')"
  $exeLocalEnv = Get-Content -LiteralPath '.env.example' -Raw
  $exeLocalEnv = $exeLocalEnv.Replace('POSTGRES_PASSWORD=', "POSTGRES_PASSWORD=$exeLocalPassword")
  $exeLocalEnv = $exeLocalEnv.Replace('DATABASE_URL=', "DATABASE_URL=postgresql://exe_v1:${exeLocalPassword}@127.0.0.1:55432/exe_v1")
  Set-Content -LiteralPath '.env' -Value $exeLocalEnv -Encoding ascii
}
docker compose up -d --wait
docker compose ps
npm run db:check
npm run db:migrate
npm run dev
```

PostgreSQL nghe trên `127.0.0.1:55432`. API nghe trên `http://127.0.0.1:3100`. Dùng PowerShell thứ hai để kiểm tra.

```powershell
Invoke-RestMethod http://127.0.0.1:3100/health
Invoke-RestMethod http://127.0.0.1:3100/ready
```

Khi chưa có `AUTH_ISSUER`, hai health probes hoạt động và các route `/v1` trả `503 AUTH_UNAVAILABLE`. Để dùng dự án Supabase đã có, cấu hình `AUTH_ISSUER=https://<project-ref>.supabase.co/auth/v1` trong `.env`, bật khóa ký bất đối xứng ES256 hoặc RS256 của dự án và khởi động lại API. `AUTH_AUDIENCE` mặc định là `authenticated`. Client dùng access token của tài khoản đã đăng nhập qua Supabase Auth. Không cần API key hay service-role key trong backend này.

```powershell
# EXE_ACCESS_TOKEN chứa access token do Supabase cấp cho người dùng thử.
$exeHeaders = @{ Authorization = "Bearer $env:EXE_ACCESS_TOKEN" }
Invoke-RestMethod http://127.0.0.1:3100/v1/me -Headers $exeHeaders
$exeHeaders['Idempotency-Key'] = [guid]::NewGuid().ToString()
Invoke-RestMethod http://127.0.0.1:3100/v1/game-sessions -Method Post -Headers $exeHeaders -ContentType 'application/json' -Body '{"scenarioId":"b18"}'
```

Xem [hợp đồng API](../../docs/backend/API_CONTRACT_V1.md) để biết mã lỗi và hành vi khi gửi lại yêu cầu.

## Kiểm thử và migrations

Chạy từ `apps/api`. Suite integration cần PostgreSQL Compose đang healthy. Suite tạo một database trống có tên ngẫu nhiên và chỉ dọn database mà chính suite vừa tạo. Tài khoản local Compose có quyền tạo database.

```powershell
npm test
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

Sau khi build, `npm start` khởi động JavaScript đã biên dịch. Chạy một tiến trình API trên mỗi cổng. Để tạo migration sau khi sửa Drizzle schema, chạy `npm run db:generate`, rà soát SQL và metadata rồi chạy `npm run db:migrate`. Lệnh migrate giới hạn ở database phát triển `exe_v1` trên `127.0.0.1`.

## Dừng hoặc khởi tạo lại môi trường phát triển

Dừng API bằng Ctrl+C. `docker compose stop` dừng PostgreSQL và giữ volume. `docker compose up -d --wait` dùng lại dữ liệu.

Để chạy thử migration trên database trống, ưu tiên `npm run test:integration`. Nếu cần một database phát triển trống lâu dài, dùng project Compose mới để giữ volume cũ.

```powershell
docker compose stop
docker compose -p exe-backend-v1-fresh up -d --wait
npm run db:migrate
```

Dừng project mới bằng `docker compose -p exe-backend-v1-fresh stop`, rồi dùng `docker compose up -d --wait` để quay lại database gốc. Mỗi tên project tạo volume riêng ở lần chạy đầu. Dùng tên mới nếu đã từng khởi tạo project `exe-backend-v1-fresh`.

## Xử lý sự cố

| Hiện tượng | Kiểm tra |
| --- | --- |
| Không kết nối được Docker Engine | Mở Docker Desktop và chờ `docker version` báo phần Server. |
| Tải image Docker Hub lỗi CDN | Thử lại `docker pull postgres:17-bookworm`. Nếu CDN vẫn lỗi, có thể tải qua `mirror.gcr.io/library/postgres:17-bookworm`, đối chiếu digest bằng `docker buildx imagetools inspect postgres:17-bookworm`, rồi tag image đã xác minh thành `postgres:17-bookworm`. |
| Cổng 55432 hoặc 3100 đã được dùng | Đổi `POSTGRES_PORT` cùng cổng trong `DATABASE_URL`, hoặc đổi `API_PORT`. |
| `db:check` thất bại | Kiểm tra `docker compose ps`, cổng và mật khẩu trong `.env`. Volume đã khởi tạo giữ mật khẩu cũ của PostgreSQL. |
| `/ready` trả 503 | Kiểm tra container và `npm run db:check`. |
| Route V1 trả 401 | Kiểm tra issuer, audience, thời hạn và khóa ký của access token. |
| Route V1 trả 503 về auth | Kiểm tra `AUTH_ISSUER` và khả năng truy cập JWKS của Supabase. |

[Kiến trúc V1](../../docs/backend/ARCHITECTURE_V1.md) · [Cơ sở dữ liệu V1](../../docs/backend/DATABASE_V1.md)
