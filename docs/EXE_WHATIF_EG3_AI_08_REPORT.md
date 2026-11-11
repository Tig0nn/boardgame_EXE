# EXE EG3-AI-08 · Kiểm thử độ ổn định What-if DEV

**EG3-AI-08 PASS · `DEV_MOCK_FEATURE_READY`** trong phạm vi B18 và Chromium đã kiểm chứng.

## Lỗi đã sửa

Sau 12 request tới mock HTTP theo giới hạn mặc định, request thứ 13 trả 429. Trước sửa, client chuyển phản hồi này thành `PROVIDER_UNAVAILABLE` và gợi ý gửi lại ngay. Test HTTP loopback đã tái hiện. Client giờ giữ `RATE_LIMITED`, kể cả khi vượt giới hạn cục bộ của panel. Panel hướng dẫn chọn thủ công ngay hoặc hỏi lại sau. Giới hạn request và timeout của server giữ nguyên. [Test HTTP](../src/ai/what-if/transport.test.ts)

## Lịch sử B18 mới

Engine tạo bốn seed mới bằng hành động hợp lệ. Seed được chọn theo số lượt gặp, cơ cấu danh mục, số lot, số lệnh sau fork và kích thước lịch sử. Mỗi comparison đều có chứng nhận replay độc lập từ engine. Test so hash packed save và đối chiếu nguyên văn source trước và sau khi chạy.

| Nhóm | Seed | Thay đổi và tình huống kiểm tra |
|---|---|---|
| Gold | `EG3-AI-08-GOLD-2` | Bỏ mua tại quyết định 7, xác nhận riêng bỏ lần bán toàn bộ ở quyết định 31 tại ô 5 |
| Bank | `EG3-AI-08-MIXED-3` | Gửi 7.250.019 VND kỳ hạn 3 START tại quyết định 7 trong lịch sử có nhiều lượt Bank |
| Course | `EG3-AI-08-MIXED-5` | Bỏ đúng lần học Basic tại quyết định 48 trong lịch sử có nhiều lượt Course |
| Advanced | `EG3-AI-08-MIXED-9` | Học Advanced tại quyết định 7 trong lịch sử 118 mục sát giới hạn |
| Stocks | `EG3-AI-08-MIXED-5` | Bỏ mua FPT tại quyết định 7. Xác nhận theo thứ tự 20, 21 và 22. Ván gốc có FPT, VCB, Business, tiền gửi và trái phiếu |
| Bonds | `EG3-AI-08-MIXED-3` | Bán 17 VND từ `bond-4` tại quyết định 78. Nguồn có bốn lot và hai lot còn khả dụng ở lượt đó |
| Business | `EG3-AI-08-MIXED-5` | Đổi nâng cấp từ không gian check-in sang chất lượng đồ uống tại quyết định 76 |

Lịch sử Advanced có 19.812.943 ký tự. Thêm một lệnh bán thật tạo lịch sử 20.005.685 ký tự, vượt giới hạn 20 triệu ký tự và bị từ chối. Test sửa cùng một giá mua trong hai bản ghi của source để vượt kiểm tra bản sao ban đầu. Replay vẫn phát hiện lịch sử giả. Gold bán toàn bộ ở START nằm ngoài đường follow-up Gold hiện có. Ca negative trả `limited` và ẩn số liệu. [Generator](../scripts/diagnostics/what-if-reliability-fixtures.ts) · [Test lịch sử](../mobile_app/src/game/what-if-ai/reliability.test.ts)

Kết quả mới gồm cả mức thay đổi nhỏ và chỉ số khác chiều. Ca Gold thay đổi +46 VND trên cả ba chỉ số. Ca Stocks tăng tiền mặt 3.876.325 VND, giảm tài sản ròng 246.072 VND và giảm tiền có thể thu về 204.848 VND. Ca Bonds giảm 10.821 VND trên cả ba chỉ số. Artifact Chromium ghi delta và hash cho cả bảy ca.

## Chromium và tài nguyên

