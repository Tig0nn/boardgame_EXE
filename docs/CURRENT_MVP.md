> **CURRENT** — Nguồn tài liệu chuẩn cho MVP và candidate Mobile. Cập nhật Atomic Investments 15/10/2026; giữ các mốc audit/hosting 13/10 đúng phạm vi, tách policy encounter mới khỏi công thức tài chính.

# MVP hiện tại — Xoay Vòng Tiến Lui V2.4

Business UX final 15/10/2026: Bản tin đầu vòng và ô Kinh doanh (kể cả chưa mở quán) hiển thị thị hiếu hiện tại; Sổ tay có mục thu gọn “Thị hiếu vòng hiện tại” cùng các tầng đã nâng. Các vị trí đọc cùng GameState/selector, tách khỏi dự báo kinh tế; thưởng trùng 1 triệu/tầng tại START và công thức giữ nguyên. [Bàn giao UI](BUSINESS_PREFERENCE_UX_FINAL_REPORT.md): 304 tests/62 diagnostics, hai builds; không thêm gameplay và chưa tự thực hiện đợt Core Freeze/Final QA.

## Periodic Living V2.6 — candidate 15/10/2026

Nhánh hiện tại `codex/periodic-living-expenses` từ Economic Event UX `34f91ea`: ván Mobile mới chọn `livingExpenseRulesVersion=v2.6-periodic-start` và `boardRevision=c20-v2.6-a`. Thu cố định 7M sau salary/Business/maturity và trước nợ/nghĩa vụ ở mỗi START hoàn tất, gồm vòng 4; không thu setup. Ô 4 Stocks, ô 15 Gold; personal 8/18 giữ nguyên. Hướng recurring đã duyệt, còn 7M/layout A là thử nghiệm, chưa merge/phát hành. Root Web và metadata vắng vẫn on-landing lịch sử, không migrate saved game.

[Thiết kế và handoff designer](PERIODIC_LIVING_EXPENSES_DESIGN.md), [implementation/evidence](PERIODIC_LIVING_EXPENSES_IMPLEMENTATION_REPORT.md), [18.000 ván cân bằng](PERIODIC_LIVING_EXPENSES_BALANCE_REPORT.md): 304 tests/57 diagnostics, hai builds, hai browser four-lap replays exact. Pool 7M/A thắng 5,40% so legacy 50,33%; không tự đổi sang 5M/6M. Lương ≥14M nhận trước phí 7M nên funding sinh hoạt không tự nhiên phát sinh; chỉ test nhánh đó bằng fixture có nhãn. Artwork gốc giữ nguyên, hai marker tạm diễn đạt đúng ô mới. Chưa xác minh Actions/deployment của candidate.

## Bond Credit V2.5 — experimental candidate 15/10/2026

Nhánh `codex/bond-credit-v2-5` từ Atomic `f3a03cb` bổ sung metadata độc lập `bondRulesVersion`. Phiên mới trên nhánh này dùng `v2.5-credit-risk`; metadata vắng/API lịch sử vẫn Bond V2.4, không migrate session/log cũ. Đây **chưa phải luật chính thức đã duyệt**. [Đặc tả](BOND_V2_5_DESIGN_SPEC.md), [triển khai và kiểm chứng](BOND_V2_5_IMPLEMENTATION_REPORT.md), [12.000 ván cân bằng](BOND_V2_5_BALANCE_REPORT.md) ghi đầy đủ giả định và giới hạn. Các mục V2.4/hosting/CI bên dưới giữ phạm vi theo mốc cũ.

V2.5 có An Tâm (AA, coupon 4,5%/START) và Bứt Phá (B, 10%/START), mệnh giá100.000 ₫, hai START. Coupon cao không bảo đảm lợi nhuận: issuer có thể chậm trả hoặc default; thu hồi gốc80%/50% tại START tiếp theo, không trả coupon chưa thu khi default. Giá riêng theo credit/scenario/stress, không cộng dải tăng giá Bond cũ. Credit RNG độc lập; stock/gold/dice và Business V2.4 không đổi. Mua một issuer/ghé, tự về bàn; bán/funding chọn một lot, phí1,5%. Khoản chưa nhận không phải cash; không có executable quote thì không tính vào nguồn tiền về đích. Balance parameters đang chờ owner review.

