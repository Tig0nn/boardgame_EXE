# Phase 3A · Mobile và PostgreSQL

Mobile dùng `OnlineApp` khi build với `VITE_EXE_ONLINE=1`. Luồng đăng nhập dùng Supabase Auth SDK và publishable key. Trình duyệt chuyển access token qua Authorization header cùng origin. Fastify xác minh chữ ký JWT, issuer, audience, role và ownership. Cấu hình hosting sau này cần chuyển `/v1` tới backend. Vite proxy dùng cổng API local 3108.

## Luồng online

- Màn hình ván chơi đọc danh sách theo owner. New Game chuyển tới Game Setup hiện có và gửi số tiền cùng kỳ hạn đang hiển thị. Continue và xem kết quả tải lại session theo ID. PostgreSQL giữ state và kết quả.
- Bàn cờ, dice, HUD, hộp thoại và mascot dùng thành phần Mobile. Phase, kết quả gieo, menu thao tác, tài chính, trạng thái START và kết quả chính thức đọc từ API. Animation, âm thanh, mục ví đang xem và lựa chọn form là state giao diện.
- Advance, roll, event, funding và giao dịch dùng một bộ điều phối action. Mỗi thao tác mang expected version và UUID. Lỗi mạng giữ lại cùng request trong bộ nhớ để thử lại. Với 409, tải lại state và để người chơi chọn lại. Nạp lại trang đọc danh sách và bản đã commit trong PostgreSQL.
- Gold, Stocks, Bonds, Bank, Business và giao dịch START lấy báo giá trước khi xác nhận. Funding dùng Bank quote cho vay và rút tiết kiệm. Các nguồn Funding tài sản dùng lệnh canonical trực tiếp. Form chỉ cập nhật tài chính từ response.
- API bổ sung metadata bàn, tên/mô tả event và nhật ký công khai theo danh sách trường. Trình duyệt dùng các facts này cho Ví, Mascot Learning Coach và offline Q&A. Seed, RNG, con trỏ quyết toán, replay envelope và snapshot đầy đủ chỉ ở server.
- Journey Code thuộc chế độ local. Tệp nhật ký cũ được kiểm tra schema và mở xem local từ màn hình setup online. Nội dung file không được nhập vào session server hay dùng làm kết quả chính thức. Chế độ local tiếp tục có What-if hiện tại. What-if cho ván online cần một luồng replay được nghiệm thu riêng.

## Chạy Windows

Trong `apps/api`, dùng `.env.example` và [README](../../apps/api/README.md) để khởi động Compose và API. PostgreSQL local dùng 55440. API local dùng [3108](http://127.0.0.1:3108). Trong `mobile_app`, chạy `npm ci`, thiết lập `VITE_EXE_ONLINE=1`, rồi `npm run dev` để mở [5174](http://127.0.0.1:5174). Cần URL và publishable key Supabase staging cùng issuer backend để đăng nhập thật. Các giá trị local trong test đến từ JWT/JWKS issuer tạm thời, được cấp qua entry chỉ tạo trong test.

```powershell
# Chạy trong apps/api với PostgreSQL local đã migrate và Playwright đã cài
$env:EXE_PLAYWRIGHT_MODULE = '<đường dẫn tuyệt đối đến package playwright>'
# Có thể đặt EXE_CHROMIUM_PATH nếu dùng binary Chromium đã cài sẵn.
node --env-file=.env --experimental-strip-types --test tests/phase3a-browser.integration.ts
```

Browser test dùng Chromium và Fastify thật. Nó tạo ván qua UI ở 320, 390 và 1440 px, mô phỏng mất response ngay sau khi server commit, sau đó kiểm tra retry, hai tab, refresh và replay. Hosted staging và Supabase Auth thật cần được nghiệm thu riêng.

[Supabase Auth SDK](https://supabase.com/docs/reference/javascript/auth) · [REST API](./API_CONTRACT_V1.md)
