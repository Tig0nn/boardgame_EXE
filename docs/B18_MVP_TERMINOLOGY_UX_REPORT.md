# B18 MVP — Chuẩn hóa thuật ngữ và chú giải tương tác

Ngày: 19/10/2026. Nhánh: `codex/mvp-b18-terminology-ux`.

Base chính xác: `17f2aa1dc4958306db90673620566a90b3b02fac` (`codex/mvp-b18-ux-polish`). SHA triển khai và dấu vân tay toàn bộ file được ghi trong [manifest](playtests/b18-terminology/manifest.json). Đây là bản bàn giao branch để Owner review, chưa promote hoặc xác nhận production-ready.

## 1. Phạm vi và kết quả

Đã Việt hóa các thuật ngữ chuyên môn trên giao diện và thêm từ điển chung cho Desktop/Mobile. Người chơi có thể xem giải thích bằng chuột, bàn phím hoặc cảm ứng, hoặc mở toàn bộ định nghĩa trong Sổ tay.

Giữ nguyên engine, kinh tế, giá/spread/phí, RNG, rules profile, bàn cờ, điều kiện thắng và schema lưu/replay. Không sửa câu chữ trong log hoặc snapshot đã lưu. Không chạy lại nghiên cứu cân bằng, merge, deploy thủ công hay thay alias production.

## 2. Từ điển thống nhất và vị trí

Nguồn duy nhất: `src/components/glossary.ts`. `FinancialTerm`, `GlossaryText` và `FinancialGlossary` cùng đọc nguồn này; không sao chép định nghĩa giữa hai giao diện.

| Thuật ngữ | Tên hiển thị | Vị trí chính |
|---|---|---|
| Coupon | Lãi trái phiếu định kỳ | Bản tin, giao dịch và danh mục trái phiếu, START, kết quả, Sổ tay |
| Issuer | Tổ chức phát hành | Bản tin, thẻ trái phiếu và phần tín dụng |
| Credit rating | Xếp hạng tín nhiệm | Chi tiết tín dụng, các khoản đang giữ |
| Spread | Chênh lệch giá mua–bán | Báo giá Vàng, xác nhận bán tài sản, Sổ tay |
| Liquidity | Khả năng chuyển thành tiền | Chọn nguồn thanh toán, giải thích bàn cờ/Sổ tay |
| Funding | Huy động tiền thanh toán | Chọn nguồn thanh toán, mô tả ô, hướng dẫn |
| Maturity | Đáo hạn | Giao dịch/danh mục trái phiếu, Sổ tay |
| Default | Vỡ nợ | Chi tiết trái phiếu, danh mục, START, Sổ tay |
| Payback | Hoàn vốn | Phần mở rộng Khóa học, Sổ tay |
| Face value | Mệnh giá | Giao dịch và thông tin trái phiếu |
| START | Ô Xuất phát (START) | Thông tin ô START, quyết toán, Sổ tay |
| Net worth | Tài sản ròng | Ví, chi tiết kết quả, Sổ tay |
| Eligible proceeds | Giá trị huy động hợp lệ | Mục tiêu, nguồn tiền về đích, Sổ tay |

“Hoàn vốn” ở đây là thời gian bù vốn bằng thu nhập tăng thêm. Định nghĩa phân biệt với tỷ suất sinh lời (ROI), tránh đồng nhất ROI với một mốc thời gian. Lãi trái phiếu khác tổng lợi nhuận; có thể chậm trả hoặc mất. Chênh lệch giá mua–bán khác phí giao dịch. Tài sản ròng khác tiền mặt và nguồn tiền về đích; quán chưa bán và lãi chưa nhận không được cộng vào nguồn hợp lệ.

## 3. Audit và thay đổi giao diện

