> **CURRENT** — Nghiên cứu candidate 15/10/2026; chưa phải balance được owner phê duyệt. [Nguồn sản phẩm](CURRENT_MVP.md).

# Cân bằng sinh hoạt định kỳ — 18.000 ván

Đã chạy thật **18.000 ván**: 6 cấu hình × 6 heuristic × 500 seed. Dữ liệu [tổng hợp](playtests/periodic-living-v26/balance-results.json) và sáu bộ raw gzip tách riêng; không ghi đè nghiên cứu Bond 12.000 ván hoặc savings 180.000 ván. 7M/A có tỷ lệ thắng thấp hơn nhiều luật cũ; candidate vẫn giữ 7M/A, không tự hiệu chỉnh tham số.

## Điều kiện và cách đo

Mọi cấu hình cùng vốn 50M, gửi ban đầu 20M/kỳ hạn 3, bốn vòng, mục tiêu 90M, savings C20, atomic investments, Business Customer Preferences V2.4 và Bond V2.5 frozen. Seed PERIODIC-V26-0…499, lặp đúng seed cho từng chiến lược/cấu hình. [Model](../scripts/diagnostics/periodic-living-model.ts) chỉ dùng thông tin đã thấy; giao dịch ở đúng event đã ghé, funding nguồn hợp lệ. Không nhìn RNG tương lai hoặc chọn seed theo kết quả.

Bank-first: giữ 10M, gửi 85% surplus tại Bank, kỳ hạn min(3, số START còn lại). Stocks/Gold: giữ 10M, mua tối đa 15M/ghé đúng loại, stocks chọn mã luân phiên theo turn. Bonds: giữ 10M, mua An Tâm performing tối đa 15M/ghé. Diversified: giữ 10M, financial ticket 5M, Bank 25% surplus/kỳ hạn 1, Business mua/nâng ở vòng 1/2 và bán khi ghé lại từ vòng 3. Liquidity: giữ 20M, financial ticket 5M và bán tài sản tài chính khả dụng tại START. Tất cả mua khóa học khi có quyền và đủ cash ở vòng 1/2; chọn thanh toán ngay biến cố cá nhân. Không phải tập chiến lược tối ưu hoặc phân bố người chơi thực.

[Runner](../scripts/simulate-periodic-living.ts) sao chép source sang thư mục tạm rồi thay đúng một constant/face cho biến thể nghiên cứu. Mobile không có cờ cho 5M/6M/B/C; export game playable chỉ chấp nhận config 7M/A. Manifest lưu hash byte tại lúc chạy và hash UTF-8/LF để kiểm tra được trên Windows/Linux.

Mỗi strategy/config có 500 seed và Wilson 95% cho win rate. Sáu strategy cùng seed có tương quan; khoảng tổng hợp bên dưới dùng normal approximation theo **500 seed clusters**, không coi 3.000 hàng là độc lập. Pool trọng số 1/6 chỉ để so cấu hình, không phải tỷ lệ thắng của người dùng. File JSON còn lưu pooled Wilson mô tả; không dùng khoảng đó để tuyên bố độ tin cậy tổng hợp. Các CI không bao gồm sai lệch heuristic/model.

## Kết quả tổng hợp

Đơn vị tiền: triệu VND. Mean/median là nguồn tiền hợp lệ cuối ván sau phí, nợ, nghĩa vụ; không cộng vốn Business chưa bán hay Bond claims.

| Cấu hình | Thắng | 95% theo seed cluster | Mean proceeds | Median | Insolvent | Sinh hoạt thực trả TB |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| legacy | 50.33% | 46.40%–54.27% | 90.057 | 90.191 | 0.00% | 15.820 |
| 7m-a | 5.40% | 4.18%–6.62% | 78.263 | 78.495 | 0.00% | 28.000 |
| 5m-a | 31.50% | 28.37%–34.63% | 86.427 | 86.607 | 0.00% | 20.000 |
| 6m-a | 14.40% | 12.22%–16.58% | 82.346 | 82.560 | 0.00% | 24.000 |
| 7m-b | 5.43% | 4.21%–6.65% | 78.430 | 78.713 | 0.00% | 28.000 |
| 7m-c | 4.20% | 3.12%–5.28% | 78.168 | 78.600 | 0.00% | 28.000 |

