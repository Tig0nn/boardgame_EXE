# Xoay Vòng Tiến Lui V2.1 — Sẵn sàng playtest có kiểm soát

Ngày xác minh: **11/10/2026**. Trạng thái: **SẴN SÀNG CHO PLAYTEST CÓ KIỂM SOÁT — CHỜ REVIEW**.

Đã tiếp tục trên repository hiện tại, đọc bốn báo cáo V2, giữ các hệ thống gameplay hiện có. Không deploy Vercel, không thêm backend/analytics/AI/hệ thống tài chính mới. Không đổi cân bằng tài chính hoặc biến thể chính thức.

## 1. Thay đổi đã triển khai

### Ba lựa chọn trên màn hình thiết lập

| Lựa chọn | ID trong JSON | Bàn | Số vòng | Vai trò |
|---|---|---|---:|---|
| Original | `original` | A20 | 3 | Mặc định chính thức |
| Experimental A | `experimental-a` | A20 | 4 | Thử riêng thời hạn |
| Experimental B | `experimental-b` | C20 | 4 | Thử thời hạn và bố trí C20 |

Chọn **Chế độ chơi** trước khi bấm **Bắt đầu hành trình**. Bấm **Chơi mới → Về màn hình thiết lập** để đổi chế độ; màn hình mới trở về Original. Chế độ, bàn, tổng số vòng nằm trong state và từng snapshot, được giữ khi tuần tự hóa JSON. Quyết toán, lương, nợ cuối màn, kỳ hạn, forecast và Result dùng thời hạn của ván.

**A20 giữ nguyên cả 20 vị trí. C20 có đúng 20 ô; chỉ ô 14 (index 13) đổi Kinh tế/macro → Kinh doanh.** Tọa độ, nhãn và loại của 19 ô còn lại giữ nguyên. A20 có business tại 9/16, macro tại 6/14; C20 có business tại 9/14/16, macro tại 6. Các loại khác: START 1; ngân hàng 2/13; stocks 3/12; living 4/15; course 5/17; bonds 7/20; personal 8/18; gold 10/19; obligation 11.

Giữ nguyên 50M vốn đầu, lương 14M/START, học phí 6M và tăng lương 3M từ START kế tiếp, mục tiêu 80M + 10M dự phòng. Giữ savings 6%/7%/8%, giá/phí/spread/coupon, công thức và giới hạn business, xu hướng, d6/RNG, event và phép xét huy động hợp lệ. Chọn mode trên trình duyệt không sửa `RULES`/`ECONOMY` toàn cục.

### Sửa quyền nâng kinh doanh

Engine V2 trước đây cho mua và nâng ngay trong cùng encounter. V2.1 lưu `businessPurchaseTurn`: mua cơ sở khóa nâng cấp trong lượt đó; chỉ encounter kinh doanh ở lượt tiếp theo mới có thể nâng. Encounter tiếp theo có thể nằm **cùng vòng**, không bắt buộc đợi START.

- Engine từ chối nâng ngay sau mua, không thay state/RNG/log của đầu vào.
- UI khóa nút nâng và giải thích phải gặp lại ô Kinh doanh.
- Chỉ được nâng và bán ở ô Kinh doanh. START/funding không bán được business.
- Khi bán, vốn, vốn thu hồi, các tầng và mốc mua được xóa; mua lại đặt khóa mới.
- Hệ số ảnh hưởng kinh tế toàn thị trường được giữ khi bán/mua lại, đúng luật macro cũ; không tự đặt lại hệ số về 1 để làm lợi cho cơ sở mới.
- Giữ giới hạn tầng và công thức cũ. Sau khi quyền nâng đã mở, vẫn có thể nâng nhiều tầng trong encounter nếu đủ tiền và chưa chạm giới hạn; yêu cầu hiện tại chỉ cấm nâng trong encounter mua đầu tiên.

Đã sửa fixture của hai test V2 và một test chẩn đoán: fixture nâng cơ sở nay đại diện lần gặp sau. Không bỏ test cũ hoặc đổi kỳ vọng công thức tài chính.

### Nhật ký playtest

JSON schema **4**, rules version `gameplay-v2.1-playtest-2026-10-11`. Giữ nhật ký before/after và state hiện có, bổ sung encounter riêng và phần tổng hợp:

