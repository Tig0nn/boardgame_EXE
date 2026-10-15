# Trading policy A/B — Owner update 16/10/2026

Base `45b0c4d` đã push lên `origin/codex/core-mvp-balance-lab`. Nhánh bổ sung `codex/core-mvp-trading-ab`.
Giữ nguyên mọi file cũ, gồm source lab, Pareto config, 400.800 rows và reports. Chỉ thêm source/evidence mới; không production/merge/deploy/Final QA.

1. [x] Test RED/GREEN adapter mới: đúng ô Stocks/Bonds/Gold, một giao dịch thành công/encounter (gồm mọi mã/lot), lỗi không mất quyền, giữ START/funding, replay.
2. [x] Ghép B/C/D với hai quyền cũ/mới; full config hash không đổi. A không mô phỏng lại.
3. [x] Main: 500 seed × 3 config × 2 arm × 10 strategy = 30.000 ván. Heuristic chung visible-only: reserve, take profit/cut loss, credit distress, terminal realization. Không thêm phí mua; giữ phí/spread engine bên bán.
4. [x] Negative control: 1.800 ván heuristic v1 cũ cho kết quả giống hệt ngoài nhãn arm. Không có effect vượt gate hoặc thay rank; không mở rộng seed/sensitivity.
5. [x] Metrics: proceeds/win paired CI, actual buy/sell, fees/spread, realized gain/loss theo lý do, cash/reserve/funding, tail/CVaR, credit loss, strategy ranks và B/C/D ranks. CI win delta hậu xử lý dùng Bonferroni–Wilson discordance để tránh zero-width Wald khi không thấy flips.
6. [x] Seeds/heuristic frozen trước run, bundle exact source, raw gzip + CSV + báo cáo Việt ngắn; 31.800 rows recomputed, 60 main action replays kiểm lại, 120 worker action replays và 3 historical replays. 371 old artifacts không đổi, mọi file tracked cũ giữ nguyên. Đề xuất B/D chính, C có điều kiện; không chọn winner.

Mở rộng chỉ khi paired effect >3 điểm % thắng hoặc >1M proceeds có thể đổi thứ hạng/lựa chọn và sai số mẫu chưa phân biệt được. Khi đó ghi lý do, chỉ confirm những cặp liên quan trên seed mới. Đây là tiêu chí tăng mẫu, không phải win-rate mục tiêu.
