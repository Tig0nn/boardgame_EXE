# B18 — Câu chữ quyết định tài chính

Ngày 20/10/2026 · Chờ Owner review.

Nhánh `codex/b18-financial-decision-clarity`, tạo từ **`codex/b18-course-layout-polish` / `1f60d792fb88d1e22dc4c9a3f928daa2efc2dd6b`**. Trước sửa đã xác nhận HEAD, nhánh remote và lịch sử có `12ad3d0`, `0c60f1c`, `f96a8f6`; không bắt đầu từ main hoặc candidate Production cũ. Commit source: **`005c2b377da5c737bb5db2ce24a7980b5add1746`**. Không tạo PR.

## Before / After

| Màn hình | Trước | Sau / kiểm chứng |
|---|---|---|
| Gia đình | “Thanh toán cuối vòng”; “Nghĩa vụ tại ô Xuất phát +3.500.000 ₫” | **Trả ngay / Trả sau**. Nêu rõ bây giờ trả 0, khi qua ô Xuất phát phải trả 3,5M; tổng trả nhiều hơn trả ngay 500.000 ₫. Số tiền và chênh lệch lấy từ `Option.cost` / `Option.obligation`, không hardcode giá ví dụ. |
| Sửa xe | “Trả 1M ngay + 4M tại Xuất phát” | Tách tiền trả bây giờ và tiền phải trả khi qua Xuất phát; tổng 5M, nhiều hơn trả ngay 1M. Không gọi chênh lệch là lãi vay hoặc tiền phạt. |
| Y tế, hóa đơn, hợp đồng | Nhãn “nghĩa vụ” và dấu cộng dễ nhầm | Dùng cùng helper trình bày, so sánh với lựa chọn thanh toán ngay của từng sự kiện. Ba biến cố B18 được kiểm tra UI; hóa đơn/hợp đồng C20 được kiểm tra SSR trên cả hai wrapper. |
| Ngân hàng | Một đoạn “lãi đơn”, “cuối kỳ hạn”, “rút sớm” gộp chung; chỉ có số lãi và mốc đáo hạn | Ba câu theo yêu cầu: mỗi lần qua Xuất phát là 1 kỳ; hết hạn nhận tiền đã gửi và toàn bộ lãi; lãi chỉ tính trên số gửi ban đầu. Cảnh báo rút trước hạn thành đoạn riêng. Bảng **tiền gửi ban đầu / tổng lãi / tổng nhận / mốc đến hạn** cập nhật theo amount/term. |
| Cổ phiếu | “Giá / đơn vị” | **“Giá hiện tại”** ở màn chọn mã. Phần mở rộng nói đây là giá một cổ phiếu, không phải tổng danh mục. Không đổi nhãn đơn vị ở vàng/trái phiếu. |

Ví dụ ngân hàng đã xác nhận bằng UI và SSR: **10M, 2 kỳ, 5% mỗi kỳ → lãi 1M, tổng nhận 11M**. Bảng dùng `depositPreview` và profile của ván; chỉ cộng tiền gửi với lãi được selector trả về, không tạo công thức lãi khác. Ngay khi nhập 0, vượt tiền mặt, không phải số nguyên hoặc NaN, bảng dự kiến không render; cảnh báo input và disabled của CTA dùng selector hiện có.

Hẹn trả không phải tiền được nhận. Các dấu cộng biểu thị thu nhập thật, như thưởng hợp đồng, vẫn giữ nguyên. Dữ liệu event, nhãn/detail trong log/JSON lịch sử không bị sửa; chỉ render câu giải thích mới tại quyết định. Không thay `onChoose(option.id)`, `course-*`, transaction action, quyền rút, lịch quyết toán hay cơ chế funding.

## File thay đổi

**8 file sản phẩm, tất cả thuộc presentation:**

