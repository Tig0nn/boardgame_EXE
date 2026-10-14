> **HISTORICAL** — Triển khai profile savings V2.2; số test và tình trạng hosting thuộc ngày 11/10/2026. Nguồn chuẩn hiện tại: [CURRENT_MVP.md](CURRENT_MVP.md). Các phương pháp, kết quả và nội dung gốc bên dưới được giữ nguyên; lệnh lịch sử không được thực thi lại trong audit này.

# V2.2 — Triển khai profile tiết kiệm đã duyệt

Ngày: **11/10/2026**. Nhánh: **`feat/v2-2-savings-profile`**. Commit code/kiểm thử cục bộ: **`8d72753`**.

**Đã hoàn tất thay đổi được duyệt, sẵn sàng chủ dự án review và solo playtest.** Experimental B mới dùng 4/5/6%; hai mode A20 giữ 6/7/8%. Đã chạy 109 tests sản phẩm, 19 diagnostic tests, lint, typecheck, build; chơi đủ một ván B qua Result và replay JSON tải thật. Không push, merge hoặc deploy.

## 1. Phạm vi và profile thực tế

Đã đọc [review cơ chế](V2_2_MECHANICS_REVIEW.md), [guide solo](V2_2_SOLO_TEST_GUIDE.md), [readiness V2.1](V2_1_PLAYTEST_READINESS.md), kiểm tra source, tests và trạng thái Git trước sửa. Tiếp tục repository hiện có, giữ kết quả nghiên cứu trước đó. Git hiện có và đã tạo nhánh riêng; nhận xét “chưa có Git” trong báo cáo nghiên cứu là trạng thái lịch sử.

| Mode | Board / vòng | Profile lưu trong state | Lãi mỗi START, kỳ hạn 1 / 2 / 3 | Tổng lãi đủ kỳ |
|---|---|---|---|---|
| Original — mặc định | A20 / 3 | `v2.1-standard` | 6% / 7% / 8% | 6% / 14% / 24% |
| Experimental A | A20 / 4 | `v2.1-standard` | 6% / 7% / 8% | 6% / 14% / 24% |
| Experimental B — ván mới | C20 / 4 | `v2.2-c20` | **4% / 5% / 6%** | **4% / 10% / 18%** |

Lãi đơn = `Math.round(principal × lot.rate × số START của kỳ hạn)`, trả một lần khi đáo hạn. Ví dụ B: 10M term1 nhận 10,4M; term2 nhận 11M; term3 nhận 11,8M. Không có lãi kép hoặc tự tái tục.

Profile được tạo riêng cho từng ván và sao chép vào snapshot; không gán lại `ECONOMY.savingsRates` hay sửa file config toàn cục. Mỗi lot lưu rate khi mở, nên khoản cũ không bị định giá lại. Initial allocation và gửi thêm dùng cùng profile; preview setup/ngân hàng đọc profile tương ứng. Settlement, forfeited interest và nguồn hợp lệ tiếp tục đọc `lot.rate` theo công thức hiện có.

Giữ nguyên whole-lot withdrawal: rút toàn gốc, mất toàn lãi chưa trả. Lot gửi vòng `L`, kỳ hạn `T`, đáo hạn START `L+T−1`; kỳ hạn vượt màn vẫn được phép, cuối màn chỉ tính gốc rút sớm. Emergency funding vẫn do người chơi chọn nguồn, không tự vay hoặc đổi thứ tự quyết toán.

`config.ts`, `board.ts`, `modes.ts`, `events.ts`, `random.ts`, `market.ts`, `business.ts`, `settlement.ts`, `selectors.ts` không có diff. Vốn50M, lương14M, course6M/+3M, goal80M+10M, các tài sản, business, nợ/nghĩa vụ, xúc xắc và bàn không đổi. UI chỉ cập nhật câu chữ/preview lãi, không đổi bố cục.

## 2. State, JSON và tương thích lịch sử

Log mới **schema5**, rules version `gameplay-v2.2-savings-2026-10-11`. Có `savingsProfile:{id,rates}` ở top-level, state và snapshots; `financialConfig.ECONOMY.savingsRates` ghi rates thực của ván bằng bản sao. Các khoản gửi vẫn có `rate`, kỳ hạn, trạng thái và lãi thực nhận riêng. Hằng `RULES.savingsRate` cũ vẫn được giữ để không sửa baseline; engine không dùng nó để tính lot. Khi đọc log, dùng `savingsProfile`/lot và `ECONOMY.savingsRates` đã xuất.

