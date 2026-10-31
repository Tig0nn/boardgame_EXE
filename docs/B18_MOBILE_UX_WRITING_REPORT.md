# B18 Mobile — UX Writing & Financial Language

Ngày 20/10/2026 · Chờ Product Owner review.

Nhánh: `codex/b18-mobile-ux-writing-audit`. Commit triển khai: **`878414a93e66f6545ff816ee6ffb64957c74870a`**. Nền nhánh `f0bb612a2aa9514c4fc2fcbf8d878b7bece3947f` giữ tài liệu QA, có source sản phẩm khớp `927e53e2189bd6d901ed494791d9dc7e912358a6` trước sửa. Không tạo PR.

## Kết quả

Đã rà soát Mobile và UI dùng chung theo nguyên tắc giải thích bằng lời trước, thuật ngữ sau. [Bảng audit](B18_MOBILE_UX_WRITING_AUDIT.md) ghi component, before/after, vấn đề, lý do và kiểm chứng nghĩa tài chính. [Inventory](playtests/b18-mobile-ux-writing/literal-inventory.json) quét **60 file** Mobile/UI nhập vào; [diff câu chữ](playtests/b18-mobile-ux-writing/changed-display-strings.json) ghi vị trí literal và fragment trước/sau ở **21 file**. Inventory có cả literal kỹ thuật trong code; không coi mọi literal là chữ đang hiện trên màn hình.

| Bề mặt | Trước | Sau và ý nghĩa được giữ |
|---|---|---|
| Sự kiện kinh tế | “Thị trường vừa phản ứng”, “Bình quân đều các mã” | “Giá thay đổi sau sự kiện”; trung bình của **tất cả cổ phiếu, mỗi mã tính như nhau**. Nêu ngay đây không phải lãi người chơi; chi tiết nói rõ trung bình cộng tỷ lệ đổi giá và không phải chỉ số thị trường thực. |
| Áp lực bên phát hành | “Áp lực trả nợ 0/2 → 0/2” | Tăng / giảm / không thay đổi; nói rõ chủ thể là bên phát hành trái phiếu, không phải nợ người chơi. Thang 0–2 chỉ ở phần mở rộng, giải thích hai đầu thang và mức 0 vẫn có thể chậm trả/mất vốn. |
| Tác động cá nhân | “Thay đổi định giá chưa thực hiện” trong chi tiết | Tóm tắt ngay ở lớp mặc định giá trị các tài sản thực đang giữ đổi bao nhiêu. Dùng đúng chênh lệch snapshot của cùng lượng tài sản; **không gọi đó là lãi/lỗ so với vốn đã mua** hoặc tiền đã bán nhận. |
| Chưa sở hữu / thiếu dữ liệu | Chỉ không hiện bảng danh mục | Nói rõ chưa giữ cổ phiếu, trái phiếu, vàng hay quán. Nếu đang giữ mà không có quan sát hợp lệ thì báo chưa đủ dữ liệu, không tự tạo số tiền. |
| Trái phiếu | “Áp lực X/2”, “Tín dụng, kỳ hạn & cách rút vốn” | Thẻ chính giữ cảnh báo chậm trả/mất vốn. “Khả năng trả nợ và cách lấy lại tiền” chứa chỉ số kỹ thuật và giải thích. Nơi bán theo rules profile: B18 có ô Trái phiếu; ván cũ không được thêm quyền bán tại ô. |
| Cổ phiếu / vàng | Mobile ẩn cảnh báo giảm giá cổ phiếu; “chênh lệch” thiếu ngữ cảnh | Cảnh báo giảm giá trước nút mua trên Mobile. “Chênh lệch giá mua và bán”; vàng không trả lãi định kỳ. Giữ đúng phí, spread và quote. |
| Giá vốn vàng | “Giá vốn bình quân” | “Bình quân số tiền đã bỏ ra mua mỗi đơn vị”; vẫn lấy cost basis chia số đơn vị, không thay cách tính. |
| Kết quả / review | “Giá trị huy động hợp lệ”, “Vốn quán chưa bán” | “Nguồn tiền về đích”, giải thích tiền bán sau phí, trừ nợ/khoản phải trả và không tự bán tài sản. Tiền đầu tư còn nằm trong quán chưa bán không tính mục tiêu. Facts vẫn chỉ từ log/state, không suy diễn lý do thắng thua. |
| Funding / bán tại Xuất phát | “Thực nhận” | “Tiền nhận sau phí”; giữ nguyên nguồn hợp lệ, số tiền quote và cảnh báo mất lãi khi rút sớm/vay có lãi. |
| Tổng kết vòng | “Chỉ Việt hóa nhãn hiển thị” | Giải thích khoản đã vào ví khác khoản đang chờ hoặc không thu hồi được; không đưa chi tiết triển khai vào luồng đọc. |
| Dự báo | “Điều kiện tín dụng phân hóa”, “Điều bạn học được” | “Khả năng trả nợ khác nhau giữa các bên phát hành”, “Nhìn lại dự báo và rủi ro”. Không coi việc đã xem popup là bằng chứng đã học. |
| Sổ tay / hướng dẫn / Ví | “thanh khoản”, “nghĩa vụ”, “huy động hợp lệ” thiếu ngữ cảnh | Khả năng có tiền khi cần; khoản hẹn trả; nguồn tiền về đích. Giữ giải thích kỳ hạn, lịch nhận tiền và nguy cơ hết nguồn thanh toán. |
| Setup / mở save | “Nhật ký JSON · Giữ nguyên phiên bản” | “Chọn tệp nhật ký đã xuất từ trò chơi (.json)”. Không thay import, storage, schema hoặc resume. Cảnh báo 0 tiền mặt vẫn cho chọn tiếp. |

