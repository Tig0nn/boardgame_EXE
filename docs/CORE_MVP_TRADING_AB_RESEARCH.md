# Trading Policy A/B — bổ sung nghiên cứu MVP

**Research only — 16/10/2026. Nhánh gốc đã push; không merge, deploy, đổi production hoặc chạy Final QA.**

Quyền Mua/Bán/Bỏ qua tại Stocks, Bonds, Gold đã được thử trong bản sao engine nghiên cứu: một giao dịch thành công/encounter; lỗi không mất quyền; vẫn bán tại START và khi funding bắt buộc. B/C/D giữ nguyên economy, goal, layout và initial allocation từ Pareto. Personal giữ ba sự kiện/lựa chọn; Kinh tế hiển thị Sự kiện, cú sốc không đổi. A không chạy lại.

Đợt chính: **30,000 ván mới** = B/C/D × 2 quyền × 10 strategy × 500 seed. Đối chứng 1,800 ván dùng heuristic v1 cũ cho kết quả cũ/mới giống hệt ngoài nhãn arm. Toàn bộ 400.800 ván, cấu hình, source lab và báo cáo cũ được giữ nguyên; không mô phỏng lại tập đó.

## Kết quả trực tiếp

Bảng này cân bằng tám strategy có chủ đích (loại cash/novice), không phải phân bố người chơi thật. CI ghép cặp theo seed cluster; không coi tám strategy cùng seed là tám mẫu độc lập. Đơn vị tiền: triệu VND giả lập.

| PA | Win cũ → mới | Δ win điểm % [95% CI] | Proceeds TB cũ → mới | Δ proceeds [95% CI] | Mua / bán TB cũ → mới | Phí+spread TB cũ → mới |
|---|---|---|---|---|---|---|
| B | 58.88% → 58.67% | -0.20 [-0.42; 0.02] | 91.185 → 91.154 | -0.031 [-0.045; -0.016] | 2.649/1.749 → 2.653/1.765 | 0.425 → 0.428 |
| C | 12.68% → 12.57% | -0.10 [-0.22; 0.02] | 81.320 → 81.300 | -0.020 [-0.035; -0.005] | 2.631/1.765 → 2.631/1.780 | 0.423 → 0.425 |
| D | 60.98% → 60.77% | -0.20 [-0.48; 0.08] | 92.677 → 92.663 | -0.014 [-0.039; 0.010] | 3.291/2.154 → 3.294/2.177 | 0.540 → 0.543 |

Quyền bán mới không tạo cải thiện thắng/nguồn tiền đáng kể trong mẫu này. B/C giảm proceeds bình quân khoảng 20–31 nghìn, D khoảng 14 nghìn (CI D gồm 0). Thứ hạng điểm theo cả win và proceeds vẫn **D → B → C**. Đây là xếp hạng có điều kiện theo heuristic/trọng số trên mẫu, không phải kết luận D tốt hơn B về trải nghiệm hay mọi seed.

| Strategy | Δ win B / C / D (điểm %) | Δ proceeds B / C / D (triệu) | Bán tại ô TB B / C / D |
|---|---|---|---|
| cash | 0.00 / 0.00 / 0.00 | 0.000 / 0.000 / 0.000 | 0.000 / 0.000 / 0.000 |
| savings | 0.00 / 0.00 / 0.00 | 0.000 / 0.000 / 0.000 | 0.000 / 0.000 / 0.000 |
| stocks | -0.40 / 0.00 / -0.40 | -0.051 / 0.000 / -0.032 | 0.068 / 0.000 / 0.084 |
| gold | -0.20 / -0.40 / -0.80 | -0.055 / -0.078 / -0.050 | 0.056 / 0.038 / 0.030 |
| bond-a | -0.40 / 0.00 / -0.40 | -0.039 / -0.053 / -0.047 | 0.054 / 0.070 / 0.118 |
| bond-b | -0.40 / -0.20 / 0.60 | -0.041 / 0.023 / 0.066 | 0.030 / 0.058 / 0.086 |
| business | 0.00 / 0.00 / 0.00 | 0.000 / 0.000 / 0.000 | 0.000 / 0.000 / 0.000 |
| diversified | 0.20 / -0.20 / -0.20 | -0.054 / -0.040 / -0.029 | 0.180 / 0.112 / 0.248 |
| liquidity | -0.40 / 0.00 / -0.40 | -0.006 / -0.010 / -0.021 | 0.032 / 0.056 / 0.132 |
| novice | -0.40 / 0.00 / -1.80 | -0.420 / -0.448 / -0.933 | 0.504 / 0.476 / 0.672 |

