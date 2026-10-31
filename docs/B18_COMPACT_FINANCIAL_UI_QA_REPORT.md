# B18 Mobile — Compact Financial UI: QA

Ngày kiểm tra: 20/10/2026. Nhánh review: `codex/b18-compact-financial-ui`.
Base đã xác nhận: `codex/b18-financial-decision-clarity`, `bd5925a9276eefb814cf04b78b67deb67fa36c95`.
Commit triển khai: `717b0b404a30a76b73edf850e4ba1df20366bf07` (commit tài liệu sau đó chỉ bổ sung báo cáo/bằng chứng).

Đã rút gọn lựa chọn thanh toán, tiết kiệm, thẻ trái phiếu và thông tin vàng theo nguyên tắc số liệu trước, giải thích khi cần. Chỉ thay presentation/copy. Chờ Owner review; không merge, không triển khai hoặc thay domain.

## Thay đổi và đối chiếu luật

| Hạng mục | Kết quả |
| --- | --- |
| Đơn vị thời gian | Màn chính dùng kỳ hạn 1/2/3 kỳ, lãi mỗi kỳ và trả cuối vòng. Glossary/Tutorial giải thích kỳ tài chính kết thúc khi hoàn thành vòng, qua ô Xuất phát. Kỳ đầu của khoản mua giữa vòng kết thúc tại lần quyết toán sắp tới. |
| Mốc chính xác | Savings dùng `depositPreview.maturityLap`; trái phiếu dùng `game.lap + config.term - 1`. Lịch nhận nằm trong chi tiết, vẫn ghi chỉ số lần qua ô Xuất phát tuyệt đối. Ví dụ mua 2 kỳ ở vòng 3 đến hạn ở lần thứ 4, không phải lần thứ 5. Cảnh báo sau khi hết ván vẫn hiện trên màn chính. |
| Thanh toán | Số tiền nằm ngay trong nhãn. Chỉ có trả một phần mới hiện riêng khoản ngay/cuối vòng. Bỏ dòng trả 0 và tổng tiền lặp. Chênh lệch lấy từ `cost + obligation` so với phương án trả ngay; không tạo phí/giao dịch mới. Áp dụng family/medical/repair/bills/contract; khoản nhận tiền giữ nguyên dấu cộng. |
| Ngân hàng | Giữ gốc/lãi/tổng nhận từ preview của profile đang chạy. Giải thích lãi đơn vào “Cách nhận lãi”; ngày đáo hạn vào “Lịch nhận tiền”. Input không hợp lệ không hiện dự kiến nhận. |
| Trái phiếu | Header tên + hạng; hai chỉ số lãi/kỳ và thời hạn; một câu rủi ro. Giá/mệnh giá/lịch và tín dụng trong chi tiết. Lãi dự kiến ghi rõ điều kiện trả đúng hạn; phí bán lấy từ config, luôn thấy trước khi mua. Báo giá bán thực nhận giữ nguyên. |
| Vàng | Ba hàng giá hiện tại / spread / phí bán từ config, một câu rủi ro. Giữ tín hiệu thị trường và lịch sử giá trong accordion. Chi tiết nói rõ phí tính sau chênh lệch, không cộng thành 4%. |
| Bố cục | CSS cục bộ cho financial sheets và thẻ issuer; không thêm scroll container. Thanh cuộn desktop dạng thin, không ẩn. CTA giữ ≥44px; focus còn rõ. Sửa khoảng trắng không ngắt giữa số tiền và ₫ sau khi phát hiện currency bị rơi dòng ở 320px. |

Audit đọc `engine.ts`, `settlement.ts`, `savings.ts`, `bond-credit.ts` và `selectors.ts`: settlement vẫn chạy tại crossing, nghĩa vụ vẫn thu sau sinh hoạt/nợ; coupon và gốc có thể chậm trả/vỡ nợ. Không sửa các file này. Không thay giá, phí, RNG, action IDs, schema, save hoặc replay.

## Kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Product | 355/355 đạt, gồm regression currency wrapping và copy data-derived |
| SSR/UI, 13 file | 62/62 đạt (13 suite, gồm hai ca SSR mới về thẻ trái phiếu/vàng) |
| Browser chính | 170 kiểm tra; 50 thao tác UI có snapshot engine/resume khớp |
| Kiểm lại payment wrapping | 45 kiểm tra, 30 thao tác bằng phím Enter có snapshot/resume khớp |
| Responsive | 320×740, 390×844, 430×932, 768×1024, 1440×900; không tràn ngang/modal, không nested scroll ở các trạng thái đã đo |
| Lịch sử | 81 replay khớp; 1.846 artifact và 9 manifest cũ giữ đúng hash |
| Research parity | 13 ván / 2.306 snapshot khớp; không chạy nghiên cứu cân bằng mới |
| Lint/typecheck/build | Full lint đạt; lint bổ sung cho 2 file cuối đạt; typecheck Mobile và shared đạt; Mobile production build đạt |
| JavaScript | Không `pageerror`, không console error ngoài favicon 404 đã có trên localhost |