Legacy thu trung bình 15,820M khi dừng ô; 7M periodic thu đúng 28M ở tất cả ván hoàn tất. Chi phí tăng có thể lấn phần sinh lời dù bàn thêm cơ hội. Không có insolvency trong các heuristic này; zero quan sát không chứng minh không có tail risk (với 500 seed/strategy, Wilson upper hai phía khoảng 0,76%).

## Theo chiến lược và bố trí

Mỗi hàng N=500. CI Wilson 95%; không diễn giải thứ hạng gần nhau là khác biệt chắc chắn.

| Cấu hình | Chiến lược | Thắng | Wilson 95% | Mean proceeds | Median |
| --- | --- | ---: | --- | ---: | ---: |
| legacy | bank-first | 55.80% | 51.42%–60.09% | 91.737 | 92.119 |
| legacy | stocks | 51.40% | 47.03%–55.75% | 90.916 | 90.775 |
| legacy | gold | 48.20% | 43.85%–52.58% | 89.132 | 89.462 |
| legacy | bonds | 48.80% | 44.44%–53.17% | 89.412 | 89.576 |
| legacy | diversified | 53.20% | 48.82%–57.53% | 90.790 | 91.416 |
| legacy | liquidity | 44.60% | 40.30%–48.98% | 88.355 | 88.639 |
| 7m-a | bank-first | 5.20% | 3.57%–7.51% | 79.460 | 79.643 |
| 7m-a | stocks | 14.80% | 11.96%–18.18% | 79.793 | 79.527 |
| 7m-a | gold | 3.20% | 1.98%–5.13% | 77.378 | 77.405 |
| 7m-a | bonds | 1.60% | 0.81%–3.13% | 77.401 | 77.938 |
| 7m-a | diversified | 6.40% | 4.57%–8.90% | 79.200 | 79.568 |
| 7m-a | liquidity | 1.20% | 0.55%–2.59% | 76.347 | 76.782 |
| 5m-a | bank-first | 39.00% | 34.82%–43.34% | 87.811 | 87.981 |
| 5m-a | stocks | 40.40% | 36.19%–44.76% | 88.040 | 87.665 |
| 5m-a | gold | 28.60% | 24.81%–32.71% | 85.497 | 85.279 |
| 5m-a | bonds | 25.80% | 22.16%–29.81% | 85.477 | 86.108 |
| 5m-a | diversified | 36.40% | 32.30%–40.71% | 87.384 | 87.625 |
| 5m-a | liquidity | 18.80% | 15.62%–22.46% | 84.356 | 84.707 |
| 6m-a | bank-first | 16.60% | 13.60%–20.11% | 83.635 | 83.766 |
| 6m-a | stocks | 25.80% | 22.16%–29.81% | 83.919 | 83.601 |
| 6m-a | gold | 12.20% | 9.62%–15.36% | 81.438 | 81.307 |
| 6m-a | bonds | 9.00% | 6.79%–11.83% | 81.440 | 82.030 |
| 6m-a | diversified | 18.20% | 15.06%–21.82% | 83.292 | 83.554 |
| 6m-a | liquidity | 4.60% | 3.08%–6.81% | 80.355 | 80.713 |
| 7m-b | bank-first | 7.80% | 5.76%–10.49% | 80.471 | 80.813 |
| 7m-b | stocks | 14.20% | 11.41%–17.53% | 79.953 | 79.843 |
| 7m-b | gold | 2.40% | 1.38%–4.15% | 77.106 | 77.167 |
| 7m-b | bonds | 1.60% | 0.81%–3.13% | 77.401 | 77.938 |
| 7m-b | diversified | 5.60% | 3.90%–7.97% | 79.283 | 79.618 |
| 7m-b | liquidity | 1.00% | 0.43%–2.32% | 76.369 | 76.821 |
| 7m-c | bank-first | 6.80% | 4.91%–9.35% | 80.436 | 80.796 |
| 7m-c | stocks | 9.00% | 6.79%–11.83% | 78.812 | 78.934 |
| 7m-c | gold | 3.40% | 2.13%–5.38% | 77.339 | 77.417 |
| 7m-c | bonds | 1.60% | 0.81%–3.13% | 77.401 | 77.938 |
| 7m-c | diversified | 3.80% | 2.45%–5.86% | 78.856 | 79.424 |
| 7m-c | liquidity | 0.60% | 0.20%–1.75% | 76.167 | 76.720 |

