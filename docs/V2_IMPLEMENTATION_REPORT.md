> **HISTORICAL** — Triển khai V2 ngày 10–11/10/2026; số test, ba vòng và giới hạn backend/Git ghi nhận mốc cũ. Nguồn chuẩn hiện tại: [CURRENT_MVP.md](CURRENT_MVP.md). Các phương pháp, kết quả và nội dung gốc bên dưới được giữ nguyên; lệnh lịch sử không được thực thi lại trong audit này.

# Báo cáo triển khai V2

## Kiểm kê trước khi sửa (10/10/2026)

Thư mục hiện tại không có metadata `.git`; lệnh `git status --short` thất bại. Không thể xác nhận diff của các phiên trước. Triển khai trên các file hiện có, giữ giao diện và các mô-đun funding/settlement/log.

| Yêu cầu | Trạng thái ban đầu | File liên quan |
| --- | --- | --- |
| Bàn cờ 20 ô với nhóm chuyên biệt, sinh hoạt đúng ô | Thiếu; đang bốc sự kiện theo 4 nhóm | data/board, data/events, game/engine |
| START một lần, giữ ô đích vượt START | Một phần; có pendingLanding và settlement progress, sai thứ tự và còn phí sinh hoạt cố định | game/settlement, engine |
| Lương 14M, khóa học 6M/+3M một lần | Một phần; đang 12M, nhiều cơ hội tăng lương | data/config, events, engine |
| Khoản gửi riêng, kỳ hạn 1/2/3, rút toàn khoản | Thiếu; đang một số dư tổng | types, transactions, settlement, Setup |
| Sáu mã hư cấu, thị trường tương quan, lịch sử riêng RNG | Thiếu | game/market (mới), config, types |
| Macro shock ngay và biểu đồ đúng giá | Thiếu | market, events, engine, UI |
| Quyền mua tại ô, START chỉ bán | Một phần; checkpoint đang cho mua/gửi | transactions, RebalanceDialog |
| Funding kết hợp, phí công khai, insolvency | Một phần; đã chọn nguồn nhưng vay vô hạn, chưa có quote | transactions, FundingDialog |
| Kinh doanh nâng cấp theo xu hướng và bán đúng ô | Thiếu; đang vốn khóa vĩnh viễn | game/business (mới), config, UI |
| Mua 80M và giữ 10M từ nguồn huy động hợp lệ | Sai; đang net worth >=80M và cash >=10M | selectors, GoalChecks, Portfolio, Result |
| Log trước/sau và tái hiện seed | Đã có nền tảng; cần thêm lot, giá và trạng thái | state, log, types |
| Test/mô phỏng/báo cáo | Có 34 test luật cũ, chưa có mô phỏng V2 | tests, scripts (mới), docs |

## Xung đột cần thay theo V2

- Bỏ sinh hoạt cố định tại START; chỉ trả khi dừng đúng ô.
- Thay lương 12M bằng 14M; thay nhiều upgrade lương bằng một khóa học 6M/+3M.
- Bỏ quyền mua/gửi ở START; quyền mua gắn với ô hiện tại.
- Thay một số dư tiết kiệm lãi nhập gốc bằng khoản gửi có kỳ hạn và đáo hạn về tiền mặt.
- Thay giá trị tài sản tổng biến động cuối vòng bằng đơn vị sở hữu, giá niêm yết và shock tức thời.
- Thay điều kiện net worth/cash cũ bằng nguồn huy động ròng >=90M, không tính kinh doanh chưa bán.

## Kết quả triển khai

