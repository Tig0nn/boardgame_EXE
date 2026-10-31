> **CURRENT** — START UX presentation candidate ngày 15/10/2026, từ Bond V2.5 `46bf390`. Không thay luật hoặc thông số balance; [MVP chuẩn](CURRENT_MVP.md).

# START ngắn gọn, phân biệt tiền đã nhận và khoản còn chờ

Nhánh review: [codex/bond-v25-start-ux](https://github.com/Tig0nn/boardgame_EXE/tree/codex/bond-v25-start-ux). Nguồn Bond V2.5 được giữ tại `46bf3903d0eeac7afc9111e29f758b170c103449`.

## Quyết định UX

- Đầu màn hình là **Tiền đã nhận / Tiền đã chi**, các nguồn lương, tăng lương khóa học, kinh doanh, tiết kiệm đáo hạn, trái phiếu và huy động khi có. Tiền huy động có thể gồm vay, được ghi riêng để không gọi nhầm là lợi nhuận. Tiền mặt hiện có tách khỏi tài sản ròng.
- Mỗi tổ chức phát hành liên quan có một thẻ: coupon/gốc thực nhận, trạng thái trả nợ, tổng khoản còn chờ và mất được xác nhận. Không hiện tổ chức không có holdings hay hoạt động START này. Không hiện lot ID ở mặc định.
- **Chi tiết các khoản trái phiếu** giữ số đến hạn, thực nhận, còn chờ, mất lũy kế/mới phát sinh và trạng thái từng lô. **Chi tiết giao dịch** giữ nguyên toàn bộ summary lines/funding notes của engine, kể cả ghi chú không có dòng tiền.
- Tiền nhận thực sự màu xanh; chi thực sự và mất xác nhận màu đỏ; 0 ₫ trung tính; khoản còn chờ màu vàng kèm giải thích chưa cộng tiền mặt. Mất xác nhận được ghi là không phải tiền chi thêm. Khoản thu hồi chưa nhận không được tính là tiền dùng được.
- **Thị trường vòng này** chỉ hiện biến động ba nhóm tài sản. **Xem dự báo vs. thực tế** mở lại nguyên phần so sánh cũ, gồm issuer credit và bài học. Tỷ lệ giá vẫn không gồm coupon/phí.
- Footer nằm ngoài vùng nội dung cuộn, có safe-area và nút **Ghé ví tại START →**. Không che nội dung, không bỏ qua ví; giữ START Summary → Wallet → Forecast/Next Round hoặc kết quả ở vòng 4.

## Tính đúng và phạm vi được bảo toàn

[Selector START](../mobile_app/src/game/start-summary.ts) chỉ đọc history Bond và snapshot endpoint quyết toán của đúng lap. Tiền nhận/mất mới dùng record của lap yêu cầu; khoản còn chờ/lỗ lũy kế dùng snapshot kết thúc START, nên bán/thu hồi ở lap sau không viết lại tổng kết cũ. Tổng issuer cộng các số nguyên đã làm tròn của từng lot, không làm tròn lại theo danh mục. Không đọc số tiền từ label tự do.

Overview đọc năm financial schedule theo thứ tự đã có và các funding records xen giữa. Tổng thu trừ tổng chi phải khớp chênh lệch cash; không dùng chênh lệch net worth. Funding proceeds và phần thực trả được tách riêng; lãi cộng vào nợ cuối game không giả thành cash payment. Thiếu endpoint/schedule đáng tin thì báo chưa đủ dữ liệu. Phiên V2.4 không có credit metadata dùng tổng nhận Bond từ bước đáo hạn sau khi tách deposit đã thực nhận, vẫn giữ raw records cũ.

**Engine, số tiền transaction, thứ tự START, RNG và exported log không đổi.** Không sửa root source, financial handlers, Bond catalog, Business/Bank/Stocks/Gold, session throttle, AI Coach, news selectors, assets/artwork/audio, dependency fixes/lockfiles, Vercel hoặc CI. [Scope check](playtests/bond-start-ux/scope-check.txt) và [danh sách file đầy đủ](playtests/bond-start-ux/changed-files.txt).

Economic News vẫn dùng selector cũ; equality trước/sau render và verifier bản tin đều PASS. AI facts/schema và các bài kiểm thử mock vẫn PASS; không tuyên bố đã gọi provider thật. V2.5 giữ nguyên toàn bộ [tham số thử nghiệm và giới hạn balance](BOND_V2_5_BALANCE_REPORT.md), cần owner duyệt trước khi nhập luật chính thức.

## Verification local

| Check | Kết quả và bằng chứng |
| --- | --- |
| Product tests | **265/265 PASS** — [log](playtests/bond-start-ux/tests.txt) |
| Diagnostics | **50/50 PASS** — [log](playtests/bond-start-ux/diagnostics.txt) |
| Lint | PASS — [log](playtests/bond-start-ux/lint.txt); script verifier mới cũng lint PASS |
| Web / Mobile build | PASS — [Web](playtests/bond-start-ux/web-build.txt), [Mobile](playtests/bond-start-ux/mobile-build.txt) |
| Docs checker mặc định | PASS — [log](playtests/bond-start-ux/documentation-check.txt); không chạy lại full documentation audit |
| Verifier Bond hiện có | PASS: đọc 12.000 rows đã lưu, 12 V2.5 full-state cases, 13 historical replays — [log](playtests/bond-start-ux/bond-replay.txt) |
| Verifier Atomic / News | PASS, chạy trên bản sao tạm để không ghi vào evidence cũ — [Atomic](playtests/bond-start-ux/atomic-replay.txt), [News](playtests/bond-start-ux/news-replay.txt) |
| Verifier V2.1 / V2.2 | PASS, output ở bản sao tạm — [V2.1](playtests/bond-start-ux/v21-replay.txt), [V2.2](playtests/bond-start-ux/v22-replay.txt) |
| START reconciliation | **4 archived full-state games / 16 START**, purity, AI facts và news equality; UI cash/claim/loss đối chiếu endpoint — [log](playtests/bond-start-ux/verification.txt), [JSON/SHA256/dimensions](playtests/bond-start-ux/verification.json) |
| Browser | 30 START layouts tại 320×640 / 390×844 / 430×932: không tràn ngang, không cắt số tiền, CTA trong viewport — [DOM evidence](playtests/bond-start-ux/browser-verification.json) |
| Interaction | Enter mở details, Tab vẫn trong dialog, Escape không bỏ START; double-tap vẫn ở ví, chuyển đúng vòng 3 tại ba widths; vòng 4 qua ví rồi ra kết quả 72.250.000 ₫ — [evidence](playtests/bond-start-ux/browser-interactions.json) |
| Console cuối | Fresh final page: 0 errors/warnings — [log và lỗi loader dev đã sửa](playtests/bond-start-ux/browser-console.json) |

[11 presentation tests](../tests/bond-start-summary.test.ts) và [6 React diagnostic checks](../scripts/diagnostics/bond-start-ui.test.ts) bao phủ không holdings, một/nhiều lô A, cả A/B, coupon đúng hạn/chậm, gốc chậm, cure, default từng phần, claim chờ thu hồi, thu hồi thực nhận, bán một phần/toàn bộ, zero neutral, tổng không trùng, details reconcile, snapshot lịch sử và legacy V2.4. Còn kiểm funded payments/deposit maturity/terminal noncash interest. Có [RED checkpoint trước selector](playtests/bond-start-ux/selector-red.txt).

Không tái chạy nghiên cứu 12.000 hoặc 180.000 ván. Verifier Bond cũ kiểm raw rows/aggregate đã lưu và sáu seed-0 spot checks; không sinh lại balance datasets. Các historical logs và simulation evidence giữ nguyên bytes trong Git diff.

## Screenshots trước / sau

**52 JPEG**: 15 ảnh before là bản sao nguyên bytes từ evidence V2.5 (có [manifest nguồn/commit/SHA256](playtests/bond-start-ux/before-screenshots.json)); 37 ảnh after chụp mới bằng browser. Kích thước từng file được verifier đọc từ JPEG, không resize/chỉnh ảnh.

| Chậm trả cùng checkpoint | Trước | Sau |
| --- | --- | --- |
| 320 × 640 | [ảnh](playtests/bond-start-ux/320-before-delayed.jpg) | [ảnh](playtests/bond-start-ux/320-delayed.jpg) |
| 390 × 844 | [ảnh](playtests/bond-start-ux/390-before-delayed.jpg) | [ảnh](playtests/bond-start-ux/390-delayed.jpg) |
| 430 × 932 | [ảnh](playtests/bond-start-ux/430-before-delayed.jpg) | [ảnh](playtests/bond-start-ux/430-delayed.jpg) |

Các cặp normal/cure/default/recovery tại cả ba widths và ảnh empty/both/details/wallet/next-round/credit-defeat có trong [dimensions manifest](playtests/bond-start-ux/verification.json). Ví dụ [default](playtests/bond-start-ux/390-default.jpg), [recovery](playtests/bond-start-ux/390-recovery.jpg), [lot details](playtests/bond-start-ux/390-default-details.jpg), [raw records](playtests/bond-start-ux/390-raw-records.jpg), [forecast details](playtests/bond-start-ux/390-forecast-details.jpg).

Browser after dùng [dev-only checkpoint harness](../mobile_app/src/start-summary-harness.tsx) đọc snapshot/summary/log prefix từ bốn ván browser đã lưu và hai fixtures empty/both. Đây là kiểm tra lại UI từ checkpoint, **không phải tám ván browser mới hoàn chỉnh**. Pending landing được phục dựng từ vị trí START đã qua; các transaction/settlement amounts lấy nguyên snapshot. Harness bị chặn ngoài DEV và không nằm trong production entry/bundle.

## Chạy và bàn giao

Từ root: `npm ci`, `npm ci --prefix mobile_app`, `npm run dev --prefix mobile_app`; mở `http://localhost:5174/`. Checkpoint development: `/start-summary-harness.html?case=delayed`; các case normal/cure/default/recovery/defeat/empty/both cũng có sẵn. Preview đang kiểm tra chỉ localhost, không phải Vercel.

Chạy verifier riêng: `node --experimental-strip-types scripts/verify-bond-start-ux.ts`. Nó đọc evidence đã lưu và chỉ ghi kết quả mới trong folder UX. Không cần AI keys hoặc rerun balance.

Commits đã tách: `7bf653a` selector/tests, `01b2115` UI/CSS/harness/React diagnostics; commit report/evidence sau cùng có SHA trong handoff chat để tránh tự tham chiếu. Không merge, force-push hoặc deploy.

Giới hạn: chưa kiểm tra điện thoại/keyboard ảo vật lý, screen reader thật, live AI provider hoặc GitHub Actions/Vercel mới. Không cài lại dependencies vì không thay manifest/lockfile và base đã clean-install; hai build/tests vẫn dùng dependencies hiện có. Issue icon C20 cũ không nằm trong phạm vi. CI lịch sử V2.4 **186 product tests + 21 diagnostics** ở [audit chronology](DOCUMENTATION_AUDIT.md), không phải kết quả HEAD này.

**READY FOR REVIEW — presentation-only.** Không còn lỗi UX đã xác nhận chặn bàn giao này; việc duyệt/merge Bond V2.5 và tham số thử nghiệm vẫn thuộc owner.
