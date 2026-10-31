> **HISTORICAL** — Thu nhập matching theo scenario và giới hạn encounter V2.3; V2.4 dùng sở thích khách hàng riêng. Nguồn chuẩn hiện tại: [CURRENT_MVP.md](CURRENT_MVP.md). Các phương pháp, kết quả và nội dung gốc bên dưới được giữ nguyên; lệnh lịch sử không được thực thi lại trong audit này.

# Business V2.3 — Báo cáo triển khai

Nhánh `feat/business-v2-3-fixed-income`, tạo từ `origin/main` tại `71e722d` sau fetch. Main đã có merge mobile MVP và transaction UX; working tree ban đầu sạch.

Follow-up giới hạn Ngân hàng/Kinh doanh tiếp tục từ `9d20242`, sau hai commit V2.3 `06a4a6f` và `9d20242`. Giữ nguyên các commit đã hoàn tất; thay đổi bổ sung được commit riêng trên cùng nhánh.

## Luật thay đổi

Với cơ sở đang sở hữu, gọi `N` là tổng tầng nâng cấp, `M` là số tầng trùng `scenarioId` hiện tại:

- **V2.1/V2.2:** `round(3M × trendIncome + N × 700k + M × 1M + (economicMultiplier − 1) × 2M)`.
- **V2.3:** `round(3M + N × 700k + M × 1M)`.
- Không sở hữu: thu nhập bằng 0. Chỉ nhận tại bước kinh doanh của START như trước.

| Trạng thái V2.3 | Thu nhập / START |
|---|---:|
| Không nâng cấp, mọi xu hướng/cú sốc | 3.000.000 ₫ |
| Một tầng trùng xu hướng | 4.700.000 ₫ |
| Một tầng không trùng | 3.700.000 ₫ |
| Hai tầng trùng | 6.400.000 ₫ |

Xu hướng vẫn được sinh và dùng cho thưởng trùng nâng cấp; cú sốc không trực tiếp đổi thu nhập. Giá thu hồi vẫn chịu xu hướng thị trường, cú sốc và khấu hao. Giữ nguyên vốn mua 20M, nâng 5M, giới hạn tầng, công thức thu hồi, khóa nâng cấp ngay sau mua, chỉ bán tại ô Kinh doanh, cấm bán khẩn cấp và loại vốn chưa bán khỏi lawful proceeds. Thu nhập vận hành dương không đảm bảo tổng lợi nhuận.

## Version và replay

- Thêm `businessRulesVersion?: 'v2.2-trend-shock' | 'v2.3-fixed-income'` trong Snapshot/GameState.
- `createGame` mặc định V2.3 ở mọi mode; tham số thứ sáu cho phép replay chỉ định luật kinh doanh legacy. Không suy luật kinh doanh từ mode hoặc savings profile.
- State thiếu metadata dùng **legacy**, kể cả khi tiếp tục JSON cũ. Snapshot/copy giữ version; export thêm version ở root/state/snapshots/settlement-before. Re-export legacy chỉ bổ sung metadata, không đổi tài chính.
- Giữ schema **5**; replay nhận schema 4/5 và dùng version đã khai báo, kiểm tra metadata nhất quán. Log cũ thiếu version chạy công thức cũ; không sửa hay tái sinh fixture.
- Giữ `trendIncome`, `economicMultiplier`, các định nghĩa scenario và cấu trúc kinh tế cho replay cũ và định giá. Metadata version quyết định công thức thu nhập, không xóa các trường legacy khỏi `financialConfig`.

## UI và files

- `src/game/business.ts`: nhánh công thức V2.3 và fallback legacy; `types.ts`, `engine.ts`, `state.ts`, `log.ts`: version/default/snapshot/export.
- `scripts/diagnostics/replay-game-log.ts`: chọn đúng luật khi replay.
- `Forecast.tsx`: chỉ ba hàng **cổ phiếu, trái phiếu, vàng**; bỏ cả đoạn thông tin kinh doanh đang sở hữu.
- `TradingPanel.tsx`: nền 3M cố định, thưởng 700k/1M và xu hướng hiện tại; giữ selector nâng cấp, báo giá, vốn và cảnh báo thanh khoản/lỗ vốn. Có mô tả riêng nếu render state legacy.
- Thêm `tests/v2_3-business.test.ts` và `scripts/verify-business-v2_3.mjs`. Không thêm dependency, không đổi CSS hay thiết kế bàn.

