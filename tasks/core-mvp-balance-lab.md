# Core MVP balance lab — research only

Base: `4b0be454a8dd24bb65f00517f598f751ab333980`. Nhánh local: `codex/core-mvp-balance-lab`.
Không sửa production, artwork, lịch sử, merge, push hay deploy. Chín loại ô là ràng buộc duy nhất đã duyệt.

1. [x] A: audit engine/research cũ, tái lập 30 baseline rows và 3 historical replay; adapter bản sao engine, kiểm legality/RNG/kế toán/action replay trước khi chạy.
2. [x] B: 240 layout, 200.000 dice-only paths (10.000 mỗi N/H); tách count profiles khỏi permutations, loại 12 layout theo bộ lọc lab.
3. [x] C: benchmark 200 ván; broad 63 candidate × 8 policy × 200 seed = 100.800 ván; OFAT và tương tác chọn lọc, không full factorial.
4. [x] D: shortlist 10 × 10 policy × 1.000 seed; freeze 4 Pareto candidate rồi holdout 5.000 seed/policy = 200.000 ván. Báo matched initial conditions và hạn chế ghép seed. A chỉ là biên ngắn/khó, không đề xuất MVP với economy/goal này.
5. [x] Kết quả: báo cáo Việt ngắn + technical appendix, decision matrix, full economy/layout CSV/JSON/raw gzip, 6 chart sets PNG/SVG, manifests/hash/source/elapsed. 12 research tests, 400.800 rows recomputed, 40 action replays và 3 historical replay pass; không full product QA, production/merge/deploy giữ nguyên.

Acceptance: không gọi thời lượng điện thoại từ số roll; không chọn win-rate đích; cash-only thuần không học; novice là synthetic. Các rate CI theo từng policy; so sánh policy cùng config dùng paired seed nếu path khớp. Không tinh chỉnh sau holdout.

Các luật giữ làm baseline: settlement hiện hành (market → salary → business → maturity/coupon → living → debt → obligations); vốn Business không thanh khoản ở START; savings rút toàn lot khi funding; credit dùng RNG độc lập. Thông số giữ nguyên cũng phải nằm trong effective config snapshot.

Shortlist 10 × 10 policy × 1.000 seed = 100.000 ván đã xong. Freeze lúc 00:39:37 ngày 16/10/2026 Asia/Bangkok, trước holdout 00:40:03: A=16/H3 (biên khó), B=18/H4 learning/liquidity, C=20/H4 business access, D=20/H5. Không sửa ứng viên từ dữ liệu holdout. Mã nguồn từng phase được lưu chính xác thành bundle gzip đối chiếu hash; source SHA là checkpoint ancestor. Không full product QA trước owner chọn.