**State V2.1 không có profile luôn fallback 6/7/8%, kể cả C20.** Không suy profile mới chỉ từ `gameMode`. Mở thêm lot trên state lịch sử vẫn dùng profile cũ; JSON continuation không đổi lãi lot đã mở.

CLI replay nhận schema4/V2.1 hoặc schema5/V2.2. Schema4 chọn profile cũ tường minh và so mọi giá trị tài chính, RNG, action, snapshot, summary và final state; chỉ bỏ qua trường metadata `savingsProfile` mới khi đối chiếu log cũ. Schema5 xác nhận rates khớp profile ID và replay toàn snapshot, không bỏ trường profile. Export lại state V2.1 sang schema5 bổ sung metadata cũ vào snapshot, giữ mọi số tiền/lot lịch sử.

Ba file browser V2.1 gốc không sửa và replay thành công:

| File | Rolls / salary | Nguồn hợp lệ giữ nguyên |
|---|---|---|
| `original-log.json` | 17 / 3 | 75.200.000đ |
| `a-log.json` | 25 / 4 | 92.384.234đ |
| `b-log.json` — C20 lịch sử | 26 / 4 | 116.734.938đ |

Đã kiểm cả re-export B lịch sử sang schema5 và export/replay ván schema5 đang chơi dở. Đây là tương thích state/CLI; chưa có UI import JSON, không thêm hệ thống import hoặc autosave.

## 3. Kiểm thử và build

| Kiểm tra chạy thực tế | Kết quả cuối |
|---|---|
| `npm test` | **109/109 pass**: 90 cũ + 19 mới, 0 fail/skip |
| `node --experimental-strip-types --test scripts/diagnostics/*.test.ts` | **19/19 pass** |
| `npm run lint` | Pass, không lỗi/cảnh báo ESLint |
| `npx tsc -b` | Pass |
| Strict typecheck các script/test mới và replay | Pass |
| `npm run build` | Pass; Vite8.3.3, 48 modules; JS303,71kB, gzip92,96kB |
| Replay 3 log V2.1 và log B V2.2 tải thật | Pass |
| `git diff --check` | Pass |
| 6.000 ván diagnostic focused | Hoàn tất; residual kế toán0đ; 3.000 cặp path/RNG/scenario khớp |

19 tests mới bao phủ 3 mode ×3 kỳ hạn, lãi đơn và đáo hạn đúng một lần; nhiều lot độc lập qua JSON; rút toàn lot, từ chối rút một phần và mất đúng lãi; funding bằng savings; lot chưa đủ hạn không có lãi trong terminal lawful proceeds; profile không nhiễm giữa ván/mode/config/snapshot; 3 log lịch sử; schema5 đang chơi dở; state cũ mở lot mới và re-export lịch sử. Các tests có sẵn về tài sản, nghĩa vụ, settlement, goal và business tiếp tục pass. Cảnh báo experimental type stripping của Node22 vẫn có, không phải test/build failure.

## 4. So sánh focused bằng seed ghép cặp

Dữ liệu: [v2_2-approved-savings-comparison.json](simulations/v2_2-approved-savings-comparison.json), gồm summary và 6.000 hàng per-game. **1.000 seed `XVTL-V2-0`…`XVTL-V2-999` cho mỗi policy/profile**; không chạy lại nghiên cứu100.000 ván. Cả hai phía đều C20/4 vòng/90M; khác duy nhất profile rates. So A20 với C20 lúc này đổi cả board lẫn lãi, không dùng làm đối chứng riêng lãi. Runner có mode tường minh không gán tạm cả global horizon; test kiểm ngay bên trong ván. Tái chạy 6.000 kịch bản sau bước này cho JSON byte-identical.

Policy chung: initial term3; dự phòng10M; tại bank gửi85% phần cash vượt10M nếu phần dư≥1M, làm tròn xuống đồng; kỳ hạn=min(3, số START còn lại). Mua course một lần nếu đủ cash và còn≥2 START; trả nghĩa vụ ngay; không mua stock/bond/gold/business; không vay để đầu tư. Default funding rút toàn lot active đầu tiên rồi các nguồn hợp lệ hiện có và cuối cùng vay; nhóm debt-first ưu tiên vay vừa đủ thiếu trong hạn mức, fallback các nguồn khác nếu cần. Đây là heuristic cố định, không nhìn giá/RNG tương lai và không tối ưu theo kết quả ván.

Đơn vị tiền trong bảng: triệu đồng. p10/p90 là nguồn hợp lệ cuối màn.

