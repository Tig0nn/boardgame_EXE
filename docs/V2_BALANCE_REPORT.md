# Báo cáo cân bằng V2 — cấu hình THỬ NGHIỆM

## Tái hiện

Chạy `npm run simulate:v2 -- 5000`. Mỗi chiến lược dùng cùng 5000 seed `XVTL-V2-0` đến `XVTL-V2-4999`. Tổng 25000 ván cơ sở và 30000 ván độ nhạy. Toàn bộ cấu hình, phân phối nợ/thiếu hụt và tần suất từng ô nằm trong [v2-results.json](simulations/v2-results.json). Không chỉnh config gameplay theo kết quả mô phỏng. Đây là mẫu chưa hiệu chỉnh, không phải bằng chứng cân bằng cuối cùng.

## Chính sách chiến lược

- Tất cả giữ dự phòng tiền mặt 10M trước khi mua; trả chi phí ngay theo lựa chọn đầu tiên, không chọn trì hoãn để tăng thắng. Funding lần lượt rút toàn khoản gửi, bán tài sản tài chính, rồi vay trong hạn mức.
- cash-heavy: không đầu tư, không học; đo chiến lược chỉ lương và giữ Cash.
- saving-heavy: gửi đầu ván 40M kỳ hạn 3; tại Ngân hàng gửi 85% tiền vượt dự phòng với kỳ hạn không vượt cuối màn.
- stock-heavy: mua tối đa 25M mỗi lần gặp cổ phiếu, chọn mã theo lượt modulo 6 (không nhìn tương lai).
- business-heavy: mua cơ sở và tối đa một tầng mỗi lần gặp trong vòng 1/2; bán khi gặp ô kinh doanh vòng 3.
- diversified: đầu ván gửi 15M kỳ hạn 1; mua cổ phiếu tối đa 5M, trái phiếu 5M, vàng 3M, gửi 25% tiền vượt dự phòng và kinh doanh khi đủ vốn.
- Trừ cash-heavy, học khi đủ Cash trong vòng 1/2. Không mua tại START. Nếu không gặp ô mục tiêu thì không ép mua. Các chính sách là heuristic nhất quán, không phải chiến lược tối ưu.

## Phân phối nguồn tiền huy động

Đơn vị triệu đồng; đã trừ phí/spread/nợ/nghĩa vụ, không tính kinh doanh chưa bán. Thiếu = max(0,90M − nguồn huy động).

| Chiến lược | Thắng | p10 | Median | p90 | Median thiếu | Còn nợ | Mua khóa học |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cash-heavy | 119/5000 (2.38%) | 61.50 | 74.00 | 85.00 | 16.00 | 0.00% | 0.00% |
| saving-heavy | 1395/5000 (27.90%) | 65.89 | 83.22 | 96.72 | 6.76 | 0.00% | 65.44% |
| stock-heavy | 776/5000 (15.52%) | 62.40 | 77.54 | 93.75 | 12.45 | 0.00% | 71.84% |
| business-heavy | 307/5000 (6.14%) | 55.30 | 70.95 | 87.00 | 19.04 | 0.00% | 72.80% |
| diversified | 424/5000 (8.48%) | 59.93 | 75.03 | 89.27 | 14.96 | 0.00% | 72.46% |

## Khả năng tiếp cận kinh doanh

| Chiến lược | Lần gặp TB | Không gặp | Gặp >=2 lần | Đã mua | Đã nâng cấp | Đã bán | Còn vốn khóa cuối |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cash-heavy | 1.710 | 12.54% | 55.52% | 0.00% | 0.00% | 0.00% | 0.00% |
| saving-heavy | 1.710 | 12.54% | 55.52% | 0.00% | 0.00% | 0.00% | 0.00% |
| stock-heavy | 1.710 | 12.54% | 55.52% | 0.00% | 0.00% | 0.00% | 0.00% |
| business-heavy | 1.710 | 12.54% | 55.52% | 75.20% | 32.16% | 37.08% | 38.12% |
| diversified | 1.710 | 12.54% | 55.52% | 50.94% | 10.20% | 24.98% | 25.96% |

Các tỷ lệ mua/nâng/bán tính trên toàn bộ seed, không chỉ người mua. Gặp lại tính trong toàn màn; số liệu JSON có số tầng nâng cấp trung bình. Quyền tiếp cận chịu xúc xắc, nên chiến lược ưu tiên một ô có thể không mua được hoặc không bán lại đúng hạn.

## Thiếu tiền và sự kiện

| Chiến lược | Lần thiếu tổng | Thiếu TB/seed (M) | Sinh hoạt TB / p90 | Macro TB / p90 | Hoàn tất / mất thanh toán |
| --- | --- | --- | --- | --- | --- |
| cash-heavy | 0 | 0.00 | 1.646 / 3 | 1.736 / 3 | 5000 / 0 |
| saving-heavy | 1878 | 0.95 | 1.646 / 3 | 1.736 / 3 | 5000 / 0 |
| stock-heavy | 301 | 0.13 | 1.646 / 3 | 1.736 / 3 | 5000 / 0 |
| business-heavy | 0 | 0.00 | 1.646 / 3 | 1.736 / 3 | 5000 / 0 |
| diversified | 38 | 0.01 | 1.646 / 3 | 1.736 / 3 | 5000 / 0 |

Tần suất từng loại ô, số roll trung bình, nợ p10/median/p90 và số tiền thiếu nằm trong JSON. Cả 25.000 ván cơ sở hoàn tất, không còn nợ; chưa xuất hiện insolvency tự nhiên với các chính sách dự phòng này. Nhánh insolvency và vay cuối màn được kiểm tra bằng test tình huống thiếu tiền, không suy ra rằng chúng đã xuất hiện trong mô phỏng cơ sở. Macro có thể tích lũy nhiều lần trong vòng; không bị áp lại tại START.