## File và phạm vi sửa

- Mobile: `EconomicEventModal`, `market-language`, `BondStartSummary`, `GameResultModal`, `GameSetup`, `LapSummaryModal`, `MarketNews`, `RulebookModal`, `Tutorial`, `economic-event.css`.
- Hai selector trình bày `mobile_app/src/game/economic-event.ts` và `market-news.ts`: **chỉ sửa chuỗi giải thích**, không đổi phép tính, nhánh hay dữ liệu dẫn xuất.
- UI dùng chung mà Mobile nhập: `BondCreditPanel`, `BusinessPanel`, `FundingDialog`, `MarketDetails`, `Portfolio`, `RebalanceDialog`, `TradingPanel`, `financial-review`, `glossary`, `tile-information`.
- Regression: `tests/market-language.test.ts`, `tests/glossary.test.ts`; SSR economic-event, terminology, atomic-investments và economic-news. Test language-cleanup giờ chỉ ghi audit khi có `UI_AUDIT_OUTPUT` chỉ định, tránh ghi đè bằng chứng khóa.
- Script tái lập mới: `ux-writing-checkpoints.ts`, `ux-writing-browser.mjs`, `ux-writing-accessibility.mjs`, `ux-writing-compat.ts`, `ux-writing-inventory.mjs`, `verify-b18-ux-writing-evidence.mjs`.

Không đổi `src/game`, `src/data`, RNG, phí, spread, transaction, victory, save/replay/schema, nghiên cứu hoặc dependency. Không sửa App/config/project Desktop riêng. Component dùng chung có thể đổi chữ khi Desktop nhập vào; chỉ xác nhận typecheck dùng chung, không tuyên bố Desktop được QA lại.

Khóa học và ba biến cố cá nhân đã có chi phí/lựa chọn/thời điểm trả rõ ràng nên giữ các giá trị và lựa chọn. Kiểm tra UI ở ô học, sửa xe và funding; không tạo lời khuyên khóa nào tối ưu. Save, board, market, course IDs và mã tham chiếu giao dịch giữ nguyên.

## Thuật ngữ cố ý giữ

- **Đáo hạn, mệnh giá, xếp hạng tín nhiệm, hoàn vốn, tài sản ròng:** vẫn có ích để học, có giải thích tại chỗ hoặc glossary. Đáo hạn không bảo đảm trái phiếu được trả đúng ngày; hoàn vốn không phải tỷ suất sinh lời.
- **Coupon, Liquidity, Spread, Default** trong mục đối chiếu tiếng Anh của Sổ tay; tiêu đề chính lần lượt là “Tiền lãi trái phiếu định kỳ”, “Khả năng có tiền khi cần”, “Chênh lệch giá mua và bán”, “Không trả được nợ”. Alias tiếng Việt cũ vẫn được nhận diện khi đọc log lịch sử.
- **START** chỉ trong câu glossary giải thích đây là tên kỹ thuật; **JSON/.json**, **B18/C20**, mã hành trình, hạng **AA/B/CCC/D**, ticker **FPT/CMG/VCB/TCB/HPG/BMP**, tên công ty và **AI Coach** giữ đúng mục đích. Không sửa những tên này trong dữ liệu tải xuống.
- “Vỡ nợ”, “lãi đơn”, “chi phí cơ hội”, “tái cơ cấu”, “quyết toán” có thể còn ở lịch sử hoặc luật nâng cao có ngữ cảnh. Không thay hàng loạt làm sai nội dung hợp đồng cũ. Không có UI drawdown mới để đặt tên lại.

