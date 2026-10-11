# MVP UX audit và sửa lỗi giao dịch

Nhánh: `fix/mvp-transaction-ux` · Baseline: `51843df` · 11/10/2026.

## Phát hiện và xử lý

| Mức | Vấn đề / nguyên nhân | Kết quả |
|---|---|---|
| P0 | Mua cổ phiếu chỉ cập nhật danh mục; `decide(skip)` mới kết thúc sự kiện. Người đã mua vẫn phải “Bỏ qua”. | Mua và kết thúc sự kiện trong một transition atomic; hiện thành công, trả về bàn và mở gieo tiếp. |
| P1 | Biểu đồ và giải thích dài đứng trước ô tiền/nút mua. | Đưa mã/ngành, giá, biến động gần nhất, nắm giữ, tiền mua và số dư lên trước; thông tin dài mở theo nhu cầu. |
| P1 | Nhập số không phân cách; lý do vô hiệu hóa thiếu rõ ràng. | Nhập VND có dấu chấm, giữ số nguyên chính xác; bàn phím numeric; báo lỗi số tiền, thiếu tiền, đã học, chưa mở/max nâng cấp. |
| P1 | Sau giao dịch nhiều lần vẫn ghi “Bỏ qua”, thiếu phản hồi. | Hiện giao dịch thành công; đổi nhãn tiếp tục thành “Hoàn tất · Về bàn chơi”. |
| P1 | Kinh doanh mô tả hoàn vốn đơn giản, dễ nhầm dòng tiền với lợi nhuận. | Tách thu nhập START theo hiện trạng, giá bán, vốn đã chi, số kỳ còn lại, chi phí/mức tăng nâng cấp; cảnh báo lỗ vốn và thanh khoản. |
| P1 | START chứa biểu đồ dài; thao tác huy động cần cuộn nhiều. | Thu gọn thông tin tài sản; footer hành động bám đáy panel, cuộn được; giữ quyết định bắt buộc không đóng bằng Escape. |
| P2 | Artwork thay thế, hoạt ảnh mới, redesign lớn. | Chỉ ghi nhận, không triển khai. Giữ bàn SVG 2.5D và nhận diện hiện có. |

## Thay đổi hành vi có chủ đích

UI mua **một mã cổ phiếu một lần cho mỗi lần dừng ô**, qua `transact({kind:'buy', asset:'stocks', completeEncounter:true, ...})`. Validation và toàn bộ tính tiền/đơn vị dùng đường giao dịch cũ. Sau khi mua hợp lệ mới chuyển `event → rolling`, xóa `eventId`, ghi **một** record `buy-stocks-complete`; không gọi thêm `decide`, không ghi Skip và không draw RNG.

Khóa submit bằng ref, cộng guard state identity có sẵn trong App, chặn double-tap. Gọi lại với state đã hoàn tất bị engine từ chối. Bỏ qua không mua vẫn là lựa chọn riêng. Lệnh không có flag giữ hành vi lịch sử. Replay schema 5 nhận record mới; thống kê mua cộng cả hai dạng. Không đổi schema/profile, config kinh tế, START, công thức, điều kiện thắng hoặc nội dung JSON cũ.

Ngân hàng, vàng, trái phiếu và kinh doanh **không** bị áp giới hạn một giao dịch. Nhãn “Hoàn tất” của những luồng này vẫn dùng decision cũ để giữ replay.

## Audit hành trình

| Hành trình | Kiểm tra / cải thiện |
|---|---|
| Phân bổ ban đầu | Tổng 50 triệu; slider, kỳ hạn/lãi/đáo hạn và Start giữ nguyên; 4 vòng C20 là mode chính. |
| Ngân hàng | Nhiều khoản độc lập; xem danh sách trong mục mở rộng, cảnh báo vượt màn và mất lãi rút sớm. |
| Cổ phiếu | Đủ 6 mã; phí mua/bán, rủi ro trước xác nhận; nhãn biến động lấy mốc giá gần nhất, biểu đồ ghi so với điểm đầu. |
| Trái phiếu / vàng | Giá, coupon/kỳ hạn hoặc spread/phí trước quyết định; thông tin lịch và rủi ro chi tiết mở rộng; vẫn mua nhiều lần. |
| Kinh doanh | Giữ mua/bán/nâng cấp và forecast; khóa nâng cấp ngay sau mua; mở ở lần gặp sau, cho nâng nhiều tầng hợp lệ. |
| Khóa học | Phí, mức tăng lương, START kế tiếp; giải thích đã mua hoặc thiếu tiền; vẫn có bỏ qua. |
| Sinh hoạt / biến cố / hoãn | Phân biệt khoản bắt buộc với cơ hội tự nguyện; tiền trả ngay và nghĩa vụ START giữ nguyên. |
| Huy động / rút / vay | Nguồn tự chọn, phối hợp nhiều nguồn, rút toàn khoản, lãi mất, báo giá ròng/phí, giới hạn vay; không bán khẩn cấp kinh doanh. |
| START / kết quả | Giữ thứ tự và quyền bán vòng cuối, trả nợ; kết quả dùng lawful proceeds sau phí/nợ, loại vốn kinh doanh chưa bán. |