Browser: Chromium 149.0.7827.55, local Mobile Web; modal rộng khoảng 460px ở viewport 1440 cũng được kiểm tra riêng. Có 30 ảnh trước, 75 ảnh sau lượt chính và 15 ảnh payment cuối cùng. Các trạng thái mở/đóng accordion, kỳ hạn 1/2/3, đổi số tiền, input lỗi, chọn issuer, cảnh báo đáo hạn sau ván, mua/bán và CTA được đo trực tiếp. Mở chi tiết không thay save. Product/SSR tiếp tục bao phủ profile lịch sử; bills/contract là fixture render legacy vì B18 không có hai ô đó.

Lượt SSR đầu có assertion đòi nguyên văn câu cũ (vàng dạng đoạn văn/dấu cộng, phí trái phiếu dạng cũ, giải thích kỳ trên Setup). Đã cập nhật assertion theo yêu cầu Owner, giữ kiểm tra số tiền/phí, không mutation và điều kiện giao dịch. Hai log lượt chưa đạt được giữ trong thư mục bằng chứng; kết quả cuối ở `ssr-tests.txt`.

### Tám ca tiếp diễn đến quyết toán

Các ca này chạy engine từ checkpoint hợp lệ đã nhập qua UI, không gán state để tạo kết quả; mỗi log mới đều replay lại khớp. Đây là kiểm tra kỹ thuật, không phải thống kê hiệu quả đầu tư.

| Ca | Tiền/lịch thực tế |
| --- | --- |
| Gia đình hẹn trả | Không trừ ngay; thu 3.500.000 ₫ cuối vòng hiện tại |
| Sửa tạm | Trừ 1.000.000 ₫ ngay; thu 4.000.000 ₫ cuối vòng, không tạo khoản phí 1M riêng |
| Gửi 10M, 1/2/3 kỳ | Nhận 10,4M / 11M / 11,8M đúng kỳ 1/2/3; chưa đến hạn vẫn active |
| An Tâm, vốn 8M | 360.000 ₫ lãi ở kỳ 1; 360.000 ₫ + 8M gốc ở kỳ 2 |
| Bứt Phá, vốn 8M | Ca seed này nhận 800.000 ₫ kỳ 1; vỡ nợ kỳ 2, không nhận coupon/gốc đúng hạn. Không suy ra tỷ lệ vỡ nợ từ một ca. |
| Bán vàng | Giá trị 1.974.376 ₫; spread 59.231 ₫; phí 19.151 ₫; tiền mặt tăng đúng 1.895.994 ₫ |

Chi tiết: [settlement/results.json](playtests/b18-compact-financial-ui/settlement/results.json), [compatibility.json](playtests/b18-compact-financial-ui/compatibility.json), [parity.txt](playtests/b18-compact-financial-ui/parity.txt).

## Ảnh trước / sau

Ảnh thanh toán ở `after-payment-wrap` là phiên bản cuối, sau khi giữ ₫ cùng số tiền. Lượt `after` giữ bằng chứng phát hiện lỗi ngắt dòng; các màn ngân hàng/trái phiếu/vàng không thay sau lượt đó.

| Màn | Trước | Sau |
| --- | --- | --- |
| Sửa xe 320 | [Ảnh](playtests/b18-compact-financial-ui/before/320-repair.png) | [Ảnh cuối](playtests/b18-compact-financial-ui/after-payment-wrap/320-repair.png) |
| Gia đình 390 | [Ảnh](playtests/b18-compact-financial-ui/before/390-family.png) | [Ảnh cuối](playtests/b18-compact-financial-ui/after-payment-wrap/390-family.png) |
| Ngân hàng 320 | [Ảnh](playtests/b18-compact-financial-ui/before/320-bank.png) | [Ảnh](playtests/b18-compact-financial-ui/after/320-bank.png) |
| Ngân hàng 390 | [Ảnh](playtests/b18-compact-financial-ui/before/390-bank.png) | [Ảnh](playtests/b18-compact-financial-ui/after/390-bank.png) |
| Trái phiếu 320 | [Ảnh](playtests/b18-compact-financial-ui/before/320-bonds.png) | [Ảnh](playtests/b18-compact-financial-ui/after/320-bonds.png) |
| Trái phiếu 390 | [Ảnh](playtests/b18-compact-financial-ui/before/390-bonds.png) | [Ảnh](playtests/b18-compact-financial-ui/after/390-bonds.png) |
| Vàng 320 | [Ảnh](playtests/b18-compact-financial-ui/before/320-gold.png) | [Ảnh](playtests/b18-compact-financial-ui/after/320-gold.png) |
| Vàng 390 | [Ảnh](playtests/b18-compact-financial-ui/before/390-gold.png) | [Ảnh](playtests/b18-compact-financial-ui/after/390-gold.png) |
| Modal hẹp ở 1440 | [Ảnh](playtests/b18-compact-financial-ui/before/1440-bonds.png) | [Ảnh](playtests/b18-compact-financial-ui/after/1440-bonds.png) |