| Nhóm | Trạng thái cuối | Bằng chứng |
| --- | --- | --- |
| Bàn cờ dữ liệu, 11 loại ô, sinh hoạt đúng đích | Hoàn tất | 20 vị trí cũ được giữ, loại ô chuyên biệt; test đi ngang/đích/vượt START |
| START theo thứ tự, một lần, giữ đích pending, vòng cuối | Hoàn tất | Cursor settlement; market → lương → kinh doanh → schedules → nợ/nghĩa vụ → checkpoint bán → forecast/result |
| Lương 14M và một khóa học 6M/+3M | Hoàn tất | Mua tự nguyện bằng Cash; preview số kỳ và tổng tăng thêm; test không truy lĩnh/mua hai lần |
| DepositLot riêng, kỳ hạn 1/2/3 và rút toàn khoản | Hoàn tất | Đáo hạn về Cash, không tái tục; mất lãi đúng khoản; cảnh báo vượt màn ở UI/log |
| Sáu cổ phiếu hư cấu, thị trường tương quan | Hoàn tất | Ba ngành × hai mã; 12 mốc lịch sử từ RNG riêng; cả lịch sử và tương lai có thành phần chung/ngành/riêng |
| Shock tức thời và compounding đúng | Hoàn tất | Một marker turn:eventId; shock cả tài sản chưa sở hữu; START chỉ normal; test nhiều shock và giá sau shock |
| UI stock/gold chart và bond timetable | Hoàn tất chức năng | SVG line chart, marker tên/lượt, giá thống nhất với engine; coupon/mệnh giá/kỳ hạn/giá bán/rủi ro |
| Mua tại ô, START chỉ bán tài sản tài chính | Hoàn tất | transact kiểm tra phase, tile và event; không cho mua tại START dù từng gặp tài sản |
| Funding nhiều nguồn và insolvency | Hoàn tất | Người chơi chọn khoản gửi/sale/debt; phí/spread/lãi mất trước xác nhận; không bán business; hết nguồn kết thúc rõ ràng |
| Business: đầu tư, nâng cấp từng trend, bán đúng ô | Hoàn tất | Giữ từng tầng theo trend, base uplift bền vững, bonus chỉ khi khớp; giá bán vốn thu hồi thay đổi theo kinh tế |
| Mục tiêu 80M + 10M sau mua | Hoàn tất | liquidatableFunds dùng cùng saleQuote với giao dịch; loại business khóa, trừ toàn bộ nợ/nghĩa vụ/phần thiếu |
| Log tài chính và tái hiện JSON | Hoàn tất | Snapshot lot/giá/units/trend/debt/RNG; test cộng delta khớp tài sản thực, không đếm lặp log tổng kết |
| Mô phỏng và độ nhạy | Hoàn tất | 5 × 5.000 seed cơ sở + 6 × 5.000 seed độ nhạy; config snapshot và từng ô trong JSON |
| Trình duyệt và responsive | Hoàn tất mức kiểm tra yêu cầu | Một ván 3 vòng thực tế tới Result tại 320px; ảnh lưu, không có console warning/error |

Không có yêu cầu engine bắt buộc nào còn thiếu được biết sau review. Các giới hạn MVP và hiệu chỉnh chưa chốt được ghi riêng dưới đây.

## Giả định kinh tế chính xác

Thông số **CHỐT cho bản thử nghiệm**: lương 14M/START, khóa học 6M một lần, tăng 3M/START kế tiếp. Các tham số còn lại sau đây là **THỬ NGHIỆM**, tập trung trong `src/data/config.ts`; toàn bộ snapshot có tại `docs/simulations/v2-results.json`.

| Tham số | Mẫu đang dùng |
| --- | --- |
| Vốn/vòng/mục tiêu | 50M, 3 vòng, mua 80M và giữ 10M sau mua |
| Sinh hoạt | 7M chỉ khi dừng đúng ô 4 hoặc 15 (đếm ô từ 1) |
| Tiết kiệm | Kỳ hạn 1/2/3 START, lãi đơn 6/7/8% **mỗi vòng game**, trả toàn bộ cuối kỳ |
| Maturity | Gửi ở lap L, term T → đáo hạn START lap L+T−1; gốc + round(gốc × rate × T) |
| Rút sớm | Toàn khoản, nhận gốc; mất toàn bộ lãi kỳ hạn chưa trả; không ảnh hưởng khoản khác |
| Phí stock/bond/gold | 1%/1,5%/1% khi bán; vàng thêm spread 3% trước phí |
| Quote | net = gross − round(gross × spread) − round((gross − spread) × fee); khẩn cấp giống START, không phụ phí |
| Đơn vị sở hữu | Đơn vị phân số = tiền mua / giá niêm yết; tổng giá trị làm tròn VND; bán stock tổng phân bổ theo tỷ trọng từng mã |
| Bond | Người phát hành hư cấu; mệnh giá 100k/đơn vị, coupon 5% mệnh giá/START, kỳ hạn 2 START; hoàn gốc theo số đơn vị còn giữ |
| Debt | Hạn mức dư nợ gốc 30M; chỉ vay phần thiếu nghĩa vụ; lãi 10% tại lần trả hoặc START kế tiếp; vay mới tại START cuối cộng lãi vào nợ ngay một lần |
| Business vốn | Mua 20M, thu hồi ban đầu 70%; nâng cấp 5M, tăng vốn thu hồi 50% giá nâng cấp; tối đa 6 tầng |
| Business thu nhập | round(3M × hệ số trend + tổng tầng ×0,7M + tầng khớp trend ×1M + (hệ số kinh tế−1) ×2M) |
| Business trend | growth/uncertain/recovery thu nhập nền ×1,25/0,75/1,1; xác suất mỗi trend 1/3 |
| Business giá bán | Vốn thu hồi ×(1 + normal business return − 8% khấu hao) tại START; ×(1 + macro business effect) khi shock; bán toàn cơ sở theo giá trị này |
| Business kinh tế | Shock cộng vào multiplier, giới hạn 0,3–1,8; đổi trend giữ base uplift và chỉ đổi bonus khớp trend |
| Giá mở | Stock 100k, gold 1M, bond 100k; giá cuối chart khớp chính xác giá mua/định giá |
| Normal stock | Return chung từ scenario + sector U(−3,5%,3,5%) + riêng U(−volatility,volatility); giá tối thiểu 1đ, return thấp nhất −80% |
| Lịch sử | 12 mốc trước màn; RNG hash(seed + ':history-v2'); chung ±7%, ngành ±2,5%, riêng theo volatility; gold ±10%, bond ±3%; rebase về giá mở |
| Tài sản an toàn | Gold không coupon; normal bond/gold theo ranges của scenario, giá sau shock là điểm xuất phát |

