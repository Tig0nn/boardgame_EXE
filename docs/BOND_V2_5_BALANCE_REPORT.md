> **CURRENT** — Bond V2.5 experimental candidate, 15/10/2026. Chưa duyệt luật chính thức. [Đặc tả](BOND_V2_5_DESIGN_SPEC.md), [triển khai](BOND_V2_5_IMPLEMENTATION_REPORT.md), [nguồn MVP](CURRENT_MVP.md).

# Cân bằng Bond Credit V2.5

## Phương pháp và tham số

Phase0 chạy trước engine, 50.000 seed × hai issuer × bốn candidate = 400.000 instrument paths. [Prototype](../scripts/prototype-bond-credit.mjs), [JSON kết quả](playtests/bond-credit-v25/phase0-prototype.json) và bảng so sánh trong đặc tả ghi vì sao không dùng mặc định3%/8%. Đây là phép thử hai START, không có board/lương/course/debt; không phải win-rate study.

Candidate triển khai: An Tâm4,5%, Bứt Phá10%; hai START, face100.000 ₫, bán phí1,5%. Performing default/delay A0,5%/3,5%, B2,5%/10%; uncertain cộng1,5/4 điểm% vào cả hai, mỗi stress cộng1/3 điểm%. Delayed default gấp đôi, cure75%/55%; default mất coupon chưa trả, giữ80%/50% principal để nhận START tiếp theo. Toàn bộ là giả định giáo dục, không phải xác suất thực tế của doanh nghiệp.

Full-game dùng [runner](../scripts/simulate-bond-credit.ts), [policy](../scripts/diagnostics/bond-credit-model.ts), **2.000 seed chung `BOND-V25-0`…`BOND-V25-1999` × sáu chiến thuật =12.000 ván**, C20/bốn vòng, RNG/outcomes nguyên trạng. Không ép dice hay chọn seed thuận lợi để tính tỷ lệ. Face/coupon conservation, nonnegative claims và at-most-once payment history được assert từng ván. [Raw rows gzip](playtests/bond-credit-v25/balance-runs.json.gz), [aggregates/config/CI](playtests/bond-credit-v25/balance-results.json), [output thực](playtests/bond-credit-v25/balance-output.txt).

Các chiến thuật đều học course nếu gặp ở vòng1/2 và đủ tiền; không mua tự nguyện bằng nợ. Bank-first bắt đầu30M/kỳ2, gửi85% budget tại Bank với kỳ hạn tối đa còn trong ván. A/B bắt đầu0, reserve10M, mua tối đa15M mỗi lần ghé issuer performing tương ứng. Mixed luân phiên issuer theo số lot lịch sử, cùng giới hạn15M. Liquidity reserve20M, mua A và bán toàn lot có quote tại mỗi START. Balanced bắt đầu15M/kỳ2, chia Bank/Stocks/Gold/Bonds/Business theo policy đã ghi; Business mua/nâng vòng1/2, bán từ vòng3 khi gặp lại. Không chọn issuer khác thay cho issuer mục tiêu đã default; đây là heuristic, không phải tối ưu.

## Kết quả actual

| Chiến thuật | Win rate (95% CI) | Proceeds TB | Median | Chậm trả trên holdings | Default trên holdings |
| --- | --- | --- | --- | --- | --- |
| Bank-first | 54,65% (52,47–56,83%) | 90.962.929 ₫ | 91.424.404 ₫ | 0% | 0% |
| Issuer A | 39,70% (37,56–41,84%) | 86.208.679 ₫ | 86.794.923 ₫ | 11,15% | 3,05% |
| Issuer B | 41,80% (39,64–43,96%) | 86.198.255 ₫ | 86.863.345 ₫ | 26,60% | 12,30% |
| Mixed Bonds | 39,20% (37,06–41,34%) | 86.034.339 ₫ | 86.500.000 ₫ | 19,95% | 8,60% |
| Liquidity | 33,70% (31,63–35,77%) | 84.657.171 ₫ | 85.055.290 ₫ | 7,80% | 2,05% |
| Balanced | 47,00% (44,81–49,19%) | 89.120.583 ₫ | 89.081.912 ₫ | 18,80% | 7,85% |

Insolvency **0/2.000 ở cả sáu chiến thuật**; không chứng minh phá sản bất khả thi. Các policy giữ reserve, có lương/course và funding hiện hành. Product tests vẫn kiểm insolvency khi default claims không có quote và hết hạn mức vay.

