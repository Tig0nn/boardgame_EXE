# EXE EG3-AI-09 | AI Provider Readiness

Workspace `C:\Users\Admin\EXE-whatif-demo`, branch `feat/b18-whatif-deep-analysis-v2`, HEAD `759a6fe1879816a716e21e38cc91eecd3fe5f50a`. Phạm vi nghiệm thu là DEV, HTTP loopback và model mô phỏng. Gemini live **`LIVE_NOT_RUN`**.

**Verdict `EG3-AI-09 PASS`** trong phạm vi trên. Staging trống.

## Provider contract

| Operation | Dữ liệu gửi | Điều kiện chấp nhận |
| --- | --- | --- |
| `interpret` | Câu hỏi tiếng Việt có giới hạn độ dài | Intent có schema đóng hoặc trạng thái làm rõ, không hỗ trợ, nhiều thay đổi. Số tiền và kỳ hạn nếu có phải khớp thông tin đọc được từ câu hỏi. Intent thiếu trường dẫn đến bước hỏi lại. App tra lịch sử và dùng native Worker để xác minh phương án. |
| `propose` | Câu hỏi và tối đa 16 mục catalog đã xác minh | Cặp decision ID và alternative ID phải trùng một mục. Trong luồng câu hỏi tự nhiên, App thu hẹp catalog đến đúng phương án được xác minh cho câu hỏi. Người chơi xác nhận trước khi chạy. |
| `explain` | Nhóm quyết định, hướng thay đổi và trạng thái follow-up | Chỉ nhận `claimId` khớp dữ kiện đã gửi. Server và HTTP client từ chối claim khác hoặc trường bổ sung. App dựng lời giải thích và các chỉ số từ replay đã xác minh, độc lập với operation này. |

`createModelWhatIfProvider` triển khai đủ ba operation của `WhatIfProvider`. Backend truyền callback nhận request đã validate và `AbortSignal`, trả về một chuỗi JSON tối đa 4 KiB. Adapter giữ bản catalog và facts riêng để đối chiếu sau khi callback hoàn tất. Các giới hạn đồng thời, timeout và số lượt gọi tiếp tục nằm ở HTTP handler hiện có. Request chỉ chứa các trường theo bảng, không mang lịch sử đầy đủ, save hoặc số liệu kết quả.

## Lỗi đã sửa và trải nghiệm

- Giá trị JSON dạng mảng từng được ép sang chuỗi và lọt qua kiểm tra trạng thái hoặc hướng thay đổi. Validation hiện so sánh kiểu và giá trị chính xác. Phản hồi sai schema được phân loại `OUTPUT_REJECTED`.
- Một intent có thể thêm số tiền hoặc kỳ hạn người chơi chưa nêu. Các số này giờ phải có căn cứ trong câu hỏi. Kỳ hạn thập phân, kỳ hạn khác hoặc số tiền không khớp bị từ chối. Câu thiếu tham số hợp lệ chuyển đến ô bổ sung.
- HTTP client từng nhận claim đúng cấu trúc nhưng sai nhóm hoặc hướng. Client và server dùng chung phép đối chiếu claim. Phản hồi tự thêm số tiền, sự kiện hoặc lời giải thích bị từ chối.
- Khi provider gặp lỗi, nút **Chọn phương án thủ công** đưa focus tới phương án đã xác minh, danh sách quyết định hoặc nhóm quyết định tùy trạng thái. Người chơi có thể chạy lại từ catalog. Gợi ý khóa học tính đến lần học đã ghi nhận để tránh lặp lại chính hành động gốc.

## Kiểm thử