Sáu volatility riêng: XV-MAY 6%, XV-HAT 8%, XV-SONG 4%, XV-DEM 5%, XV-GOM 5%, XV-SOI 7%. Tên, mã, lịch sử và giá tương lai đều hư cấu; không lấy dữ liệu thật.

Ba macro mẫu có xác suất 1/3 khi dừng ô macro: tín dụng thắt chặt (technology −12%, banking −16%, manufacturing −10%, bond −6%, gold +8%, business −20%); nhu cầu khởi sắc (+14%,+8%,+12%,+2%,−5%,+20%); cung ứng phục hồi (+6%,−3%,+16%,−2%,−4%,+10%). Một sự kiện chung áp cho cả thị trường; không bốc riêng mỗi mã. Bình thường ranges theo scenario được lưu đầy đủ trong snapshot JSON, không lộ giá tương lai trong UI.

Các sự kiện cá nhân/nghĩa vụ giữ các trade-off cũ nhưng đưa số mẫu vào config: y tế 5M ngay hoặc 6M cuối vòng; sửa xe 4M ngay hoặc 1M +4M cuối vòng; gia đình 3M hoặc 3,5M; hóa đơn 2M hoặc 2,5M; hợp đồng 1,5M hoặc 2M; thưởng hợp đồng một lần +2M. Hai cơ hội tăng lương equipment/job cũ được thay bằng khóa học duy nhất theo V2.

## Quyết định kỹ thuật có thể đảo ngược

- Mua tự nguyện (tài sản, khóa học, nâng cấp) cần đủ Cash. Ngoại lệ funding dành cho khoản bắt buộc theo đặc tả; không vay để mua tùy ý. Các khoản bắt buộc vẫn cho kết hợp nhiều nguồn do người chơi quyết định.
- Tiết kiệm chưa đáo hạn ngoài màn tính gốc rút sớm hợp lệ trong mục tiêu, không cộng lãi chưa trả. Result đánh giá khả năng mua, chưa tự thanh lý hay trừ 80M; không thêm nút mua giả lập vì đặc tả chỉ yêu cầu nếu có nút thì dùng đúng quote.
- Lịch sử được tái chuẩn hóa về giá mở để không thay đổi nền kinh tế khi chỉ cải thiện biểu đồ. Stream lịch sử không tiêu thụ stream xúc xắc/event/normal; actions giao dịch không rút RNG.
- Mẫu bond có rủi ro giá do macro/normal; không thêm mô phỏng vỡ nợ riêng chưa có luật xác suất. Thông tin này hiển thị rõ cho người chơi.
- Giữ 20 vị trí bàn cờ, phân bố lại loại ô; không tuyên bố phân bố cuối cùng đã cân bằng. Không chỉnh roll hoặc event theo tài sản.
- Hạn mức vay đặt trong config và state để có thể tái hiện trường hợp không được vay. Dư nợ mới trong quyết toán không bị tính lại ngay; khoản cũ chưa trả nằm trong pending liability, không được xóa khỏi đánh giá nguồn huy động.

## File thay đổi

