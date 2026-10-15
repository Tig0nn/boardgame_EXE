> **CURRENT — EXPERIMENTAL CANDIDATE**, 15/10/2026. V2.5 chỉ trên `codex/bond-credit-v2-5`, từ `f3a03cb`. Chưa được owner phê duyệt cân bằng hoặc phát hành. Luật V2.4 đã duyệt: [CURRENT_MVP.md](CURRENT_MVP.md).

# Bond Credit Risk V2.5 — đặc tả trước triển khai

## Phạm vi và kiến trúc hiện tại

Đã đọc config/types/market/transactions/settlement/selectors/engine/state/log/new-game/encounters, Economic News, AI facts/schema/handler và simulation/diagnostic scripts. Bond V2.4 dùng một giá, coupon 5%, hai START, bán theo tỷ lệ tất cả lot, luôn hoàn gốc. `SCENARIOS` còn cộng 2–8% giá/vòng, không phù hợp cộng thêm một lớp credit risk. START có cursor sáu bước chống trả trùng; funding có thể tạm dừng và tiếp tục. Replay kiểm toàn state, không chỉ tổng tiền.

Thêm metadata độc lập `bondRulesVersion: 'v2.4-single-issuer' | 'v2.5-credit-risk'`; thiếu metadata luôn là V2.4. API createGame mặc định giữ lịch sử. Player factory phiên mới dùng V2.5; stored sessions không migrate. Giữ schema5 với fields tùy chọn. Encounter vẫn `v2.4-atomic-investments`. Không đổi C20, 4 vòng, vốn50M, mục tiêu90M, Bank/Stocks/Gold/Business, dice, artwork/audio, hosting hoặc AI provider.

## Phase 0 — mô hình chọn candidate

Chạy [prototype](../scripts/prototype-bond-credit.mjs) trước khi sửa financial engine: `node --experimental-strip-types scripts/prototype-bond-credit.mjs 50000`. [Output](playtests/bond-credit-v25/phase0-prototype.json): 50.000 seed chung × 2 issuer × 4 candidate = 400.000 instrument paths, hai START. Bank C20: 4% kỳ1, 5% kỳ2, 6% kỳ3; hai START kỳ2 nhận10%, rút bắt buộc trước hạn nhận0% lãi.

| Candidate | Mean return A / B | Median A / B | Loss A / B |
| --- | --- | --- | --- |
| 3% / 8%, risk ban đầu | 3,258% / −5,715% | 6% / 16% | 6,858% / 31,362% |
| 4,5% / 9%, risk ban đầu | 6,125% / −4,163% | 9% / 18% | 6,858% / 31,362% |
| 4,5% / 10%, risk ban đầu | 6,125% / −2,611% | 9% / 20% | 6,858% / 31,362% |
| **4,5% / 10%, B moderate risk** | **6,125% / 4,499%** | **9% / 20%** | **6,858% / 21,834%** |

Chọn candidate cuối để triển khai thử: B không thống trị A về kỳ vọng, nhưng có median cao hơn và tail loss lớn. A có coupon nhận từng START và quyền bán tại START/funding trong khi Bank chỉ tự đáo hạn hoặc rút bắt buộc toàn khoản mất lãi. A không được hứa vượt Bank về lợi nhuận; đánh đổi là dòng tiền và bán từng phần. Coupon3% bị loại vì lợi ích thanh khoản không đủ bù rủi ro trong mô hình. Risk B ban đầu bị loại vì loss31% quá mạnh. Các xác suất là tham số giáo dục giả định, không phải thống kê thị trường thực.

Prototype chưa có board, lương, course, macro tiles, chiến thuật bán hoặc vay. Giá distressed dùng midpoint cố định; default kỳ1 hồi phục ở kỳ2, default kỳ2 chưa thu hồi, giá trị thanh khoản0. Full-game simulations sau triển khai phải kiểm lại candidate; không lấy kết quả này làm win rate hoặc bằng chứng cuối cùng.

## Catalog và tín dụng công khai

