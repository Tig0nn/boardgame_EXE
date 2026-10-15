> **CURRENT** — Polish UI ngày 15/10/2026; [CURRENT_MVP](CURRENT_MVP.md). Không thay gameplay.

# Bàn giao Business Customer Preferences UX

Base `820459d`; nhánh [codex/business-preference-ux-final](https://github.com/Tig0nn/boardgame_EXE/tree/codex/business-preference-ux-final). Commit code: **`4bf8718f62107f5a13311f65237364562573ed99`**; SHA commit báo cáo/evidence nằm trong final handoff.

Đã thêm thẻ thị hiếu nhỏ, màu riêng cho quán, trong Bản tin đầu vòng và trước khi mở quán. Cả ba vị trí dùng chung `currentCustomerPreference(game)`, không random hoặc lấy vòng sau. Quán đã mở giữ hướng nâng cấp, đánh dấu “Phù hợp vòng này”, thu nhập và incremental income lấy selector cũ; copy nói rõ thưởng có thể đổi ở vòng sau. Sổ tay dùng GameState đã có, thêm mục thu gọn “Thị hiếu vòng hiện tại”, hiển thị tầng theo từng hướng khi sở hữu quán. Không thêm màn/tab/nút HUD; tutorial vẫn sáu bước. Phiên lịch sử không có Customer Preferences không bị gán thị hiếu mới.

Source thay đổi:

- [CustomerPreferenceCard.tsx](../src/components/CustomerPreferenceCard.tsx), [CustomerPreference.css](../src/components/CustomerPreference.css): thẻ trình bày dùng chung.
- [BusinessPanel.tsx](../src/components/BusinessPanel.tsx): thấy thị hiếu trước mua, giữ controls và preview.
- [MarketNews.tsx](../mobile_app/src/components/MarketNews.tsx): chèn thẻ riêng; không sửa News calculations.
- [Tutorial.tsx](../mobile_app/src/components/Tutorial.tsx), [engine-ui.css](../mobile_app/src/engine-ui.css): mục Sổ tay và style gọn.
- [integration-harness.tsx](../mobile_app/src/integration-harness.tsx): fixture DEV để smoke ba trạng thái; không vào production entry.
- [business-preference-ui.test.ts](../scripts/diagnostics/business-preference-ui.test.ts): năm checks tập trung qua SSR thật.

**Kết quả:** 304/304 product tests; 62/62 diagnostics; lint, Mobile build và Web build PASS. Test riêng xác nhận ba thị hiếu đọc từ saved state, cập nhật qua vòng 2, render không mutate state/RNG, payout Business sau một tầng khớp vẫn **4.700.000 ₫** và START giống control. Hai saved replay (Periodic V2.6 và Business V2.4 lịch sử) vẫn full-state exact. Git diff xác nhận toàn bộ `src/game`, `src/data`, Mobile selectors/calculations, AI, source artwork, dependency/config và nghiên cứu cũ **không đổi**. Không chạy lại study 12.000/18.000/180.000 ván hay audit tài liệu đầy đủ.

Smoke 390×844 và 320×640 dùng **fixture DEV**, không tuyên bố ván full game mới. Mở quán chạm đôi chỉ trừ20M một lần; chọn khác thị hiếu preview700.000 ₫, chọn khớp1.700.000 ₫; nâng chạm đôi chỉ trừ5M/tăng một tầng, lần nâng tiếp bị khóa; Sổ tay ghi đúng một tầng và đóng lại giữ state. Không tràn ngang, nội dung dài cuộn trong modal, console error/warn=0. [Metadata kiểm chứng](playtests/business-preference-ux-final/verification.json) ghi đo layout/thao tác và bốn kích thước JPEG đã kiểm.

Ảnh chính:

- [Bản tin 390px](playtests/business-preference-ux-final/390-bulletin.jpg).
- [Chưa mở quán 390px](playtests/business-preference-ux-final/390-unopened-shop.jpg).
- [Sau nâng cấp 320px](playtests/business-preference-ux-final/320-upgraded-shop.jpg).
- [Sổ tay 320px](playtests/business-preference-ux-final/320-rulebook.jpg).

Không còn blocker của polish này. Giới hạn cân bằng/artwork của candidate V2.6 trước đó vẫn giữ nguyên, không xử lý trong task. Chưa xác minh điện thoại thật hoặc Actions HEAD; CI lịch sử **186 product tests + 21 diagnostics** không phải kết quả nhánh này. Không merge, force-push, chạy deploy hoặc sửa Vercel. Sẵn sàng bàn giao sang **Core Game Freeze & Final QA** theo yêu cầu tiếp theo; không tự mở thêm gameplay feature.
