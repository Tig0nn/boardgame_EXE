> **CURRENT** — Economic Event UX V1 candidate 15/10/2026, từ START UX `1b210f6`. Chỉ thay presentation/input guard, không đổi economics; [MVP chuẩn](CURRENT_MVP.md).

# Biến cố kinh tế: chuyện gì xảy ra, giá đổi thế nào, vì sao đáng chú ý

Nhánh: [codex/economic-event-ux-v1](https://github.com/Tig0nn/boardgame_EXE/tree/codex/economic-event-ux-v1), base `1b210f60e48cc69d20750efbfdc4eba4c5545139` giữ nguyên.

## UX và nguồn dữ liệu

[Popup riêng](../mobile_app/src/components/EconomicEventModal.tsx) dùng navy/yellow, icons hiện có, context ngắn, đúng ba nhóm **Cổ phiếu / Trái phiếu / Vàng**, một “Góc nhìn tài chính”, chi tiết thu gọn và footer **Đã hiểu · Tiếp tục**. Không thêm mua/bán hoặc lựa chọn tài chính. Các popup khác vẫn dùng component cũ.

- **Tín dụng thắt chặt:** bên cho vay thận trọng hơn, thị trường điều chỉnh trước lo ngại vốn/trả nợ. Bài học: tài sản có thể phản ứng trái chiều, cần dự phòng và xem rủi ro tín dụng.
- **Nhu cầu khởi sắc:** người mua chi tiêu nhiều hơn, cơ hội và phản ứng khác nhau giữa các nhóm. Bài học: tin tốt không bảo đảm tất cả tài sản tăng.
- **Chuỗi cung ứng phục hồi:** nguyên liệu/hàng hóa lưu thông thuận lợi hơn, triển vọng các ngành khác nhau. Bài học: nhìn từng ngành và phí/thời điểm cần bán.

Đây là bối cảnh trong game, không phải nhận định về diễn biến kinh tế thực. Dòng giải thích này nằm trong details, không chiếm màn chơi chính.

[Selector chỉ đọc](../mobile_app/src/game/economic-event.ts) nhận event hiện hành ở ô macro, khớp market record bằng ID, turn, lap, vị trí và transition appliedShocks. Engine đã áp dụng cú sốc trước popup; selector chỉ so **ngay trước → ngay sau cùng record**, tỷ lệ after/before − 1. Không đọc giá hiện tại để thay cho snapshot, không cộng các cú sốc trước hoặc sau.

Cổ phiếu dùng giá thực của từng mã trong catalog lưu trong snapshot; bình quân nhóm/ngành có trọng số bằng nhau, ghi rõ trên UI. Bond V2.5 tách An Tâm/Bứt Phá, giá, áp lực, hạng và trạng thái từ record; trạng thái default/chậm trả đã tồn tại được ghi là có trước biến cố. Không suy default từ giá giảm hoặc biến áp lực thành mất tiền đã xảy ra. V2.4 giữ single-issuer quote. Thiếu log/giá không hợp lệ hoặc đầu kỳ giá 0 thì “Chưa đủ dữ liệu”; giá bằng nhau hợp lệ hiện 0% trung tính.

**Tài sản của bạn bị ảnh hưởng thế nào?** chỉ xuất hiện khi có holdings và định giá đáng tin. Đối chiếu số lượng nắm ngay trước/sau shock không thay đổi, rồi dùng gross valuations đã làm tròn của engine. Không tự làm tròn lại công thức, không gồm coupon, cash, fees/debt hoặc nguồn tiền thanh lý hợp lệ. Khoản không đủ dữ liệu được bỏ khỏi optional breakdown.

**Kinh doanh chỉ có ở optional portfolio detail**, dưới tên vốn quán có thể thu hồi. Không có trong ba nhóm so sánh thị trường, không dự báo kinh doanh mới, không tính thu nhập vận hành. Giữ nguyên ảnh hưởng macro lên recoverable capital và mọi cơ chế Customer Preferences.

## Lỗi chạm nhanh đã xác nhận và sửa

Khi double-tap CTA, popup đóng sau chạm đầu; chạm thứ hai có thể trúng nút gieo ở bàn dưới, tạo lượt gieo ngoài ý muốn. Đã tái hiện ở cả ba widths — [RED evidence](playtests/economic-event-ux-v1/rapid-ack-red.json).

[Mobile App](../mobile_app/src/App.tsx) thêm đúng một điều kiện: nút gieo tuân thủ cùng cửa sổ khóa input300 ms đã có cho send. Không đổi engine roll, RNG hoặc animation; chỉ ngăn input xuyên popup. [GREEN browser checks](playtests/economic-event-ux-v1/browser-interactions.json): về bàn, không có lần gieo ngoài ý muốn ở320/390/430. Lần gieo quá nhanh ngay sau setup cũng bị bỏ qua đúng guard, được ghi trong metadata; chỉ23 lượt được engine chấp nhận được tính.

## Ván production thực tế và parity

Chơi bằng entrypoint production tại localhost5188, module thực tế `/assets/index-BxV3NFet.js`, mã nhập qua setup **BOND-V25-59**, tiết kiệm ban đầu0. Dice/animation bình thường, không inject state hoặc ép outcome. Mua2 lô An Tâm, học khóa học, trả nghĩa vụ ngay; Stocks/Gold/Business bỏ qua.

**23 lượt gieo, 4 START, hoàn tất ván**, nguồn tiền hợp lệ **86.772.313 ₫**, chưa thắng. Cả ba biến cố xảy ra tự nhiên: credit-tightening turn6/lap2, supply-recovery turn11/lap3, demand-boom turn18/lap4. Đây là một ván regression, không phải nghiên cứu balance hoặc chiến lược tối ưu.

[Export lấy bằng nút trong UI](playtests/economic-event-ux-v1/browser-full-game.json.gz) replay toàn trạng thái exact. [Metadata browser](playtests/economic-event-ux-v1/full-game-browser.json) và [verifier](../scripts/verify-economic-event-ux.ts) đối chiếu popup/details với từng record, mỗi instrument chỉ có một shock point tương ứng; acknowledgement đúng một decision, không đổi market/credit/cash/RNG. **7 investment panels** khớp giá snapshot ở các lượt tiếp theo. START round review ghi tổng đúng3 shocks, không cộng lại. AI facts/schema của log mới hợp lệ.

Setup và lần mua đầu ở1280×720; từ biến cố đầu đến hết ván ở390×844. Không mô tả toàn bộ ván như một phiên điện thoại thật. Những fixtures responsive được tách rõ khỏi ván production.

## Verification

| Check | Kết quả local / evidence |
| --- | --- |
| Product tests | **275/275 PASS**, gồm10 selector tests mới — [log](playtests/economic-event-ux-v1/tests.txt), [tests](../tests/economic-event-impact.test.ts), [RED trước implementation](playtests/economic-event-ux-v1/selector-red.txt) |
| Diagnostics | **56/56 PASS**, gồm6 React checks mới — [log](playtests/economic-event-ux-v1/diagnostics.txt), [React checks](../scripts/diagnostics/economic-event-ui.test.ts) |
| Lint | PASS; harness/verifier thêm sau cũng lint PASS — [log](playtests/economic-event-ux-v1/lint.txt) |
| Web / Mobile build | PASS — [Web](playtests/economic-event-ux-v1/web-build.txt), [Mobile](playtests/economic-event-ux-v1/mobile-build.txt) |
| Documentation checker mặc định | PASS — [log](playtests/economic-event-ux-v1/documentation-check.txt); chỉ đồng bộ inventory một report mới |
| Existing Bond verifier | PASS:12.000 rows đã lưu,12 V2.5 cases,13 historical replays — [log](playtests/economic-event-ux-v1/bond-replay.txt) |
| START UX verifier | PASS:4 archived games/16 START,30 layouts/52 screenshots cũ — [log](playtests/economic-event-ux-v1/start-ux-replay.txt) |
| Atomic / Economic News | PASS, output ở bản sao tạm, không ghi vào archives — [Atomic](playtests/economic-event-ux-v1/atomic-replay.txt), [News](playtests/economic-event-ux-v1/news-replay.txt) |
| V2.1 / V2.2 replay | PASS trên bản sao tạm — [V2.1](playtests/economic-event-ux-v1/v21-replay.txt), [V2.2](playtests/economic-event-ux-v1/v22-replay.txt) |
| New full-state / UX verifier | PASS:23 rolls/4 laps/3 shocks,7 panel prices,28 layouts,40 JPEG dimensions — [log](playtests/economic-event-ux-v1/verification.txt), [JSON/SHA256](playtests/economic-event-ux-v1/verification.json) |
| Browser console |0 errors/warnings cho fixtures và production — [log](playtests/economic-event-ux-v1/browser-console.json) |

Tests bao phủ ba events, sectors/gold, cả issuer V2.5 và single-issuer/fictional catalog cũ, missing/wrong/stale records, invalid prices, zero/no-quote, không duplicate shock, không dùng giá tương lai, purity/RNG, acknowledgement và Business V2.4 operating income không đổi.

**Với cùng seed và chuỗi action được chấp nhận, market prices, credit outcomes, Business/Bank, START, victory và RNG giữ nguyên so với base.** AI Coach/Economic News selectors không đổi. Root source tree hash giống hệt; assets, lockfiles, deployment/CI config, historical logs/simulation evidence không đổi — [scope check](playtests/economic-event-ux-v1/scope-check.txt). Không tái chạy nghiên cứu12.000 hoặc180.000 ván; Bond verifier đọc saved rows và sáu seed-0 spot checks có sẵn. Không chạy lại full documentation audit.

## Ảnh và cách chạy

**40 JPG** với kích thước đọc từ bytes: ba events và details ở320×640/390×844/430×932; portfolio disclosure, legacy/missing-data, return-board và production/investment/result. [DOM/layout/colors](playtests/economic-event-ux-v1/browser-layouts.json), [dimensions](playtests/economic-event-ux-v1/verification.json).

| Biến cố |320|390|430|
| --- | --- | --- | --- |
| Tín dụng thắt chặt |[ảnh](playtests/economic-event-ux-v1/320-credit-tightening.jpg)|[ảnh](playtests/economic-event-ux-v1/390-credit-tightening.jpg)|[ảnh](playtests/economic-event-ux-v1/430-credit-tightening.jpg)|
| Nhu cầu khởi sắc |[ảnh](playtests/economic-event-ux-v1/320-demand-boom.jpg)|[ảnh](playtests/economic-event-ux-v1/390-demand-boom.jpg)|[ảnh](playtests/economic-event-ux-v1/430-demand-boom.jpg)|
| Chuỗi cung ứng phục hồi |[ảnh](playtests/economic-event-ux-v1/320-supply-recovery.jpg)|[ảnh](playtests/economic-event-ux-v1/390-supply-recovery.jpg)|[ảnh](playtests/economic-event-ux-v1/430-supply-recovery.jpg)|

Một capture production đầu tiên bị compositor co thành390×219 ngay sau đổi viewport. Đã bỏ capture lỗi và [chụp lại đúng checkpoint](playtests/economic-event-ux-v1/390-archived-credit-tightening.jpg) bằng DEV harness, không sửa ảnh hoặc inject production; [metadata retake](playtests/economic-event-ux-v1/screenshot-retake.json). Các ảnh tên production còn lại lấy ngay trong ván thật; ảnh archived được ghi riêng, không tính như một ván mới.

Vòng học giữ nguyên: đầu vòng **Bản tin Kinh tế & Thị trường** là dự báo chưa chắc chắn → ô kinh tế **Biến cố Kinh tế** là sự kiện đã xảy ra → ô đầu tư dùng giá/tín hiệu đã có → START **Dự báo vs. Thực tế** so sánh toàn vòng. Biến động giá khác với lãi/lỗ đầu tư và tiền mặt thực nhận.

Từ root: `npm ci`, `npm ci --prefix mobile_app`, `npm run dev --prefix mobile_app`; mở `http://localhost:5174/`. [DEV harness](../mobile_app/src/economic-event-harness.tsx) tại `/economic-event-harness.html?event=credit-tightening`; thêm holdings/legacy/missing/archived để xem fixture phù hợp. Không nằm trong production entry/bundle, không cần API keys. Verifier: `node --experimental-strip-types scripts/verify-economic-event-ux.ts`.

[Danh sách file đầy đủ](playtests/economic-event-ux-v1/changed-files.txt). Commits: `f942c5b` selector/tests; `d4368e0` popup và input guard; commit verification/report sau cùng có SHA trong handoff chat. Không merge, force-push, deploy thủ công hoặc thay Vercel settings.

Chưa kiểm chứng điện thoại vật lý, screen reader thật, live AI provider hoặc GitHub Actions/Vercel mới. Không cài lại dependencies vì manifest/lockfile không đổi. Tham số Bond V2.5 vẫn [experimental, chờ owner duyệt](BOND_V2_5_BALANCE_REPORT.md). CI lịch sử V2.4 **186 product tests +21 diagnostics** ở [audit chronology](DOCUMENTATION_AUDIT.md), không phải kết quả HEAD mới.

**READY FOR REVIEW — Economic Event UX V1 presentation-only.** Không có defect đã xác nhận còn chặn UX delivery này; quyết định merge và thông số Bond vẫn thuộc owner.