| Dữ liệu cần thu | Nơi lưu |
|---|---|
| Mode, board, số vòng, seed | `mode`, `board`, `seed`, state/snapshots |
| Xúc xắc và đường đi | `entries` loại `roll`, dice/position before-after; `playtest.diceRolls` |
| Ô/sự kiện đã xử lý | `entries` loại `encounter`, `playtest.tileEncounters` |
| Mua/nâng/bán business | `rebalancing` với decisionId, số đếm riêng |
| Vốn business còn khóa | `lockedBusinessCapital` (giá vốn), `lockedBusinessQuote` (giá thu hồi hiện tại) |
| Khóa học | decision, `courseInvestment`, recurringIncome và salary schedule |
| Macro | market entries, `macroEvents`, price histories/markers |
| Gửi/rút savings | lot gốc/kỳ hạn/trạng thái/lãi; deposit/funding entries, withdrawal count |
| Mua/bán stocks/bonds/gold | rebalancing/funding entries, holdings/lots, purchases/sales counts |
| Funding | nguồn, số tiền, phí, tiền thực nhận, thiếu hụt, lãi mất; `fundingDecisions` |
| Tiền huy động và kết quả | `finalResult`, lawful proceeds, won/status/termination |

**Phân biệt gặp ô với giao dịch:** `tileEncounters` là các ô kích hoạt event, không phải số giao dịch. START được ghi bằng roll và salary/settlement schedule, không tạo event đầu tư. Qua START vượt ô phải đợi forecast rồi mới giải quyết đích; đích vượt START cuối bị bỏ. Đọc `roll.after.position` để xem đích xúc xắc thô, không tự coi mọi đích cuối màn là một event đã xử lý.

## 2. Kết quả kiểm thử và build đã xác nhận

| Kiểm tra | Kết quả |
|---|---|
| `npm test` | **90/90 đạt**, 0 fail/skip; giữ 81 test cũ, thêm 9 V2.1 |
| Test chẩn đoán | **15/15 đạt**, gồm board, horizon, maturity, debt, overshoot |
| `npm run lint` | Đạt, 0 lỗi/cảnh báo ESLint |
| `npx tsc -b --pretty false` | Đạt |
| Typecheck riêng harness và hai script xác minh | Đạt |
| `npm run build` | Đạt; 47 modules; JS 302,93 kB (gzip 92,68), CSS 26,97 kB (gzip 6,54) |
| Replay ba nhật ký tải qua browser | Khớp toàn bộ trạng thái JSON từ seed và các lựa chọn |
| Đối chiếu policy lịch sử | **85.000 ván đạt**, chi tiết mục 5 |

Regression mới kiểm tra: default 3/A20, A20/C20 4 vòng, C20 chỉ khác ô 14, JSON tiếp tục đúng mode/bàn, lương/thị trường/settlement một lần mỗi vòng, final overshoot không event thừa, cấu hình tài chính không bị sửa, mua/nâng/bán/mua lại business, lần gặp lại thật theo seed, funding tại START cuối của cả ba mode không lặp lương hoặc cộng lãi hai lần.

Build có thông báo thời gian plugin của Vite và Node22 có cảnh báo experimental type stripping; không có lỗi compile. Harness dưới `scripts/` chỉ chạy bằng Vite dev và không được nhập vào entry production; bundle production không chứa giao diện nạp fixture.

## 3. Bằng chứng trình duyệt

Đã dùng **trình duyệt thật Codex In-app Browser**, thao tác qua UI. Không thay state ẩn bằng JavaScript. Tách rõ ván đi xúc xắc bình thường với fixture tổng hợp. Không ghi nhận console warning/error trong các lượt kiểm tra.

### Các ván đầy đủ từ Setup đến Result

| Mode | Seed | Viewport lúc chơi đầy đủ | Roll | Lương/settlement | Event encounters | Huy động hợp lệ | Result |
|---|---|---|---:|---:|---:|---:|---|
| Original 3/A20 | `SAIGON-2026` | 1440×1000 | 17 | 3/3 | 16 | 75.200.000 ₫ | Thua |
| Experimental A 4/A20 | `XVTL-V2-0` | 1440×1000 | 25 | 4/4 | 22 | 92.384.234 ₫ | Thắng |
| Experimental B 4/C20 | `XVTL-V2-6` | 390×844 | 26 | 4/4 | 24 | 116.734.938 ₫ | Thắng |

