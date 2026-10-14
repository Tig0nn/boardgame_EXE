> **CURRENT** — Roadmap MVP V2.4 trên nhánh tích hợp; cập nhật 13/10/2026. Nguồn trạng thái sản phẩm: [CURRENT_MVP.md](../docs/CURRENT_MVP.md).

# Việc đang hoạt động — Mobile V2.4 và PR #8

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
