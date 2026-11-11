# EXE EG3-AI-07 · Hoàn thiện luồng What-if trong App DEV

**EG3-AI-07 PASS** trong phạm vi App DEV và mock HTTP. Bảy nhóm quyết định qua replay thực trong Chromium. Lỗi touch vào kết quả tại core 320px vẫn thuộc Owner/Phát review.

## Những lỗi đã sửa

- **Timeout làm mất đường gửi lại.** Chromium tái hiện nút phân tích bị vô hiệu sau timeout. Panel giờ giữ câu hỏi, catalog và form để thử lại tại chỗ. Nút **Hủy yêu cầu AI** và việc sửa câu hỏi đều hủy request đang chờ. Kết quả đến muộn không thể thay proposal của câu hỏi tiếp theo.
- **Câu hỏi mới dùng nhầm bối cảnh cũ.** Sửa proposal hoặc câu hỏi làm mất hiệu lực ý định cũ. Người chơi có thể mở lại toàn bộ lịch sử trong nhóm sau khi một bộ lọc không tìm thấy quyết định, hoặc chọn trực tiếp phương án đã được engine kiểm tra. Sau kết quả, **Hỏi câu khác trên ván gốc** mở ô trống và đưa focus về ô hỏi. **Đổi phương án trên ván gốc** mở catalog cho cùng nhóm. Cả hai dùng capture mới.
- **Câu gợi ý và đơn vị tiền.** Mock từng nhận chữ “tại” trong câu “mua cổ phiếu tại quyết định 10” thành mã `TAI`. Giờ mock hỏi mã và số tiền còn thiếu. Form nhận VND nguyên với dấu phân nhóm nhất quán, ví dụ `1.234.567`. Câu hỏi có cách hiểu tiền mơ hồ cần nhập lại. Câu chứa hai giao dịch cùng tài sản, kể cả tách bằng dấu phẩy, cần tách thành hai câu. Mock nhận diện được chuyên môn Business “không gian check-in”.
- **Comparison bị giữ lại bởi HTTP.** Panel công bố kết quả khi Worker đã replay và xác minh độc lập. Giải thích trong panel lấy từ dữ kiện đã xác minh và không còn phụ thuộc request `explain`. Panel hiển thị quyết định gốc cùng vòng/lượt, phương án thử, ba chỉ số, hướng khác nhau giữa các chỉ số và những follow-up người chơi đã xác nhận. Với Course, nếu khoản tăng lương thay đổi, panel nêu vòng và số tiền ghi nhận tại START. Phần **Cách đọc kết quả** giải thích các chỉ số và phạm vi tới cuối vòng 4.
- **Lỗi engine và vòng đời.** Capture thất bại giữ lý do trong panel và cho mở lại. Worker thử phương án được dọn khi kết quả bị chặn. Timeout Worker có thông báo riêng. Thay session hoặc snapshot cuối ván thu hồi quyền công bố của request đang chạy. Lỗi không tìm được phương án có hướng dẫn chọn lại, sửa tham số hoặc dùng catalog.
- **Chromium Android DEV.** Entry point mock qua loopback nhận Chromium Android để chạy hành trình ở 390px. Bản build production giữ điều kiện cũ.

## Phạm vi code

| Phần | Tệp |
|---|---|
| Điều phối, abort và lỗi Worker | `mobile_app/src/game/what-if-ai/in-game-controller.ts`, `decision-client.ts` |
| Câu hỏi và giải thích | `mobile_app/src/game/what-if-ai/natural-language.ts`, `grounded-explanation.ts` |
| Panel, form và entry DEV | `mobile_app/src/components/endgame-what-if/InGameAiEntry.tsx`, `FlexibleChoices.tsx`, `in-game-ai.css`, `mobile_app/src/dev/EndgameWhatIfDev.tsx` |
| Regression | `mobile_app/src/game/what-if-ai/in-game-controller.test.ts`, `native-worker.test.ts`, `natural-language.test.ts`, `grounded-explanation.test.ts` |

## Kiểm chứng

