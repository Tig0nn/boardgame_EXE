# EXE Backend Phase 2C2 trên Windows

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
  $exeLocalEnv = $exeLocalEnv.Replace('DATABASE_URL=', "DATABASE_URL=postgresql://exe_v1:${exeLocalPassword}@127.0.0.1:55436/exe_v1")
  Set-Content -LiteralPath '.env' -Value $exeLocalEnv -Encoding ascii
}
docker compose up -d --wait
docker compose ps
npm run db:check
npm run db:migrate
npm run dev
```

Phase 2C2 dùng project Compose `exe-backend-v2c2` từ `.env.example`, với volume riêng cho worktree này. PostgreSQL nghe trên `127.0.0.1:55436`. API nghe trên `http://127.0.0.1:3104`. Dùng PowerShell thứ hai để kiểm tra.

```powershell
Invoke-RestMethod http://127.0.0.1:3104/health
Invoke-RestMethod http://127.0.0.1:3104/ready
```

Khi chưa có `AUTH_ISSUER`, hai health probes hoạt động và các route `/v1` trả `503 AUTH_UNAVAILABLE`. Để dùng dự án Supabase đã có, cấu hình `AUTH_ISSUER=https://<project-ref>.supabase.co/auth/v1` trong `.env`, bật khóa ký bất đối xứng ES256 hoặc RS256 của dự án và khởi động lại API. `AUTH_AUDIENCE` mặc định là `authenticated`. Client dùng access token của tài khoản đã đăng nhập qua Supabase Auth. Không cần API key hay service-role key trong backend này.

```powershell
# EXE_ACCESS_TOKEN chứa access token do Supabase cấp cho người dùng thử.
$exeHeaders = @{ Authorization = "Bearer $env:EXE_ACCESS_TOKEN" }
Invoke-RestMethod http://127.0.0.1:3104/v1/me -Headers $exeHeaders
$exeHeaders['Idempotency-Key'] = [guid]::NewGuid().ToString()
$exeSession = Invoke-RestMethod http://127.0.0.1:3104/v1/game-sessions -Method Post -Headers $exeHeaders -ContentType 'application/json' -Body '{"scenarioId":"b18"}'
$exeSessionId = $exeSession.session.id
$exeHeaders['Idempotency-Key'] = [guid]::NewGuid().ToString()
$exeAction = '{"actionId":"advance","payload":{},"expectedStateVersion":0}'
Invoke-RestMethod "http://127.0.0.1:3104/v1/game-sessions/$exeSessionId/actions" -Method Post -Headers $exeHeaders -ContentType 'application/json' -Body $exeAction
```

Khi action trả `409 STATE_VERSION_CONFLICT`, đọc lại state/version trước khi gửi lệnh mới. Lần gửi lại sau timeout cần giữ cùng idempotency key và body.

```powershell
$exeState = Invoke-RestMethod "http://127.0.0.1:3104/v1/game-sessions/$exeSessionId" -Headers $exeHeaders
$exeState.session.stateVersion
$exeState.state.availableActions
$exeState.state.fundingOptions
```

Khi `state.tradingAsset` là `gold`, có thể lấy quote và gửi lệnh mua:

```powershell
$exeBase = "http://127.0.0.1:3104/v1/game-sessions/$exeSessionId"
$exeTrade = @{ kind = 'buy'; asset = 'gold'; amount = 1000000 }
$exeQuoteBody = @{ expectedStateVersion = $exeState.session.stateVersion; payload = $exeTrade } | ConvertTo-Json
$exeQuote = Invoke-RestMethod "$exeBase/trade-quote" -Method Post -Headers $exeHeaders -ContentType 'application/json' -Body $exeQuoteBody
$exeHeaders['Idempotency-Key'] = [guid]::NewGuid().ToString()
$exeTradeBody = @{ actionId = 'trade'; expectedStateVersion = $exeQuote.stateVersion; payload = $exeTrade } | ConvertTo-Json
Invoke-RestMethod "$exeBase/actions" -Method Post -Headers $exeHeaders -ContentType 'application/json' -Body $exeTradeBody
```

Tại ô Bank, dùng `state.bank.canDeposit` để hiển thị gửi tiết kiệm. Lấy quote bằng `POST /v1/game-sessions/:id/bank-quote` với `{"actionId":"trade","expectedStateVersion":2,"payload":{"kind":"deposit","amount":1000000,"term":2}}`. Khi gửi sang `/actions`, lấy version từ quote và tạo `Idempotency-Key` mới. Cùng endpoint quote hỗ trợ trả nợ tại START, vay và rút sớm trong Funding.

Xem [hợp đồng API](../../docs/backend/API_CONTRACT_V1.md) để biết mã lỗi và hành vi khi gửi lại yêu cầu.

## Kiểm thử và migrations

Chạy từ `apps/api`. Suite integration cần PostgreSQL Compose đang healthy. Mỗi suite tạo database trống riêng có tên ngẫu nhiên và chỉ dọn database do chính suite tạo. Suite actions dùng JWT/JWKS test, gồm timeout và mất response qua HTTP thật. Tài khoản local Compose có quyền tạo database.

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
docker compose -p exe-backend-v2c2-fresh up -d --wait
npm run db:migrate
```

Dừng project mới bằng `docker compose -p exe-backend-v2c2-fresh stop`, rồi dùng `docker compose up -d --wait` để quay lại database gốc. Mỗi tên project tạo volume riêng ở lần chạy đầu. Dùng tên mới nếu đã từng khởi tạo project `exe-backend-v2c2-fresh`.

## Xử lý sự cố

| Hiện tượng | Kiểm tra |
| --- | --- |
| Không kết nối được Docker Engine | Mở Docker Desktop và chờ `docker version` báo phần Server. |
| Tải image Docker Hub lỗi CDN | Thử lại `docker pull postgres:17-bookworm`. Nếu CDN vẫn lỗi, có thể tải qua `mirror.gcr.io/library/postgres:17-bookworm`, đối chiếu digest bằng `docker buildx imagetools inspect postgres:17-bookworm`, rồi tag image đã xác minh thành `postgres:17-bookworm`. |
| Cổng 55436 hoặc 3104 đã được dùng | Đổi `POSTGRES_PORT` cùng cổng trong `DATABASE_URL`, hoặc đổi `API_PORT`. |
| `db:check` thất bại | Kiểm tra `docker compose ps`, cổng và mật khẩu trong `.env`. Volume đã khởi tạo giữ mật khẩu cũ của PostgreSQL. |
| `/ready` trả 503 | Kiểm tra container và `npm run db:check`. |
| Route V1 trả 401 | Kiểm tra issuer, audience, thời hạn và khóa ký của access token. |
| Route V1 trả 503 về auth | Kiểm tra `AUTH_ISSUER` và khả năng truy cập JWKS của Supabase. |

[Kiến trúc V1](../../docs/backend/ARCHITECTURE_V1.md) · [Cơ sở dữ liệu V1](../../docs/backend/DATABASE_V1.md)

[Thiết kế Phase 2C2](../../docs/backend/ACTIONS_V2C2.md)