| Nhóm file | Nội dung sửa/lý do |
|---|---|
| `market-news.ts`, `MarketNews.tsx`, `Forecast.tsx` | Dùng đúng hai câu Bản tin Owner yêu cầu. Desktop đọc cùng selector trình bày tín dụng với Mobile; giữ bố cục hiện có, không đổi dữ liệu thị trường. |
| `BondCreditPanel`, `BondHoldings`, `BondStartSummary`, `MarketDetails` | Việt hóa lãi, tổ chức phát hành, trạng thái và rủi ro; giải thích mệnh giá/đáo hạn/xếp hạng; phân biệt chậm trả, vỡ nợ, khoản chờ và tiền thực nhận. |
| `InvestmentEncounter`, `TradingPanel`, `FundingDialog`, `RebalanceDialog` | Giữ nguyên báo giá, tiền thực nhận và hành động; thêm chú giải chênh lệch, huy động tiền và khả năng chuyển thành tiền; Việt hóa phản hồi từ log khi hiển thị. |
| `CourseChoices`, `Portfolio`, `GoalChecks`, `FinancialReview`, `GameResultModal`, `GameDialogs` | Giải thích hoàn vốn, tài sản ròng và nguồn tiền hợp lệ; không đổi công thức hoặc tạo nguyên nhân tài chính mới. |
| `Tutorial`, `RulebookModal`, Desktop `App`, `Board`, `CoreMvpBoard`, `tile-information` | Bỏ Stocks/Gold/Business/savings/funding/lot/reserve… khỏi câu hướng dẫn; thêm mục “Giải thích thuật ngữ”; mô tả đúng 9 loại ô và profile đang chơi. |
| `EconomicEventModal`, `EventModal`, `LapSummaryModal` | Việt hóa chú thích, dòng quyết toán và mô tả lấy từ dữ liệu; số tiền và sự kiện giữ nguyên. |
| `EventLog`, Mobile `App`/`GameSetup`, `AICoachPanel` | Chỉ chuyển ngữ tại lớp hiển thị. JSON gốc vẫn tải được và nằm trong phần dữ liệu kỹ thuật mở rộng. Lỗi cú pháp tệp nhập có thông báo tiếng Việt. AI Coach vẫn tùy chọn. |

Danh sách file và SHA256 đầy đủ nằm trong `manifest.json` → `sourceFiles`.

Bản tin dùng nguyên văn:

- “Lãi trái phiếu tùy tổ chức phát hành · Có thể chậm trả hoặc mất vốn”.
- “Khả năng trả nợ chịu áp lực · Tổ chức yếu rủi ro hơn”.

`GlossaryText` chỉ tách các cụm tiếng Việt có trong danh sách cho phép bằng phép tìm chuỗi chính xác, rồi render text/React node được escape. Ghép lại các đoạn luôn bằng chuỗi selector đầu vào; không thay số, giá hay dữ liệu thị trường. Với narrative lịch sử, bộ chuyển ngữ có danh sách từ giới hạn, chỉ áp dụng lúc render trường văn bản; không áp dụng cho object, mã cổ phiếu, JSON hoặc dữ liệu ghi lại.

## 4. Tương tác và khả năng truy cập

- Hover hoặc Tab focus mở giải thích; Enter/Space mở, Escape chỉ đóng chú giải đang mở và giữ modal cha.
- Chạm mở, chạm ngoài đóng. Chỉ một chú giải mở cùng lúc; rời vùng chuột/focus đóng sau khoảng ngắn để có thể đưa chuột sang phần giải thích.
- Gạch chân chấm và biểu tượng thông tin; nút có tên truy cập, trạng thái mở, liên kết tới định nghĩa. Nhãn rút gọn vẫn có tên hiển thị trong accessible name. Không dựa vào HTML `title`.
- Native Popover đưa giải thích lên trên lớp modal, tránh bị cắt bởi vùng cuộn. Vị trí giới hạn trong viewport và tránh các nút hành động đang nhìn thấy; cập nhật khi cuộn/đổi kích thước.
- Chữ giải thích 14px, màu `#173d38` trên nền `#f7fffd`; cỡ chữ không bị selector `span/strong` của panel cũ ghi đè.
- Không có dependency mới. Component chỉ giữ trạng thái hiển thị, không import engine hoặc gửi lệnh trò chơi.

## 5. Kết quả QA