CI riêng từng strategy, số mua/bán, phí và spread tách riêng, cash/funding, tail P10/worst-decile, drawdown, credit losses và realized P&L được giao trong [CSV trực tiếp](research/trading-ab/direct-comparison.csv), [CSV giao dịch theo asset](research/trading-ab/asset-trades.csv) và [JSON đầy đủ](research/trading-ab/comparison.json). Phí mua hiện bằng 0 theo engine; chỉ ghi phí/spread bán thực trả, không cộng lại phí giả định vào proceeds.

## Ý nghĩa cho MVP

- Giá chỉ đổi tại START hoặc Sự kiện: thêm quyền bán chủ yếu mở cửa phản ứng sau shock giữa vòng. C đặt Sự kiện sau cả hai ô Stocks, nên Stocks-focused C không có giao dịch bán tại ô mới; giữ layout để so đúng quyền.
- Chốt lời/cắt lỗ theo thông tin hiện tại không tạo lợi ích return nhất quán. Stocks/Gold có thể mất upside hoặc tăng churn; Bond B có vài tail/proceeds tốt hơn ở C/D nhưng chưa thay vị trí tương đối với Savings/Business. Rank strategy theo mean proceeds không đổi trong cả B/C/D.
- Novice synthetic bán tại ô ~0,48–0,67 lần/ván, cash trong lượt tăng 0,66–1,12M nhưng proceeds giảm 0,42–0,93M; có cả phí và timing/exposure, không phải toàn bộ do phí. Đây không phải hành vi người dùng thật.
- Hai arm dùng cùng ngưỡng chốt/cắt, reserve và START exit. Heuristic A/B chính có khác heuristic buy-and-hold của nghiên cứu cũ; chỉ so trực tiếp trong từng cặp mới. Đối chứng legacy xác nhận quyền mới không tự tạo tiền nếu chưa dùng.

## Ứng viên cuối và dừng ngân sách

| PA | Đề xuất cho owner | Đánh đổi còn lại |
|---|---|---|
| **B — 18 ô/4 START** | Giữ finalist chính cho trải nghiệm gọn hơn (~21 roll) | Sinh hoạt 5M, course 8M/+4M; cần playtest sức nặng học phí và ưu thế Savings |
| **D — 20 ô/5 START** | Giữ finalist chính khi ưu tiên thêm vòng tích lũy (~29 roll) | Proceeds/win cao hơn theo weighting đang dùng, nhưng dài hơn; chưa quy đổi thành phút |
| **C — 20 ô/4 START** | Giữ finalist có điều kiện nếu owner ưu tiên vòng đời Kinh doanh (~23 roll) | Gặp Business nhiều, economy khó hơn; quyền bán tại ô không khép được khoảng cách với B/D |

Không chọn winner. Quyền mới là quyết định Owner, còn cấu hình B/C/D vẫn cần chọn riêng. Không thấy effect vượt ngưỡng có khả năng đổi lựa chọn (>3 điểm % thắng hoặc >1M proceeds) ở bất kỳ cặp strategy chính nào; rank không đổi. Vì vậy **dừng ở mẫu vừa phải**, không tăng seed hay tối ưu thresholds theo kết quả. Chưa chứng minh quyền mới vô tác dụng với mọi heuristic; nếu owner muốn giao dịch thường xuyên hơn, cần một giả thuyết riêng về tín hiệu/nhịp thị trường, không tự thêm trong task này.

## Kiểm chứng và dữ liệu

Cùng config/strategy/seed: 100% dice, encounter, market và credit hash khớp giữa hai arm. Source/seed/config/raw/examples được lưu riêng; các file cũ giữ nguyên. Quy tắc một giao dịch, lỗi giữ quyền, fee/spread và action replay có kiểm thử riêng.

[Chi tiết, CI/tail, P&L theo lý do và cách tái lập](research/trading-ab/technical-report.md) · [CSV trực tiếp](research/trading-ab/direct-comparison.csv) · [CSV giao dịch từng asset](research/trading-ab/asset-trades.csv) · [JSON](research/trading-ab/comparison.json).

Elapsed: control 14.4s, main 96.6s. Nhánh gốc codex/core-mvp-balance-lab đã push tại 45b0c4d. Bổ sung trên codex/core-mvp-trading-ab; không merge/deploy/Final QA.
