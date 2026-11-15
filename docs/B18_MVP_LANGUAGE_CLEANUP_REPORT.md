# B18 MVP — Dọn nhãn tiếng Anh và mã nội bộ

Ngày bàn giao: 20/10/2026. Branch: `codex/mvp-b18-language-cleanup`.
Base chính xác: `codex/mvp-b18-terminology-ux`, `10cdaa984bcdeddc8337eab945a98c939b405fec`.
SHA phần sửa mã được ghi tại `playtests/b18-language-cleanup/manifest.json`; commit bàn giao được cung cấp khi push.

## Kết quả sửa

| Phát hiện | Cách sửa và giới hạn |
|---|---|
| Ví lộ `deposit-1`, `deposit-2` | Nhãn “Khoản tiết kiệm 1”, “Khoản tiết kiệm 2”. Lấy hậu tố số từ ID ổn định, không dùng vị trí mảng. Khoản 1/2 đã tất toán hoặc rút không làm khoản 3/10 đổi số. ID lịch sử không có hậu tố hợp lệ hiển thị tên loại khoản, không tự gán số. |
| `bond-*`, `lot-*` lộ ở danh mục và giao dịch | Khoản trái phiếu có tên theo ngữ cảnh tại Ví, báo giá, danh sách bán, funding và chi tiết quyết toán. Renderer nhật ký đổi mã thành nhãn khi trình bày. React key, option value và callback giao dịch giữ ID gốc. |
| `đáo hạn START 3`, `đáo hạn vòng ...` | “Đáo hạn khi qua ô Xuất phát lần thứ 3”, đọc trực tiếp `maturityLap`. Đây là mốc tuyệt đối, không phải vòng đang chơi hoặc số kỳ còn lại. Khoản mở ở vòng khác nhau có mốc khác nhau vẫn được hiển thị riêng. |
| `6% lãi mô phỏng/vòng` | Hàng “Lãi suất — 6% mỗi kỳ”, kèm giải thích một kỳ là mỗi lần qua ô Xuất phát; lãi đơn nhận cùng gốc cuối kỳ hạn, rút sớm toàn khoản mất lãi chưa nhận. Kỳ hạn 1/2/3 vẫn dùng lãi suất profile của ván; tổng 4/10/18% trong B18 giữ nguyên. |
| START ở các màn | Dịch nhãn bàn cờ, vị trí, thiết lập, ngân hàng, Ví, bản tin, khóa học, kinh doanh, mua/bán, huy động tiền, quyết toán, sổ tay, tooltip và kết quả. Glossary dùng tên “Ô Xuất phát”; START chỉ còn trong câu giải thích tên kỹ thuật. Không thay enum hoặc dữ liệu bàn cờ. |
| Ví trên màn hẹp | Thẻ tiết kiệm chia rõ tên, gốc, lãi suất và mốc đáo hạn; hàng số liệu dùng grid với khoảng cách, số tiền không bị ngắt. Hàng lương tách nhãn và giá trị; câu “Còn N lần nhận lương” riêng. Tiến độ và nợ cho phép xuống dòng. |
| Nhật ký mở rộng | Người chơi xem nhãn đã dịch. Snapshot kỹ thuật nguyên bản vẫn có trong nút tải nhật ký JSON; không đổ toàn bộ mã nội bộ trực tiếp vào màn nhật ký. Không sửa nội dung lưu hoặc hàm xuất dữ liệu. |

## File và phạm vi

- `src/components/player-language.ts`: helper trình bày thuần, không gọi engine. `glossary.ts` áp dụng helper trước bước dịch từ đơn để `lot-4` không bị biến thành nhãn nửa dịch.
- `Portfolio.tsx`, `Portfolio.css`: thẻ tiết kiệm và bố cục số liệu. Biểu thức tính số lần nhận lương giữ nguyên.
- `SavingsTerms.tsx`, `Setup.tsx`, `TradingPanel.tsx`, `FundingDialog.tsx`: diễn giải kỳ hạn, đáo hạn và nhãn khoản gửi; giữ nguyên số, công thức, giá trị select và ID hành động.
- `BondHoldings`, `BondCreditPanel`, `InvestmentEncounter`, `RebalanceDialog`, `MarketDetails`, `BondStartSummary`: nhãn trái phiếu và thời điểm trả tiền.
- Các màn bàn cờ, onboarding, bản tin, khóa học, kinh doanh, sổ tay, kết quả và tooltip dùng tên Xuất phát; nhãn ảnh cũng được Việt hóa. Hai SVG title chuyển thành một text child để SSR không cảnh báo về cấu trúc title.
- Tests, script audit/browser/replay và verifier manifest mới nằm trong `tests`, `scripts/diagnostics`, `scripts/verify-b18-language-cleanup-evidence.mjs`. Danh sách/hash đầy đủ trong manifest.