- `src/components/financial-decision-copy.ts`: helper thuần, đọc các lựa chọn để tính tổng/chênh lệch và tạo câu chữ; không mutation.
- `mobile_app/src/components/EventModal.tsx`, `src/components/GameDialogs.tsx`: dùng helper cho nhãn và nội dung lựa chọn, giữ nguyên callback/disabled. Wrapper dùng chung giữ cách diễn đạt nhất quán với ván cũ.
- `src/components/SavingsTerms.tsx`: phần giải thích ngắn và cảnh báo riêng, dùng chung tại ngân hàng; Setup Mobile nhập component này cũng nhận câu chữ rõ hơn.
- `src/components/SavingsPreview.tsx`, `src/components/savings-preview.css`: bảng dự kiến hợp lệ; căn label/số tiền bằng grid cục bộ, không sửa modal toàn cục.
- `src/components/TradingPanel.tsx`: đặt bảng dưới input, bỏ dòng dự kiến cũ và lời giải thích rút sớm lặp lại trong chi tiết khoản gửi; rút gọn nhãn giá riêng cho cổ phiếu.
- `src/components/MarketDetails.tsx`: một câu giải thích giá một cổ phiếu trong phần mở rộng.

Tests: `tests/financial-decision-copy.test.ts`, `scripts/diagnostics/financial-decision-ui.test.ts`, cập nhật assertion câu chữ trong `language-cleanup-ui.test.ts`. Các helper/đoạn hướng dẫn cũ ở Ví, log và luật nâng cao không bị thay hàng loạt ngoài phạm vi ba màn hình.

Không đổi `src/game`, `src/data`, RNG, luật, pricing, schema, replay, package/dependency, nhánh Production, project Vercel hoặc domain.

## Kết quả kiểm thử

| Kiểm tra | Kết quả / bằng chứng |
|---|---|
| Product | **354/354 PASS** = baseline 351 + 3 test helper. Có test đổi số tiền trong event fixture để phát hiện hardcode. [Log](playtests/b18-financial-decision-copy/product-tests.txt) |
| SSR | **60/60 PASS**, 13 test cấp cao. Thêm 10 test (gồm subtest) cho cả hai wrapper, 5 sự kiện, bonus, 3 kỳ hạn, 2 số tiền, B18/legacy profile, invalid input, đáo hạn sau ván và nhãn cổ phiếu. [Log](playtests/b18-financial-decision-copy/ssr-tests.txt) |
| Lint / TypeScript / build | ESLint PASS; TS Mobile/shared PASS; Mobile production build cục bộ PASS. Không deploy. |
| UI thật | **116 check, 0 JavaScript page error / tràn ngang / cuộn lồng** tại **320×740, 390×844, 430×932, 1440×900**. [JSON](playtests/b18-financial-decision-copy/after/results.json) |
| Tiền trả ngay/sau | **24 lựa chọn** (gia đình, y tế, sửa xe × 2 lựa chọn × 4 viewport) khớp snapshot từ `decide` không đổi; có cả thiếu tiền mở funding. |
| Tiết kiệm | **24 kiểm tra dự kiến** (3 kỳ × 2 số tiền × 4 viewport); **12 kiểm tra input lỗi** (0, vượt tiền mặt, chữ). **4 giao dịch gửi thật** khớp snapshot từ `transact`. |
| Cổ phiếu | **24 kiểm tra giá** (6 mã × 4 viewport), dùng checkpoint có giá khác nhau thật để phát hiện giá bị giữ từ mã trước. Biến động gần nhất, tiền tệ, phí và cảnh báo giữ nguyên. |
| Save/resume | **28 hành động** trả tiền/gửi tiền so snapshot và reload/resume khớp. Đổi amount/term hoặc xem mã không đổi byte save; trạng thái xem cổ phiếu cũng reload/resume được. |
| Replay / bằng chứng cũ | **81/81 replay PASS**; **1.727 artifact** theo 8 manifest khớp raw SHA256, không ghi đè golden/evidence. [JSON](playtests/b18-financial-decision-copy/compatibility.json) |

Một assertion cũ phân biệt hoa/thường với “mỗi lần…” không khớp câu mới bắt đầu bằng “Mỗi…”; đã sửa assertion theo câu mới và chạy lại toàn bộ SSR đạt 60/60. Lãi suất và phép tính không thay đổi. Test RED ban đầu của helper được giữ trong evidence như bước tái hiện trước triển khai, không phải kết quả QA cuối.

