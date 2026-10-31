> **CURRENT** — Bond Credit V2.5 experimental candidate, 15/10/2026. [Nguồn MVP](CURRENT_MVP.md), [đặc tả trước engine](BOND_V2_5_DESIGN_SPEC.md), [balance](BOND_V2_5_BALANCE_REPORT.md). Chưa owner approval, merge hoặc deploy.

# Bàn giao Bond Credit Risk V2.5

## Kết quả và version

Triển khai trên [codex/bond-credit-v2-5](https://github.com/Tig0nn/boardgame_EXE/tree/codex/bond-credit-v2-5), base `codex/atomic-investment-encounters` tại `f3a03cbb36554bbaa9e59397c257f5966f12ef2f`. Nhánh gốc giữ nguyên. Tính năng mới chỉ là candidate experimental; coupon4,5%/10%, probabilities và recovery80%/50% chờ owner duyệt, không được gọi là luật chính thức.

[Catalog](../src/data/bond-issuers.ts) định nghĩa An Tâm (AA, rủi ro thấp hơn) và Bứt Phá (B, coupon cao/rủi ro cao). [Credit engine](../src/game/bond-credit.ts) sở hữu price series, lifecycle, ledger, quotes và evidence. `bondRulesVersion` độc lập encounter/business; absent metadata giữ V2.4-single-issuer. [Player factory](../src/game/new-game.ts) bật V2.5 cho phiên mới trên nhánh này; API createGame, session đã lưu và historical replay không tự migrate.

Giá V2.5 là target quanh face theo trạng thái/scenario/stress/jitter, không compound dải Bond tăng giá cũ. Market vẫn tiêu thụ old bond draw để giữ chuỗi stock/gold/dice; credit stream seed riêng và processedLap guard. Macro chỉ đổi credit stress/quote công khai, default/cure xảy ra START. Đọc Help/news hoặc chọn thẻ không draw RNG. Tên issuer/ratings hoàn toàn hư cấu trong game.

## Accounting, START, bán và đích

Giữ settlement order/cursor: thị trường → lương → Business → savings/Bonds → nợ/nghĩa vụ. Mỗi lot lưu issuer, purchase price, units, face/cost basis, buy/maturityLap, coupon history, trạng thái, outstanding coupon/principal, principal paid/lost/sold và transferred coupon. Contract amount tách khỏi actual cash. Coupon đến hạn chưa trả chỉ là claim; sau maturity không tạo coupon mới. Default write-off phần mất và giữ recovery claim; cash chỉ tăng START kế tiếp. Pause funding/reentry không trả salary/credit lần hai.

Bán tại START hoặc mandatory funding phải chỉ rõ lotId. Partial sale giảm đúng units/face/cost basis/coupon rights của lot đó, không chia sang issuer khác. Phí1,5% giữ nguyên, double tap không bán hai lần. Default/resolved issuer không executable quote; delayed còn quote có discount. Funding liệt kê eligible holdings và net proceeds, phối hợp Savings/Stocks/Gold/debt theo luật cũ.

Valuation Bond là tổng executable quotes; liquidatableFunds cộng net từng lot sau phí, không cộng receivables, không giả định hoàn gốc sau vòng4 và không đếm đồng thời quote với face claim. Recovery claim không có quote định giá0 trong aggregate và hiển thị riêng ở holdings; mức giảm aggregate khi default không phải toàn bộ permanent loss. Ledger principal/coupon loss phân biệt phần không thu hồi với phần còn chờ nhận. Mục tiêu80M+10M không đổi.

## Mobile, news và AI

Hai thẻ issuer dùng button aria-pressed, giữ amount khi chuyển thẻ, một CTA mua và một Skip. Form giữ quote/face, coupon có điều kiện, maturity, cash-after và sale fee; chi tiết credit/exit/lịch sử công khai mở rộng. Successful purchase tự về board. Ví và MarketDetails hiển thị từng lot, active/near maturity/delayed/recovery/resolved; selected START/funding sale giữ đúng target.

Economic News giữ ba scenario và ba asset; Bond row mô tả điều kiện tín dụng phân hóa. START giữ price return tách khỏi actual payments; bảng credit theo issuer trong details chứa rating movement/due/paid/claims/loss. Endpoint returns chỉ tính shock một lần. Không đủ observation hoặc issuer halt từ đầu kỳ thì “Chưa đủ dữ liệu”. Tutorial vẫn sáu bước, thêm Bank vs issuer credit ngắn; Sổ tay giải thích delay vs loss, price vs face, recovery và horizon.

AI facts lấy từ engine, evidence `bond-credit`/`bond-choice`: issuer và warning lúc mua đầu tiên, concentration theo tiền mua, coupon/gốc thực nhận, delay/loss/claims, vòng bán và net sale. Schema giữ8 evidence/500chars/fact/10KB; facts của mọi exported V2.5 game hợp lệ. Handler/provider/API/keys/timeout/fallback/grounding không đổi. Không cần key hoặc live Gemini để chạy tests. Không xác minh provider thật.

## Kiểm chứng local actual

| Check | Kết quả / output |
| --- | --- |
| Clean root install | PASS,0 vulnerability — [log](playtests/bond-credit-v25/root-install.txt) |
| Clean Mobile install | PASS,0 vulnerability — [log](playtests/bond-credit-v25/mobile-install.txt) |
| Product tests | **254/254 PASS** — [log](playtests/bond-credit-v25/tests.txt) |
| Diagnostics | **44/44 PASS** — [log](playtests/bond-credit-v25/diagnostics.txt) |
| Lint | PASS — [log](playtests/bond-credit-v25/lint.txt) |
| Web production build | PASS — [log](playtests/bond-credit-v25/web-build.txt) |
| Mobile production build | PASS — [log](playtests/bond-credit-v25/mobile-build.txt) |
| Documentation checker mặc định | PASS — [log](playtests/bond-credit-v25/documentation-check.txt) |
| Balance/replay verifier | PASS:12.000 rows,12 V2.5 replay cases,13 historical — [log](playtests/bond-credit-v25/replay-output.txt), [JSON/SHA256](playtests/bond-credit-v25/replay-verification.json) |
| Browser/fixture console |0 errors — [log](playtests/bond-credit-v25/browser-console.json) |
| Responsive |320×640/390×844/430×932;93 JPG dimensions verified, no horizontal overflow — [dimensions](playtests/bond-credit-v25/screenshot-dimensions.json) |

Mobile clean install ban đầu gặp native rolldown binding bị preview Atomic cũ khóa; đã xác minh/dừng riêng preview PID35084 rồi npm ci thành công. Không đổi dependencies/lockfiles hoặc sửa lại dependency fixes cũ. [TDD red checkpoint](playtests/bond-credit-v25/presentation-red.txt) là output trước khi bật factory/evidence mới, không phải kết quả cuối.

[Product regressions](../tests/bond-credit.test.ts) và [presentation tests](../tests/bond-credit-presentation.test.ts) bao phủ A/B, atomic/invalid/reopen, price/RNG isolation, coupons/delays/default/recovery, partial sales, mandatory combinations, terminal liquidity, settlement pause/duplicate prevention, no future leaks và AI constraints.200 fractional sale cases kiểm face/coupon conservation;12.000 ván kiểm final invariants. [UI diagnostics](../scripts/diagnostics/bond-credit-ui.test.ts) dùng real React SSR. Replay kiểm version/config catalog frozen, từng before-action và complete state; metadata khai sai coupon bị reject. Verifier đọc toàn bộ12 archived gzip game logs hiện có ngoài V2.5 và fixture multi-purchase trước thay đổi: **13 historical replay PASS**, gồm Business Customer Preferences V2.4, Business V2.3, GD/Web, transaction UX, Mobile MVP/onboarding/final/integration, Economic News, encounter V2.3 và Atomic. Các suite V2.1/V2.2 hiện có vẫn PASS; không sửa các file lịch sử.

## Năm ván Mobile production qua UI

Chạy local `http://127.0.0.1:5188/`, cash50M/savings0, gieo bình thường và tất cả action qua UI; không fixture injection, không ép dice/credit outcomes hoặc rút animation. Mỗi mua Bond dùng double tap, chỉ một transaction và một lần trừ tiền. Log được tải bằng “Lưu nhật ký hành trình”, gzip riêng; [collector UI](playtests/bond-credit-v25/browser-verification.json) lưu seed/actions/build và [verifier](../scripts/verify-bond-credit.ts) replay full state.

| Ván / seed | Rolls / purchases | Proceeds | Outcome / evidence |
| --- | --- | --- | --- |
| A normal / BOND-V25-1 |25 /4 |91.407.512 ₫ |Win, coupons/gốc đúng hạn — [export](playtests/bond-credit-v25/browser-normal-a.json.gz) |
| B normal / BOND-V25-1 |25 /4 |96.112.622 ₫ |Win, coupons/gốc đúng hạn — [export](playtests/bond-credit-v25/browser-normal-b.json.gz) |
| A delayed / BOND-V25-0 |22 /4 |95.765.466 ₫ |Win, coupon/gốc delay START2, cure START3; partial sale bond-2 gross500k/net492.500 — [export](playtests/bond-credit-v25/browser-delayed.json.gz) |
| A default / BOND-V25-59 |23 /2 |83.316.939 ₫ |Defeat; loss7.393.469 gốc+coupon, thu hồi24.141.939 ở START3 — [export](playtests/bond-credit-v25/browser-default-recovery.json.gz) |
| B default / BOND-V25-10 |27 /2 |72.250.000 ₫ |Defeat; default trước maturity tại START1, loss16.500.000, thu hồi13.750.000 ở START2 — [export](playtests/bond-credit-v25/browser-default-b.json.gz) |

Invalid0 làm CTA disabled và giữ encounter; Help giữ input và signal expanded. Ván delayed bán đúng lot bond-2, double tap cash tăng đúng492.500; lot khác tiếp tục quyền coupon/gốc. Default quote unavailable làm CTA bán disabled. Tutorial đầu tiên và mở lại được kiểm, stock/gold/Bank/Business không bị UI Bond chiếm flow.

Ván normal-A dùng build đầu `index-Dw9T-IIu.js`; bốn ván còn lại dùng build cuối `index-Qdizf_3O.js` (thẻ ngắn hơn, credit details collapsible, result giải thích claims). Engine/config của hai build giống nhau. Không gán mọi screenshot cho cùng một build. Một lượt thử điều khiển B chưa chọn đúng issuer đã được bỏ khỏi collector; ván B báo ở bảng xác nhận selection trước mua và issuer IDs trong export. Chỉ năm ván đầy đủ này được tính browser coverage.

## Funding fixture và ảnh

Fixture development riêng `http://127.0.0.1:5189/integration-harness.html?fixture=bond-credit-funding`: A default không eligible; B delayed gross1,65M/net1.625.250, Savings3M và debt374.750 trả đủ sinh hoạt7M sau cash2M. Invalid0/partial double tap/combined funding đều kiểm qua UI. [Fixture evidence](playtests/bond-credit-v25/fixture-verification.json) ghi rõ injected state; **không phải full-game replay hoặc production outcome**. Unit tests riêng bao phủ phối hợp thêm Stocks/Gold và insolvency.

| Màn |320 |390 |430 |
| --- | --- | --- | --- |
| Chọn A |[ảnh](playtests/bond-credit-v25/320-issuer-a.jpg) |[ảnh](playtests/bond-credit-v25/390-issuer-a.jpg) |[ảnh](playtests/bond-credit-v25/430-issuer-a.jpg) |
| Chọn B |[ảnh](playtests/bond-credit-v25/320-issuer-b.jpg) |[ảnh](playtests/bond-credit-v25/390-issuer-b.jpg) |[ảnh](playtests/bond-credit-v25/430-issuer-b.jpg) |
| Chậm gốc/coupon |[ảnh](playtests/bond-credit-v25/320-principal-delay-start2.jpg) |[ảnh](playtests/bond-credit-v25/390-principal-delay-start2.jpg) |[ảnh](playtests/bond-credit-v25/430-principal-delay-start2.jpg) |
| Bán một phần |[ảnh](playtests/bond-credit-v25/320-partial-sale.jpg) |[ảnh](playtests/bond-credit-v25/390-partial-sale.jpg) |[ảnh](playtests/bond-credit-v25/430-partial-sale.jpg) |
| Default A |[ảnh](playtests/bond-credit-v25/320-default-start2.jpg) |[ảnh](playtests/bond-credit-v25/390-default-start2.jpg) |[ảnh](playtests/bond-credit-v25/430-default-start2.jpg) |
| Thu hồi B |[ảnh](playtests/bond-credit-v25/320-recovery-b-start2.jpg) |[ảnh](playtests/bond-credit-v25/390-recovery-b-start2.jpg) |[ảnh](playtests/bond-credit-v25/430-recovery-b-start2.jpg) |
| Funding fixture |[ảnh](playtests/bond-credit-v25/320-fixture-funding.jpg) |[ảnh](playtests/bond-credit-v25/390-fixture-funding.jpg) |[ảnh](playtests/bond-credit-v25/430-fixture-funding.jpg) |
| Tutorial |[ảnh](playtests/bond-credit-v25/320-tutorial.jpg) |[ảnh](playtests/bond-credit-v25/390-tutorial.jpg) |[ảnh](playtests/bond-credit-v25/430-tutorial.jpg) |

Toàn bộ93 ảnh trong dimensions manifest:84 production/tutorial và9 fixture. Ba capture320 bị compositor cắt đã chụp lại từ UI, không resize/edit ảnh. Tutorial320 chụp lại bằng fresh origin `http://localhost:5188/`; không sửa localStorage để giả first-time. Ảnh tên coupon-delay-start1/credit là START1 của ván delayed (khi issuer còn performing); delay actual ở ảnh principal-delay-start2. Không diễn giải ảnh START1 như một coupon đã bị trễ.

## Files, commits và giới hạn bàn giao

[Danh sách đầy đủ files thay đổi](playtests/bond-credit-v25/changed-files.txt) gồm engine/catalog/types/replay, shared financial UI, Mobile news/tutorial/result/session/fixtures, AI facts/types/schema, tests/research version pin, runner/verifier, docs và evidence mới. Không sửa approved non-Bond config, C20, Business/savings engine, stock/gold formulas, artwork/GLB/dice/audio/animation, AI provider handler, package/lockfiles, Vercel/CI settings hoặc evidence lịch sử.

Commits: design trước engine `ed3be4d`; engine/version/settlement/replay `e396ba7`; UI/AI `7e94728`; regressions/replay config `92693ba`; chuẩn hóa EOL riêng `ad6e948`; balance `1c1197b`; docs/browser `46f07dd`. Follow-up kiểm toàn bộ13 archived logs tách sau cùng; SHA cuối và trạng thái push ghi trong handoff của chat, tránh tự tham chiếu hash của chính report. EOL correction giữ nguyên code/kết quả và không viết lại lịch sử. Không merge hoặc deploy.

Chạy app từ root: `npm ci`, `npm ci --prefix mobile_app`, `npm run dev --prefix mobile_app`, mở `http://localhost:5174/`. Recheck artifact: `node --experimental-strip-types scripts/verify-bond-credit.ts`. Không cần rerun12.000 hoặc180.000 ván chỉ để replay.

Chưa xác minh điện thoại vật lý, live Gemini, GitHub Actions mới hoặc Vercel deployment cho HEAD này. Preview5188 chỉ localhost; hosting cũ không được tự gán là V2.5. Icon C20 artwork lệch vẫn là issue cũ, không sửa. Bank-first tốt hơn các Bond heuristics trong benchmark; chưa có sensitivity/user study. Owner cần duyệt các numerical parameters, terminal no-quote policy và giá trị educational tradeoff trước nhập luật chính thức.

Mốc CI lịch sử V2.4 là **186 product tests + 21 diagnostics**, xem [audit chronology](DOCUMENTATION_AUDIT.md). Đây không phải kết quả của HEAD V2.5; bảng254/44 bên trên là local verification mới.

**READY FOR OWNER REVIEW — experimental candidate; chưa chứng nhận READY TO MERGE/production.**