## Cash, funding và chi phí bất ngờ

Cash cuối là tiền mặt cuối ván; cash trong lượt là trung bình cash trước các roll, tính trong từng ván rồi lấy trung bình. Tần suất funding/vay/rút là tỷ lệ ván có ít nhất một quyết định; raw/JSON có thêm số quyết định trung bình. Emergency là tiền thực trả cho medical/repair/family, gồm funding event nếu có. Các strategy này không defer personal, nên không cần suy phân bổ từ nghĩa vụ hẹn gộp.

| Cấu hình | Cash cuối TB | Cash trong lượt TB | Emergency trả TB | Có funding sinh hoạt | Có vay | Có rút savings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| legacy | 74.700 | 30.975 | 9.002 | 1.73% | 0.00% | 3.93% |
| 7m-a | 58.712 | 26.884 | 9.002 | 0.00% | 0.00% | 0.53% |
| 5m-a | 65.755 | 28.950 | 9.002 | 0.00% | 0.00% | 0.47% |
| 6m-a | 62.218 | 27.906 | 9.002 | 0.00% | 0.00% | 0.50% |
| 7m-b | 61.071 | 27.219 | 9.002 | 0.00% | 0.00% | 0.47% |
| 7m-c | 60.974 | 27.315 | 9.002 | 0.00% | 0.00% | 0.50% |

Periodic living funding luôn 0 có lý do cấu trúc: lương ≥14M nhận trước phí 5/6/7M, Business hiện hành không âm. Các khoản nợ/nghĩa vụ đến sau. Browser/unit fixtures salary=0 chỉ kiểm nhánh phòng vệ, không phải tần suất ván thật. Vay zero ở tập này phản ánh reserve và thứ tự funding savings/assets trước debt, không kết luận vay không cần thiết trong mọi lối chơi.

## Cơ hội và đầu tư muộn

Cơ hội là encounter thực tế, không đếm ô đi ngang; không tăng số mua bằng giao dịch ngoài ô. Cuối game chỉ tính exposure còn giữ theo gross mark; không coi đó là proceeds ròng. Late = vòng 3/4; Bond face chưa đáo hạn là hợp đồng maturityLap>4, không phải cam kết được thanh toán sớm.

| Cấu hình | Stock/Bond/Gold gặp TB | Bank gặp TB | Late Stock/Bond/Gold | Giá vốn mua muộn TB | Financial exposure cuối TB | Bond face maturity>4 TB |
| --- | --- | ---: | --- | ---: | ---: | ---: |
| legacy | 2.146 / 2.420 / 2.334 | 2.204 | 1.132 / 1.126 / 1.136 | 12.726 | 15.725 | 1.722 |
| 7m-a | 3.266 / 2.420 / 3.474 | 2.204 | 1.716 / 1.126 / 1.692 | 15.468 | 20.019 | 1.719 |
| 5m-a | 3.266 / 2.420 / 3.474 | 2.204 | 1.716 / 1.126 / 1.692 | 16.281 | 21.171 | 1.720 |
| 6m-a | 3.266 / 2.420 / 3.474 | 2.204 | 1.716 / 1.126 / 1.692 | 15.900 | 20.613 | 1.720 |
| 7m-b | 3.286 / 2.420 / 2.334 | 3.324 | 1.688 / 1.126 / 1.136 | 13.901 | 17.745 | 1.718 |
| 7m-c | 2.146 / 2.420 / 3.454 | 3.344 | 1.132 / 1.126 / 1.720 | 13.980 | 17.650 | 1.720 |