| Chiến thuật | Loss hợp đồng TB | Loss P99 / max | Loss TB khi có loss | Coupon thực nhận TB | Thu hồi sau default TB | Gốc illiquid cuối ván TB | Coupon chưa nhận TB |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bank-first | 0 | 0 / 0 | 0 | 0 | 0 | 0 | 0 |
| A | 166.218 | 7.197.754 / 13.842.746 | 5.449.775 | 2.549.724 | 306.216 | 233.192 | 40.636 |
| B | 1.648.002 | 21.000.000 / 31.328.188 | 13.398.393 | 4.572.050 | 968.980 | 384.077 | 278.673 |
| Mixed | 714.451 | 10.334.340 / 19.259.712 | 8.307.571 | 3.166.886 | 529.906 | 281.424 | 147.156 |
| Liquidity | 83.828 | 3.718.958 / 7.531.278 | 4.089.175 | 1.401.469 | 182.617 | 91.107 | 0 |
| Balanced | 213.364 | 3.201.605 / 6.419.903 | 2.718.017 | 951.241 | 148.155 | 97.500 | 48.588 |

Các số ở bảng hai là VND, TB tính trên toàn2.000 ván gồm ván không mua Bond. Loss gồm principal write-off và coupon đã đến hạn nhưng không thu hồi; không trừ lại các số này khỏi cash/proceeds. Median loss0 ở tất cả chiến thuật; P95 loss A/Liquidity cũng0 do biến cố hiếm, nên bổ sung P99/max và conditional mean thay vì che tail risk. Percentile là order statistic tại floor(n×p). P99/max/conditional mean được tính thêm từ raw rows đã lưu, không chạy lại engine study.

## Đọc kết quả và uncertainty

B không thống trị A: mean proceeds B thấp hơn A khoảng10.424 ₫, dù median/win rate hơi cao hơn; B nhận coupon nhiều hơn nhưng default và tail loss lớn hơn. Một ván B tốt không chứng minh B là lựa chọn tốt nhất. Bank-first dẫn đầu benchmark; paired mean proceeds A/B thấp hơn Bank khoảng4,75M/4,76M, 95% CI của chênh lệch lần lượt [−4,946M;−4,562M] và [−5,117M;−4,412M]. Không kết luận A/B ưu việt hơn Savings.

A vẫn có vai trò khác Bank: nhận coupon từng START, bán từng phần khi cần, chuyển giao phần quyền coupon cùng khoản bán; Bank rút bắt buộc toàn lot và mất lãi chưa trả. Lợi ích lựa chọn thanh khoản này không đồng nghĩa lợi nhuận trung bình cao hơn; Liquidity study trả giá cho phí bán sớm. Owner cần quyết định liệu educational tradeoff hiện tại đủ hấp dẫn, hoặc cần candidate mới. Không tự tăng coupon để làm Bond thắng benchmark.

CI win dùng normal approximation; CI mean và paired mean chỉ phản ánh seed sampling theo model cố định. Không bao gồm sai số mô hình, lựa chọn strategy, hành vi người thật, đổi budget/term, hạng credit hoặc tham số. Bank bắt đầu30M, Balanced15M, các nhóm Bond0: so sánh cả chính sách/vòng đời dòng tiền, không phải causal estimate riêng asset. Không có credit calibration thực, user study hoặc optimal-policy search. Cần sensitivity study và owner review trước luật chính thức.

## Replay và tái lập

`node --experimental-strip-types scripts/simulate-bond-credit.ts 2000` chạy lại study mới và chỉ ghi thư mục evidence V2.5. `node --experimental-strip-types scripts/verify-bond-credit.ts` kiểm aggregates/rows, chạy lại sample seed0 của mỗi strategy, replay toàn state bảy simulation examples và các browser exports riêng, kiểm historical logs và kích thước ảnh. Không chạy lại study nếu chỉ cần kiểm artifact.

Các file simulation coupon-delay/principal-delay/victory dùng chung một ván seed0; đó là **bảy trường hợp được gắn nhãn, không phải bảy ván độc lập**. Metadata example strategy được sửa từ seed label thành policy sau run; các financial rows/exported states không đổi. Năm browser games trong implementation report là bằng chứng riêng, không gộp vào12.000 ván tính win rate. Bộ180.000 ván Savings V2.4 giữ nguyên và không chạy lại.

**Verdict: candidate có dữ liệu kiểm chứng để owner review; chưa chứng nhận cân bằng hoặc production readiness.** Đổi coupon/probabilities/recovery sau khi freeze phải dùng rules version mới và giữ artifact/version V2.5 này để replay.

CI lịch sử V2.4 ghi **186 product tests + 21 diagnostics** trong [audit chronology](DOCUMENTATION_AUDIT.md); không phải run của V2.5. Các con số balance ở đây được kiểm local và không xác nhận GitHub Actions hoặc deployment mới.