Các số preview mới nằm ở selectors đọc-only và tái dùng công thức engine; component không tạo công thức lợi nhuận mới.

## Files chính

- Engine giới hạn: `src/game/{types,transactions,selectors,log}.ts`; replay: `scripts/diagnostics/replay-game-log.ts`.
- UI: `TradingPanel`, `MarketDetails`, `GameDialogs`, `Forecast`, `FundingDialog`, `RebalanceDialog`, `Modal`, `Board`; thêm `MoneyInput`, helper `src/ui/money-input.ts`, CSS trong `mobile.css`. App đã có guard chống callback cũ, không cần sửa.
- Kiểm chứng: `tests/transaction-ux.test.ts`, harness dev và hai script `verify-mobile-ui.mjs`, `verify-transaction-inputs.mjs`.

## Kiểm chứng

- **114/114 product tests**, **19/19 diagnostics tests**; ESLint, TypeScript app/harness và production build pass. Tests mới kiểm sáu mã, số tiền lỗi, state bất biến, gọi lặp, replay, preview nâng cấp và số nguyên VND.
- Chrome **320/390/430/1440px**: không tràn ngang, panel trong viewport, nút mua cổ phiếu thấy ngay; double click chỉ trừ một lần; mua tự đóng và Skip không mua giữ nguyên tiền. Có kiểm mua nhiều lần ngân hàng/vàng/trái phiếu, mua–nâng cấp nhiều tầng–bán kinh doanh, khóa học, nghĩa vụ, vay phối hợp bán, rút tiết kiệm, bán tại START và trả nợ.
- Ván thật seed `XVTL-V2-6`: **4 START, 26 lượt, đủ 6 mặt**, hai lần mua cổ phiếu atomic; huy động hợp lệ **103.921.205 ₫**. Download/replay khớp toàn bộ state; đường xúc xắc/RNG/vị trí khớp ván lịch sử cùng seed. JSON V2.1 original/A/B và V2.2 cũ replay được.
- Input: giữ đúng **1.234.567 đồng**, sửa giữa số, chặn paste sai; viewport **320×460** mô phỏng phần bị bàn phím chiếm vẫn nhập/cuộn/xác nhận được. Xác nhận hai khoản ngân hàng kỳ hạn 1 và 3 độc lập, các lựa chọn hoãn vẫn tiếp tục được.
- [Evidence browser](playtests/transaction-ux/verification.json), [input](playtests/transaction-ux/input-verification.json), [log đầy đủ nén gzip](playtests/transaction-ux/browser-game-log.json.gz), [audit nguồn](playtests/transaction-ux/source-audit.json): 12/16 file engine/data nguyên vẹn; bốn file còn lại chỉ có thay đổi flow/types/log/selectors nêu trên.
- Verifier artifact cũ `verify-v2_2-mechanics.ts` vẫn dừng ở checksum `GameDialogs.tsx` trong manifest lịch sử (đã lỗi từ baseline UI trước). Giữ nguyên manifest; không coi verifier này là pass. 19 diagnostics hành vi riêng đều pass.

Ảnh trước/sau: [320 trước](playtests/transaction-ux/320-stocks-before.png) → [sau](playtests/transaction-ux/320-stocks-after.png); [390 trước](playtests/transaction-ux/390-stocks-before.png) → [sau](playtests/transaction-ux/390-stocks-after.png); [430 sau](playtests/transaction-ux/430-stocks-after.png); [desktop sau](playtests/transaction-ux/1440-stocks-after.png). [Thành công](playtests/transaction-ux/320-stocks-success.png), [không gian bàn phím](playtests/transaction-ux/320-keyboard-space.png), [nhiều khoản gửi](playtests/transaction-ux/390-bank-multiple-lots.png).

## Còn lại

Chưa kiểm bàn phím trên iOS/Android thật. Panel kinh doanh/quyết toán dài vẫn cần cuộn vì giữ đủ lựa chọn và giải thích. Nhãn bàn 320px còn nhỏ, có thẻ vị trí và thông tin khi chạm. Không thay artwork; ảnh đính kèm dùng tham chiếu UX, không tách lớp từ ảnh phẳng. Chưa có bộ artwork rời GD được phê duyệt. Không merge hoặc deploy.