## Kiểm chứng bản nền, trước follow-up giới hạn ô

- **130/130 product tests**, **19/19 behavior diagnostics**, ESLint, TypeScript app/harness, Vite production build: pass.
- **16 tests mới**: các ví dụ thu nhập, mọi scenario/cú sốc, chuyển thưởng theo scenario, recovery/RNG bằng legacy, mua/nâng nhiều tầng/bán, cấm bán khẩn cấp, loại vốn chưa bán, START trả một lần kể cả funding pause/JSON continuation, version và replay.
- Replay nguyên vẹn các log V2.1 original/A/B, V2.2 C20 và log atomic-stock từ task UX; replay được cả bản re-export có metadata legacy.
- Chrome **320/390/430/1440px**: forecast đúng ba tài sản, business 3M → 4,7M → 6,4M khi nâng cấp trùng, bán nhận đúng báo giá; không tràn ngang, không lỗi console.
- Smoke C20 thật, seed `XVTL-V2-0`: **4 START, 25 lượt gieo, 1 lần mua cơ sở, 2 nâng cấp, 1 bán, 3 mua cổ phiếu atomic**. Double-tap không mua lặp; không có Skip sau mua cổ phiếu. Log download replay khớp toàn bộ state.
- Kết quả **86.910.537 ₫ lawful proceeds**, chưa đủ 90M. Chạy luật legacy với cùng lựa chọn đạt 87.410.537 ₫; khác biệt đến từ thu nhập đã duyệt. Xúc xắc, RNG và vị trí bằng nhau ở từng lượt.
- [Evidence browser](playtests/business-v2_3/verification.json), [log browser nén](playtests/business-v2_3/browser-game-log.json.gz), [audit nguồn](playtests/business-v2_3/source-audit.json): 19/24 file được bảo vệ giữ nguyên; chỉ năm file engine/version kể trên đổi. Fixture lịch sử giữ nguyên byte; manifest checksum giữ nguyên nội dung sau chuẩn hóa CRLF/LF.
- Verifier artifact `verify-v2_2-mechanics.ts` vẫn fail checksum `GameDialogs.tsx` trong manifest UI cũ như ở baseline. Không sửa manifest để che lỗi; tách giới hạn này khỏi 19 diagnostics hành vi đã pass.

Ảnh: [forecast 390px](playtests/business-v2_3/390-forecast.png), [kinh doanh 390px](playtests/business-v2_3/390-business.png), [320px](playtests/business-v2_3/320-business.png), [kết quả](playtests/business-v2_3/390-result.png).

## Follow-up — giới hạn theo lần gặp ô

- **Ngân hàng:** mỗi lần gặp ô chỉ gửi một khoản mới. Engine ghi một transaction `deposit-bank`, đồng thời chuyển sang `rolling` và xóa `eventId`; không cần thêm Skip. Board báo gửi thành công, tiền mặt còn lại và đưa focus về nút gieo. Lần gặp sau vẫn mở khoản mới; khoản cũ giữ nguyên lãi suất/kỳ hạn/đáo hạn độc lập. Phân bổ tiết kiệm ban đầu không tiêu thụ quyền gửi tại ô.
- **Kinh doanh:** chỉ nâng cấp một lần trong một encounter; không nâng cấp ở lượt mua. Muốn nâng tiếp phải gặp ô Kinh doanh ở lượt sau. Sau nâng cấp, panel khóa nút và giải thích rõ; vẫn cho bán toàn cơ sở rồi Hoàn tất để giữ nguyên luật mua/bán. Không đổi thu nhập nền/thưởng trùng xu hướng, giá mua/nâng cấp/thu hồi hay giới hạn tầng.
- Chốt engine dùng loại transaction và lượt đã ghi trong log; không phụ thuộc suffix `asset` từ caller. Gọi lặp, đổi trend/asset hoặc khôi phục JSON đều không vượt giới hạn. UI giữ khóa submit đồng bộ và callback kiểm tra state hiện tại. Giao dịch thất bại không ghi log hay tiêu thụ quyền.
- Thêm `encounterRulesVersion?: 'legacy-multi-action' | 'v2.3-single-action'`, độc lập với `businessRulesVersion`. Game mới dùng single-action; metadata vắng mặt luôn dùng legacy, kể cả log **V2.3 trước follow-up**. Snapshot/copy/export/replay giữ version; export bổ sung metadata legacy khi re-export. Schema vẫn là 5; tham số thứ bảy của `createGame` dành cho replay. Mã atomic-stock và double-tap protection giữ nguyên.
- Thay đổi hẹp ở `encounters.ts`, transaction gates, metadata/replay và hai component phản hồi. Driver diagnostics/browser được cập nhật để không xử lý Skip sau Bank atomic. Không thêm dependency hoặc thay công thức tài chính, RNG, dữ liệu bàn, maturity, funding hay victory.