**291/291 regression PASS**, giữ đủ tên và kết quả PASS của 284 test baseline. Bảy test mới kiểm tra hủy khi sửa câu hỏi, thay session hoặc snapshot, retry capture, dữ kiện lương START, đơn vị tiền, câu chứa nhiều thay đổi và lỗi nhận chữ “tại” thành mã. Ca Worker deadline cũ kiểm tra thêm việc phân biệt timeout với hủy. TypeScript mobile/root, ESLint và production build trong bộ nhớ PASS. [Regression](playtests/whatif-endgame/2026-11-10/eg3-ai-07-01/regression-full-summary.json) · [TypeScript và ESLint](playtests/whatif-endgame/2026-11-10/eg3-ai-07-01/checks-final.json) · [Build](playtests/whatif-endgame/2026-11-10/eg3-ai-07-01/build-final.json)

**50/50 ca Chromium App DEV PASS**, gồm đủ 43 ca baseline và 7 ca mới. Desktop dùng pointer. Android 390px dùng touch qua nút core vào kết quả và trong panel trên fixture được kiểm tra. Ở 320px, harness dùng Enter qua các nút core rồi dùng touch trong panel. Các ca kiểm tra phân trang với chín quyết định Course, sửa proposal, hỏi tiếp, scroll, focus, double-click, timeout, hủy và phương án thủ công. Packed save và nội dung kết quả chính thức được so sánh trước và sau từng ca. Harness kiểm tra Worker đã đóng, delta khớp fixture replay độc lập, không có lỗi trang và không có request `explain`. [Kết quả Chromium](playtests/whatif-endgame/2026-11-10/eg3-ai-07-01/app-final-results.json) · [Ảnh Android 390px](playtests/whatif-endgame/2026-11-10/eg3-ai-07-01/player-mobile-390.png) · [Tái hiện timeout trước sửa](playtests/whatif-endgame/2026-11-10/eg3-ai-07-01/before-fix-results.json)

| Nhóm | Kết quả App DEV |
|---|---|
| Gold C1 | PASS. Xác nhận follow-up bỏ bán vàng. Cả ba chỉ số +104.006 VND trong fixture |
| Bank | PASS. Gửi tiết kiệm 3 START, hỏi lại kỳ hạn khi thiếu |
| Course | PASS. Học Basic, bỏ đúng Basic đã ghi nhận, phân trang và replay quyết định ở trang hai |
| Stocks | PASS. Mua CMG/FPT, bán một phần FPT, nhập số tiền có dấu nhóm, sửa câu hỏi và đổi phương án |
| Bonds | PASS. Chọn lot, bổ sung lot khi thiếu, giải thích khi continuation bị chặn do provenance |
| Business | PASS. Nâng cấp theo chuyên môn trong catalog |
| Advanced | PASS. Nhóm Advanced riêng qua form, chọn và xác nhận follow-up. Ca hỏi tự nhiên hiển thị khoản tăng lương theo vòng |

App DEV chạy bằng `node --experimental-strip-types scripts/what-if-ai-dev.ts`. Mở [App DEV](http://127.0.0.1:5196/?endgameWhatIf=1&whatIfAi=1). Bộ Chromium chạy lại bằng `node --experimental-strip-types docs/playtests/whatif-endgame/2026-11-10/eg3-ai-07-01/browser.mjs <tên-lượt-mới>`. Bộ regression chạy lại bằng `node docs/playtests/whatif-endgame/2026-11-10/eg3-ai-07-01/regression.mjs <tên-lượt-mới>`.

## Owner review và bước sau milestone

**`OWNER_APPROVAL_REQUIRED` · `FinancialTerm` ở 320px.** Tooltip trái phiếu có thể che CTA ở màn tổng kết ngay trước Rebalance. Bản vá core từ EG3-AI-06 vẫn chờ Owner/Phát review. Hành trình 320px trong harness vào màn kết quả qua Enter và kiểm tra touch trong panel riêng. Chạy lại pointer và touch với bản vá sau khi được duyệt. [Repro 320px](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-verified-repro.json) · [Diff đề xuất chưa áp dụng](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-tooltip-proposed-NOT-APPLIED.patch)

**Gemini `LIVE_NOT_RUN`.** DEV dùng bộ nhận diện tiếng Việt mock và fallback form. Mỗi phân tích chỉ thay một quyết định gốc, sau đó hỏi xác nhận từng follow-up. Chất lượng câu hỏi tự do và tích hợp provider live cần được đánh giá riêng khi có triển khai `interpret` đúng contract và phê duyệt. Bằng chứng hiện tại áp dụng cho App DEV, các fixture B18 được chạy và Chromium được kiểm tra.