## Tần suất dừng từng ô

Đường đi giống nhau giữa năm chiến lược với các seed chung; bảng dùng cash-heavy. START đếm đúng đích bằng 0, còn số lần đi qua checkpoint được ghi bằng summaries. Bỏ đích vượt START ở lần hoàn tất vòng cuối vì luật không xử lý đích này.

| Ô | Nhãn | Số lần dừng TB/seed | Không dừng trong màn |
| --- | --- | --- | --- |
| 1 | Xuất phát | 0.870 | 35.58% |
| 2 | Ngân hàng | 0.729 | 43.34% |
| 3 | Cổ phiếu | 0.753 | 41.58% |
| 4 | Sinh hoạt | 0.783 | 40.28% |
| 5 | Đầu tư bản thân | 0.827 | 37.64% |
| 6 | Kinh tế | 0.908 | 33.98% |
| 7 | Trái phiếu | 0.953 | 31.46% |
| 8 | Biến cố cá nhân | 0.805 | 39.34% |
| 9 | Kinh doanh | 0.841 | 37.40% |
| 10 | Vàng | 0.846 | 37.00% |
| 11 | Dòng tiền | 0.873 | 35.76% |
| 12 | Cổ phiếu | 0.877 | 35.46% |
| 13 | Ngân hàng | 0.864 | 36.16% |
| 14 | Kinh tế | 0.827 | 37.80% |
| 15 | Sinh hoạt | 0.863 | 35.78% |
| 16 | Kinh doanh | 0.868 | 36.00% |
| 17 | Đầu tư bản thân | 0.854 | 36.94% |
| 18 | Biến cố cá nhân | 0.848 | 36.30% |
| 19 | Vàng | 0.869 | 35.60% |
| 20 | Trái phiếu | 0.847 | 37.10% |

## Độ nhạy kinh doanh (cùng seed)

| Biến thể riêng trong mô phỏng | Chiến lược | Thắng | Median huy động (M) | p10 / p90 (M) |
| --- | --- | --- | --- | --- |
| business-income-half | business-heavy | 3.64% | 68.53 | 51.15 / 84.57 |
| business-income-half | diversified | 7.06% | 73.74 | 57.39 / 88.36 |
| business-upgrade-cost-8M | business-heavy | 5.58% | 70.14 | 53.95 / 86.36 |
| business-upgrade-cost-8M | diversified | 8.30% | 74.86 | 59.63 / 89.08 |
| business-recovery-40pct | business-heavy | 1.54% | 68.35 | 54.05 / 81.43 |
| business-recovery-40pct | diversified | 4.92% | 73.08 | 58.83 / 86.80 |

Giá vốn cơ sở 20M, dòng tiền nền 3M × hệ số xu hướng: hoàn vốn dòng tiền đơn giản khoảng 5,33–8,89 START, vượt màn 3 vòng. Tầng 5M tăng 0,7M bền vững +1M khi khớp xu hướng: hoàn vốn phần tăng 2,94 kỳ nếu luôn khớp, 7,14 kỳ nếu không khớp; chưa tính vốn thu hồi và kinh tế. Biến thể giảm thu nhập một nửa kéo dài hoàn vốn, tăng giá nâng cấp lên 8M làm rủi ro khóa vốn rõ hơn. Giá thu hồi cơ sở 70%, nâng cấp 50%, khấu hao 8%/START và thay đổi kinh tế là giả định mẫu, không mặc định hoàn đủ vốn.

## Rủi ro và đề xuất cần đội chốt

- Mục tiêu 90M so với 50M + 42M lương để lại biên 2M trước chi phí; chiến lược chỉ tiền mặt chỉ thắng ở đường đi ít chi phí. So sánh tỷ lệ cash-heavy ở trên để đánh giá có quá dễ hay không; không ngầm phạt giữ Cash.
- Với snapshot này, cash-heavy chỉ thắng 2,38%, còn saving-heavy cao nhất trong năm heuristic ở 27,90%; mục tiêu có thể đạt nhưng không dễ. Không suy ra chiến lược tiết kiệm là tối ưu trên mọi seed. Kinh doanh-heavy mua được 75,20% nhưng 38,12% toàn bộ seed vẫn khóa vốn cuối màn: khoảng 50,69% số ván đã mua không bán lại trong vòng 3. Đây là rủi ro tiếp cận đáng kể.
- Khoảng p10–p90 và tỷ lệ không gặp/gặp lại ô cho thấy ảnh hưởng đường đi và thị trường. Chưa tách phương sai nhân quả từng nguồn RNG; không tuyên bố đã loại trừ luck dominance.
- Kinh doanh hoàn vốn dài, bán phụ thuộc ô và vốn chưa bán không giúp thắng. Cân nhắc thay số ô kinh doanh hoặc giá thu hồi/thu nhập, thử riêng từng tham số và chạy lại cùng seed trước khi chốt.
- Tần suất và tích lũy cú sốc cần playtest; cân nhắc giảm biên độ shock nếu p10 quá thấp. Không giới hạn hay điều chỉnh sự kiện theo tài sản người chơi.
- Trái phiếu coupon 5%/vòng, kỳ hạn 2; giá bán có rủi ro tín dụng nhưng bản mẫu chưa có vỡ nợ ngẫu nhiên. Tiết kiệm dùng lãi đơn 6/7/8% theo kỳ hạn 1/2/3; cần xác nhận mức mẫu có áp đảo đầu tư rủi ro không.
- Các số là kết quả mô phỏng heuristic với một snapshot, không phải chứng minh chiến lược tối ưu hay tỷ lệ thắng mục tiêu. Cần playtest người thật và phê duyệt tham số trước phát hành.