Cả ba đã bấm tải JSON qua browser, nhận file thật trong Downloads, sao chép vào [playtests](playtests/) và kiểm tra bằng script. Không chỉ kiểm tra nội dung do engine tự xuất. [Bản tổng hợp đã xác minh](playtests/verified-browser-logs.json), [quan sát browser](playtests/browser-observations.json).

Để tái hiện các ván:

- Original: savings đầu 20M, kỳ hạn 1; mua khóa học lần đầu, bỏ qua tài sản, trả ngay chi phí/sửa đầy đủ/nhận thưởng.
- A: savings đầu 0; học ở lượt 2; mua business lượt 3/ô 9, nâng theo forecast lượt 7/ô 9, bán lượt 23/ô 16. Gửi 5M kỳ hạn 1 ở lượt 19/vòng 4; còn lại bỏ qua đầu tư và thanh toán ngay.
- B: savings đầu 0; học ở lượt 5; mua business lượt 11/ô 14, nâng theo forecast lượt 12/ô 16 và 17/ô 14, bán lượt 23/ô 9. Gửi 5M kỳ hạn 2 ở lượt 14/vòng 3; còn lại bỏ qua đầu tư và thanh toán ngay.

Nhật ký là bằng chứng chính xác cho các lựa chọn. Hai ván A/B dùng seed và quyết định khác nhau; **không dùng chênh lệch tiền của hai ván browser để quy tác động cho bố trí bàn**.

### Các đường đã xác nhận trong UI

| Đường kiểm tra | Bằng chứng |
|---|---|
| Board/dice/qua START | 20 ô đúng layout; vị trí và die đi theo roll; overshoot/forecast tiếp tục đúng; B bỏ đích vượt START cuối |
| Lương và course | A/B nhận 4×17M, course chi đúng 6M một lần; Original nhận 3×17M |
| Savings tại vòng 4 | A trả 5,3M ở START4 (5M + 300k); B trả 5,7M ở START4 (5M + 700k), không đáo hạn sớm ở START3 |
| Mua rồi nâng business | Nút nâng bị khóa ngay sau mua A lượt3/B lượt11; nâng được khi gặp lại A lượt7/B lượt12,17 |
| Bán business | A/B bán tại đúng ô; vốn và tầng cuối đều 0; START chỉ cho chọn stocks/bonds/gold |
| Macro và chart | A credit-tightening lượt11; B demand-boom lượt22; báo giá và marker khớp event, marker còn trên chart tại START |
| Result và tiền hợp lệ | UI khớp JSON/replay; có ván thắng và thua thật qua đầy đủ thời hạn |

Ảnh: [A mua và khóa nâng](playtests/a-initial-upgrade-blocked.png), [A macro](playtests/a-macro.png), [A START4](playtests/a-lap4-settlement.png), [A Result](playtests/a-result.png), [B bàn mobile](playtests/b-mobile-board.png), [B mua tại ô14](playtests/b-initial-upgrade-blocked.png), [B START4](playtests/b-lap4-settlement.png), [B Result](playtests/b-mobile-result.png), [Original Result](playtests/original-result.png).

### Fixture trình duyệt cho nhánh hiếm

Trang dev `/scripts/playtest-harness.html` ghi rõ **FIXTURE TỔNG HỢP, KHÔNG PHẢI VÁN TỰ NHIÊN**; dùng cùng Board/Portfolio/PhaseDialog/FundingDialog và engine. Các chỉnh state tạo điều kiện kiểm thử được giới hạn trong harness, không đổi config sản phẩm.

| Fixture | Thao tác UI và kết quả xác nhận |
|---|---|
| `funding` | Hóa đơn 5M, cash3M → thiếu2M. Bán nominal stocks1M nhận990k, còn thiếu1,01M; vay đúng phần còn thiếu → trở lại chơi, debt1,01M |
| `withdrawal` | Rút toàn lot2M, cảnh báo mất480k lãi chưa trả; trả xong thiếu hụt, không còn lot active |
| `start-business` | Business quote14M vẫn tồn tại; lawful funds chỉ cash30M; dropdown START không có business |
| `insolvent` | Không cash/tài sản/credit, thiếu5M → Result mất khả năng thanh toán |
| `defeat` / `victory` | 89.999.999 ₫ thua vì reserve9.999.999; đúng90M thắng và reserve10M |
| `locked-final` | Worth103M, cash89M, business quote14M → lawful89M, thua. File tải thật ghi locked cost20M, quote14M |

