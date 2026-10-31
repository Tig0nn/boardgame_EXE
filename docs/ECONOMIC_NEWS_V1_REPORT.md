> **CURRENT** — Economic News & Market Forecast V1, 15/10/2026. Nguồn luật: [CURRENT_MVP.md](CURRENT_MVP.md). Candidate local, chưa merge/deploy hoặc xác minh GitHub Actions mới.

# Bản tin kinh tế và học từ diễn biến thị trường

## Bản giao và quyết định UX

Nhánh [codex/economic-news-v1](https://github.com/Tig0nn/boardgame_EXE/tree/codex/economic-news-v1) bắt đầu từ `b97b16c` của `codex/mobile-ui-final`. Giữ tutorial, board/nhân vật/xúc xắc, Help, audio và các handler giao dịch. Không đổi nhánh tích hợp hoặc main.

- Đầu mỗi vòng: headline và ngữ cảnh đúng scenario, ba thẻ tài sản có icon, đặc tính/rủi ro, nhắc tiền mặt/khoản đến hạn/phí/thời gian. Một CTA “Bắt đầu vòng”.
- Chi tiết đóng mặc định: cách đọc tin, ba tình huống kinh tế có thể xuất hiện, giá/tin trong game, không phải tin thật. Không dự đoán sự kiện sắp được chọn hoặc gán xác suất tự đặt.
- Tại ô mua: “Xem tín hiệu thị trường” nối dự báo đầu vòng, mã đang chọn, báo giá hiện tại và thay đổi đã quan sát trong vòng. Giữ tiền mặt sau mua và chi phí trước xác nhận; phí bán trái phiếu được đưa ra ngoài details.
- Tại START: ba hàng dự báo/biến động giá, ghi nhận số cú sốc; bài học và phương pháp tính để trong details. CTA sticky giữ quyền đi tiếp khi đọc bảng dài.
- Help giữ nội dung mở, mã cổ phiếu và số tiền nhập; không tạo game mới, giao dịch hoặc tiêu thụ RNG.

## Kết nối forecast → giá → cú sốc

Mã trình bày: [market-news selectors](../mobile_app/src/game/market-news.ts), [MarketNews UI](../mobile_app/src/components/MarketNews.tsx), [CSS](../mobile_app/src/market-news.css). Nguồn chính thức được giữ nguyên: [SCENARIOS/MACRO_EVENTS](../src/data/config.ts), [market](../src/game/market.ts), [settlement](../src/game/settlement.ts). [Forecast Web cũ](../src/components/Forecast.tsx) không bị thay; chỉ Mobile dùng bản tin mới.

**Dự báo gốc:** lấy scenario đầu tiên của đúng vòng từ `entry.before/after`, dùng state hiện tại khi chưa có action/log của vòng mới. Không lưu thêm bản sao forecast vào GameState hoặc log. Scenario của vòng trước được truy lại từ snapshot, không dùng scenario hiện tại để viết lại lịch sử.

**Ranh giới giá:** chỉ dùng PricePoint `normal/shock` của đúng `lap`, timestamp từ turn mở vòng đến turn cập nhật normal tại START; loại lịch sử `lap=0`, vòng khác và timestamp tương lai. Kiểm tra giá mở khớp snapshot, giá dương/hữu hạn và chuỗi liên tục. Log bắt đầu sau biến động hoặc thiếu điểm mở vòng không đủ để tính. Vòng chưa có normal START chưa được gọi là kết quả cuối vòng; context mua có thể hiển thị riêng biến động đã xảy ra, nếu có.

**Phép tính:** `giá sau điểm cuối / giá trước điểm đầu − 1`. Không cộng phần trăm các cú sốc vào tỷ lệ này lần nữa. Cổ phiếu là trung bình số học tỷ lệ từng mã, mỗi mã trọng số bằng nhau; không phải một danh mục người chơi hay chỉ số thị trường thực tế. Details có từng mã. Trái phiếu/vàng dùng giá của chính công cụ đó.

**Cú sốc:** chỉ ghi nhận khi PricePoint `shock` có eventId và market log công khai cùng vòng/turn. Khóa turn + eventId chống liệt kê lặp trên nhiều tài sản. Nhãn lấy từ MACRO_EVENTS, không suy diễn “giá giảm vì chính sách” khi không có event. Biến động trên đã bao gồm cả normal lẫn shock; chú thích sự kiện không phải một khoản lợi nhuận bổ sung. Danh sách tình huống trong bản tin đầu vòng chỉ là help chung, không đọc hidden RNG hay sự kiện tương lai.

**Giới hạn diễn giải:** tỷ lệ giá chưa gồm coupon, phí, spread hoặc thời điểm/quy mô mua bán. Nó khác lãi đã thực hiện và lợi nhuận danh mục. Giá tăng không chứng minh quyết định tốt, giá giảm không chứng minh quyết định sai. Thiếu dữ liệu hiện “Chưa đủ dữ liệu”, không tự điền 0%.

**Business riêng:** không nằm trong ba thẻ/bảng tỷ lệ. Customer Preferences, thu nhập vận hành, upgrade/sale không đổi. Thị trường vẫn có thể đổi giá thu hồi theo engine, không trực tiếp đổi thu nhập V2.4. Tiết kiệm vẫn dùng rate cố định/kỳ hạn thật của game, không theo forecast.

## Validation đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| Product tests | **203/203 PASS** — [output](playtests/economic-news-v1/tests.txt) |
| Diagnostics | **34/34 PASS** (23 top-level + 11 subtests) — [output](playtests/economic-news-v1/diagnostics.txt) |
| Lint | PASS — [output](playtests/economic-news-v1/lint.txt) |
| Web build | PASS — [output](playtests/economic-news-v1/web-build.txt) |
| Mobile production build | PASS — [output](playtests/economic-news-v1/mobile-build.txt) |
| Documentation checker | PASS mặc định — [output](playtests/economic-news-v1/documentation-check.txt) |
| Browser | 320×640, 390×844, 430×932; không tràn ngang; details/scroll, Enter/Escape/Help, restart, selected stock và double taps PASS — [evidence](playtests/economic-news-v1/browser-verification.json) |
| Ván thật / replay | 4 vòng / 21 rolls / 92 entries; full-state equality và cả 4 bảng browser khớp selector — [verification](playtests/economic-news-v1/replay-verification.json) |

14 [test selector mới](../tests/economic-news.test.ts) bao phủ ba scenario, ba tài sản, Business exclusion, preservation, returns thực, shock compounding/idempotence, START boundaries, future filtering, incomplete observations, read-only/RNG và full replay. [5 diagnostics UI](../scripts/diagnostics/economic-news-ui.test.ts) render component thật, kiểm bulletin/CTA, asset routing, luật mua/bán, phí trước details, summary và unavailable state. Các test V2.4/encounter hiện có vẫn PASS.

CI lịch sử tại `13c9c7c` có **186 product tests + 21 diagnostics** — [run lịch sử](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38421516083). Không dùng run này để khẳng định CI của nhánh mới. Không cài dependency mới, không đổi lockfile, không gọi AI/provider/feed hoặc chạy lại simulation 180.000 ván.

## Ván production local và replay

URL local `http://127.0.0.1:5185`, build Mobile Vite 8.3.4. Seed `economic-news-browser-v1`, gửi ban đầu 10 triệu/1 START. Mọi action qua UI thật; không inject fixture/state vào ván này. Export bằng “Lưu nhật ký hành trình”: [log gzip](playtests/economic-news-v1/browser-game-log.json.gz).

Kết thúc đủ bốn vòng: **96.480.028 ₫** nguồn tiền hợp lệ, **won=true**. [Verifier có thể chạy lại](../scripts/verify-economic-news-log.ts) kiểm toàn bộ state/log qua replay, selector không mutate state và tỷ lệ hiển thị trong từng bảng browser. Đây là một playtest, không phải đo cân bằng hoặc bảo đảm chiến thắng.

| Vòng | Turn mở → START | Scenario gốc | Cổ phiếu bình quân | Giá trái phiếu | Giá vàng | Cú sốc ghi nhận |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 0 → 5 | Recovery | +19,69% | +3,00% | −4,83% | Không |
| 2 | 5 → 10 | Growth | +27,59% | +4,87% | +5,27% | Không |
| 3 | 10 → 15 | Uncertain | +12,88% | +2,68% | −2,04% | Chuỗi cung ứng phục hồi |
| 4 | 15 → 21 | Recovery | +17,86% | +4,70% | −9,15% | Chuỗi cung ứng phục hồi |

Ví dụ vòng 2: forecast vàng “Có thể hạ nhiệt”, thực tế +5,27% mà không có cú sốc — không gán sai nguyên nhân chính sách. Vòng 4 có sự kiện cung ứng nhưng vàng vẫn −9,15% sau toàn bộ biến động; chỉ số này không phải lãi khoản vàng người chơi.

Browser kiểm double tap Stocks/Bonds chỉ chi 1 triệu/lần, stock purchase hoàn tất encounter. Fixture Gold dev hiện có kiểm cash 47 → 41 triệu sau double tap mua 6 triệu. Console errors: 0 ở production và Gold fixture. Mở Help giữ details, mã CMG và số tiền. Các ảnh model trên production vẫn có marker native-loaded=true; asset/renderer không đổi.

## Ảnh và phạm vi bằng chứng

| Màn | 320px | 390px | 430px |
| --- | --- | --- | --- |
| Bản tin | [320](playtests/economic-news-v1/320-bulletin.jpg) | [390](playtests/economic-news-v1/390-bulletin.jpg) | [430](playtests/economic-news-v1/430-bulletin.jpg) |
| Chi tiết bản tin | [320](playtests/economic-news-v1/320-bulletin-details.jpg) | [390](playtests/economic-news-v1/390-bulletin-details.jpg) | [430](playtests/economic-news-v1/430-bulletin-details.jpg) |
| Cổ phiếu / CMG | [320](playtests/economic-news-v1/320-stocks-signal.jpg) | [390](playtests/economic-news-v1/390-stocks-signal.jpg) | [430](playtests/economic-news-v1/430-stocks-signal.jpg) |
| Trái phiếu | [320](playtests/economic-news-v1/320-bonds-signal.jpg) | [390](playtests/economic-news-v1/390-bonds-signal.jpg) | [430](playtests/economic-news-v1/430-bonds-signal.jpg) |
| Vàng (dev fixture) | [320](playtests/economic-news-v1/320-gold-signal.jpg) | [390](playtests/economic-news-v1/390-gold-signal.jpg) | [430](playtests/economic-news-v1/430-gold-signal.jpg) |
| So sánh không shock | [320](playtests/economic-news-v1/320-reality.jpg) | [390](playtests/economic-news-v1/390-reality.jpg) | [430](playtests/economic-news-v1/430-reality.jpg) |
| Bài học | [320](playtests/economic-news-v1/320-reality-details.jpg) | [390](playtests/economic-news-v1/390-reality-details.jpg) | [430](playtests/economic-news-v1/430-reality-details.jpg) |
| So sánh có shock | [320](playtests/economic-news-v1/320-reality-macro.jpg) | [390](playtests/economic-news-v1/390-reality-macro.jpg) | [430](playtests/economic-news-v1/430-reality-macro.jpg) |
| Chi tiết shock | [320](playtests/economic-news-v1/320-reality-macro-details.jpg) | [390](playtests/economic-news-v1/390-reality-macro-details.jpg) | [430](playtests/economic-news-v1/430-reality-macro-details.jpg) |
| Result ván export | [320](playtests/economic-news-v1/320-result.jpg) | [390](playtests/economic-news-v1/390-result.jpg) | [430](playtests/economic-news-v1/430-result.jpg) |

30 JPG có [kích thước thực](playtests/economic-news-v1/screenshot-dimensions.json). Đã sửa phương pháp capture: chờ browser observation trước screenshot sau resize; thay các ảnh compositor bị cắt. Ván cùng seed được chơi thêm để chụp lại, với một số lựa chọn đầu tư khác; số tài sản cá nhân trong ảnh summary có thể khác ván export, còn giá thị trường cùng đường đi vẫn khớp. Ảnh Result giữ ván export đầu tiên. Gold là dev fixture, không gộp vào claims production/replay. Bảng DOM của ván export ban đầu được giữ riêng trong evidence.

Tổng thay đổi: [danh sách tệp](playtests/economic-news-v1/changed-files.txt). Không đổi `src/game/`, `src/data/`, session dispatcher, AI Coach, artwork/GLB/dice/audio, financial formulas hoặc replay schema.

## Chạy và giới hạn

Từ root: `npm ci`, `npm ci --prefix mobile_app`, `npm run dev --prefix mobile_app`, mở http://localhost:5174. Tin tức không cần AI key hoặc network API. Production local: build Mobile rồi chạy preview. Tái kiểm log: `node --experimental-strip-types scripts/verify-economic-news-log.ts docs/playtests/economic-news-v1/browser-game-log.json.gz`.

Chưa thử điện thoại vật lý, screen reader thực tế hoặc candidate trên Vercel; font Google có thể phụ thuộc network và có fallback. 320×640 cần cuộn, đặc biệt khi mở chi tiết. Không có live news, AI forecast, confidence score hoặc đánh giá khả năng sinh lời thật. Artwork lệch một số icon C20 vẫn thuộc phạm vi designer riêng. **Sẵn sàng owner review**, không tự merge, force-push hay deploy.