A: ô 4 Stocks/15 Gold; tăng Stocks/Gold từ 2 lên 3 mặt mỗi loại, Bank giữ 2. Stocks ô 3/4 liền nhau tạo cụm sớm, không bảo đảm D6 ghé cả hai; Gold 15 thêm cơ hội giữa nhánh Business và personal 18. B: ô 4 Bank/15 Stocks, Bank và Stocks mỗi loại 3, Gold 2; thiên về savings và thêm Stock muộn. C: ô 4 Gold/15 Bank, Gold/Bank mỗi loại 3, Stocks 2; Gold sớm và Bank muộn cần chú ý kỳ hạn. Bond 7/20, personal 8/18, macro 6 và mọi mặt khác giữ nguyên. A/B win rate 7M gần như bằng nhau trong mẫu; không có bằng chứng B giải quyết độ khó.

Trong dữ liệu này, cả 3.000/3.000 đường D6 của mỗi cấu hình khớp legacy vì các encounter thay thế vẫn tiêu thụ một lần draw và thị trường luôn cập nhật cùng dải; chỉ 210/3.000 đường encounter đầy đủ khớp legacy. Cùng vị trí không có nghĩa cùng event, giao dịch, dòng tiền hoặc credit history. Không bảo đảm ghép cặp này cho code/chiến lược tương lai: thay số draw, thời điểm kết thúc hay quy trình encounter sẽ làm RNG/path rẽ nhánh.

## Owner decision matrix

| Lựa chọn | Tình trạng | Ý nghĩa | Cần owner quyết định |
| --- | --- | --- | --- |
| Sinh hoạt cố định ở START; personal riêng | Hướng sản phẩm đã duyệt | Học lập ngân sách và dự phòng hai loại chi phí | Giữ hướng đã duyệt |
| 7M/A | Playable candidate hiện tại | 5,40% thắng trong pool; nghĩa vụ 28M; nhãn artwork tạm | Có chấp nhận độ khó này cho MVP? Chưa release sign-off |
| 5M/A | Research-only | 31,50%; tổng 20M; dễ hơn rõ trong mẫu | Có muốn candidate version mới để thử người chơi? Không tự áp |
| 6M/A | Research-only | 14,40%; tổng 24M; mức giữa | Có muốn candidate version mới để thử người chơi? Không tự áp |
| 7M/B | Research-only | 5,43%; thêm Bank/Stock; CI chồng lấp A | Không đủ bằng chứng đổi khỏi A chỉ để tăng win rate |
| 7M/C | Research-only | 4,20%; thêm Gold/Bank | Cân nhắc tiếp cận tài sản và kỳ hạn; chưa duyệt |
| Artwork 4/15 | Chưa thay source asset | Nhãn tạm rõ nghĩa; cần designer handoff | Duyệt face overlay/asset mới trước polish cuối |

Khuyến nghị: giữ nhánh 7M/A để review correctness; **chưa xác nhận cân bằng phát hành**. Chọn mức độ khó mục tiêu rồi playtest người thật. Không gọi Bank-first hoặc bất cứ heuristic nào là tối ưu; không sửa mục tiêu 90M, bốn vòng, Bond hoặc Business để tăng kết quả. Chưa xác minh điện thoại thật/AI provider/Actions của nhánh mới.

## Tái lập và bảo toàn

Chỉ chạy lại khi chủ đích nghiên cứu; lệnh đầy đủ sẽ ghi lại các artifact mới này:

```sh
node --experimental-strip-types scripts/simulate-periodic-living.ts 500
node --experimental-strip-types scripts/simulate-periodic-living.ts 500 --aggregate-only
node --experimental-strip-types scripts/verify-periodic-living.ts
```

Aggregate-only đọc raw đã lưu, không chơi lại 18.000 ván. [Verification](playtests/periodic-living-v26/verification.json) kiểm lại raw aggregates, 12 spot games deterministic và replay browser. [Thiết kế](PERIODIC_LIVING_EXPENSES_DESIGN.md) giải thích version, handoff và giới hạn funding. CI lịch sử **186 product tests + 21 diagnostics** là mốc V2.4 cũ; không phải Actions HEAD của nghiên cứu này.