## Kiểm thử

| Kiểm chứng | Kết quả / bằng chứng |
|---|---|
| Product | **351/351 PASS**; baseline 349 + 2 test helper áp lực. [Log](playtests/b18-mobile-ux-writing/product-tests.txt) |
| SSR / UI | **50/50 PASS**, 12 test cấp cao; baseline 46 + 4 trường hợp B18 macro. [Log](playtests/b18-mobile-ux-writing/ssr-tests.txt) |
| Macro | Giá tăng/giảm, áp lực tăng/giảm/không đổi và chạm trần; chưa giữ/có tài sản; legacy single issuer, thiếu dữ liệu, trung lập. Render không đổi serialized log. SSR dùng fixture kiểm soát, không gắn nhãn là ván tự nhiên. |
| Replay | **81/81 PASS** từ danh sách lịch sử cố định, không thay golden. [JSON](playtests/b18-mobile-ux-writing/compatibility.json) |
| Research parity | **13 ván / 2.306 snapshot khớp**, không chạy nghiên cứu cân bằng mới. [Log](playtests/b18-mobile-ux-writing/parity.txt) |
| Lint, typecheck, build | ESLint PASS; TS Mobile và shared PASS; production build Mobile PASS. Không deploy artifact build. |
| Save/resume UI | **33/33** lượt import → xem → reload → resume giữ nguyên byte save; thêm **3** luồng ván kết thúc → Setup → save mới → reload/resume mới đúng. Product tests giữ B18/C20 và schema lịch sử. |
| Artifact cũ | **1.300 artifact** theo 6 manifest khớp raw SHA256; báo cáo/evidence trước đó không đổi. Verifier mới không yêu cầu source UI mới phải trùng hash của candidate cũ. |

Các assertion chứa câu cũ ban đầu thất bại đúng dự kiến; đã thay bằng nghĩa mới và chạy lại toàn bộ SSR đạt 50/50. Bộ duyệt tự động đã chặn một số lệnh SSR rộng vì nguy cơ ghi evidence cũ; sau khi audit đủ 12 file và đổi writer sang output mới, chạy danh sách tường minh thành công. Không cần bỏ qua bảo vệ artifact.

## Visual QA và ảnh

Chromium **149.0.7827.55**, UI cục bộ ở **320×740, 390×844, 430×932**. **24 ảnh trước**, **96 ảnh sau**, **12 ảnh kiểm tra bổ sung**; 162 check sau + 12 check accessibility. Không tràn ngang page/modal; CTA chính đi tới được, kiểm tra mua trái phiếu và xác nhận sự kiện cao ít nhất 44px. Tab tới nút mua; tap mở giải thích, Escape đóng tooltip mà giữ modal. Modal vẫn cuộn; thông tin kỹ thuật không làm thêm bước xác nhận.

Ảnh trước/sau cùng checkpoint, nhập qua UI sản phẩm. [Provenance](playtests/b18-mobile-ux-writing/checkpoints/provenance.json) ghi seed, vòng/lượt và log nguồn. 13 checkpoint là **prefix replay đúng của ván đã lưu**, không sửa field hoặc tạo RNG/path; không tính chúng là 13 ván UI mới hoàn chỉnh. Bản gzip giải nén đúng JSON gốc.