| Policy | Profile | Thắng | Median | p10 / p90 | Lãi savings TB | Thiếu tiền TB/ván | Từng vay |
|---|---|---:|---:|---:|---:|---:|---:|
| Đầu40M | cũ6/7/8 | 64,2% | 94,956 | 76,600 / 111,259 | 10,098 | 0,379 | 0% |
| Đầu40M | mới4/5/6 | **56,4%** | **92,148** | 75,081 / 107,325 | 7,397 | 0,379 | 0% |
| Đầu30M | cũ6/7/8 | 68,1% | 96,200 | 78,836 / 111,091 | 10,816 | 0,123 | 0% |
| Đầu30M | mới4/5/6 | **60,4%** | **93,389** | 76,547 / 107,400 | 7,928 | 0,124 | 0% |
| Debt-first40M | cũ6/7/8 | 70,9% | 96,762 | 79,993 / 111,679 | 12,482 | 0,609 | 36,5% |
| Debt-first40M | mới4/5/6 | **61,8%** | **93,587** | 77,042 / 107,735 | 9,167 | 0,609 | 36,5% |

Chênh lệch paired nguồn hợp lệ TB (mới−cũ):

| Policy | TB delta | Khoảng95% xấp xỉ chuẩn cho TB delta |
|---|---:|---:|
| Đầu40M | −2,701M | [−2,776; −2,626]M |
| Đầu30M | −2,888M | [−2,942; −2,834]M |
| Debt-first40M | −3,315M | [−3,358; −3,273]M |

Lãi nợ TB debt-first cũ/mới là0,172284/0,172361M; hai policy default không vay trong mẫu. Course rate cũ/mới giữ nguyên tương ứng80,5% /83,2% /77,1%. Cả6.000 ván hoàn tất, không insolvency. 3.000 cặp có đường die/vị trí/forecast khớp; chênh lệch dòng tiền có thể dẫn tới lượng gửi hoặc funding khác, đó là hậu quả của rates trong cùng policy.

**Xác nhận:** giảm thưởng tiết kiệm và win rate của ba policy trong mẫu. **Suy luận giới hạn:** dự phòng30M và vay-first vẫn tạo lựa chọn thanh khoản đáng cân nhắc; chưa chứng minh tối ưu hoặc trải nghiệm học tốt hơn. Khoảng95% chỉ là ước lượng trên seed và heuristic này, không bao phủ sai lệch mô hình hay mọi người chơi. Không chỉnh thêm tham số để nhắm tỷ lệ thắng50%.

Guide đã tính lại seed2 với policy đầy đủ: 30M→99.205.000đ;40M/rút→96.355.000đ;40M/vay-first→100.046.500đ. Rút40M term3 ở B mất7,2M lãi, không còn9,6M. Các số này được xác nhận bằng engine, không gọi là browser playthrough.

## 5. Browser verification thực tế

Chơi trực tiếp Chromium trong Codex in-app browser tại `http://127.0.0.1:5176/`, qua UI bình thường, seed **`XVTL-V2-6`**, Experimental B, initial30M term3; không nạp fixture hoặc chỉnh hidden state. Đã xác nhận setup Original mặc định và Experimental A còn6/7/8%; sau chọn B, options/preview hiển thị4/5/6%.

Policy browser riêng: gửi thêm5M term1 ở lượt1, học6M lượt5; gửi5M term2 ở lượt14/vòng3 và5M term1 ở lượt21/vòng4; bỏ các cơ hội tài sản khác, trả chi phí ngay, nhận thưởng, xác nhận macro. Policy này **khác** runner bank85%, không dùng kết quả102,8M thay cho benchmark guide seed2.

| Checkpoint đã nhìn trên browser | Kết quả |
|---|---|
| Setup B | C20/4, ô14 business,30M term3 preview5,4M |
| Bank lượt1 | term1 rate4%,5M preview200k |
| START1 | salary17M; lot2 nhận5,2M; cash28,2M |
| START2 | salary17M; lot đầu chưa đáo hạn; cash37,7M |
| Bank vòng3/lượt14 | term2 rate5%,5M preview500k; maturitySTART4 |
| START3 | salary17M; lot đầu nhận35,4M; lot3 còn active; cash78,1M |
| Vòng4/lượt22 | macro demand-boom cập nhật; marker chart hiện rõ |
| START4 | salary17M; lot3 nhận5,5M và lot4 nhận5,2M |
| Result | **102.800.000đ** nguồn hợp lệ, còn22.800.000đ sau mua80M; **thắng** |

Đủ **26 dice rolls, 4 salary và 4 settlement**, mỗi lot đáo hạn một lần, tổng lãi savings6,3M. Đối chiếu tiền:50M+68M lương+4M thưởng−6M học−12,5M personal/contract−7M living+6,3M lãi=102,8M. Nợ/nghĩa vụ/tài sản khác cuối màn đều0.