## Atomic Investment Encounters — candidate 15/10/2026

Nhánh `codex/atomic-investment-encounters` từ Economic News `d990244` áp policy đã phê duyệt `v2.4-atomic-investments` cho phiên người chơi mới ở cả hai UI: Stocks/Gold/Bonds chỉ mua một lần mỗi lần ghé; mua thành công tự về bàn, bỏ qua không mua, giao dịch lỗi không mất cơ hội. Engine chặn mua lại cùng turn kể cả mở lại encounter hoặc đổi mã/tài sản. Bank, Business, START, công thức giá/phí/thu nhập, RNG và selector tin tức không đổi. [Báo cáo và bằng chứng](ATOMIC_INVESTMENT_ENCOUNTERS_REPORT.md): 224 tests, 39 diagnostics, hai builds và ván browser bốn vòng replay PASS; chưa merge/deploy hoặc xác minh Actions mới.

Không migrate phiên đang chạy. Player factory truyền version mới; API `createGame` vẫn giữ mặc định `v2.4-business-purchase-complete`. Replay chọn version trong dữ liệu đã lưu; metadata encounter vắng nghĩa là `legacy-multi-action`. Log Gold/Bonds cũ có mua nhiều lần vẫn hợp lệ theo policy cũ, không áp hạn mức mới khi replay.

## Economic News V1 — candidate 15/10/2026

Nhánh `codex/economic-news-v1` từ `codex/mobile-ui-final` tại `b97b16c` thêm Bản tin Kinh tế & Thị trường trong phase forecast, so sánh Dự báo vs. Thực tế tại START và mục mở rộng ở ô Cổ phiếu/Trái phiếu/Vàng. [Báo cáo và bằng chứng](ECONOMIC_NEWS_V1_REPORT.md) ghi 203 product tests, 34 diagnostics và ván browser replay đủ bốn vòng. Đây là validation local, chưa deploy/merge candidate hoặc xác minh Actions mới.

Selector chỉ đọc scenario/snapshot đầu vòng và lịch sử giá đã xảy ra đến cập nhật START của đúng vòng. Tỷ lệ là giá cuối / giá đầu − 1, gồm các cú sốc đã công khai một lần; cổ phiếu dùng bình quân cùng trọng số giữa các mã. Không phải lợi nhuận danh mục, không gồm coupon/phí. Thiếu đầu vòng hoặc chuỗi giá đầy đủ thì hiện “Chưa đủ dữ liệu”. Không thêm RNG, state field, nguồn tin thật hoặc lời khuyên chắc thắng. Business vẫn tách riêng: sở thích khách quyết định thưởng vận hành, thị trường chỉ có thể đổi giá thu hồi; tiết kiệm giữ lãi cố định theo kỳ hạn.

## Candidate UI tổng hợp — 14/10/2026

Nhánh review mới `codex/mobile-ui-final` dựa trên onboarding `13faa21`, chọn lọc visual từ `277d2dc`; không merge/cherry-pick cả commit UI. [Báo cáo tổng hợp](MOBILE_UI_FINAL_REPORT.md) ghi quyết định, kiểm chứng và ảnh trước/sau. Mốc audit/hosting bên dưới là lịch sử ngày 13/10; candidate này chưa deploy và chưa merge vào main.

Mobile giữ tutorial 6 bước trước lần chơi đầu, Bỏ qua, marker an toàn trên thiết bị và Sổ tay phủ trên panel mà không reset game/input. Setup và Bank dùng thẻ kỳ hạn lấy rate từ profile chính thức: 4% / 5% / 6% mỗi START, tổng lãi đơn 4% / 10% / 18% cuối hạn. HUD chỉ cash, goal progress và debt khi có; tài sản ròng ở Ví. Result tính lawful proceeds, không tự thanh lý. Bàn cờ trong Sổ tay lấy trực tiếp C20; asset minh họa vẫn có các icon lệch đã ghi nhận, không thay luật để khớp ảnh.

## Phạm vi và thứ tự nguồn chuẩn