Ảnh CTA và chi tiết cũng có trong [manifest](playtests/b18-compact-financial-ui/manifest.json), kèm raw hash/byte count của toàn bộ evidence.

## File và tái lập

13 file sản phẩm:

- `src/components/financial-decision-copy.ts`, `GameDialogs.tsx`; `mobile_app/src/components/EventModal.tsx`: copy thanh toán và bỏ fallback gây lặp.
- `src/components/SavingsTerms.tsx`, `SavingsPreview.tsx`: nội dung mở rộng và lịch nhận chính xác.
- `src/components/BondCreditPanel.tsx`, `BondCredit.css`: thứ bậc nội dung issuer, chỉ số, báo giá/chi tiết.
- `src/components/TradingPanel.tsx`, `MarketDetails.tsx`; `mobile_app/src/components/MarketNews.tsx`: facts vàng, đơn vị kỳ và cách diễn đạt phí.
- `src/components/glossary.ts`; `mobile_app/src/components/Tutorial.tsx`: định nghĩa kỳ một lần trong từng nội dung trợ giúp.
- `mobile_app/src/engine-ui.css`: spacing, số liệu, focus/scroll giữ theo theme cũ.

6 file kiểm thử: `tests/financial-decision-copy.test.ts`; các SSR `atomic-investments-ui`, `bond-credit-ui`, `economic-news-ui`, `financial-decision-ui`, `language-cleanup-ui`. 5 script mới: `compact-financial-checkpoints.ts`, `compact-financial-browser.mjs`, `compact-financial-compat.ts`, `compact-financial-settlement.mjs`, `verify-b18-compact-financial-evidence.mjs`.

```powershell
node --experimental-strip-types --test tests/*.test.ts
$env:UI_AUDIT_OUTPUT='docs/playtests/b18-compact-financial-ui/rendered-language-audit.json'
node --experimental-strip-types --test --test-concurrency=1 scripts/diagnostics/atomic-investments-ui.test.ts scripts/diagnostics/b18-ux-ui.test.ts scripts/diagnostics/bond-credit-ui.test.ts scripts/diagnostics/bond-start-ui.test.ts scripts/diagnostics/business-preference-ui.test.ts scripts/diagnostics/core-mvp-b18-ui.test.ts scripts/diagnostics/economic-event-ui.test.ts scripts/diagnostics/economic-news-ui.test.ts scripts/diagnostics/financial-decision-ui.test.ts scripts/diagnostics/language-cleanup-ui.test.ts scripts/diagnostics/mobile-final-ui.test.ts scripts/diagnostics/multi-course-ui.test.ts scripts/diagnostics/terminology-ui.test.ts
node node_modules/eslint/bin/eslint.js .
node node_modules/typescript/bin/tsc -p mobile_app/tsconfig.json
node node_modules/typescript/bin/tsc -b
node mobile_app/node_modules/vite/bin/vite.js build mobile_app
node --experimental-strip-types scripts/diagnostics/compact-financial-checkpoints.ts
# Local Vite: chạy từ mobile_app, port 5216
node ../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5216
# Từ repository root, ở terminal khác:
node --experimental-strip-types scripts/diagnostics/compact-financial-browser.mjs --after
node --experimental-strip-types scripts/diagnostics/compact-financial-browser.mjs --after --payments-only
node --experimental-strip-types scripts/diagnostics/compact-financial-settlement.mjs
node --experimental-strip-types scripts/diagnostics/compact-financial-compat.ts
node --experimental-strip-types scripts/verify-multi-course-parity.ts
node scripts/verify-b18-compact-financial-evidence.mjs --check
```

Chỉ tạo lại `before` khi checkout đúng base; không chạy `--before` trên code đã sửa rồi gọi đó là ảnh trước. Browser dùng runtime Playwright/Chromium đã cài trên máy; có thể chỉ định `PLAYWRIGHT_MODULE`, `BROWSER_PATH`, `DECISION_COPY_URL`. Nguồn checkpoint sao chép và replay prefix nằm trong hai file provenance của thư mục `checkpoints`. Script mới chỉ ghi evidence của task này; verifier parity chạy không có `--write`.

## Giới hạn

Chưa kiểm chứng Safari/iOS, Android vật lý hoặc screen reader chuyên dụng. Chưa có Human Playtest, không kết luận người mới đã hiểu nhanh hơn chỉ từ QA này. Mobile ở desktop viewport không thay cho Full Desktop App QA. Favicon localhost 404 giữ ngoài scope. Nhánh hiện tại chỉ để Owner review; không phải phê duyệt phát hành/production-ready.
