# Business V2.4 — Luồng mua và sở thích khách hàng

Nhánh `codex/business-v2-4-customer-preferences`, tạo từ `origin/main` mới nhất `661bcf6` (đã merge V2.3). Không merge hoặc deploy.

## Commit A — mua cơ sở kết thúc encounter

- Mua thành công 20M được ghi một transaction `buy-business`, đồng thời chuyển `rolling` và xóa `eventId`. Không gọi Skip, không thêm RNG, giữ giá thu hồi ban đầu 14M.
- Version encounter mới `v2.4-business-purchase-complete` giữ giới hạn Bank một khoản/nâng cấp một lần. Chặn bán/nâng cấp ở lượt vừa mua, kể cả gọi engine trực tiếp sau khi mở lại encounter hoặc tiếp tục JSON. Lượt Business sau vẫn nâng cấp rồi bán được.
- Board thông báo mua thành công và chuyển focus về nút gieo. UI trước mua không hiện nút bán/nâng cấp; submit lock và cập nhật state nguyên tử chặn double-tap.
- Không sửa luật `v2.3-single-action` hay fallback `legacy-multi-action`: các log mua rồi bán cùng encounter vẫn replay được. Mã transaction không đổi, version và snapshot xác định transition đúng khi replay.
- Các suite regression cũ dùng factory V2.3 tường minh qua `tests/helpers/v2_3.ts`; không đổi assertion để khớp hành vi mới. Diagnostic lịch sử vẫn chạy policy scenario V2.3. Tests mới dùng factory hiện tại.
- Kiểm chứng: **143/143 tests, 19/19 diagnostics hành vi**, ESLint, TypeScript app/harness, build pass. Chrome 320/390/430/1440px: double-tap trừ đúng 20M một lần, tự đóng panel, focus/nút gieo hoạt động; không lỗi console/tràn ngang. [Bằng chứng A](playtests/business-v2_4/purchase-flow/verification.json).

Phần sở thích khách hàng được triển khai trong commit tiếp theo, sau khi commit A hoàn tất.
