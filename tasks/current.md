> **CURRENT** — Roadmap MVP V2.4 và candidate Mobile; cập nhật 15/10/2026. Nguồn trạng thái sản phẩm: [CURRENT_MVP.md](../docs/CURRENT_MVP.md).

# Việc đang hoạt động — Mobile V2.4 và PR #8

## Bond Credit V2.5 — experimental candidate 15/10/2026

- [x] Phase0 đặc tả/prototype commit trước engine; hai issuer, RNG riêng, payment claims/loss/recovery, lot-specific sales/funding, terminal executable quotes.
- [x] Mobile cards/portfolio/news/START/tutorial/Sổ tay và AI evidence có giới hạn; financial core ngoài Bond giữ nguyên. Historical replay exact.
- [x] 12.000 ván/sáu chiến thuật; năm ván browser đủ bốn vòng, cả default80%/50%, delay, sale, win/loss; 254 tests/44 diagnostics và clean installs/builds. [Báo cáo](../docs/BOND_V2_5_IMPLEMENTATION_REPORT.md).
- [ ] Owner duyệt coupon4,5%/10%, xác suất, recovery và quyền thanh khoản; chưa phát hành/merge/deploy. Bank-first dẫn đầu benchmark, không kết luận cân bằng cuối.

## Atomic Investment Encounters — 15/10/2026

- [x] Policy mới `v2.4-atomic-investments`: engine chặn mua Stocks/Gold/Bonds lần hai cùng turn, tự hoàn tất sau lần mua hợp lệ; skip/invalid/later visit đúng hành vi.
- [x] Phiên cũ giữ policy cũ; fixture Gold/Bonds multi-purchase tạo từ baseline trước sửa và log V2.3/V2.4 replay exact. Không thay công thức, Bank/Business/START hoặc Economic News.
- [x] 224 product tests, 39 diagnostics, lint, Web/Mobile builds; browser 320/390/430, 36 ảnh, ván thật 4 vòng/23 rolls export/replay PASS. [Báo cáo](../docs/ATOMIC_INVESTMENT_ENCOUNTERS_REPORT.md).
- [ ] Owner review nhánh `codex/atomic-investment-encounters`; chưa merge/deploy hoặc xác minh Actions/thiết bị vật lý.

## Economic News V1 — 15/10/2026

- [x] Bản tin đầu vòng, Dự báo vs. Thực tế tại START, context mở rộng theo tài sản/mã cổ phiếu; không đưa Business vào bảng thị trường.
- [x] Selector đọc snapshot/history, giữ dự báo gốc, không đếm lại cú sốc hoặc lộ tương lai; fallback khi thiếu dữ liệu.
- [x] 203 product tests, 34 diagnostics, lint và cả hai build PASS; browser 320/390/430, log ván thật bốn vòng replay đầy đủ. [Báo cáo](../docs/ECONOMIC_NEWS_V1_REPORT.md).
- [ ] Owner review `codex/economic-news-v1`; chưa merge/deploy, chưa xác minh CI mới hoặc thiết bị vật lý.

## Candidate UI tổng hợp — 14/10/2026

- [x] `codex/mobile-ui-final` từ `13faa21`: tutorial sáu bước, safe marker/overlay, preset/thẻ kỳ hạn, grouping và result progress; không nhận toàn bộ `277d2dc`.
- [x] Clean installs, 189 product tests, 29 diagnostics, lint và hai build local PASS. [Báo cáo UI final](../docs/MOBILE_UI_FINAL_REPORT.md) ghi ảnh, replay, model native load và các kiểm tra browser.
- [ ] Owner review candidate và quyết định nhập vào nhánh tích hợp/main. Task này không tự merge/deploy; bằng chứng local không đóng các mục online/thiết bị/provider bên dưới.

Đây là roadmap hiện tại; [plan V2.2](plan.md) và [todo V2.2](todo.md) chỉ là lịch sử hoàn tất. Không chạy lại các nghiên cứu đó hoặc chỉnh luật để khớp kết quả cũ.

## Các mốc đã có bằng chứng

- [x] Mobile dùng engine root V2.4, catalog có version, crypto seed và deterministic replay; giữ artwork/character/dice/audio.
- [x] Sửa lỗi hai React của build Mobile và import ESM của Function; có regression diagnostics.
- [x] CI tại `13c9c7c`: 186 product tests, 21 diagnostics, lint và hai build qua; [run](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38421516083).
- [x] Có [Mobile URL riêng](https://boardgame-exe-mobile-preview.vercel.app), deployment Ready được gắn Production trong project Mobile; Web project gốc vẫn riêng.
- [x] User nhìn thấy setup, illustrated board, HUD, nhân vật 3D và dice; GET `/api/ai-coach` trả 405 JSON. Mức này là smoke check, không thay full online game.

## Việc cần làm và điều kiện xác nhận xong

| Việc | Điều kiện hoàn tất cần lưu | Trạng thái |
| --- | --- | --- |
| Full online Mobile gameplay | Ván thật từ setup đủ 4 START tới Result; funding/START khi gặp, export JSON, replay/parity và restart; ghi URL, commit/deployment, browser, seed và lỗi | Chưa xác minh |
| Android/iOS thật | Ít nhất thiết bị Android và iPhone/Safari; touch, bàn phím, WebGL/model, audio unlock/mute, viewport và các modal; ghi thiết bị/browser/phiên bản | Chưa có bằng chứng |
| Sửa icon C20 Mobile | Nhà thiết kế sửa ảnh/layer đúng thứ tự C20: 4/6/11/14/15, xác nhận START và course 5/17; kiểm tra toàn 20 ô, không đổi board logic để chiều artwork | Chưa làm; xem [audit icon](../docs/MOBILE_V2_4_FINANCIAL_INTEGRATION_REPORT.md) |
| AI provider thật | Owner cấu hình key server đúng project/environment; gọi bằng facts một ván kết thúc, kiểm tra output/evidence, lỗi/retry và kết quả/restart không bị chặn; không lưu key | Chưa có phản hồi thật được xác nhận |
| Final PR review/merge decision | Review diff, CI của HEAD cuối, phạm vi testing/known limits được owner chấp nhận; quyết định rõ trên [PR #8](https://github.com/Tig0nn/boardgame_EXE/pull/8) | PR mở, chưa merge |

## Cách cập nhật

Mỗi bằng chứng mới ghi ngày, SHA/URL, thao tác thực hiện và giới hạn. GET 405 không đóng task AI; viewport desktop không đóng task điện thoại; deployment Ready không đóng task full game. Những việc liên quan production, rule/artwork changes hoặc merge cần phạm vi riêng được owner giao; audit tài liệu hiện tại không thực hiện chúng. Giữ [PR8 chronology](../docs/PR8_FINAL_REVIEW.md), không sửa lại log/bảng lịch sử thành kết quả mới.