MVP là game tài chính tiếng Việt một người chơi, React/TypeScript/Vite, với hai giao diện dùng chung engine. Tài liệu này mô tả code trên `feat/mobile-v2-4-engine-integration`, mốc audit `13c9c7c5fa932e50a3ba23da4b316e1dff4cdda9`. [PR #8](https://github.com/Tig0nn/boardgame_EXE/pull/8) **đang mở, chưa merge vào main**. Không suy ra main đã có toàn bộ Mobile/AI chỉ vì ứng dụng đã có URL.

Đây là nguồn chuẩn của **tài liệu hiện hành**. Công thức và chuyển trạng thái phải đối chiếu engine/test được liên kết bên dưới; nếu tài liệu sai thì sửa tài liệu, không tự thay luật. [Danh mục tài liệu](README.md) và [audit đầy đủ](DOCUMENTATION_AUDIT.md) phân biệt CURRENT, HISTORICAL, SUPERSEDED. Các nhãn version của package, footer cũ hoặc tên project không quyết định luật của một ván.

## Mode, mục tiêu và bàn cờ

| Thuộc tính của entry point người chơi | Giá trị từ code |
| --- | --- |
| Mode | `experimental-b` — Experimental B |
| Board / thời hạn | C20, **20 ô, 4 vòng** |
| Vốn đầu ván | **50.000.000 VND**, phân bổ giữa cash và tiết kiệm |
| Lương cơ bản | **14.000.000 VND mỗi START** |
| Mục tiêu | Mua món đồ **80.000.000 VND**, còn ít nhất **10.000.000 VND** dự phòng |
| Setup mặc định hai UI | Gửi 20.000.000 VND kỳ hạn 1 START, cash 30.000.000 VND; người chơi có thể chỉnh |
| Luật business / encounter mới | `v2.4-customer-preferences` / `v2.4-atomic-investments` |
| Luật Bond trên nhánh V2.5 thử nghiệm | `v2.5-credit-risk`; phiên lịch sử giữ `v2.4-single-issuer` hoặc metadata vắng |
| Sinh hoạt Mobile candidate / Web và historical | START 7M + C20 A có version / on-landing 4/15 |
| Profile savings / catalog mới | `v2.2-c20` / `vn-v1` |

Nguồn: [config](../src/data/config.ts), [modes](../src/data/modes.ts), [player factory](../src/game/new-game.ts), [Web setup](../src/components/Setup.tsx), [Mobile setup](../mobile_app/src/components/GameSetup.tsx), [Mobile session](../mobile_app/src/game/session.ts). `RULES.laps = 3` là mặc định API/diagnostic lịch sử; entry point người chơi truyền mode B tường minh và nhận `totalLaps = 4`. Original (3/A20) và Experimental A (4/A20) còn trong code để replay/kiểm thử; không phải lựa chọn mode mặc định của UI hiện tại.

Thứ tự **C20 lịch sử** dưới đây là **1-based**, từ [board.ts](../src/data/board.ts):

| Ô | Loại |
| --- | --- |
| 1 | START |
| 2, 13 | Ngân hàng |
| 3, 12 | Cổ phiếu |
| 4, 15 | Sinh hoạt |
| 5, 17 | Đầu tư bản thân/khóa học |
| 6 | Biến cố kinh tế |
| 7, 20 | Trái phiếu |
| 8, 18 | Biến cố cá nhân |
| 9, 14, 16 | Kinh doanh |
| 10, 19 | Vàng |
| 11 | Dòng tiền/nghĩa vụ |

C20 lịch sử khác A20 tại ô 14 (index 13): macro → business. Candidate V2.6 chỉ thay ô 4 → Stocks, 15 → Gold trong boardRevision mới; gọi boardFor(active session) để chọn bàn. D6 và sự kiện vẫn lấy từ RNG seeded. On-landing lịch sử trả 7 triệu khi dừng đúng ô; periodic Mobile trả 7 triệu tại START, không thu trên ô thay thế. Nội dung/lựa chọn chi phí khác nằm trong [events.ts](../src/data/events.ts).

## Lượt chơi, START và điều kiện thắng

[Engine](../src/game/engine.ts) điều khiển forecast → rolling → event/funding, và khi qua START: summary → rebalancing → forecast kế tiếp hoặc finished. Khi vượt START, quyết toán xảy ra trước ô đích; ô đích chờ được xử lý sau forecast vòng mới. Ở vòng cuối, ô đích vượt START bị bỏ, nhưng vẫn có checkpoint bán trước kết quả.

[Settlement](../src/game/settlement.ts) chạy đúng một lần. Candidate periodic chèn sinh hoạt 7M sau maturity/coupon và trước nợ; legacy không có bước đó. Thứ tự legacy: thị trường normal → lương/khóa học → thu nhập business → đáo hạn savings/coupon và gốc bond → gốc/lãi nợ đến hạn → nghĩa vụ đã hẹn. Funding có thể tạm dừng và tiếp tục bằng cursor, không trả thu nhập hai lần. Khoản vay mới tại START cuối có lãi 10% được cộng vào nợ để trừ khỏi nguồn huy động; không biến thành tiền thắng miễn phí.

Khóa học tự nguyện giá 6 triệu, chỉ mua một lần và bằng cash đủ; tăng lương 3 triệu từ START kế tiếp. Một vòng/START là đơn vị game, không phải năm hoặc tháng ngoài đời.

[Selectors](../src/game/selectors.ts) dùng một phép tính chung:

```text
lawful proceeds = cash + gốc các savings lot đang active
                + báo giá bán ròng stocks/bonds/gold
                - debt - obligations - pendingPayment.remaining
```

Thắng khi không insolvent, proceeds ≥ 80 triệu và proceeds − 80 triệu ≥ 10 triệu, tức đủ 90 triệu sau các khoản trừ trên. **Không** dùng riêng net worth hay cash ở HUD; business chưa bán và lãi savings chưa trả bị loại. Đây là kiểm tra khả năng mua, không tự tạo transaction mua món đồ 80 triệu vào log.

## Savings, đầu tư và funding

[Savings profile](../src/game/savings.ts) của B dùng lãi đơn **4% / 5% / 6% mỗi START** cho kỳ hạn 1/2/3 START; tổng lãi đủ kỳ lần lượt 4%/10%/18%. A20 mới và state lịch sử thiếu profile giữ 6%/7%/8%; không suy profile mới từ tên mode của log cũ.

[Transactions](../src/game/transactions.ts) tạo từng lot độc lập, `maturityLap = startLap + term − 1`, lãi cuối kỳ `round(principal × rate × term)`. Maturity trả gốc/lãi một lần, không tự tái tục. Mỗi encounter Ngân hàng được gửi **một lot mới**, rồi tự đóng; gặp Ngân hàng ở lượt khác vẫn được thêm lot dù còn lot active. Đây là Policy A được duyệt. Rút sớm chỉ phục vụ thiếu tiền bắt buộc, phải rút toàn lot, nhận gốc và mất lãi chưa trả. Lot đáo hạn ngoài màn không nhận lãi giả ở cuối ván; gốc active vẫn được xét khi tính mục tiêu.

Mua tự nguyện chỉ ở đúng ô tài sản và đủ cash; START cho bán stocks/bonds/gold và trả nợ chủ động, không mở mua mới. Phiên mới mua Stocks/Gold/Bonds một lần mỗi lượt ghé, tự kết thúc encounter; lượt ghé sau được mua tiếp. Gold/Bonds trong các policy lịch sử vẫn mua nhiều lần; Stocks lịch sử chỉ atomic khi action yêu cầu completion. Các phí dưới đây là **phí bán**, không tự gán thêm phí mua:

| Tài sản | Cơ chế hiện hành |
| --- | --- |
| Stocks | Units = số tiền mua / giá mã hiện tại; phí bán 1% |
| Gold | Units theo giá giả lập; spread bán 3%, rồi phí 1% trên giá trị sau spread |
| Bonds V2.4 lịch sử | Mệnh giá 100.000 VND; units theo giá mua; principal = units × mệnh giá; coupon 5% principal/START, kỳ hạn 2 START, trả gốc một lần; phí bán sớm 1,5% |
| Bonds V2.5 candidate | Hai issuer, coupon4,5%/10%, giá và credit riêng; cash chỉ tăng khi được trả, bán theo lot; xem đặc tả thử nghiệm ở trên |

Báo giá/holdings/chart cùng đọc simulated market. Bond issuer là giả lập; phiên V2.4 có biến động giá nhưng không có random default. V2.5 thêm credit RNG độc lập và không đổi lịch sử.

Khoản phải trả dùng cash trước. Nếu thiếu, người chơi phối hợp rút toàn lot savings, bán tài sản tài chính và vay với trần tổng nợ **30 triệu**; hạn mức còn lại là max(0, 30 triệu − nợ hiện tại), khoản vay funding không vượt shortfall. Tiền dư từ rút lot/bán tài sản vẫn ở cash. Lãi nợ 10% theo START; trả nợ chủ động tại checkpoint trước vòng cuối trả gốc cộng 10% phần gốc trả, còn checkpoint cuối không cộng lãi lần nữa sau bước terminal accrual. Không bán business khi funding hoặc tại START. Không còn nguồn hợp lệ/hạn mức thì kết thúc insolvent rõ ràng, không gieo tiếp hay ghi tiền âm vô cớ. Phí, tiền ròng và lãi bị mất theo selector/engine, không do Mobile tự tính.

## Business V2.4

[Business](../src/game/business.ts), [encounter gates](../src/game/encounters.ts) và [customer preference RNG](../src/game/customer-preferences.ts) xác định:

- Mua cơ sở 20 triệu; giá thu hồi khởi tạo 70% = 14 triệu. Mua atomically kết thúc encounter; không nâng cấp/bán ở lượt vừa mua.
- Lần gặp Business sau mới mở upgrade: 5 triệu/tầng, tối đa 6 tầng, một upgrade mỗi encounter; sau đó vẫn có thể bán toàn cơ sở ngay tại ô Business.
- Thu nhập START khi sở hữu: **3 triệu + 700 nghìn × tổng tầng + 1 triệu × tầng khớp sở thích hiện tại**. Một tầng khớp cho 4,7 triệu; không khớp cho 3,7 triệu.
- Ba khóa riêng `checkin`, `budget`, `taste`; chọn từ seed + lap bằng RNG riêng. Sở thích cố định suốt vòng, có thể trùng ở các vòng kế tiếp. Đổi sở thích không xóa upgrade và lợi ích cố định 700 nghìn.
- Forecast/macro không trực tiếp nhân thu nhập vận hành V2.4. Vốn thu hồi được cộng 50% chi phí upgrade, rồi chịu normal market/depreciation 8% theo công thức hiện có và macro shocks; giá bán không phải hoàn đủ vốn. Chỉ bán business tại ô Business; vốn chưa bán không tính vào proceeds.

V2.3 matching theo scenario và V2.2 trend/shock còn được giữ cho replay; không ánh xạ khóa cũ sang preference mới.

## Catalog, random và replay

[Stock catalog](../src/data/stock-catalog.ts) mới `vn-v1`: FPT, CMG, VCB, TCB, HPG, BMP; tên doanh nghiệp thật dùng làm identity, ba nhóm sector rộng của game. **Giá, volatility, lịch sử và lợi suất đều giả lập**, không gọi API giá thật hay dùng giá niêm yết trực tiếp. Catalog `fictional-v1` và ID `XV-*` cũ giữ nguyên. `createGame` mặc định catalog lịch sử; hai entry point người chơi dùng `createPlayerGame` để chọn `vn-v1`.

[Market](../src/game/market.ts) khởi tạo 12 điểm history bằng stream riêng; normal return và macro shock thay báo giá một lần từ giá hiện tại, không áp lại shock tại START. Xem chart không tiêu thụ gameplay RNG.

[Seed factory](../src/game/seed.ts) gọi `crypto.getRandomValues` trên 4 số uint32 (128 bit, 32 ký tự hex) khi seed người chơi để trống, gồm chơi lại. Seed cố định chỉ là tùy chọn tái kiểm. Gameplay sau khởi tạo vẫn deterministic: cần cùng seed, mode, profile, version business/encounter/catalog, allocation/term và chuỗi action để tái hiện.

[JSON export](../src/game/log.ts) hiện schema 5, gồm metadata, before/after snapshot và state. [Replay tool](../scripts/diagnostics/replay-game-log.ts) hỗ trợ schema 4/5 có version/fallback tương ứng, không đổi holdings lịch sử. Không cam kết schema 3 hoặc JSON bị sửa tay. Chưa có import UI, autosave, tài khoản, database hay multiplayer; state ở bộ nhớ trang, cần tải log trước refresh. Không dùng compact simulation log thay cho browser replay đầy đủ.

## Hai UI và AI Coach

| Phần | Thực tế code |
| --- | --- |
| Root Web | [src/App.tsx](../src/App.tsx), [Board.tsx](../src/components/Board.tsx), SVG board/pawn với [city-background.webp](../public/art/city-background.webp); output root `dist` |
| Illustrated Mobile | [mobile_app/src/App.tsx](../mobile_app/src/App.tsx), thin session dispatch tới engine root, subscribe snapshot; [BoardView](../mobile_app/src/components/BoardView.tsx), [Character3D](../mobile_app/src/components/Character3D.tsx), CSS Dice3D/audio; output `mobile_app/dist` |
| Shared logic | Engine `src/game/`, dữ liệu `src/data/`, selectors và financial panels; Mobile chỉ ánh xạ phase/coordinates/animation, không có economy engine riêng |
| React build | [Mobile Vite config](../mobile_app/vite.config.ts) dedupe React/React DOM để component root và renderer Mobile dùng chung instance |
| AI | [AICoachPanel](../src/ai/AICoachPanel.tsx) được gắn trong [Mobile result](../mobile_app/src/components/GameResultModal.tsx); root Web result [GameDialogs](../src/components/GameDialogs.tsx) chưa gắn panel này; root có API và harness riêng |

AI chỉ phân tích sau finished khi người chơi yêu cầu. [Facts](../src/ai/facts.ts) lấy kết quả deterministic từ engine; [server handler](../src/ai/server/handler.ts) gọi Gemini, validate schema/evidence IDs bằng [schema](../src/ai/schema.ts). Grounding kiểm tra cấu trúc và ID tham chiếu, **không chứng minh mọi câu văn/suy luận của model đúng 100%** hoặc facts gửi từ client không bị giả mạo. AI không quyết định số tiền, RNG hoặc thắng/thua.

Route cùng origin [api/ai-coach.ts](../api/ai-coach.ts): GET 405; POST dữ liệu sai 400; facts hợp lệ thiếu key 503/fallback; provider thành công trả output đã validate; lỗi/timeout có fallback. Giới hạn mặc định 5 request/60 giây/IP ở bộ nhớ từng process, không phải quota toàn cluster. `GEMINI_API_KEY`, `GEMINI_MODEL` chỉ ở server; không dùng `VITE_*` cho key. [Root tsconfig](../tsconfig.json) rewrite đuôi import khi emit ESM. Local root Vite có middleware API, Mobile proxy tới 5173; Vite static preview không tự chạy Function.

## Kiểm chứng hiện có và giới hạn

| Bằng chứng | Phạm vi được xác nhận |
| --- | --- |
| [CI run 38421516083](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38421516083) tại `13c9c7c` | Node 22.23.3/Ubuntu: hai `npm ci`, **186 product tests + 21 diagnostics**, lint, Web build, Mobile build qua; đã đọc log. Đây là mốc trước audit docs, không gán SHA này cho commit sau |
| [Mobile integration browser JSON](playtests/mobile-v2-4/browser-verification.json) | Local automated browser: 4 vòng/26 rolls, parity toàn state và replay; rapid tap recovery, funding, lots, AI 503 được mock; **không phải full online playthrough** |
| [PR8 review evidence](playtests/pr8-final/verification.json) | Mốc sửa React/ESM, local static build và API Web Preview trước cập nhật hosting; JSON này là lịch sử, không sửa thành kết quả deploy mới |
| User xác minh Mobile URL | Setup, illustrated board, HUD, 3D character và dice; GET API method rejection. Chưa có bằng chứng thêm về full online game/AI provider/điện thoại |
| Audit này kiểm tra chỉ đọc | HTTP 200/title Mobile, GET API 405 JSON; CLI deployment Ready/Production của project Mobile riêng, Function tồn tại; PR còn mở |

Không chạy lại game, mô phỏng hoặc test suite trong audit docs; dùng CI đã xác minh và bằng chứng có version. [Workflow](../.github/workflows/pr-checks.yml) được cấu hình cho PR nhắm main, Node 22, action pinned, fail khi bất kỳ check bắt buộc lỗi, không cần AI key. Việc đặt check thành required trên branch protection thuộc owner.

Follow-up sau push docs ngày 13/10/2026: ở commit chỉ Markdown `5c91a8c`, GitHub Actions API trả **0 run** tại thời điểm đọc; hai status Vercel tự động đã success. CI gần nhất được xác minh vẫn là run tại `13c9c7c` trên cùng code sản phẩm. Không tuyên bố HEAD docs đã có Actions pass; nguyên nhân thiếu run chưa xác định, cần maintainer xác minh check trên HEAD cuối trước quyết định merge. Offline documentation check đã qua riêng; audit không sửa workflow hoặc tự dispatch rerun.

Các nghiên cứu V2–V2.3 chỉ là kết quả trên snapshot/policy của thời điểm đó. Nghiên cứu savings V2.4 [JSON 180.000 ván](simulations/v2_4-savings-lot-comparison.json), 257,829 giây, cũng là heuristic offline, không phải số đo production/người thật. Giữ nguyên Policy A; không triển khai hạn chế Policy B. Xem [báo cáo tích hợp lịch sử](MOBILE_V2_4_FINANCIAL_INTEGRATION_REPORT.md) để đọc phương pháp, bảng, paired intervals và hạn chế.

## Deployment và việc cần hoàn tất

| Project Vercel | URL / ứng dụng | Cấu hình được đọc tại audit |
| --- | --- | --- |
| `boardgame-exe` | https://boardgame-exe.vercel.app — root Web; project gốc giữ riêng | root `.`, build `npm run build`, output `dist`, Node 24.x |
| `boardgame-exe-mobile-preview` | https://boardgame-exe-mobile-preview.vercel.app — illustrated Mobile | root `.`, install `npm ci && npm ci --prefix mobile_app`, build `npm run build --prefix mobile_app`, output `mobile_app/dist`, Node 24.x |

Tên có chữ preview nhưng deployment alias Mobile hiện được Vercel gắn **Production**, trạng thái Ready; inspection tại audit xác nhận `dpl_4Z5uiiuPHa9YdGT2RGyVMGvp7nnd`, có Function `api/ai-coach`. Đó là Production của **project Mobile riêng**, không phải thay root Web production. URL là alias có thể đổi deployment sau này; không coi tên alias là bằng chứng branch đã merge. Trạng thái deploy success và GET 405 không chứng minh provider key/model hợp lệ.

[PR8 follow-up](PR8_FINAL_REVIEW.md) cập nhật blocker thiếu URL trước đây nhưng giữ chronology cũ. Audit này không deploy, không thay project settings, không tải secret và không merge PR. [Roadmap hiện tại](../tasks/current.md): full online Mobile game qua Result/export/replay; Android/iOS thật; sửa icon C20 Mobile (đặc biệt 4/6/11/14/15, START và course); gọi AI provider thành công có evidence; final PR review và quyết định merge. Chưa tuyên bố release readiness hoặc tự chốt các việc này hoàn tất.

## Chạy và kiểm tra

Từ repository root, dùng Node 22.14 trở lên trong dòng 22.x (local đã kiểm 22.14.0, CI 22.23.3), cài cả hai lockfile:

```sh
npm ci
npm ci --prefix mobile_app
npm run dev --prefix mobile_app
```

Mobile mặc định http://localhost:5174; Web/API dev chạy `npm run dev` ở terminal root khác, mặc định http://localhost:5173. Nếu cổng bị chiếm, đọc URL Vite in ra; Mobile proxy vẫn trỏ 5173. Windows cần dừng Vite trước clean install nếu native binding bị giữ. Chơi cơ bản không cần key; AI local tùy chọn dùng root `.env.local` được ignore, không in/commit secret.

```sh
npm test
node --experimental-strip-types --test scripts/diagnostics/*.test.ts
npm run lint
npm run build
npm run build --prefix mobile_app
npm run preview --prefix mobile_app
```

Lệnh preview dùng bản build tĩnh, không tự mở backend API. Lệnh simulation nằm trong tài liệu lịch sử để tái lập đúng snapshot, có thể ghi đè artifacts; không đưa vào quick start hoặc chạy chỉ để kiểm tra docs. [Mobile handoff](../MOBILE_APP_HANDOFF.md), [AI handoff](../AI_COACH_HANDOFF.md) có chi tiết kỹ thuật và giới hạn.