- Dữ liệu/engine hiện có: `src/data/{board,config,events}.ts`, `src/game/{types,state,engine,settlement,transactions,selectors,log}.ts`.
- Mô-đun mới: `src/game/market.ts`, `src/game/business.ts`.
- UI hiện có: `src/App.tsx`, `src/finance.css`, `src/components/{Setup,Board,Portfolio,GoalChecks,Forecast,GameDialogs,FundingDialog,RebalanceDialog}.tsx`.
- UI mới: `src/components/MarketDetails.tsx`, `src/components/TradingPanel.tsx`.
- Kiểm thử: hai file test cũ giữ 34 trường hợp với luật V2, thêm `tests/v2.test.ts`.
- Mô phỏng/tài liệu: `scripts/simulate-v2.ts`, `package.json`, `README.md`, hai báo cáo V2, `docs/simulations/v2-results.json`, ảnh `docs/screenshots/`.
- Không thay dependencies/lockfile, không thêm backend/AI/login/database/multiplayer hoặc dữ liệu thị trường thật; không deploy.

## Kiểm thử đã thực thi

- Trước khi sửa engine, 34 test luật cũ pass; 5 regression V2 đầu tiên fail đúng các xung đột lương/khóa học/quyền mua/mục tiêu.
- Unit/integration: đã chạy `npm test`; kết quả cuối được ghi ở phần chốt kiểm tra bên dưới. Có kiểm tra từng loại ô, whole-lot/đa maturity, coupon, nhiều shock trước START, tài sản chưa sở hữu, chart=engine, quyền giao dịch, business theo trend, funding nhiều lần, nợ cuối, insolvency, JSON replay và cộng delta log.
- Kiểm tra lịch sử và normal tương quan: 200 seed, cả ba cặp cùng ngành có thành phần chung nhưng không đồng nhất. ReturnRate lịch sử bằng chính xác priceAfter/priceBefore−1 sau làm tròn.
- Build/lint: đã chạy các lệnh thật; lỗi lint ban đầu về biến thừa đã sửa. Kết quả cuối ghi dưới đây.
- Mô phỏng: `npm run simulate:v2 -- 5000`, exit 0; 55.000 ván tổng cộng. [Báo cáo cân bằng](V2_BALANCE_REPORT.md) có phân phối p10/median/p90, nợ, thiếu hụt, lần gặp từng ô và độ nhạy; chưa auto-retune.
- Browser: localhost trong sandbox timeout; chạy Vite cục bộ ngoài network sandbox rồi kiểm tra được tại 127.0.0.1:5175. Không mở truy cập công khai.

## Ván trình duyệt thực tế

Seed `SAIGON-2026`, gửi đầu 20M kỳ hạn 1, mua XV-MAY 10M tại lượt 1, mua khóa học khi gặp lần đầu, mua bond 8M tại lượt 7; các quyết định còn lại chọn option đầu còn bật; không bán tại START. Đi đủ 3 vòng tới Result. Tài sản ròng từng vòng **62.148.100 → 75.769.316 → 78.449.528đ**. Cash cuối **65.681.028đ**, huy động hợp lệ sau phí **78.321.843đ**, chưa đạt mục tiêu 90M. Không kích hoạt đích vượt START sau vòng cuối. Một regression tái hiện đúng kết quả thực tế này.

Viewport 320px: document scrollWidth =320, board width =288, dialog width =267; không tràn ngang. Đã xem bàn cờ, biểu đồ stock, mua stock/course/bond, coupon và đáo hạn, checkpoint cuối, Result. Console warning/error =0 trong ván. Ảnh: [stock 320px](screenshots/v2-stock-320.jpg), [Result 320px](screenshots/v2-result-320.jpg), [Result](screenshots/v2-result.jpg).

## Hạn chế và kiểm tra thủ công còn lại

- Chưa playtest cân bằng với người thật; tỷ lệ thắng là heuristic theo snapshot, không phải cân bằng đã chốt.
- Ván browser đã chạy không có shortage tự nhiên, không gặp macro, không mua business; các nhánh này được test engine tự động. Cần kiểm tra thủ công sâu UI funding kết hợp, business upgrade/sale, macro marker và gửi nhiều khoản ngoài đường đi vừa thực hiện.
- Chưa xác nhận download JSON lưu thành file qua browser; serialization và JSON state replay được test. Game vẫn lưu trong bộ nhớ trang, refresh bắt đầu lại; chưa thêm chức năng nhập/save tự động.
- Chưa thực hiện audit WCAG, screen reader hoặc browser khác, chưa kiểm tra trực quan mọi dialog ở 768/1024/1440px. Native dialog giữ focus trap; viewport 320px đã kiểm tra thật.
- Log giữ snapshot giá/lịch sử đầy đủ nên export dài hơn trước; phù hợp màn 3 vòng hiện tại, cần xem lại nếu tăng rất nhiều vòng.
- Không có `.git` nên không tạo commit/diff để đối chiếu. Danh sách file trên và test/report là bằng chứng thay đổi hiện tại.