**301/301 regression PASS**, gồm đủ 291 test EG3-AI-07 và 10 test mới. TypeScript mobile/root, ESLint theo phạm vi và production build trong bộ nhớ đều PASS. Build không chứa endpoint mock DEV. [Regression](playtests/whatif-endgame/2026-11-10/eg3-ai-08-01/regression-full-summary.json) · [TypeScript và ESLint](playtests/whatif-endgame/2026-11-10/eg3-ai-08-01/checks-verified.json) · [Build](playtests/whatif-endgame/2026-11-10/eg3-ai-08-01/build-verified.json)

**9/9 ca Chromium mới PASS.** Bảy nhóm đều khớp delta và hash nhánh replay độc lập trong App thật. Ca HTTP 429 xác minh người chơi vẫn chạy được nhánh chọn thủ công. Ca stress thực hiện 8 lần hủy trong lúc mở, tiếp theo 3 lần replay hoàn chỉnh trên cùng ván. Cả 16 Worker đã tạo đều được terminate. Packed save được so theo từng byte và kết quả chính thức theo nội dung hiển thị sau mỗi vòng. Heap của trang sau ép GC là 19.575.384 byte trước và 20.181.584 byte sau stress. Đây là hai lần đo trong một phiên Chromium có harness ghi sự kiện. [Kết quả lịch sử mới và stress](playtests/whatif-endgame/2026-11-10/eg3-ai-08-01/new-histories-results.json)

**50/50 ca Chromium baseline chạy lại PASS**, đối chiếu đủ tên ca EG3-AI-07. Các ca bao gồm pagination, timeout rồi gửi lại, stale response, đóng giữa HTTP/probe/replay, focus và Tab/Enter/Escape. Tổng hai lượt là **59/59 ca Chromium PASS**. [Baseline chạy lại](playtests/whatif-endgame/2026-11-10/eg3-ai-08-01/baseline-rerun-results.json)

Desktop dùng pointer. Các fixture Bank và Stocks mới ở 390px dùng touch qua nút core và trong panel. Ở 320px, Gold và Advanced đi qua màn core bằng Enter, rồi thao tác trong panel bằng touch. Harness chặn request ngoài loopback, phục vụ response giả cho font của App, và ghi nhận không có request ngoài danh sách, lỗi trang hay request `explain`. [Bank 390px](playtests/whatif-endgame/2026-11-10/eg3-ai-08-01/new-bank-app.png) · [Advanced 320px](playtests/whatif-endgame/2026-11-10/eg3-ai-08-01/new-advanced-app.png)

## Giới hạn và Owner review

- **`OWNER_APPROVAL_REQUIRED`** cho `FinancialTerm` ở 320px. Tooltip có thể che CTA ở màn tổng kết ngay trước Rebalance. Diff đề xuất vẫn chờ Owner/Phát. Bằng chứng 320px tách Enter qua core khỏi touch trong panel. [Repro](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-verified-repro.json) · [Diff chưa áp dụng](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-tooltip-proposed-NOT-APPLIED.patch)
- **Gemini `LIVE_NOT_RUN`.** Provider chạy trong App DEV là mock HTTP. Phạm vi kiểm chứng gồm các fixture B18 và một quyết định gốc mỗi lần. Gold giữ giới hạn policy về lần bán kế tiếp. Cách diễn đạt ngoài tập nhận diện mock có thể cần form thủ công.
- Mock DEV mặc định giới hạn 12 request mỗi địa chỉ loopback trong 10 phút, tối đa 8 lượt qua client của một panel và 100 lượt provider trên một tiến trình. Bộ Chromium nhiều ca dùng quota test riêng. Test HTTP chạy quota mặc định riêng, và ca Chromium HTTP 429 kiểm tra tiếp tục qua form thủ công.

## Chạy lại

- `node --experimental-strip-types scripts/what-if-ai-dev.ts` mở [App DEV](http://127.0.0.1:5196/?endgameWhatIf=1&whatIfAi=1).
- `node docs/playtests/whatif-endgame/2026-11-10/eg3-ai-08-01/regression.mjs <tên-lượt-mới>` chạy bộ regression và đối chiếu tên test với EG3-AI-07.
- `node --experimental-strip-types docs/playtests/whatif-endgame/2026-11-10/eg3-ai-08-01/browser.mjs <tên-lượt-mới>` chạy Chromium App DEV. Có thể thêm `reliability-` để chạy nhóm mới hoặc `baseline` để chạy lại nhóm cũ.
