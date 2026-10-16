# Phase 1 — Audit trước thí nghiệm

120 seed mới/bàn × 10 heuristic; luật và policy trading hiện có không đổi. Đo tiếp xúc ≠ đo học tập.

| Proxy | B | D |
|---|---:|---:|
| Gặp personal ≥1 | 71.7% | 80.0% |
| Personal 0 / 1 / 2+ | 28.3% / 52.5% / 19.2% | 20.0% / 37.5% / 42.5% |
| Personal trung bình | 0.96 | 1.38 |
| Gặp Sự kiện ≥1 | 66.7% | 83.3% |
| Ghé course sau mua | 3.20 | 5.97 |
| Bước quyết định có ≥2 lựa chọn | 17.73 | 22.68 |
| Mở→còn ≥2 encounter Business (cơ hội đường đi) | 72.0% | 93.5% |

Khoảng trống: personal và Sự kiện không bảo đảm xuất hiện; nhiều course sau mua chỉ là xác nhận. Business cần phân biệt đường đi đủ lượt và chuỗi mua/nâng cấp/bán thực tế. Reserve 10M ở heuristic có thể làm funding hiếm; thí nghiệm reserve thấp kiểm tra thêm.

Thay đúng một course: B ô 13, D ô 18, là vị trí có nhiều lượt ghé sau mua nhất trong audit (trung bình heuristic có mục đích). Chỉ thay loại ô; giữ ba tình huống, amount, payment và funding.

Dữ liệu chi tiết: audit-analysis.json và audit/*.summary.json. Việc đổi course→personal có thể đổi số draw RNG; các thí nghiệm sẽ công bố mức khớp đường đi.