| Thuộc tính | A — Hợp tác xã An Tâm | B — Công ty Bứt Phá |
| --- | --- | --- |
| Tên/ratings | Hoàn toàn hư cấu; AA trong game | Hoàn toàn hư cấu; B trong game |
| Coupon/START | 4,5% mệnh giá còn nắm giữ | 10% mệnh giá còn nắm giữ |
| Mệnh giá | 100.000 ₫/unit | 100.000 ₫/unit |
| Kỳ hạn | Hai START, maturityLap = buyLap+1 | Hai START |
| Performing: default / delay | 0,5% / 3,5% | 2,5% / 10% |
| Uncertain cộng vào cả default và delay | 1,5 điểm% | 4 điểm% |
| Mỗi mức stress công khai cộng vào cả hai | 1 điểm% | 3 điểm% |
| Delayed: default / cure | 2×default hiện hành / 75% | 2×default hiện hành / 55% |
| Default principal recovery | 80%, nhận tại START tiếp theo | 50%, nhận tại START tiếp theo |
| Default coupon recovery | 0% phần chưa trả | 0% phần chưa trả |

Issuer lifecycle: performing → performing/delayed/defaulted; delayed → performing/delayed/defaulted; defaulted → resolved tại START kế tiếp; resolved absorbing. Delayed rating CCC; defaulted/resolved D. Không hồi sinh issuer đã default hoặc phát hành thêm. Chỉ mua issuer performing; delayed vẫn có executable sale quote. Mọi trạng thái/lịch sử thanh toán hiện tại công khai; không precompute hoặc đưa outcomes tương lai vào selector.

Macro credit-tightening tăng stress1; demand-boom/supply-recovery giảm1; giới hạn0..2. Macro công bố stress và đổi quote ngay, không tạo default ngoài START. Growth/recovery không thêm penalty. Nếu tổng default+delay vượt1 thì clamp delay theo phần còn lại; delayed cure cũng clamp. Dùng một categorical draw, không lấy hai biến cố độc lập có thể chồng lên nhau.

## Giá thứ cấp và RNG

V2.5 không dùng old Bond normal-return/shock multiplier. Giữ phép draw old bond trong market stream để stock/gold/dice tiếp tục cùng chuỗi; quote cũ chỉ phục vụ nhánh lịch sử. Giá từng issuer là target quanh mệnh giá (không compound mức tăng dương): performing midpoint A1,00/B1,00; delayed A0,75/B0,55; uncertain giảm A0,01/B0,03; stress giảm A0,01/B0,03 mỗi mức; jitter A±0,015/B±0,035. Min quote 1 ₫. Defaulted/resolved không executable quote. Khi macro đổi, reprice theo cùng jitter công khai của kỳ, không draw thêm. START cập nhật credit rồi quote, sau đó xử lý cash trong bước đáo hạn/coupon.

Credit RNG stream `hashSeed(seed + ':bond-credit-v2.5')`, lưu state riêng. Mỗi START draw outcome+jitter theo thứ tự A,B, kể cả không có holdings hoặc issuer resolved. Khi Help/news/chọn card/giao dịch không draw. Startup có giá par; không sinh hidden historical credit events. Series price history độc lập, ghi cả before/after, lap/turn/kind/eventId. Credit event ghi from/to/rating/stress công khai đúng thời điểm. Không lưu draw tương lai.

## Accounting và settlement

Giữ order thị trường → lương → Business → Savings/Bonds → nợ → nghĩa vụ. Credit market update có processedLap guard và settlement cursor tiếp tục chống duplicate khi pause funding. Mỗi lot ghi issuer, purchasePrice, units, costBasis, originalFace, remaining principal, buy/maturityLap, coupon history, last processed lap, payment status, outstanding coupon/principal, principal recovered, principal/coupon losses và warning công khai lúc mua.

Performing: phát sinh coupon nếu chưa vượt maturity; trả toàn outstanding coupon, tới maturity trả principal còn lại và resolve lot. Delayed: phát sinh coupon đến maturity, không tăng cash, tới maturity gắn outstanding principal; sau maturity không tạo coupon mới. Khi cure: trả arrears và principal nếu tới hạn. Default: dừng coupon, ghi mất coupon outstanding và phần principal không thu hồi; retained principal = rounded(recovery×principal), outstanding principal = recovery claim; không tăng cash. START tiếp theo trả đúng recovery claim rồi resolve. Coupon kỳ default được ghi due rồi lost, không coi là cash. Recovery không trả lãi phạt hoặc coupon mới. Principal actually recovered tách khỏi sale proceeds; contract face/cost basis không bị diễn giải thành cash.

