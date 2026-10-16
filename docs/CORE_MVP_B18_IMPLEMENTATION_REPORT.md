# B18 + một mục tiêu 90M — bàn giao candidate

Đã triển khai trên `codex/mvp-b18-implementation`, từ gameplay/UI `4b0be454a8dd24bb65f00517f598f751ab333980`. Commit nền triển khai: `03dbe31`; SHA bàn giao cuối được ghi trong tin nhắn bàn giao và lịch sử nhánh. Đây là candidate chờ Owner review; chưa merge, deploy hay thực hiện Human Playtest.

## Gameplay và UI

- Bàn riêng B18 đúng thứ tự 18 ô/9 loại ô, kết thúc sau 4 START. Vốn 50M tự phân bổ; mặc định 0M savings, không bắt buộc dự phòng. Lương 14M, sinh hoạt 5M tại START, khóa học một lần 8M/+4M từ START kế tiếp.
- Một mục tiêu **90M huy động hợp lệ** ở Setup, HUD, Tutorial, Sổ tay, START và kết quả. Tất cả dùng selector chung: tiền mặt + gốc tiết kiệm đang hoạt động + giá bán ròng financial − nợ/nghĩa vụ/khoản thiếu đang chờ. Không cộng quán chưa bán hoặc lãi/coupon chưa nhận; không tự thanh lý; không thắng trước khi hoàn thành đủ vòng.
- Stocks/Bonds/Gold: Mua/Bán/Bỏ qua ngay tại ô, tối đa một giao dịch thành công mỗi lần ghé, lỗi không mất quyền, lần ghé sau cùng vòng vẫn được giao dịch. Preview thực nhận/phí/spread dùng selector. START/funding giữ quyền cũ; giá không đổi vì giao dịch.
- Business giữ sở thích khách hàng, thu nhập/nâng cấp hiện có; chỉ bán tại ô Business. Ba Biến cố cá nhân và lựa chọn thanh toán giữ nguyên. Ô Kinh tế đổi nhãn thành Sự kiện, giữ cú sốc.
- Mobile giữ onboarding, bản tin và Sổ tay sáu tab. HUD gọn; chi tiết tài sản/nợ trong Ví. Bàn vẽ riêng 18 ô, không dùng hình 20 ô; khóa học hoàn tất chỉ còn tiếp tục nhanh. Desktop cũng vào B18.
- Profile `core-mvp-b18-v1`, board revision `b18-core-v1`, goal `single-90m-v1`, encounter `b18-tile-trading-v1`, living `b18-periodic-start-v1`; export schema6. Thiếu metadata vẫn dùng luật lịch sử. Save C20 tiếp tục C20, không chuyển đổi.
- Mobile có lưu/khôi phục cục bộ và nhập/xuất JSON. Bản lưu cục bộ dùng dictionary lịch sử market để tránh vượt quota, khôi phục đầy đủ snapshot; định dạng export replay không đổi. Nếu trình duyệt từ chối lưu, UI báo và hướng dẫn xuất nhật ký.

## Đối chiếu frozen B và nguồn

Ba nhánh nghiên cứu được giữ đúng SHA và đã có trên origin: balance `45b0c4d`, trading `33de122`, risk/allocation `d04b8ad`. Manifest lưu Git blob ID của 373/434/597 artifact trên từng nhánh; có phần trùng giữa các nhánh. Không sửa/xóa source nghiên cứu hay replay lịch sử; không chạy lại 400.800 ván.

**Không có sai khác kinh tế so với B hiệu lực đã chạy.** Mười ví dụ của 10 heuristic từ trading A/B được thực thi lại trên production candidate, khớp từng snapshot tài chính, RNG, credit, proceeds và kết quả. Chỉ bỏ qua metadata nhận diện phiên bản/bàn khi đối chiếu. Đây là kiểm tra tương thích, không phải nghiên cứu cân bằng mới.

Raw frozen config còn các trường kế thừa `rules.tiles=20`, `rules.livingCost=7M` và bảng savings chung 6/7/8%. Nghiên cứu thực tế dùng board length18, `economy.livingCost=5M`, savings profile `v2.2-c20` **4/5/6%**. Candidate theo các giá trị hiệu lực này, Bonds V2.5 AA4,5%/B10%, phí/spread/thị trường/Business nguyên trạng. Mục tiêu 90M + reserve0 tương đương ngưỡng 80M + 10M cũ.

Base `4b0be45` giữ finance/credit mới hơn. Sổ tay sáu tab được tích hợp theo trải nghiệm UI `277d2dc`, không chép các thông số cũ của nhánh UI đó vào engine.

## Kết quả kiểm thử

