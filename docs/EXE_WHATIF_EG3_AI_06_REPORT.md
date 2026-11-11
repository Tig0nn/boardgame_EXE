# EXE EG3-AI-06 · What-if bằng câu hỏi tiếng Việt

**EG3-AI-06 PASS** trong phạm vi App DEV và mock HTTP. Lỗi touch và pointer ở màn tổng kết core 320px được ghi riêng, kèm diff đề xuất để Owner duyệt.

## Luồng đã triển khai

Người chơi nhập câu hỏi ở đầu panel. Provider mock nhận câu hỏi qua HTTP và trả ý định có kiểu dữ liệu giới hạn. App đối chiếu ý định với lịch sử ván đã xác minh, lọc theo quyết định, vòng, lượt, lần đầu hoặc cuối và giao dịch gốc nếu được chỉ rõ. Khi có nhiều kết quả, panel đưa focus về danh sách lịch sử để người chơi chọn. Khi thiếu dữ liệu, panel nêu từng tham số cần bổ sung và giữ ô tương ứng trống.

Phương án đủ thông tin được kiểm tra tại thời điểm lịch sử bằng native legality probe. Với câu hỏi tự nhiên, catalog gửi ở bước `propose` chỉ chứa phương án đã khớp và vượt qua probe. App và HTTP đều kiểm tra đúng cặp ID. Người chơi xác nhận phương án trước khi native Worker chạy, rồi xác nhận riêng từng follow-up. Kết quả cuối đi qua replay độc lập trước khi công bố số liệu. Panel hỗ trợ đổi phương án trên ván gốc, hủy Worker và loại phản hồi từ phiên cũ.

| Câu hỏi thử trong App | Hành vi |
|---|---|
| “Nếu mua FPT 7,25 triệu lần đầu thì sao?” | Khớp lần đầu, probe mã và ngân sách, đưa phương án ra xác nhận |
| “Bán FPT 1 triệu ở quyết định 51” | Kiểm tra lượng bán ở đúng lượt lịch sử |
| “Bán trái phiếu lot bond-2 750 nghìn ở quyết định 23” | Probe đúng lot và số tiền |
| “Gửi tiết kiệm 1 triệu kỳ hạn 3 START tại quyết định 36” | Dùng đúng số tiền và kỳ hạn đã nêu |
| “Nâng cấp cơ sở theo giá cả hợp lý tại quyết định 48” | Chọn đúng chuyên môn Business trong catalog |
| “Học khóa nâng cao lần đầu” | Thử Advanced và hỏi xác nhận bỏ lần học sau khi cần |
| “Học khóa cơ bản lần đầu” hoặc “Nếu bỏ học khóa cơ bản ở quyết định 37 thì sao?” | Khớp đúng Basic và trình bày rõ hành động học hoặc bỏ lần học |
| “Nếu tôi không mua vàng lần đầu thì sao?” | Giữ quy trình Gold C1 và follow-up bỏ lần bán |
| “Nếu tôi mua CMG 1.234.567 VND thì sao?” | Yêu cầu chọn lần giao dịch khi lịch sử có nhiều kết quả |
| “Mua CMG tại quyết định 10” | Yêu cầu nhập số tiền. Kỳ hạn và lot thiếu cũng được hỏi riêng |
| “Bỏ mua CMG tại quyết định 10” với lịch sử không có giao dịch mua CMG ở lượt đó | Báo không có quyết định khớp |
| “Gửi 1 triệu kỳ hạn 2 hoặc 3 START” hoặc “Gửi 1 triệu kỳ hạn 3 tháng” | Yêu cầu chọn một phương án hoặc giải thích đơn vị START |
| “Bỏ mua vàng và bỏ bán vàng” | Yêu cầu tách câu hỏi thành từng thay đổi |

## Giải thích và an toàn

Kết quả ghi quyết định gốc, phương án thay thế, ba chỉ số cuối ván và các follow-up đã được xác nhận. Với fixture mua CMG 1.234.567 VND, tài sản ròng tăng 2.321 VND, tiền mặt giảm 1.234.567 VND và tiền có thể thu về giảm 10.048 VND. Phần mô tả đọc trực tiếp ba dấu và giá trị từ kết quả engine. Khi continuation bị chặn, panel nêu lý do đã phân loại. Ví dụ, nếu lot trái phiếu không còn cùng nguồn mua gốc, UI báo lỗi provenance và ẩn bảng so sánh.

Schema từ chối ID do intake tự đặt, action ngoài tập cho phép, tham số sai kiểu và trường lạ. Thiếu tham số hoặc định dạng tiền có nhiều cách hiểu dẫn đến hỏi lại. Câu hỏi có nhiều thay đổi được xử lý từng fork độc lập theo lựa chọn của người chơi. Giới hạn request, timeout, exact membership, independent replay, cancellation và stale response được giữ trong luồng. Các ca App đối chiếu packed save và kết quả chính thức trước và sau khi chạy.

## Lỗi core 320px cần Owner duyệt nếu sửa