## Chốt xác minh tiếp nối (11/10/2026)

Tiếp tục từ code V2 hiện có, đối chiếu lại prompt, đặc tả, `src/game`, `src/data`, UI liên quan, ba file test và script mô phỏng. Phiên tiếp nối không sửa engine/UI/test, không thêm tính năng, không đổi thông số tài chính và không deploy Vercel. Phần còn dang dở đã hoàn tất: thay mô tả V1 lỗi thời trong README bằng luật V2, sửa số test ban đầu từ 36 thành 34, bổ sung kết quả xác minh cuối vào báo cáo này. Hai file mô phỏng được tạo lại bằng script hiện có.

Môi trường thực thi: Windows PowerShell, Node **22.14.0**, npm **10.9.2**.

| Lệnh/kiểm tra | Kết quả xác nhận trong phiên tiếp nối |
| --- | --- |
| `npm test` | Exit 0; **81/81 pass**, 0 fail, 0 skipped; gồm regression tái hiện ván browser 3 vòng |
| `npm run build` | Exit 0; TypeScript và Vite production build thành công, 46 modules; JS 299,10 kB (gzip 91,43 kB), CSS 26,94 kB |
| `npm run lint` | Exit 0; ESLint không báo lỗi |
| `npm run simulate:v2 -- 5000` | Exit 0; **25.000 ván cơ sở + 30.000 ván độ nhạy = 55.000 ván** |
| Đối chiếu JSON và báo cáo | Snapshot RULES/ECONOMY/SCENARIOS/STOCKS/MACRO_EVENTS/BOARD khớp code; 11 nhóm × 5.000 ván, 20 ô, phân phối và tất cả hàng kết quả cơ sở/độ nhạy khớp báo cáo |
| Tái lập mô phỏng | SHA-256 JSON trước/sau giống hệt: `C723E26C91948442262D2F5BC91CF6C0EB2AA76BA5EDA1867761A15F622BA75B` |
| Giữ nguyên cân bằng | SHA-256 `src/data/config.ts` trước/sau giống hệt: `DF966518474C1821E337E73203C0970EAAB8E3FD5B51FB0B9E14BDDEA04A7071` |
| File/bằng chứng | Hai báo cáo, JSON và ba ảnh browser tồn tại; không tìm thấy TODO/FIXME báo phần triển khai còn dang dở trong source/test/script |

Node có cảnh báo `ExperimentalWarning` về TypeScript stripping; build có thông tin thời gian plugin. Đây là thông báo công cụ, các lệnh nêu trên vẫn exit 0.

Tỷ lệ thắng cơ sở được xác nhận lại: cash-heavy **2,38%**, saving-heavy **27,90%**, stock-heavy **15,52%**, business-heavy **6,14%**, diversified **8,48%**. Cả 25.000 ván cơ sở hoàn tất và không còn nợ. Không có insolvency tự nhiên ở bộ chính sách này; nhánh đó được xác nhận bằng test tình huống, không được coi là đã quan sát qua mô phỏng cơ sở. Báo cáo cân bằng giữ đầy đủ p10/median/p90 và phân tích độ nhạy, chưa chốt hay tự chỉnh cân bằng.

**Phạm vi bằng chứng browser:** ván thực tế đã chạy ở phiên triển khai trước đủ **3 vòng, checkpoint cuối và Result**. Phiên tiếp nối kiểm tra ảnh Result đã lưu và chạy lại regression engine khớp số liệu; không chạy thêm một ván browser mới. Kết quả huy động hợp lệ **78.321.843đ**, nợ **0đ**, chưa đạt mục tiêu. Các kiểm tra UI mở rộng nêu ở mục hạn chế vẫn chưa thực hiện, không được suy ra từ test engine.

**Kết luận:** Không phát hiện tính năng V2 bắt buộc còn thiếu hoặc lỗi chặn trong phạm vi code review, test, build và mô phỏng đã thực hiện. Việc cân bằng với người thật, kiểm tra sâu các nhánh UI ngoài ván mẫu, download file và accessibility/browser khác vẫn là giới hạn xác minh; chưa phải kết quả đã xác nhận. Không thể chứng minh mọi tính năng cũ được giữ nguyên bằng Git diff vì repository hiện không có `.git`; bộ regression hiện có đã pass.

**V2 IMPLEMENTATION COMPLETE — READY FOR REVIEW**