Lot matured/sold/resolved không phát sinh coupon. Partial sale chỉ một lot được chọn: fraction=gross/rounded(executable lot value), giảm units/principal/outstanding coupon/outstanding principal/costBasis theo tỷ lệ, làm tròn VND với phần dư ở holding còn lại; phần sold chuyển giao coupon claim, không trả giả cash coupon. Full sale zeros remaining rights, ghi status sold. Lịch sử receipts giữ nguyên, soldPrincipal và transferredCoupon ghi riêng để audit conservation. Không bán default recovery claim (quote unavailable). Principal đã paid hoặc lost không bán/thu lần hai.

## Giao dịch, funding và đích

Buy action phải có issuerId hợp lệ, cash integer dương, issuer performing, đúng tile và atomic guard; một lot và một transaction, tự rolling. Invalid giữ state. Sale action START và fundPayment dùng lotId, không phân bổ sang issuer khác. Engine không tự chọn lot khi nhiều lựa chọn hoặc lot không hợp lệ. Sale fee giữ1,5%, buy fee0. Funding UI liệt kê eligible lots và net proceeds; Bank/stock/gold/debt giữ luật cũ.

Valuation chỉ là executable market amount của remaining holdings, không cộng coupon claim. Default recovery claim ghi riêng, không được tính liquidatable. `liquidatableFunds` cộng từng net sale quote sau phí (không gộp rounding giữa lot); không quote =0; trừ debt/obligations/pending như cũ. Không assume repayment sau vòng4 hoặc tính face đầy đủ. Lot maturity vòng5 vẫn chỉ tính giá bán hiện tại nếu có. Mục tiêu80M+10M không đổi.

## News, UX và AI

Bulletin giữ growth/uncertain/recovery và stock/bond/gold; Bond nói điều kiện tín dụng phân hóa, không hứa tất cả cùng tăng. Issuer cards hiển thị rating/outlook/stress/payment history/coupon/term/quote/face. Expandable detail chứa risk, exit fee và contractual payout có điều kiện. Chọn issuer không mất amount hoặc context. Portfolio theo issuer/lot gồm active/near maturity/delayed/recovery/resolved. START review tách price return, rating change, coupon due/paid, principal due/paid, arrears, losses/recovery; insufficient observations → Chưa đủ dữ liệu; không cộng shock lần hai.

Tutorial ngắn nói Bank vs issuer credit, Sổ tay chi tiết delay vs permanent loss và liquidity cuối ván. AI chỉ nhận evidence engine: lựa chọn+warning lúc mua, actual coupon, delay/loss/recovery, concentration và net sales; giữ giới hạn8 evidence/10KB/500chars, fallback/grounding/provider/API unchanged; historical fields optional. Không yêu cầu live provider test.

## Thứ tự triển khai và tiêu chí chứng minh

1. Đặc tả/prototype commit trước engine. Version/catalog/state và tests RED→GREEN cho purchase/RNG/history.
2. Credit price/settlement/accounting/sales/funding/liquidation cùng invariant tests và replay compatibility; lưu action issuerId/lotId để replay partial sales chính xác.
3. Shared trading/holdings/sales UI + Mobile news/START/tutorial/Rulebook + AI evidence; kiểm SSR và browser.
4. Sáu chiến thuật cùng seeds: Bank-first/A/B/mixed/liquidity/balanced; báo win/insolvency/proceeds mean+median/loss distribution/coupon/delay/default/recovery/illiquid và uncertainty. Không sửa old180k evidence.
5. Clean npm ci cả hai app, tests/diagnostics/lint/build/docs/verifier; full four-lap browser games thắng/thua, normal A/B, coupon/principal delay, default/recovery; 320/390/430 screenshots và exported full-state replay.
6. Report implementation/balance/file list/limits, review diff, logical commits, push feature branch. Không merge/deploy. Owner duyệt coupon/probabilities/recovery/terminal illiquidity trước nhập chính thức.

Owner approval chưa có cho các con số; việc triển khai experimental đã được yêu cầu. Không có quyết định bắt buộc phải chờ mới xây được candidate. Nếu full simulations cho thấy candidate không đạt educational tradeoff, cập nhật đặc tả và ghi rõ calibration trước handoff.