Ảnh: [funding](playtests/fixture-funding.png), [withdrawal](playtests/fixture-withdrawal.png), [business tại START](playtests/fixture-business-at-start.png), [insolvency](playtests/fixture-insolvent.png), [biên mục tiêu](playtests/fixture-goal-boundary.png), [vốn khóa cuối màn](playtests/fixture-locked-final.png). Nhật ký fixture vốn khóa nằm ở [fixture-locked-final-log.json](playtests/fixture-locked-final-log.json); đây là fixture tổng hợp, không được coi là replay ván tự nhiên từ seed.

**Không gán bằng chứng browser cho test chỉ chạy engine:** các tổ hợp terminal interest, nhiều khoản gửi/bond, max-upgrade/trend khác nhau và trạng thái từ chối giao dịch được phủ bằng regression/diagnostic tests; không tuyên bố đã chơi mọi tổ hợp đó trên browser.

### Desktop/mobile

Đã kiểm tra bàn và điều khiển cả ba mode ở desktop1440×1000 và mobile320×740; B có thêm full playthrough390×844. Ở320px, phát hiện thanh bốn vòng gây tràn ngang; đã thêm wrap và xác nhận lại cả ba mode với `document.scrollWidth <= innerWidth` (320/320). B desktop hiển thị20 ô, ô14 kinh doanh. Screenshot mobile là viewport trình duyệt, chưa phải thử máy điện thoại vật lý.

## 4. Cách chạy và xuất dữ liệu

Từ thư mục repository, chạy:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5176 --strictPort
```

Mở `http://127.0.0.1:5176/`, chọn mode, savings/kỳ hạn, seed, bắt đầu. URL fixture dev: `http://127.0.0.1:5176/scripts/playtest-harness.html`; chọn fixture rồi **Nạp fixture**. Harness không có trong bản production build.

Cuối ván bấm **Tải nhật ký quyết định**. Giữa ván bấm **Chơi mới → Tải nhật ký hiện tại** trước khi quay về thiết lập. Tên file: `xoay-vong-tien-lui-<mode>-log.json`. Browser có thể thêm hậu tố khi tên trùng. Tệp tải xuống ở trình duyệt của người chơi; cần chủ động gửi lại cho người điều phối. Không tự gửi dữ liệu lên dịch vụ ngoài.

Các lệnh tái kiểm tra:

```powershell
npm test
node --experimental-strip-types --test scripts/diagnostics/*.test.ts
npm run lint
npx tsc -b --pretty false
npm run build
node --experimental-strip-types scripts/verify-v2_1-playtest-logs.ts
node --experimental-strip-types scripts/verify-v2_1-policy-impact.ts
npx tsc --ignoreConfig --noEmit --jsx react-jsx --allowImportingTsExtensions --module esnext --moduleResolution bundler --target es2023 --skipLibCheck --types 'node,vite/client' scripts/playtest-harness.tsx scripts/verify-v2_1-policy-impact.ts scripts/verify-v2_1-playtest-logs.ts
```

Script replay đọc ba JSON browser đã lưu, tái dựng từ seed và action entries, đối chiếu before mỗi action và toàn bộ state cuối ở dạng JSON. Script policy đọc dữ liệu lịch sử và tạo artifact mới; không ghi đè kết quả/manifest cũ.

## 5. Khác biệt với giả định mô phỏng trước

**Khác biệt luật:** V2 cho phép mua+nâng cùng encounter; V2.1 chặn nhánh đó. Policy lịch sử đã dùng `if/else if`, tối đa một hành động business mỗi encounter: mua, hoặc nâng, hoặc bán. Vì thế policy đó vẫn hợp lệ, không đổi hành vi. Đã thêm chú thích vào policy và ghi addendum trong báo cáo board/length để tránh coi mô tả engine V2 là luật hiện hành.

**Xác minh, không suy đoán:** chạy lại seeds `XVTL-V2-0..4999`:

- 60.000 ván: A20 và C20 × sáu policy (cash, saving, stock, business, diversified, business-exit-window) ×5.000. Mọi scalar outcome, audit và hash đường đi khớp từng dòng JSONL lịch sử.
- 25.000 ván: Original3/A20 × năm policy ×5.000. Toàn bộ aggregate khớp báo cáo length lịch sử.
- Đối soát cash/accounting residual, salary/maturity/market/terminal semantics của runner vẫn đạt. SHA-256 của config, events, market, random, selectors khớp nguồn trước thay đổi; `RULES`/`ECONOMY` khớp baseline.