| Phạm vi | Kết quả |
|---|---|
| Test tự động | 323/323 đạt; thêm 1/1 test render UI đạt |
| Lint, build desktop/mobile | Đạt |
| Replay | 49/49 log tự nhiên schema4/5/6 khớp mọi action và trạng thái cuối: 32 lịch sử, 10 parity B, 7 UI B18 |
| Frozen B | 10/10 ví dụ khớp tài chính/RNG/kết quả |
| Browser | 3 ván hoàn chỉnh + 4 luồng một phần; click UI thật, không chèn trạng thái hoặc ép xúc xắc |
| Mobile | 58 lượt kiểm tra layout 320/390px và 8 smoke check cuối; không tràn ngang, không lỗi JavaScript |

Một file lịch sử `fixture-locked-final-log.json` là fixture DEV chèn trực tiếp vị trí/lượt trong `scripts/playtest-harness.tsx`, không có chuỗi roll tương ứng. File được bảo toàn, ghi riêng trong danh sách excluded; không tính vào 49 replay đạt.

| Ván UI | Seed | Lượt / START | Proceeds cuối | Kết quả |
|---|---|---:|---:|---|
| Savings + course, 390px | `TRADING-AB-MAIN-0` | 25 / 4 | 95.088.000đ | Thắng |
| Cash, 320px | `TRADING-AB-MAIN-0` | 25 / 4 | 86.000.000đ | Thua |
| Giao dịch tại ô, 390px | `B18-UI-TRADES` | 21 / 4 | 94.444.551đ | Thắng |

Heuristic UI savings gửi 85% phần tiền mặt vượt 10M, kỳ hạn1 và mua course; khác chính sách archived savings nên proceeds khác ví dụ parity. Các ván này kiểm tra luồng sản phẩm, không dùng để suy luận tỷ lệ thắng hay chọn chiến thuật tốt nhất.

Luồng bổ sung: Bonds mua lượt1/bán lượt3 cùng vòng (`B18-TILE-45`), nhận 1.970.000đ trên giá trị 2M; Stocks mua lượt3/bán lượt5 (`B18-TILE-56`), nhận 1.980.000đ. Input bán0 bị khóa, sửa lại vẫn bán được. Gold có preview và hai lần bán trong ván hoàn chỉnh. Seed `B18-FUND-11`, phân bổ 50M savings kỳ hạn3: trả Y tế5M bằng rút toàn khoản còn cash45M/mất lãi9M, hoặc vay5M giữ savings50M và ghi debt5M; cả hai không tạo tăng giả nguồn tiền. Reload/resume giữ đúng số dư.

Biên 89.999.999/90.000.000, đủ4 START, không thắng sớm/phá sản, quán/coupon/tiền vay không tạo thắng giả, D6 quấn18 ô, phí/spread, giới hạn encounter, Business tile-only, ba personal events, save/version sai và historical replay đều có test.

## Bằng chứng và tái lập

- [Thư mục bằng chứng](playtests/core-mvp-b18): test/lint/build logs, `research-parity.json`, `replay-verification.json`, `source-manifest.json`, `artifact-manifest.json`, kết quả CSV/JSON, replay `.json.gz` và screenshot320/390.
- [Bàn 320px](playtests/core-mvp-b18/320-cash-board.png), [preview bán Stocks](playtests/core-mvp-b18/320-sale-preview-stocks.png), [preview bán Bonds](playtests/core-mvp-b18/320-sale-preview-bonds.png), [preview bán Gold](playtests/core-mvp-b18/390-sale-preview-gold.png), [kết quả thắng](playtests/core-mvp-b18/390-savings-result.png), [kết quả thua](playtests/core-mvp-b18/320-cash-result.png).
- Chạy từ repo: `npm test`, `npm run lint`, `npm run build`; trong `mobile_app`: `npm run build`.
- `node --experimental-strip-types --test scripts/diagnostics/core-mvp-b18-ui.test.ts`.
- `node --experimental-strip-types scripts/verify-core-mvp-b18-parity.ts` và `node --experimental-strip-types scripts/diagnostics/verify-b18-replays.ts`.
- `node scripts/diagnostics/b18-source-manifest.mjs` và `node scripts/diagnostics/b18-artifact-manifest.mjs`.
- Browser: chạy Vite mobile trên localhost; đặt `B18_URL`, `PLAYWRIGHT_MODULE` tới package Playwright và `BROWSER_PATH` tới Chromium đã cài. Chạy `node scripts/diagnostics/core-mvp-b18-browser.mjs`, rồi `--funding`, `--tile-sales`, `--smoke`. Mỗi chế độ có file kết quả riêng. Môi trường kiểm tra: Windows, Node22.14, Chromium headless, viewport320×740/390×844; luồng phụ320×844.

## Giới hạn trước phát hành

Chưa kiểm tra trên thiết bị iOS/Android thật hoặc Safari, chưa đo khả năng học/thời lượng với người thật, chưa xác minh dịch vụ AI bên ngoài bằng provider thật. Browser local save phụ thuộc quyền/quota của trình duyệt; export JSON là bản sao thủ công. Import kiểm tra cấu trúc và phiên bản, không phải cơ chế chống sửa số dư. Chưa merge, deploy hoặc tuyên bố production-ready; Owner review candidate trước bước phát hành.