Không sửa `src/game`, `src/data`, economics, RNG, schema, save, log/replay lưu trữ hay nghiên cứu. `mobile_app/src/game/living-presentation.ts` chỉ đổi câu hiển thị, không đổi amount/điều kiện. Không chạy mô phỏng cân bằng mới.

## Quét chuỗi và ngoại lệ chủ đích

Audit AST đọc 59 file UI và selector trình bày, gồm literal, JSX, alt/title/aria và ID được render trực tiếp. Base có **138 vị trí cần rà** trong tập mẫu; bản cuối **0 finding**, còn hai ngoại lệ được ghi riêng. Có thêm audit output render của **15 bề mặt** và quét text/nhãn truy cập trong browser; không chỉ tìm literal trong mã nguồn. Bộ mẫu tự động không phải bộ nhận diện mọi từ tiếng Anh có thể có; đã rà diff và các đường render động liên quan.

Giữ nguyên có chủ đích:

- START trong câu glossary “START là tên kỹ thuật trong dữ liệu”; không xuất hiện như tên hiển thị của ô. ROI trong giải thích phân biệt hoàn vốn với tỷ suất sinh lời.
- AI Coach là tên tính năng tùy chọn; tên trò chơi, thương hiệu/tên doanh nghiệp hư cấu, “check-in”, 3D và mã cổ phiếu giữ nguyên.
- JSON là định dạng xuất/nhập. Mã hạt giống do người chơi nhập, AA/B/CCC/D, B18/C20 và phiên bản luật giữ vai trò định danh.
- Tên tiếng Anh đối chiếu trong phần thuật ngữ mở rộng. ID trong key, DOM hook, option value, callback và payload kỹ thuật không phải nhãn trình bày, không được dịch.
- Ván C20 giữ loại ô và tên lịch sử (ví dụ Kinh tế); chỉ tên START được trình bày thành Xuất phát. Không thay bàn cờ hoặc profile để phù hợp nhãn B18.

Chi tiết: `playtests/b18-language-cleanup/{before-language-audit,language-audit,rendered-language-audit}.json` và các tệp `*-visible.txt`.

## Kiểm chứng

| Hạng mục | Kết quả |
|---|---|
| Product tests | **349/349** (base 343; thêm 6 regression tests) |
| SSR bộ B18 bắt buộc | **5/5** (4 baseline + 1 regression mới; nằm trong bộ đầy đủ dưới đây) |
| SSR mở rộng | **46/46**, 12 test cấp cao gồm các subtest của UI lịch sử |
| Replay tự nhiên schema 4/5/6/7 | **81/81**, mỗi hành động và final state khớp; 81 hash tệp cũ giữ nguyên |
| Research parity | **13 ván, 2.306 before/after snapshot**, 3 phase screen/shortlist/holdout khớp |
| Lint | Root `eslint .` bao gồm Desktop/Mobile đạt; kiểm tra riêng `eslint mobile_app/src` đạt |
| Build | Desktop và Mobile TypeScript/Vite đạt |
| Browser thật | **61 checks**, Chromium tại 320×844, 390×844, Desktop 1440×1000; 0 page error, không tràn ngang trang/modal trong các màn chụp |
| Artifact lịch sử | **381/381** raw-byte hash khớp: terminology 79, beginner UX 187, multi-course 115 |

Regression covers số thứ tự có khoảng trống sau khi khoản cũ đáo hạn/rút, ID khác loại, mốc đáo hạn 3/4 ở vòng hiện tại 2, renderer lịch sử, thứ tự dịch `lot-*`, giữ nguyên JSON đầu vào và option value. Fixture dùng cho SSR chỉ là trạng thái render có kiểm soát, không được ghi vào save/replay hoặc dùng làm dữ liệu nghiên cứu.

Browser dùng seed `LANG-0`, gửi 10M kỳ hạn 3 ở Setup, rồi gửi 6M kỳ hạn 2 tại Ngân hàng qua UI. Hai khoản có mốc 3 và 2 ngay ở vòng 1. Hash save của mỗi viewport mobile giống hệt base sau cùng hành động; xem Ví, 9 loại ô, 6 tab sổ tay và reload/resume không làm đổi state. Test SSR xác nhận trường hợp khoản 1/2 không còn hoạt động, khoản 3/10 giữ nguyên số; không tạo lịch sử giả để chụp ảnh.

Trong quá trình QA, bộ SSR lịch sử còn assertion cũ đòi Coupon/START/ID thô và mặc định BoardGuide C20 khi UI mặc định đã chuyển B18 từ trước. Đã cập nhật nhãn kỳ vọng và truyền game C20 rõ ràng cho test tương thích; không đổi kiểm tra số tiền, policy hoặc engine. Một câu bản tin bị lặp “lần qua Số lần qua...” được sửa và có assertion regression. SSR chạy tuần tự để các Vite test không tranh cache/port. Mobile không có npm script lint riêng, nên dùng ESLint root và kiểm tra thư mục Mobile trực tiếp.

