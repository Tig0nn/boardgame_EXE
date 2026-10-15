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

CI riêng từng strategy, số mua/bán, phí và spread tách riêng, cash/funding, tail P10/worst-decile, drawdown, credit losses và realized P&L được giao trong [CSV trực tiếp](direct-comparison.csv), [CSV giao dịch theo asset](asset-trades.csv) và [JSON đầy đủ](comparison.json). Phí mua hiện bằng 0 theo engine; chỉ ghi phí/spread bán thực trả, không cộng lại phí giả định vào proceeds.

## Chốt lời, cắt lỗ và thanh khoản

Giá chỉ đổi tại START hoặc Sự kiện. Vì cả hai quyền đều bán được sau settlement START, lợi ích mới chủ yếu nằm ở cửa phản ứng sau cú sốc giữa vòng. B có Sự kiện ô 2; C có Sự kiện ô 17 sau Stocks ô 2/9, nên Stocks-focused C không phát sinh bán tại ô; D có Sự kiện ô 6, còn nhiều ô tài chính phía sau. Không đổi vị trí ô để làm đẹp kết quả.

Chốt lời/cắt lỗ dùng báo giá ròng sau phí, so với cost basis đang giữ: Stocks +15%/−12%, Gold +10%/−8%; Bond bán khi delayed hoặc stress≥1; ưu tiên bổ sung reserve, và tất toán tài chính có quote tại START cuối. Đây là heuristic chung của hai arm, không nhìn tương lai. Khi muốn bán tại ô, arm cũ bỏ qua và chờ START; arm mới bán rồi đóng encounter. Base buy/course/business/funding giữ cùng thuật toán. Novice là synthetic, dùng cùng nhiễu ý định theo seed/turn, không giả làm dữ liệu user.

Do đó arm cũ trong A/B chính cũng sử dụng heuristic bán tại START này; không được so nó trực tiếp với policy buy-and-hold của báo cáo 400.800 ván để suy riêng tác động quyền giao dịch. Đối chứng legacy được lưu riêng để kiểm tra đúng khác biệt đó.

| PA | Take-profit cũ → mới (lần/ván)* | Stop-loss cũ → mới | Funding cũ → mới** | Credit loss TB cũ → mới** |
|---|---|---|---|---|
| B | 0.280 → 0.289 | 0.172 → 0.184 | 0.00% → 0.00% | 0.173 → 0.173 |
| C | 0.255 → 0.256 | 0.177 → 0.182 | 0.00% → 0.00% | 0.169 → 0.165 |
| D | 0.351 → 0.354 | 0.248 → 0.263 | 0.00% → 0.00% | 0.203 → 0.196 |

(*) Tính cả START và tại ô. Realized capital P&L = tiền bán ròng − cost basis đã xóa; coupon nằm riêng trong thu nhập, không cộng hai lần. Cắt lỗ là hành động đã xảy ra, không chứng minh đã tránh được thua lỗ tương lai. (**) Bình quân tám strategy có chủ đích.

Stocks/Gold: cơ hội thoát sau shock có thể giảm một số tail loss nhưng cũng mất upside và tăng churn; không tăng sức hấp dẫn lợi nhuận một cách nhất quán. Bond B có vài trường hợp tail/proceeds tốt hơn (C/D), nhưng spread/quote discount, phí, coupon bỏ lỡ và default vẫn hiện hữu; quyền bán không cứu được claim đã default và mất quote. Savings và Business trực tiếp không đổi ở cả hai arm; Savings vẫn mạnh ở B, Diversified/Business nổi bật hơn ở C/D trong heuristic này. Bảng rank từng strategy nằm trong JSON.

Novice có bán tại ô nhiều hơn (khoảng 0,48–0,67 lần/ván), tiền mặt bình quân trước roll tăng 0,66–1,12M nhưng proceeds giảm 0,42–0,93M. Có cả phí tăng (~42–48 nghìn/ván) và thay đổi thời điểm/mức nắm giữ; không gán toàn bộ hao hụt cho phí. Mức này không phải dự báo người mới thật. Mean tiền mặt, tỷ lệ roll dưới reserve, forced sales và chi phí được giữ để phân biệt thanh khoản với giàu hơn. Các CI/tail chỉ phản ánh seed và heuristic cố định; chưa human-test mức hấp dẫn hay hiểu hậu quả.

## Ứng viên cuối và dừng ngân sách

| PA | Đề xuất cho owner | Đánh đổi còn lại |
|---|---|---|
| **B — 18 ô/4 START** | Giữ finalist chính cho trải nghiệm gọn hơn (~21 roll) | Sinh hoạt 5M, course 8M/+4M; cần playtest sức nặng học phí và ưu thế Savings |
| **D — 20 ô/5 START** | Giữ finalist chính khi ưu tiên thêm vòng tích lũy (~29 roll) | Proceeds/win cao hơn theo weighting đang dùng, nhưng dài hơn; chưa quy đổi thành phút |
| **C — 20 ô/4 START** | Giữ finalist có điều kiện nếu owner ưu tiên vòng đời Kinh doanh (~23 roll) | Gặp Business nhiều, economy khó hơn; quyền bán tại ô không khép được khoảng cách với B/D |

Không chọn winner. Quyền mới là quyết định Owner, còn cấu hình B/C/D vẫn cần chọn riêng. Không thấy effect vượt ngưỡng có khả năng đổi lựa chọn (>3 điểm % thắng hoặc >1M proceeds) ở bất kỳ cặp strategy chính nào; rank không đổi. Vì vậy **dừng ở mẫu vừa phải**, không tăng seed hay tối ưu thresholds theo kết quả. Chưa chứng minh quyền mới vô tác dụng với mọi heuristic; nếu owner muốn giao dịch thường xuyên hơn, cần một giả thuyết riêng về tín hiệu/nhịp thị trường, không tự thêm trong task này.

## Tái lập và kiểm tra

Nguồn chính xác, config hash, seed list, source SHA, Node version, raw rows và full-state examples nằm trong [manifest](main-manifest.json) và thư mục `docs/research/trading-ab`. Hai arm có 100% hash dice/encounter/market/credit khớp trên cùng config/strategy/seed. Cùng seed giữa B/C/D không bảo đảm cùng chuỗi kinh tế vì khác số ô/START.

```powershell
node --experimental-strip-types --test scripts/trading.test.mjs scripts/trading-ab-metrics.test.mjs scripts/trading-ab-inference.test.mjs
node --experimental-strip-types scripts/verify-core-mvp-trading-ab.mjs
# Reproduce new experiments without overwriting saved evidence:
$env:TRADING_AB_OUT = "docs/research/trading-ab-reproduction"
node --experimental-strip-types scripts/run.mjs control 30
node --experimental-strip-types scripts/run.mjs main 500
node --experimental-strip-types scripts/report-core-mvp-trading-ab.mjs
Remove-Item Env:TRADING_AB_OUT
```

Elapsed: control 14.4s; main 96.6s. Các run mới không sửa source/data/report cũ. Nhánh gốc codex/core-mvp-balance-lab đã push tại 45b0c4d; nhánh bổ sung codex/core-mvp-trading-ab. Không merge/deploy/Final QA.