Dùng fixture Bonds, mở App DEV ở 320×844 và tiếp tục tới **Khép lại vòng 4** tại START4. Chạm “Lãi trái phiếu định kỳ” để mở tooltip, sau đó thử chạm hoặc click “Xem kết quả hành trình”. Tâm nút rơi vào popover của `FinancialTerm`. Cả touch và mouse bị chặn ở bước này. Chạm bên ngoài tooltip, rồi chạm lại CTA để vào Rebalance và chạm CTA lần nữa. Hai thao tác sau chạy được. Ở 1280×900, chuỗi click của cùng fixture chạy được. Lượt kiểm tra What-if riêng dùng Enter qua các nút core trên viewport 320px, sau đó dùng touch trong panel. Đây là hai kết quả kiểm tra riêng biệt.

Nguyên nhân tái hiện nằm ở màn tổng kết ngay trước Rebalance. Selector `.button` của tooltip bỏ sót nút trong `.gamified-modal-card`, nên phép đặt vị trí không chừa vùng CTA. Diff đề xuất bổ sung các nút GamifiedModal vào vùng cần tránh và loại trigger tooltip khỏi tập đó. `git apply --check` đã kiểm tra khả năng áp dụng. Phép tính với hình học lấy từ Chromium đặt tooltip ở y=444,4–577,4 px, nằm phía trên CTA y=686,6–740,6 px. Diff đang chờ Owner duyệt và mới được kiểm chứng bằng hình học, chưa chạy bản vá trên core App.

[Repro và hit test](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-verified-repro.json) · [Ảnh 320px](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-verified-320-step0.png) · [Exact proposed diff](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-tooltip-proposed-NOT-APPLIED.patch)

## Contract thay provider

| Operation | Request | Response được chấp nhận |
|---|---|---|
| `interpret` | Câu hỏi tối đa 240 ký tự, qua kiểm tra dữ liệu nhạy cảm | Một `NaturalIntent` với hành động và tham số tường minh, hoặc `ambiguous`, `unsupported`, `multiple-changes` |
| `propose` | Câu hỏi chuẩn hóa và catalog giới hạn các lựa chọn đã qua probe | Đúng cặp `decisionId` và `alternativeId` trong request, hoặc `ambiguous` / `unsupported` |
| `explain` | Loại tài sản, hướng thay đổi tiền mặt và cờ follow-up | `claimId` cho phép. App kết hợp claim với dữ kiện engine để hiển thị |

Provider thật cần triển khai `interpret` trên cùng `WhatIfProvider`, dùng schema và validator ở cả server lẫn client, tuân thủ deadline và kiểm chứng bằng responses giả trước khi thử live. Mọi quyền truy cập, secret và cấu hình môi trường thuộc phía server. `interpret` chỉ nhận câu hỏi. Lịch sử, packed save và dữ liệu tài chính dùng cho comparison nằm trong App và Worker. Gemini **LIVE_NOT_RUN**. Mock hiện hỗ trợ một tập cách diễn đạt tiếng Việt, các đơn vị tiền thông dụng và các mốc lịch sử hữu hạn. Với câu ngoài tập hỗ trợ hoặc lịch sử không thể replay an toàn, người chơi có thể chọn lại bằng form catalog.

## Chạy lại trong workspace

- App DEV có mock HTTP qua `node --experimental-strip-types scripts/what-if-ai-dev.ts`. Mở [App DEV](http://127.0.0.1:5196/?endgameWhatIf=1&whatIfAi=1) và vào kết quả của một ván phù hợp.
- Regression qua `node docs/playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/regression.mjs <tên-lượt-mới>`. Runner so tên test với baseline 275 ca.
- Chromium App qua `node --experimental-strip-types docs/playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/browser.mjs <tên-lượt-mới>`. Harness dùng Chromium và Playwright cục bộ của workspace.
- Lỗi core qua `node --experimental-strip-types docs/playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-repro.mjs <tên-lượt-mới>`. Dùng fixture được chuẩn bị bởi harness App.

## Kiểm chứng

Regression **284/284 PASS**, giữ đủ 275 ca baseline và thêm 9 ca cho nhận diện tiếng Việt, khớp lịch sử, định dạng mơ hồ, nhãn bỏ giao dịch, giải thích và schema HTTP. TypeScript mobile/root, ESLint theo phạm vi và production build trong bộ nhớ đều PASS. [Regression](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/regression-release-check-summary.json) · [TypeScript và ESLint](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/checks-release-check.json) · [Build](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/build-release-check.json)

Chromium **43/43 PASS** cho App DEV trên desktop và viewport 320px. Bộ kiểm tra bao gồm 14 ca App cũ, câu hỏi tiếng Việt đủ và thiếu tham số, Basic và Advanced, Gold, ca continuation bị chặn do provenance, schema sai, provider trả phương án hợp lệ khác với yêu cầu, touch trong panel, Tab/Enter/Escape, trả focus, overflow và đóng/mở lại khi request còn chạy. Gold C1 vẫn cho delta +104.006 VND trên cả ba chỉ số ở fixture. Các ca đối chiếu packed save và nội dung kết quả chính thức sau khi đóng panel. [Kết quả Chromium](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/release-check-results.json) · [Ảnh App 320px](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/natural-stockAgain.png)