| Kiểm chứng | Baseline | Sau sửa |
|---|---:|---:|
| Product tests | 339/339 | **343/343** |
| SSR UI tests | 3/3 | **4/4** |
| Replay khớp hoàn toàn | 77/77 | **81/81** |
| Research parity | 13 ván / 2.306 snapshot | **13 ván / 2.306 snapshot** |
| Lint | Đạt | **Đạt** |
| Build Desktop/Mobile | Đạt | **Đạt / Đạt** |

77 replay cũ có SHA256 không đổi. Bốn replay bổ sung gồm hai checkpoint chậm trả/vỡ nợ tái dựng bằng hành động gốc và hai ván Desktop chơi qua UI thật (thắng 94M, thua 84M). Không sửa trạng thái tín dụng bằng cách tiêm dữ liệu. Các kết quả này dùng kiểm chứng kỹ thuật, không phải nghiên cứu cân bằng hoặc bằng chứng người chơi đã học.

40 điểm kiểm chứng glossary bằng Chromium: 320px, 390px và Desktop 1440px; hover, Tab, Enter, Space, Escape, cảm ứng, chạm ngoài, modal và cuộn; đủ 9 loại ô trên Mobile, thêm 9 loại ô bằng bàn phím trên Desktop. Không tràn ngang, không che nút giao dịch trong các trường hợp đã đo, không lỗi JavaScript. So sánh bản lưu trước/sau mở chú giải và export trước/sau xem ô cho kết quả không đổi; có kiểm tra reload/resume và lỗi nhập JSON tiếng Việt.

Đã xác minh nguyên byte **187 artifact** của vòng Beginner UX và **115 artifact** của vòng Multi-Course trước. Kiểm tra diff không có thay đổi trong `src/game`, `src/data`, `scripts/research`, `docs/research`.

Chênh lệch QA đã xử lý:

1. Assertion cũ tìm chữ `issuer` được đổi sang `tổ chức phát hành`; không sửa fixture.
2. SSR so sánh nguyên markup Khóa học gặp ID `useId` khác theo cây cha. Assertion chỉ chuẩn hóa ID React sinh tự động; nhãn, tiền và thuộc tính hành động vẫn được so sánh.
3. CSS Bản tin cũ làm chú giải Desktop quá nhỏ: đã cô lập typography và thêm kiểm tra cỡ chữ thực tế 14px.
4. Phép so sánh state sau import phải đợi autosave hoàn tất; tránh so sánh `null` trước lưu với bản lưu vừa tạo. Đợt kiểm chứng cuối chạy trên mã ổn định, không bị HMR trong lúc tương tác.

## 6. Ảnh trước/sau

| Màn | Trước | Sau |
|---|---|---|
| Bản tin 320px | [Ảnh](playtests/b18-terminology/before/320-bulletin.png) | [Ảnh](playtests/b18-terminology/after/320-bulletin.png) · [Chú giải](playtests/b18-terminology/after/320-tooltip-bulletin.png) |
| Giao dịch Trái phiếu 320px | [Ảnh](playtests/b18-terminology/before/320-bond-trade.png) | [Ảnh](playtests/b18-terminology/after/320-bond-trade.png) · [Chú giải](playtests/b18-terminology/after/320-tooltip-bond.png) |
| Sổ tay 390px | [Ảnh](playtests/b18-terminology/before/390-handbook.png) | [Ảnh](playtests/b18-terminology/after/390-glossary.png) · [Cuộn](playtests/b18-terminology/after/390-glossary-scroll.png) |
| Kết quả 390px | [Ảnh](playtests/b18-terminology/before/390-result.png) | [Ảnh](playtests/b18-terminology/after/390-result.png) |
| Bản tin Desktop 1440px | [Ảnh](playtests/b18-terminology/before/desktop-bulletin.png) | [Ảnh](playtests/b18-terminology/after/desktop-bulletin.png) · [Bàn phím](playtests/b18-terminology/after/desktop-keyboard-tooltip.png) |
| Trái phiếu Desktop | [Ảnh](playtests/b18-terminology/before/desktop-bond-trade.png) | [Ảnh](playtests/b18-terminology/after/desktop-bond-trade.png) |
| Sổ tay Desktop | [Ảnh](playtests/b18-terminology/before/desktop-handbook.png) | [Ảnh](playtests/b18-terminology/after/desktop-handbook.png) |
| Kết quả Desktop | [Ảnh](playtests/b18-terminology/before/desktop-result.png) | [Thắng](playtests/b18-terminology/after/desktop-result.png) · [Thua](playtests/b18-terminology/after/desktop-result-defeat.png) |
| Tín dụng lịch sử | Không thay archive | [Chậm trả](playtests/b18-terminology/after/delayed-credit.png) · [Vỡ nợ](playtests/b18-terminology/after/defaulted-credit.png) |

