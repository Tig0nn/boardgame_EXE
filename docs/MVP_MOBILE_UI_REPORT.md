> **HISTORICAL** — Responsive mobile của root Web tại src/, không phải ứng dụng minh họa trong mobile_app/. Nguồn chuẩn hiện tại: [CURRENT_MVP.md](CURRENT_MVP.md). Các phương pháp, kết quả và nội dung gốc bên dưới được giữ nguyên; lệnh lịch sử không được thực thi lại trong audit này.

# Web MVP mobile — Xoay Vòng Tiến Lui V2.2

Ngày kiểm chứng: 11/10/2026. Nhánh: `feat/mvp-mobile-ui`.

## Thay đổi

- Audit: giữ React/TypeScript/Vite và toàn bộ `src/game/`, `src/data/`; tập trung sửa Setup, Board, Modal, cách hiển thị kết quả và CSS. Không thêm dependency sản phẩm.
- Setup chỉ hiển thị Experimental B: 4 vòng, C20, vốn 50 triệu, mục tiêu huy động hợp lệ 90 triệu. Nút bắt đầu hiện ngay; phân bổ vốn, kỳ hạn và seed nằm trong mục tùy chỉnh. Các mode cũ vẫn có trong engine và kiểm thử.
- Bàn hình thoi 2.5D bằng SVG: đúng 20 ô riêng theo `boardFor(game)`, đúng nhóm màu và thứ tự, gồm ô 14 Kinh doanh. Token nón lá đi theo vị trí thật. Có thể chạm ô hoặc dùng bàn phím để đọc tên đầy đủ.
- Một xúc xắc sáu mặt lấy kết quả từ engine; chưa gieo hiển thị dấu hỏi. Nút gieo nằm dưới bàn, không phủ ô chơi. Giữ khóa chống gieo liên tiếp trong thời gian animation.
- Tiền mặt, huy động hợp lệ, mục tiêu và vòng thực hiển thị rõ. Tài sản, nhật ký, dự báo và luật vẫn truy cập được.
- Panel tài chính cuộn trong viewport và thành bottom sheet trên mobile. Tăng cỡ chữ, vùng chạm và input; panel mở từ tiêu đề. Kết quả ưu tiên huy động hợp lệ từ selector, vẫn hiển thị tài sản ròng, tiền mặt và chi tiết hiện có.
- Không sửa kinh tế, lãi suất, RNG, dữ liệu bàn, đáo hạn, nợ, hạn chế kinh doanh hay điều kiện thắng. Không thêm công thức tài chính cho board hoặc status; dùng state và selector hiện có. Không merge hoặc deploy.

## Kiểm chứng

- `npm test`: **109/109 pass**; bao gồm mode cũ và replay lịch sử.
- `node --experimental-strip-types --test scripts/diagnostics/*.test.ts`: **19/19 pass**.
- Verifier artifact lịch sử `scripts/diagnostics/verify-v2_2-mechanics.ts` dừng ở checksum UI cũ (`GameDialogs.tsx`). Manifest này còn khác một số file engine đã có từ trước task V2.2, nên không đại diện cho baseline hiện tại. Giữ nguyên manifest. Audit riêng đối chiếu hash nội dung toàn bộ engine/data với commit bắt đầu task `12da166`, xác nhận không thay đổi: [audit nguồn](playtests/mobile-mvp/protected-source-audit.json). Đây là giới hạn của verifier artifact cũ, không phải lỗi trong 19 diagnostics hành vi.
- ESLint, TypeScript và Vite production build: pass. Harness cũng được typecheck riêng.
- Chrome browser ở **320, 390, 430 và 1440px**: Setup, bàn, portfolio, luật, nhật ký, dự báo, thao tác bàn phím. Không tràn ngang; panel nằm trong viewport.
- Tại **320, 390 và 1440px**: gửi tiết kiệm, mua cổ phiếu/trái phiếu/vàng, mua–nâng cấp–bán kinh doanh, kết hợp vay và bán tài sản, rút toàn khoản tiết kiệm, bán ba tài sản tại START, trả nợ, quyết toán và kết quả. Có kiểm tra số tiền không hợp lệ, khóa nâng cấp ngay sau mua, và không đóng được quyết định bắt buộc bằng Escape.
- Ván thật trên UI: seed `XVTL-V2-6`, Experimental B, **26 lượt gieo, 4 lần quyết toán**, đủ cả sáu mặt xúc xắc; thử click lặp trong animation không phát sinh lượt thứ hai. Gửi ban đầu 30 triệu kỳ hạn 3, thêm ba khoản gửi qua các vòng.
- Kết quả: **102.800.000 ₫ huy động hợp lệ**, còn 22.800.000 ₫ sau mua giả định. Download JSON thành công, replay toàn bộ snapshot khớp engine và state của ván V2.2 trước đó.
- **64 screenshot**, không lỗi console/runtime trong lần kiểm cuối. [Evidence JSON](playtests/mobile-mvp/verification.json), [log browser nén gzip](playtests/mobile-mvp/browser-game-log.json.gz), [script tái kiểm](../scripts/verify-mobile-ui.mjs).

Ảnh đại diện: [Setup 320px](playtests/mobile-mvp/320-setup.png), [bàn 320px](playtests/mobile-mvp/320-board.png), [bàn 390px](playtests/mobile-mvp/390-board.png), [desktop](playtests/mobile-mvp/1440-board.png), [huy động tiền](playtests/mobile-mvp/320-funding-sources.png), [kết quả](playtests/mobile-mvp/320-result.png).

## Giới hạn hình ảnh và artwork còn thiếu

- Chưa có bộ artwork GD rời được phê duyệt trong repo, và không thấy ảnh concept đính kèm trong phiên này. `src/assets/hero.png` là hình mẫu kỹ thuật, không phải artwork bàn chơi. Bản MVP dùng SVG thành phố có sẵn cùng tile/token dựng bằng code; không tách tự động từ ảnh phẳng hay dùng số liệu giả trong ảnh.
- Chưa tái hiện pixel-perfect concept. Nhãn trên bàn vẫn nhỏ ở 320px; tên đầy đủ hiện khi chạm ô và ở thẻ vị trí hiện tại. Màn hình ngắn có thể cần cuộn để đến nút gieo, nhưng nút không che bàn.
- Để nâng cấp đồ họa cần: cảnh phố Việt Nam tách nền, nhân vật nền trong suốt, bộ icon ô đồng nhất và các chi tiết trang trí riêng ở SVG/PNG/WebP có quyền sử dụng rõ ràng. Không bắt buộc artwork xúc xắc vì sáu mặt đã dựng bằng CSS.
- Kiểm chứng bằng Chrome với viewport mô phỏng; chưa thử trên thiết bị iOS/Android thật. Ván vẫn lưu trong bộ nhớ trang theo kiến trúc hiện tại.