Artifact: [v2_1-policy-impact.json](simulations/v2_1-policy-impact.json), ghi nhóm, số ván, hash nguồn và kết quả gốc. Không sửa rates để đạt số liệu này.

Review đã bổ sung guard cho verifier: đủ 12 nhóm A20/C20, mỗi nhóm đúng 5.000 seed liên tục không trùng, đúng horizon4 và tổng85.000 trước khi ghi thành công. Bản có guard đã chạy lại đạt. Output của test/lint/typecheck/build/replay/policy được lưu trong `docs/playtests/*-output.txt`; typecheck thành công không in thông báo nên hai file typecheck rỗng là bình thường.

Tỷ lệ thắng4 vòng đã được tái xác nhận, mục tiêu90M; mỗi ô bảng dùng5.000 seed, giữ policy giống nhau khi so A/C:

| Policy | A20 | C20 |
|---|---:|---:|
| Cash-heavy | 20,32% | 20,32% |
| Savings-heavy | 63,52% | 63,52% |
| Stock-heavy | 46,86% | 46,28% |
| Business-heavy — bán vòng cuối | 31,60% | 41,28% |
| Diversified | 38,56% | 42,86% |
| Business — tìm bán hai vòng cuối | 37,60% | 43,34% |

Những tỷ lệ này chỉ đại diện heuristic đã định nghĩa. Luật mới có thể thay kết quả **người chơi/policy trước đây mua+nâng ngay**, chưa có định lượng cho nhóm đó; không ngoại suy 85.000 ván thành “mọi chiến thuật không đổi”. Không áp đặt win rate50% hoặc ngang bằng các nhóm tài sản.

CLI chẩn đoán V2 cũ có guard hash nguồn nên sẽ chủ động dừng ở repository V2.1. Giữ nguyên manifest và số liệu lịch sử; không bỏ guard hoặc báo chúng đã pass trên nguồn mới. Dùng hai script V2.1 ở trên cho phép đối chiếu có chủ đích. Runner lịch sử chỉ tạm đổi board/horizon trong process offline rồi khôi phục; setup sản phẩm dùng mode riêng trong state.

## 6. Lỗi đã sửa, giới hạn còn lại và mức độ chắc chắn

**Đã sửa:** nâng business ngay encounter mua; thanh bốn vòng tràn ngang ở320px. Không phát hiện bug chặn playtest trong phạm vi đã kiểm tra. Review độc lập core/mode/log/tests không phát hiện lỗi cần sửa thêm.

**Giới hạn được xác nhận:**

- Ván lưu trong bộ nhớ; reload/đóng tab mất ván nếu chưa export. Không thêm autosave/backend.
- Có JSON state và CLI replay đã kiểm tra; chưa có UI nhập lại JSON. Không cam kết nhập log schema3 cũ vào engine V2.1.
- Full JSON verbose, ba ván mẫu khoảng9,4–15,1MB do giữ snapshots và nhật ký đầy đủ. Browser đã tải thành công; chưa stress-test ván có số giao dịch thủ công rất lớn.
- Chỉ kiểm thử một trình duyệt Chromium và viewport desktop/mobile; chưa kiểm thử Safari/Firefox hoặc điện thoại vật lý.
- Fixture tổng hợp là bằng chứng cho đúng nhánh UI, không phải tần suất xuất hiện, xác suất thắng hoặc ván tự nhiên.
- Chưa có người chơi thật tham gia trong đợt này. Mức hiểu tài chính, thời lượng đọc, mệt mỏi và mức vui của C20 vẫn là giả thuyết cần thu thập trong playtest.
- Thư mục không có metadata Git; không tạo repository mới/commit. Bảo toàn nguồn tài chính bằng hash và regression.

**Chưa làm có chủ đích:** đổi C20 thành mặc định, rebalance tham số, triển khai hosting và đánh giá kết quả người chơi thật. Các việc này cần quyết định sau playtest, không phải phần còn thiếu của V2.1 được yêu cầu.

**Kết luận xác nhận:** ba chế độ đã chơi được; hai chế độ4 vòng đã hoàn tất Result thật; export/replay hoạt động; kiểm thử/lint/typecheck/build đạt; các policy lịch sử không đổi kết quả. V2.1 sẵn sàng cho một đợt playtest có kiểm soát. Điều này không đồng nghĩa cân bằng cuối cùng đã được phê duyệt.