Các cặp bản tin/giao dịch dùng cùng mã `TERMS-1`. Kết quả Mobile nhập cùng replay thật. Ảnh kết quả Desktop trước được sao chép nguyên byte từ bằng chứng của đúng base; ảnh sau chơi lại cùng mã `TRADING-AB-MAIN-0`. Thư mục ảnh còn có đủ bản 320/390px ngoài các ví dụ trên.

## 7. Từ giữ lại và giới hạn

Bản quét AST UI literal/selector trình bày: **0 trường hợp sót** trong bộ từ được kiểm tra. [Kết quả JSON](playtests/b18-terminology/language-audit.json) ghi rõ phạm vi và ngoại lệ; đây không phải công cụ dịch tự động mọi câu tiếng Anh.

Giữ START, AI Coach, JSON, mã cổ phiếu/tên thương hiệu, tên doanh nghiệp giả lập, hạng AA/B/CCC/D, ký hiệu profile/phiên bản khi cần xác định ván lịch sử; giữ tên tiếng Anh đối chiếu trong Sổ tay. ROI chỉ xuất hiện để phân biệt tỷ suất sinh lời với thời gian hoàn vốn. Mã kỹ thuật trong dữ liệu mở rộng/export giữ nguyên.

Đã kiểm tra bằng Chromium với viewport và cảm ứng giả lập. Chưa kiểm tra thiết bị vật lý, VoiceOver/NVDA hoặc Safari/Firefox; ARIA/bàn phím đã kiểm chứng kỹ thuật, không thay thế thử nghiệm với người dùng dùng trình đọc màn hình. Popover sử dụng API trình duyệt hiện đại. Không gọi AI Coach ra dịch vụ ngoài trong QA; nhận xét sinh bởi dịch vụ vẫn là nội dung tùy chọn cần đối chiếu nhật ký.

## 8. Tái lập

Từ thư mục gốc, khởi động Desktop tại `http://127.0.0.1:5201` và Mobile tại `http://127.0.0.1:5200` bằng Vite của từng ứng dụng. Script browser hỗ trợ `PLAYWRIGHT_MODULE`, `BROWSER_PATH`, `B18_URL`, `B18_DESKTOP_URL`; dùng Chromium headless, chỉ truy cập máy cục bộ.

```powershell
npm test
node --experimental-strip-types --test --test-concurrency=1 scripts/diagnostics/b18-ux-ui.test.ts scripts/diagnostics/core-mvp-b18-ui.test.ts scripts/diagnostics/multi-course-ui.test.ts scripts/diagnostics/terminology-ui.test.ts
node --experimental-strip-types scripts/diagnostics/terminology-checkpoints.ts
node scripts/diagnostics/terminology-screens.mjs --after
node scripts/diagnostics/terminology-browser.mjs
node scripts/diagnostics/terminology-desktop.mjs
node scripts/diagnostics/terminology-desktop-board.mjs
node scripts/diagnostics/audit-terminology.mjs
node --experimental-strip-types scripts/diagnostics/verify-terminology-replays.ts
node --experimental-strip-types scripts/verify-multi-course-parity.ts
npm run lint
npm run build
npm run build --prefix mobile_app
node scripts/verify-b18-terminology-evidence.mjs --check
```

Không chạy script ảnh không có `--after` trên bản đã sửa để ghi đè bằng chứng trước. `--check` chỉ xác minh dấu vân tay; nếu chủ động tạo lại bằng chứng cần lưu đầu ra kiểm thử vào đúng file và tạo lại manifest. Các script mới không ghi vào thư mục bằng chứng cũ.
