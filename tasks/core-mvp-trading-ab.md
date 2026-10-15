# Trading policy A/B — Owner update 16/10/2026

Base `45b0c4d` đã push lên `origin/codex/core-mvp-balance-lab`. Nhánh bổ sung `codex/core-mvp-trading-ab`.
Giữ nguyên mọi file cũ, gồm source lab, Pareto config, 400.800 rows và reports. Chỉ thêm source/evidence mới; không production/merge/deploy/Final QA.

1. [ ] Test RED/GREEN adapter mới: đúng ô Stocks/Bonds/Gold, một giao dịch thành công/encounter (gồm mọi mã/lot), lỗi không mất quyền, giữ START/funding, replay.
2. [ ] Ghép B/C/D với hai quyền cũ/mới; full config hash không đổi. A không mô phỏng lại.
3. [ ] Main: 500 seed × 3 config × 2 arm × 10 strategy = 30.000 ván. Heuristic chung visible-only: reserve, take profit/cut loss, credit distress, terminal realization. Không thêm phí mua; giữ phí/spread engine bên bán.
4. [ ] Negative control: 30 seed × 3 × 2 × 10 với heuristic v1 cũ không ra lệnh bán tại ô; dự kiến kết quả phải bằng nhau. Sensitivity thresholds chỉ dùng nếu có dấu hiệu thay đổi lựa chọn; không tự mở rộng samples.
5. [ ] Metrics: proceeds/win paired 95% CI, actual buy/sell/turnover, fees/spread, realized gain/loss theo lý do, cash/reserve/funding, tail/CVaR, credit loss, strategy ranks và B/C/D ranks.
6. [ ] Freeze seeds/heuristic trước run, bundle exact source, raw gzip + CSV + báo cáo Việt ngắn, verify nguồn cũ và historical replay. Đề xuất 2–3 finalist; không chọn winner.

Mở rộng chỉ khi paired effect >3 điểm % thắng hoặc >1M proceeds có thể đổi thứ hạng/lựa chọn và sai số mẫu chưa phân biệt được. Khi đó ghi lý do, chỉ confirm những cặp liên quan trên seed mới. Đây là tiêu chí tăng mẫu, không phải win-rate mục tiêu.