- **64/64 ca Chromium** trên source cuối, gồm đủ 59 ca EG3-AI-08 và 5 ca mới. 50 ca App baseline xác minh luồng hỏi, chọn, xác nhận follow-up, replay và so sánh. Các lượt cuối không ghi nhận page error hoặc request ngoài allowlist. Một lượt chuẩn bị trước đó bị Vite tải lại trang giữa ca khi source đổi. Kết quả bên dưới lấy từ các lượt chạy lại với HMR tắt. [Chromium App baseline](playtests/whatif-endgame/2026-11-10/eg3-ai-09-01/baseline-final-results.json)
- **4/4 ca Chromium model mô phỏng** trên App DEV với HTTP loopback. Desktop thử câu diễn đạt khác dẫn đến so sánh CMG đã xác minh, và thử timeout, gửi lại, bỏ phản hồi cũ. 390px thử câu mơ hồ, bổ sung số tiền với focus đúng và chạy replay. 320px thử JSON hỏng, số tiền tự thêm, ID ngoài catalog và chuyển sang chọn thủ công bằng touch. Các ca kết thúc với save và kết quả gốc nguyên vẹn, Worker đóng và không có request bị bộ lọc mạng chặn. [Chromium model mô phỏng](playtests/whatif-endgame/2026-11-10/eg3-ai-09-01/provider-final-results.json)
- **1/1 ca Chromium gợi ý Course** ở 390px. Người chơi chọn gợi ý bỏ lần học Basic đã ghi nhận ở quyết định 37, xác nhận phương án và nhận so sánh từ native Worker. [Chromium gợi ý Course](playtests/whatif-endgame/2026-11-10/eg3-ai-09-01/course-suggestion-final-results.json)
- **9/9 ca Chromium stress**. Lượt chạy phủ cả bảy nhóm trên lịch sử engine độc lập, phục hồi sau throttle và chạy lặp trên cùng ván. Ca lặp đo 3 lần hoàn tất, 8 lần hủy nhanh, 16 Worker được tạo và 0 Worker còn hoạt động khi đóng. [Chromium stress](playtests/whatif-endgame/2026-11-10/eg3-ai-09-01/reliability-final-results.json)
- TypeScript mobile/root, ESLint theo phạm vi và build Vite production trong bộ nhớ đều PASS. Build kiểm tra endpoint DEV không có trong bundle. [TypeScript và ESLint](playtests/whatif-endgame/2026-11-10/eg3-ai-09-01/checks-final.json) · [Build](playtests/whatif-endgame/2026-11-10/eg3-ai-09-01/build-final.json)
- **305/305 test regression** ở lượt đầy đủ đầu tiên, gồm toàn bộ 301 test baseline và 4 test mới. Lượt lặp chạy đồng thời đạt **304/305**. Ca Gold C1 `public pending rejects invalid inputs, preserves head, then valid retry commits once` trả `limited` thay vì `supported-final` sau 27,1 giây. Assertion của ca đó không ghi lý do `limited`. Ca này PASS khi chạy riêng trên source cuối, trong 5,8 giây. [Regression đầy đủ](playtests/whatif-endgame/2026-11-10/eg3-ai-09-01/regression-full-summary.json) · [Lượt lặp](playtests/whatif-endgame/2026-11-10/eg3-ai-09-01/regression-final-summary.json) · [Chạy riêng Gold C1](playtests/whatif-endgame/2026-11-10/eg3-ai-09-01/gold-c1-isolated.tap)

## Điều kiện tích hợp và phê duyệt

- Provider thật cần transport server được Owner phê duyệt, quyền truy cập hợp lệ, cấu hình bí mật phía server, kiểm soát chi phí và xác minh chất lượng tiếng Việt cũng như wire schema thực tế. Adapter Gemini hiện có vẫn ở trạng thái tắt và đường gọi riêng của nó mới có `propose` và `explain`. Khi chọn Gemini, nối transport qua adapter ba operation rồi nghiệm thu bằng truy cập đã được cấp.
- Cách nhận diện số tiền và kỳ hạn cố ý giới hạn ở định dạng có thể đối chiếu. Những cách diễn đạt chưa xác minh được cần làm rõ hoặc chọn thủ công. Provider mô phỏng kiểm chứng contract và hành vi App, chưa đo được chất lượng suy luận của model thật.
- **`OWNER_APPROVAL_REQUIRED`** cho `FinancialTerm` ở Rebalance core 320px. Tooltip có thể che nút xem kết quả. Các ca 320px dùng Enter để đi qua core và kiểm tra touch trong panel What-if riêng. Patch vẫn chờ Owner/Phát. [Repro](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-verified-repro.json) · [Diff đề xuất](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-tooltip-proposed-NOT-APPLIED.patch)

## Source và test

- Contract và backend What-if gồm `src/ai/what-if/contracts.ts`, `server.ts`, `model-provider.ts` và `transport.test.ts`.
- Controller và client gồm `mobile_app/src/game/what-if-ai/http-provider.ts`, `natural-language.ts`, `in-game-controller.ts` và `in-game-controller.test.ts`.
- Panel gồm `mobile_app/src/components/endgame-what-if/InGameAiEntry.tsx` và `FlexibleChoices.tsx`.
- Bằng chứng và lệnh tái hiện trong `docs/playtests/whatif-endgame/2026-11-10/eg3-ai-09-01`.
