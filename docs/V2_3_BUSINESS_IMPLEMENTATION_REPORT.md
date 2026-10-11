# Business V2.3 — Báo cáo triển khai

Nhánh `feat/business-v2-3-fixed-income`, tạo từ `origin/main` tại `71e722d` sau fetch. Main đã có merge mobile MVP và transaction UX; working tree ban đầu sạch.

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
- `createGame` mặc định V2.3 ở mọi mode; tham số cuối cho phép replay chỉ định legacy. Không suy luật kinh doanh từ mode hoặc savings profile.
- State thiếu metadata dùng **legacy**, kể cả khi tiếp tục JSON cũ. Snapshot/copy giữ version; export thêm version ở root/state/snapshots/settlement-before. Re-export legacy chỉ bổ sung metadata, không đổi tài chính.
- Giữ schema **5**; replay nhận schema 4/5 và dùng version đã khai báo, kiểm tra metadata nhất quán. Log cũ thiếu version chạy công thức cũ; không sửa hay tái sinh fixture.
- Giữ `trendIncome`, `economicMultiplier`, các định nghĩa scenario và cấu trúc kinh tế cho replay cũ và định giá. Metadata version quyết định công thức thu nhập, không xóa các trường legacy khỏi `financialConfig`.

## UI và files

- `src/game/business.ts`: nhánh công thức V2.3 và fallback legacy; `types.ts`, `engine.ts`, `state.ts`, `log.ts`: version/default/snapshot/export.
- `scripts/diagnostics/replay-game-log.ts`: chọn đúng luật khi replay.
- `Forecast.tsx`: chỉ ba hàng **cổ phiếu, trái phiếu, vàng**; bỏ cả đoạn thông tin kinh doanh đang sở hữu.
- `TradingPanel.tsx`: nền 3M cố định, thưởng 700k/1M và xu hướng hiện tại; giữ selector nâng cấp, báo giá, vốn và cảnh báo thanh khoản/lỗ vốn. Có mô tả riêng nếu render state legacy.
- Thêm `tests/v2_3-business.test.ts` và `scripts/verify-business-v2_3.mjs`. Không thêm dependency, không đổi CSS hay thiết kế bàn.

## Kiểm chứng

- **130/130 product tests**, **19/19 behavior diagnostics**, ESLint, TypeScript app/harness, Vite production build: pass.
- **16 tests mới**: các ví dụ thu nhập, mọi scenario/cú sốc, chuyển thưởng theo scenario, recovery/RNG bằng legacy, mua/nâng nhiều tầng/bán, cấm bán khẩn cấp, loại vốn chưa bán, START trả một lần kể cả funding pause/JSON continuation, version và replay.
- Replay nguyên vẹn các log V2.1 original/A/B, V2.2 C20 và log atomic-stock từ task UX; replay được cả bản re-export có metadata legacy.
- Chrome **320/390/430/1440px**: forecast đúng ba tài sản, business 3M → 4,7M → 6,4M khi nâng cấp trùng, bán nhận đúng báo giá; không tràn ngang, không lỗi console.
- Smoke C20 thật, seed `XVTL-V2-0`: **4 START, 25 lượt gieo, 1 lần mua cơ sở, 2 nâng cấp, 1 bán, 3 mua cổ phiếu atomic**. Double-tap không mua lặp; không có Skip sau mua cổ phiếu. Log download replay khớp toàn bộ state.
- Kết quả **86.910.537 ₫ lawful proceeds**, chưa đủ 90M. Chạy luật legacy với cùng lựa chọn đạt 87.410.537 ₫; khác biệt đến từ thu nhập đã duyệt. Xúc xắc, RNG và vị trí bằng nhau ở từng lượt.
- [Evidence browser](playtests/business-v2_3/verification.json), [log browser nén](playtests/business-v2_3/browser-game-log.json.gz), [audit nguồn](playtests/business-v2_3/source-audit.json): 19/24 file được bảo vệ giữ nguyên; chỉ năm file engine/version kể trên đổi. Fixture lịch sử giữ nguyên byte; manifest checksum giữ nguyên nội dung sau chuẩn hóa CRLF/LF.
- Verifier artifact `verify-v2_2-mechanics.ts` vẫn fail checksum `GameDialogs.tsx` trong manifest UI cũ như ở baseline. Không sửa manifest để che lỗi; tách giới hạn này khỏi 19 diagnostics hành vi đã pass.

Ảnh: [forecast 390px](playtests/business-v2_3/390-forecast.png), [kinh doanh 390px](playtests/business-v2_3/390-business.png), [320px](playtests/business-v2_3/320-business.png), [kết quả](playtests/business-v2_3/390-result.png).

## Giới hạn

Kiểm chứng browser bằng Chrome viewport, chưa trên thiết bị thật. Panel kinh doanh vẫn cần cuộn trên màn nhỏ để giữ đủ lựa chọn và giải thích. Bộ giải replay cũ bên ngoài cần cập nhật để đọc luật V2.3; không thay đổi khả năng tái lập log lịch sử trong bộ replay hiện tại. Không chạy Monte Carlo, merge hoặc deploy.