**Kiểm chứng bản hiện tại:**

- **139/139 product tests, 19/19 behavior diagnostics**, ESLint, TypeScript app/harness và production build đều pass. Có **9 tests mới** bao phủ hai giới hạn, gặp lại ô, nhiều savings lots, khóa sau mua, duplicate/direct calls/JSON, metadata, replay cũ và atomic-stock.
- Replay log cũ có nhiều khoản gửi trong cùng encounter, các fixture V2.1/V2.2, log atomic-stock và log V2.3 có hai nâng cấp cùng encounter; re-export rồi replay vẫn khớp. Bảy artifact lịch sử được kiểm tra giữ nguyên, gồm log V2.3 trước follow-up. [Audit nguồn](playtests/encounter-limits-v2_3/source-audit.json).
- Chrome **320/390/430/1440px**: Bank double-tap chỉ trừ tiền một lần, tự đóng panel, focus nút gieo; khoản cũ còn nguyên khi gặp lại. Business double-tap chỉ nâng một tầng, nút nâng tiếp bị khóa, vẫn bán được. Không tràn ngang hay lỗi console. Kiểm tra input/viewport thấp **320×460** cũng pass; chưa kiểm tra bàn phím trên thiết bị thật.
- Ván thật seed `XVTL-V2-0`: **4 START, 25 lượt**, 1 mua cơ sở / **1 nâng cấp** / 1 bán / 3 mua cổ phiếu atomic; lawful proceeds **86.088.031 ₫**. Log download replay khớp toàn bộ state, RNG/dice/position khớp khi chạy luật thu nhập legacy với cùng lựa chọn. [Evidence](playtests/encounter-limits-v2_3/verification.json), [log](playtests/encounter-limits-v2_3/browser-game-log.json.gz).
- Hồi quy ván khác seed `XVTL-V2-6`: **4 vòng, 26 lượt**, gửi Ngân hàng qua các encounter khác nhau, 2 mua cổ phiếu atomic; lawful proceeds **103.921.205 ₫**, replay khớp. Các panel còn lại/funding/START/results vẫn pass ở bốn độ rộng. [Hồi quy](playtests/encounter-limits-v2_3/regression-verification.json), [input](playtests/encounter-limits-v2_3/input-verification.json). Ảnh hồi quy rộng lưu tạm; ảnh tập trung giữ trong thư mục follow-up.
- Chạy lại artifact verifier V2.2: vẫn fail checksum `GameDialogs.tsx` của manifest UI cũ, đúng giới hạn đã có trước follow-up. File này và manifest không bị sửa; không tái sinh dữ liệu mô phỏng để che lỗi.

Ảnh follow-up: [gửi thành công 320px](playtests/encounter-limits-v2_3/320-bank-success.png), [khoản cũ 390px](playtests/encounter-limits-v2_3/390-bank-existing-lot.png), [khóa nâng cấp 390px](playtests/encounter-limits-v2_3/390-business-upgrade-used.png), [kết quả](playtests/encounter-limits-v2_3/390-result.png).

## Giới hạn

Kiểm chứng browser bằng Chrome viewport, chưa trên thiết bị thật. Panel kinh doanh vẫn cần cuộn trên màn nhỏ để giữ đủ lựa chọn và giải thích. Bộ giải replay cũ bên ngoài cần cập nhật để đọc luật V2.3; không thay đổi khả năng tái lập log lịch sử trong bộ replay hiện tại. Không chạy Monte Carlo, merge hoặc deploy.
