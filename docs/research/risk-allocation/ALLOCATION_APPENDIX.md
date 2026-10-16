# Phụ lục allocation — holdout

M = triệu VND. 400 seed/strategy; quantile và worst10 tính riêng strategy, không gộp độc lập. Locked-time là proxy principal định nghĩa trong README; Business cuối là marked value không thuộc proceeds. Fees/spread là giao dịch thực trả.

## B-personal

| Strategy | Mean | Median | P10 | Worst10 | Win | DD thô | DD trừ living | Fees | Spread | Locked time | Biz khóa cuối |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cash | 77.15 | 77.00 | 70.00 | 67.78 | 0.0% | 9.53 | 5.04 | 0.00 | 0.00 | 0.00 | 0.00 |
| savings | 88.73 | 89.31 | 79.75 | 76.14 | 45.5% | 12.46 | 9.33 | 0.00 | 0.00 | 23.34 | 0.00 |
| stocks | 85.38 | 85.43 | 74.26 | 71.47 | 27.8% | 12.95 | 10.15 | 0.35 | 0.00 | 0.00 | 0.00 |
| gold | 83.98 | 84.11 | 75.08 | 71.59 | 20.5% | 12.69 | 9.94 | 0.34 | 1.05 | 0.00 | 0.00 |
| bond-a | 84.01 | 84.78 | 75.00 | 72.16 | 19.0% | 13.16 | 10.31 | 0.19 | 0.00 | 0.09 | 0.00 |
| bond-b | 82.96 | 83.68 | 71.88 | 66.02 | 21.5% | 15.20 | 12.16 | 0.15 | 0.00 | 0.17 | 0.00 |
| business | 85.36 | 86.00 | 73.80 | 69.13 | 29.8% | 16.00 | 13.57 | 0.00 | 0.00 | 10.70 | 2.65 |
| diversified | 86.81 | 87.47 | 75.03 | 71.41 | 36.5% | 15.40 | 12.72 | 0.29 | 0.34 | 12.17 | 2.42 |
| liquidity | 84.37 | 84.46 | 75.60 | 72.86 | 21.0% | 12.63 | 9.88 | 0.38 | 0.36 | 2.99 | 0.00 |
| risk-aware | 86.79 | 87.48 | 75.47 | 71.26 | 35.8% | 15.45 | 12.76 | 0.21 | 0.33 | 12.28 | 2.38 |
| novice | 74.13 | 74.27 | 58.33 | 54.04 | 9.3% | 17.14 | 13.50 | 0.42 | 0.44 | 17.17 | 9.51 |

## D-personal

| Strategy | Mean | Median | P10 | Worst10 | Win | DD thô | DD trừ living | Fees | Spread | Locked time | Biz khóa cuối |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cash | 73.11 | 73.00 | 65.00 | 61.50 | 0.0% | 12.30 | 5.71 | 0.00 | 0.00 | 0.00 | 0.00 |
| savings | 89.54 | 90.22 | 79.04 | 74.93 | 52.3% | 13.21 | 8.32 | 0.00 | 0.00 | 29.03 | 0.00 |
| stocks | 84.29 | 84.27 | 72.82 | 68.81 | 28.0% | 14.13 | 9.13 | 0.44 | 0.00 | 0.00 | 0.00 |
| gold | 82.69 | 82.93 | 73.22 | 69.47 | 17.0% | 13.81 | 8.74 | 0.43 | 1.34 | 0.00 | 0.00 |
| bond-a | 82.68 | 83.61 | 72.69 | 67.76 | 14.2% | 14.09 | 9.20 | 0.20 | 0.00 | 0.08 | 0.00 |
| bond-b | 81.91 | 82.40 | 68.15 | 63.13 | 21.3% | 16.00 | 10.92 | 0.18 | 0.00 | 0.12 | 0.00 |
| business | 91.93 | 91.50 | 76.01 | 70.66 | 55.8% | 17.30 | 13.65 | 0.00 | 0.00 | 15.68 | 1.89 |
| diversified | 92.31 | 91.93 | 76.43 | 71.46 | 57.0% | 16.66 | 12.45 | 0.36 | 0.45 | 16.70 | 1.45 |
| liquidity | 83.02 | 83.82 | 73.85 | 69.98 | 12.3% | 13.63 | 8.74 | 0.47 | 0.44 | 4.94 | 0.00 |
| risk-aware | 92.26 | 92.11 | 76.69 | 71.36 | 57.8% | 16.73 | 12.53 | 0.28 | 0.44 | 17.03 | 1.50 |
| novice | 71.04 | 71.79 | 51.89 | 44.91 | 4.5% | 20.00 | 13.92 | 0.51 | 0.56 | 20.40 | 9.52 |