Đã bấm **Tải nhật ký quyết định**, nhận file trong Downloads, sao chép nguyên nội dung thành [v2_2-b-log.json](playtests/v2_2-b-log.json) (~15,1MB), replay từng snapshot và final state thành công bằng CLI. [Tổng hợp kiểm chứng](playtests/v2_2-verified-browser-log.json). Console không có warning/error trong lần kiểm tra này.

Bằng chứng ảnh: [setup](playtests/v2_2-setup.png), [START1](playtests/v2_2-start1.png), [term2 preview](playtests/v2_2-term2.png), [START3](playtests/v2_2-start3.png), [START4](playtests/v2_2-start4.png), [Result](playtests/v2_2-result.png).

**Giới hạn browser:** ván mới này kiểm maturity/lot/goal thắng; không gặp emergency rút/vay, insolvency hoặc thua. Các nhánh đó được kiểm bằng engine tests và diagnostic, không tuyên bố đã browser-test lại với rates mới. Không chạy lại full playthrough A20, mobile, Safari/Firefox trong đợt này. Bằng chứng V2.1 trước đây vẫn là lịch sử.

## 6. Files thay đổi

| Nhóm | Files / mục đích |
|---|---|
| Profile và state | `src/game/savings.ts` mới; `types.ts`, `engine.ts`, `state.ts`: ID/rates riêng, clone snapshot, chọn profile khi tạo ván/replay |
| Gửi và export | `src/game/transactions.ts`: rate lot; `src/game/log.ts`: schema5/profile/metadata lịch sử |
| UI hiện có | `src/components/Setup.tsx`, `TradingPanel.tsx`: options, mô tả, preview theo mode/state |
| Regression | `tests/v2_2.test.ts`:19 tests mới |
| Replay | `scripts/diagnostics/replay-game-log.ts` mới; `scripts/verify-v2_1-playtest-logs.ts` tái sử dụng helper; `scripts/verify-v2_2-playtest-log.ts` mới |
| Diagnostic | `scripts/diagnostics/game-length-model.ts`: hook profile; `mechanics-model.ts`, `mechanics.test.ts`: bỏ global rate mutation, giữ nhóm nghiên cứu lịch sử; `scripts/compare-v2_2-savings.ts` mới |
| Tài liệu/dữ liệu | Báo cáo này, guide solo, addendum review lịch sử, `tasks/plan.md`, `tasks/todo.md`, JSON comparison và file/ảnh `docs/playtests/v2_2-*` |

Không thêm dependency, backend, analytics, UI import, AI hoặc hệ thống tài chính.

## 7. Lệnh tái lập

Chạy tại root repository, Node22.14/npm10.9.2 đã có dependencies:

```powershell
npm test
node --experimental-strip-types --test scripts/diagnostics/*.test.ts
npm run lint
npx tsc -b
npx tsc --ignoreConfig --noEmit --strict --target es2023 --module nodenext --allowImportingTsExtensions --skipLibCheck --types node scripts/compare-v2_2-savings.ts scripts/verify-v2_1-playtest-logs.ts scripts/verify-v2_2-playtest-log.ts tests/v2_2.test.ts
npm run build
node --experimental-strip-types scripts/verify-v2_1-playtest-logs.ts
node --experimental-strip-types scripts/verify-v2_2-playtest-log.ts
node --experimental-strip-types scripts/compare-v2_2-savings.ts 1000
npm run dev
```

Lệnh comparison ghi lại đúng file JSON focused; không ghi đè nghiên cứu lớn trước phê duyệt. Runner nghiên cứu cũ hiện chọn profile explicit để controls tiếp tục dùng lãi cũ; manifest44 file cũ đánh dấu thời điểm chưa triển khai, không cập nhật hash để giả vờ source không đổi.

## 8. Vấn đề còn lại

Không phát hiện bug chặn playtest trong phạm vi thay đổi này. Chủ dự án chưa cung cấp feedback solo; simulation và automated browser playthrough không thay cho feedback người thật. JSON còn verbose; state vẫn trong bộ nhớ và mất khi reload nếu chưa export. Replay hỗ trợ schema4/5; schema3 và JSON bị sửa tay không được cam kết. Không có migration hồi tố log lịch sử sang lãi mới.

Không còn hạng mục triển khai nào của profile được duyệt bị bỏ dở. Các quyết định cân bằng ngoài profile này chưa được áp dụng. Nhánh đã chuẩn bị để review; chưa push, merge hoặc deploy Vercel.