Checkpoint là prefix replay đúng từ nhật ký đã khóa, nhập bằng UI sản phẩm; [provenance](playtests/b18-financial-decision-copy/checkpoints/provenance.json) ghi nguồn, seed, vòng, lượt. Không inject field vào save để tạo ảnh, không chạy lại nghiên cứu cân bằng. SSR legacy là fixture render được ghi rõ trong source, không tính là ván UI tự nhiên.

## Screenshot

**20 ảnh trước + 28 ảnh sau**. Các ảnh ngân hàng chính dưới đây dùng cùng lựa chọn **10M / 2 kỳ** trước và sau.

| Màn / viewport | Trước | Sau |
|---|---|---|
| Gia đình 320px | [Ảnh](playtests/b18-financial-decision-copy/before/320-family.png) | [Ảnh](playtests/b18-financial-decision-copy/after/320-family.png) |
| Gia đình 390px | [Ảnh](playtests/b18-financial-decision-copy/before/390-family.png) | [Ảnh](playtests/b18-financial-decision-copy/after/390-family.png) |
| Ngân hàng 320px | [Ảnh](playtests/b18-financial-decision-copy/before/320-bank.png) | [Ảnh](playtests/b18-financial-decision-copy/after/320-bank.png) |
| Ngân hàng 390px | [Ảnh](playtests/b18-financial-decision-copy/before/390-bank.png) | [Ảnh](playtests/b18-financial-decision-copy/after/390-bank.png) |
| Cổ phiếu 320px | [Ảnh](playtests/b18-financial-decision-copy/before/320-stocks.png) | [Ảnh](playtests/b18-financial-decision-copy/after/320-stocks.png) |
| Cổ phiếu 390px | [Ảnh](playtests/b18-financial-decision-copy/before/390-stocks.png) | [Ảnh](playtests/b18-financial-decision-copy/after/390-stocks.png) |

Có cùng bộ tại 430/1440px; thêm [sửa xe](playtests/b18-financial-decision-copy/after/320-repair.png), [y tế](playtests/b18-financial-decision-copy/after/320-medical.png), [bảng 2M / 3 kỳ](playtests/b18-financial-decision-copy/after/320-bank-summary.png), [số tiền lỗi không có dự kiến](playtests/b18-financial-decision-copy/after/320-bank-invalid.png). Modal ngân hàng cuộn tự nhiên; CTA được click thực tế sau khi xem bảng, không bị che bởi nội dung.

## Tái lập và giới hạn

```powershell
node --experimental-strip-types --test tests/*.test.ts
$env:UI_AUDIT_OUTPUT='docs/playtests/b18-financial-decision-copy/rendered-language-audit.json'
node --experimental-strip-types --test --test-concurrency=1 scripts/diagnostics/*ui.test.ts
node node_modules/eslint/bin/eslint.js .
node node_modules/typescript/bin/tsc -p mobile_app/tsconfig.json
node node_modules/typescript/bin/tsc -b
node mobile_app/node_modules/vite/bin/vite.js build mobile_app
node --experimental-strip-types scripts/diagnostics/decision-copy-checkpoints.ts
node --experimental-strip-types scripts/diagnostics/decision-copy-compat.ts
# Chạy Mobile Vite tại 127.0.0.1:5214 rồi:
node --experimental-strip-types scripts/diagnostics/decision-copy-browser.mjs --after
node scripts/verify-b18-financial-decision-evidence.mjs --check
```

Không chạy chế độ mặc định `before` trên source mới để ghi đè baseline; tái lập vào output riêng. Script browser dùng Playwright/binary đã có, có biến `PLAYWRIGHT_MODULE`, `BROWSER_PATH`, `DECISION_COPY_URL`; không thêm dependency. Manifest bảo toàn byte evidence; hash source cũ chỉ mô tả candidate cũ, không dùng để ép source UI mới trùng lại.

Giới hạn: Chromium **149.0.7827.55** giả lập viewport/touch, **chưa kiểm chứng Safari/iOS hoặc Android vật lý, screen reader, bàn phím ảo và zoom native**. Console giữ 404 favicon cục bộ đã có ở baseline; không có page error JavaScript. Không chạy lại full release QA, research parity hoặc Human Playtest; không coi nội dung rõ hơn là bằng chứng người chơi đã học được tài chính.

Chờ Owner review. Không merge, deploy/promote Production, thay Vercel domain hoặc sửa dữ liệu người chơi.