## D

| Strategy | Mean | Median | P10 | Worst10 | Win | DD thô | DD trừ living | Fees | Spread | Locked time | Biz khóa cuối |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cash | 79.14 | 80.00 | 74.00 | 71.40 | 0.0% | 10.29 | 3.65 | 0.00 | 0.00 | 0.00 | 0.00 |
| savings | 96.32 | 96.60 | 88.02 | 84.86 | 85.8% | 11.22 | 6.93 | 0.00 | 0.00 | 30.37 | 0.00 |
| stocks | 90.73 | 90.24 | 80.47 | 77.39 | 52.3% | 12.23 | 7.75 | 0.44 | 0.00 | 0.00 | 0.00 |
| gold | 89.05 | 89.08 | 81.60 | 79.23 | 43.0% | 11.80 | 7.35 | 0.44 | 1.35 | 0.00 | 0.00 |
| bond-a | 89.05 | 89.85 | 81.29 | 77.46 | 49.5% | 12.15 | 7.88 | 0.20 | 0.00 | 0.08 | 0.00 |
| bond-b | 88.29 | 89.00 | 77.44 | 72.63 | 46.8% | 14.17 | 9.54 | 0.18 | 0.00 | 0.12 | 0.00 |
| business | 98.30 | 97.12 | 85.41 | 80.15 | 77.3% | 15.80 | 12.61 | 0.00 | 0.00 | 15.68 | 1.88 |
| diversified | 98.79 | 97.37 | 85.48 | 80.84 | 80.5% | 15.19 | 11.26 | 0.36 | 0.45 | 17.25 | 1.49 |
| liquidity | 89.46 | 89.91 | 83.43 | 80.20 | 49.8% | 11.55 | 7.36 | 0.47 | 0.44 | 5.28 | 0.00 |
| risk-aware | 98.76 | 97.25 | 85.28 | 80.94 | 81.0% | 15.29 | 11.33 | 0.28 | 0.45 | 17.54 | 1.51 |
| novice | 78.49 | 78.94 | 60.95 | 53.96 | 20.8% | 18.38 | 12.59 | 0.52 | 0.56 | 21.87 | 10.07 |

## Policy và giới hạn

Focused asset: ticket15M; diversified/liquidity/risk-aware ticket5M. Reserve mặc định10M, liquidity20M, novice0. Course chỉ mua khi cash sau mua không dưới reserve và còn START đủ hoàn vốn; cash thuần không course. Savings-first gửi85% budget với kỳ hạn min(3, START còn lại). Liquidity gửi30% budget kỳ hạn1, bán financial mỗi START. Diversified gửi25% budget kỳ hạn1, thêm financial và Business theo encounter. Risk-aware thêm cap25% marked wealth mỗi tài sản tài chính, stock ít volatility nhất, nửa ticket khi uncertain, không mua bond stressed hoặc còn<2 START. Business còn≥3 START mới mở/nâng cấp, bán tại Business khi còn≤2 START. Không biết trước D6/giá/sự kiện.

Exit financial chung: thiếu reserve, ngưỡng take-profit/stop-loss net/basis, credit distress, hoặc START cuối; một giao dịch tile thành công. Funding chung savings→stocks→bonds→gold→debt, rút cả lot. Vì thứ tự ưu tiên này, savings thường hấp thụ thiếu hụt trước khi phải bán/vay. Novice dùng noise counter-based và menu giả định; không được coi là khảo sát người mới.

Trade-off với savings không giữ giống kỳ hạn, số lệnh hay exposure; chính đó là nội dung policy cần so sánh, chưa phải return attribution thuần. Không ép diversified thắng hoặc đổi coupon/living để tạo bài học. Course control, economy control, reserve full và exposure xem CSV/JSON riêng.
