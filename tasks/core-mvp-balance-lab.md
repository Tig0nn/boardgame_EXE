# Core MVP balance lab — research only

Base: `4b0be454a8dd24bb65f00517f598f751ab333980`. Nhánh local: `codex/core-mvp-balance-lab`.
Không sửa production, artwork, lịch sử, merge, push hay deploy. Chín loại ô là ràng buộc duy nhất đã duyệt.

1. [ ] A: audit engine/research cũ, tái lập baseline cùng source; adapter bản sao engine, kiểm legality/RNG/kế toán/replay trước khi chạy.
2. [ ] B: dice screening N=16/18/20/22/24, H=3/4/5/6; tách count profiles khỏi permutations, lọc coverage và khả năng quay lại Business.
3. [ ] C: benchmark tốc độ, broad khoảng 50 candidate × 8 policy × 200 seed; OFAT và tương tác chọn lọc, không full factorial.
4. [ ] D: shortlist 8–12 × 10 policy × 1.000 seed; freeze 3–5 Pareto candidate rồi holdout 5.000 seed/policy. Báo matched initial conditions và hạn chế ghép seed.
5. [ ] Kết quả: báo cáo Việt, decision matrix, bảng economy/layout, CSV/JSON/raw gzip, charts, manifests/hash/source/elapsed; kiểm research và historical replay, không full product QA.

Acceptance: không gọi thời lượng điện thoại từ số roll; không chọn win-rate đích; cash-only thuần không học; novice là synthetic. Các rate CI theo từng policy; so sánh policy cùng config dùng paired seed nếu path khớp. Không tinh chỉnh sau holdout.

Các luật giữ làm baseline: settlement hiện hành (market → salary → business → maturity/coupon → living → debt → obligations); vốn Business không thanh khoản ở START; savings rút toàn lot khi funding; credit dùng RNG độc lập. Thông số giữ nguyên cũng phải nằm trong effective config snapshot.