| Màn 320px | Trước | Sau |
|---|---|---|
| Sự kiện “Chuỗi cung ứng phục hồi” | [Ảnh](playtests/b18-mobile-ux-writing/before/320-economic-event.png) | [Ảnh](playtests/b18-mobile-ux-writing/after/320-economic-event.png) |
| Thẻ trái phiếu và thông tin rủi ro | [Ảnh](playtests/b18-mobile-ux-writing/before/320-bonds.png) | [Ảnh](playtests/b18-mobile-ux-writing/after/320-bonds.png) |
| Mua cổ phiếu | [Ảnh](playtests/b18-mobile-ux-writing/before/320-stocks.png) | [Ảnh](playtests/b18-mobile-ux-writing/after/320-stocks.png) |
| Kết quả tài chính | [Ảnh](playtests/b18-mobile-ux-writing/before/320-result.png) | [Ảnh](playtests/b18-mobile-ux-writing/after/320-result.png) |

Các cặp **390/430px** ở cùng thư mục, đổi tiền tố `320-` thành `390-` hoặc `430-`. Bổ sung: [thang áp lực có ngữ cảnh](playtests/b18-mobile-ux-writing/accessibility/320-bond-risk-details.png), [đang giữ tài sản](playtests/b18-mobile-ux-writing/accessibility/320-economic-owned-personal-impact.png), [chưa sở hữu](playtests/b18-mobile-ux-writing/accessibility/320-economic-empty-personal-impact.png). Ảnh `bonds-details` trong bộ cặp là phần tín hiệu thị trường; phần thang rủi ro mở rộng được chụp riêng trong `accessibility`.

Giới hạn: kiểm tra mới bằng Chromium desktop với viewport/touch giả lập; **chưa kiểm chứng Safari/iOS và Android vật lý, screen reader, bàn phím ảo hay zoom native**. Không chạy lại toàn bộ release QA, không Human Playtest. Không coi proxy hoặc ảnh là bằng chứng người chơi đã hiểu bài học. Cần Owner đọc copy và duyệt.

Console có **404 `/favicon.ico` trên dev server**, đã xuất hiện ở baseline; không có JavaScript page error hay HTTP lỗi tài nguyên ứng dụng trong listener page response. Giữ nguyên thiếu favicon, không mở scope sửa branding. [Kết quả UI](playtests/b18-mobile-ux-writing/after/results.json) giữ nguyên chi tiết console để kiểm tra, không che lỗi. Chữ sự kiện ở 320px vẫn cần cuộn; nút Tiếp tục luôn có thể chạm, không ép mở chi tiết.

## Tái lập và phát hành

Chạy từ root repo (Node 22+, dependency hiện có; scripts browser dùng Playwright/binary qua các path runtime hoặc biến môi trường đã nêu trong source):

```powershell
node --experimental-strip-types --test tests/*.test.ts
$env:UI_AUDIT_OUTPUT='docs/playtests/b18-mobile-ux-writing/rendered-language-audit.json'
node --experimental-strip-types --test --test-concurrency=1 scripts/diagnostics/*ui.test.ts
node --experimental-strip-types scripts/diagnostics/ux-writing-compat.ts
node --experimental-strip-types scripts/verify-multi-course-parity.ts
node node_modules/eslint/bin/eslint.js .
node node_modules/typescript/bin/tsc -p mobile_app/tsconfig.json
node node_modules/typescript/bin/tsc -b
node mobile_app/node_modules/vite/bin/vite.js build mobile_app
node --experimental-strip-types scripts/diagnostics/ux-writing-checkpoints.ts
node scripts/diagnostics/ux-writing-inventory.mjs
# Mobile dev server tại 127.0.0.1:5210, rồi:
node scripts/diagnostics/ux-writing-browser.mjs --after
node scripts/diagnostics/ux-writing-accessibility.mjs
node scripts/verify-b18-ux-writing-evidence.mjs --check
```

Ảnh `before` được chụp trước sửa trên source candidate 927; không chạy `--before` ở nhánh mới rồi ghi đè ảnh baseline. Khi tái lập ảnh, dùng thư mục output riêng hoặc checkout mới để giữ nguyên bằng chứng bàn giao.

**Dừng ở nhánh review.** Không merge, promote, deploy thủ công, thay alias/domain hoặc sửa dữ liệu người chơi. Không thao tác Vercel trong đợt này; candidate production do Owner cung cấp vẫn là 927, branch mới chưa được duyệt phát hành. Nếu Owner duyệt bước phát hành sau này, chỉ project `boardgame-exe-mobile-preview` nằm trong phạm vi; Desktop RQA-01 vẫn deferred/out of scope theo phụ lục cũ, không được ghi là fixed.