Rà cuối theo code-review-and-quality và React best practices: helper chỉ ở tầng trình bày; không mutation; nội dung vẫn là text node React có escape; không thêm dependency, request mạng, hook hay effect gameplay. Không còn phát hiện cần chặn bàn giao trong phạm vi này.

## Ảnh trước/sau

Ảnh trước lấy từ đúng base; ảnh sau cùng seed và chuỗi hành động. 24 PNG gốc, không chỉnh sửa. Các ảnh cuộn tới phần cần đối chiếu, nên mép trên có thể nằm giữa nội dung Ví.

| Kích thước / màn | Trước | Sau |
|---|---|---|
| 320 · khoản gửi trong Ví | [Trước](playtests/b18-language-cleanup/before/320-wallet-deposits.png) | [Sau](playtests/b18-language-cleanup/after/320-wallet-deposits.png) |
| 320 · lương/dòng tiền | [Trước](playtests/b18-language-cleanup/before/320-wallet-cashflow.png) | [Sau](playtests/b18-language-cleanup/after/320-wallet-cashflow.png) |
| 320 · kỳ hạn Setup | [Trước](playtests/b18-language-cleanup/before/320-setup-terms.png) | [Sau](playtests/b18-language-cleanup/after/320-setup-terms.png) |
| 320 · kỳ hạn Ngân hàng | [Trước](playtests/b18-language-cleanup/before/320-bank-terms.png) | [Sau](playtests/b18-language-cleanup/after/320-bank-terms.png) |
| 390 · khoản gửi trong Ví | [Trước](playtests/b18-language-cleanup/before/390-wallet-deposits.png) | [Sau](playtests/b18-language-cleanup/after/390-wallet-deposits.png) |
| 390 · lương/dòng tiền | [Trước](playtests/b18-language-cleanup/before/390-wallet-cashflow.png) | [Sau](playtests/b18-language-cleanup/after/390-wallet-cashflow.png) |
| 390 · kỳ hạn Setup | [Trước](playtests/b18-language-cleanup/before/390-setup-terms.png) | [Sau](playtests/b18-language-cleanup/after/390-setup-terms.png) |
| 390 · kỳ hạn Ngân hàng | [Trước](playtests/b18-language-cleanup/before/390-bank-terms.png) | [Sau](playtests/b18-language-cleanup/after/390-bank-terms.png) |
| 1440 · khoản gửi trong Ví | [Trước](playtests/b18-language-cleanup/before/desktop-wallet-deposits.png) | [Sau](playtests/b18-language-cleanup/after/desktop-wallet-deposits.png) |
| 1440 · lương/dòng tiền | [Trước](playtests/b18-language-cleanup/before/desktop-wallet-cashflow.png) | [Sau](playtests/b18-language-cleanup/after/desktop-wallet-cashflow.png) |
| 1440 · kỳ hạn Setup | [Trước](playtests/b18-language-cleanup/before/desktop-setup-terms.png) | [Sau](playtests/b18-language-cleanup/after/desktop-setup-terms.png) |
| 1440 · kỳ hạn Ngân hàng | [Trước](playtests/b18-language-cleanup/before/desktop-bank-terms.png) | [Sau](playtests/b18-language-cleanup/after/desktop-bank-terms.png) |

## Tái lập và giới hạn

Chạy từ root repository, Node hỗ trợ strip-types; cài dependency root/Mobile theo lockfile sẵn có:

```powershell
npm test
node --experimental-strip-types --test --test-concurrency=1 scripts/diagnostics/*ui.test.ts
node scripts/diagnostics/audit-player-language.mjs
node --experimental-strip-types scripts/diagnostics/verify-language-replays.ts
node --experimental-strip-types scripts/verify-multi-course-parity.ts
npm run lint
npx eslint mobile_app/src
npm run build
npm --prefix mobile_app run build
node scripts/verify-b18-language-cleanup-evidence.mjs --check
```

Browser script: chạy hai dev server Mobile/Desk ở 5200/5201, rồi `node scripts/diagnostics/language-cleanup-browser.mjs --after`. Có thể đặt `LANGUAGE_MOBILE_URL`, `LANGUAGE_DESKTOP_URL`, `PLAYWRIGHT_MODULE`, `BROWSER_PATH`. Script trước/sau dùng context trình duyệt mới, không chạm save của người dùng. Muốn tái lập ảnh trước, chạy script không có `--after` với hai URL phục vụ đúng base ở checkout riêng; không chạy đè chứng cứ đã bàn giao.

Đây là Chromium với viewport mô phỏng, chưa phải kiểm thử thiết bị vật lý hoặc đánh giá screen reader đầy đủ. Các dòng chưa được một fixture/browser path kích hoạt chỉ được bảo vệ bởi audit nguồn, regression và các test sẵn có; không tuyên bố mọi trạng thái có thể có đã được mở qua UI.

Dừng ở nhánh review: chưa merge, chưa promote production, không deploy thủ công. Không kết luận production-ready.
