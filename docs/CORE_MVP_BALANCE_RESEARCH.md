# Core Game MVP — nghiên cứu cấu hình và cân bằng

**Research only — 16/10/2026 (Asia/Bangkok). Chưa phê duyệt cấu hình, chưa sửa production, merge, push hay deploy.**

Có 4 phương án đã được khóa từ dữ liệu shortlist trước holdout. Đây là tập lựa chọn Pareto của model synthetic, không phải kết luận tối ưu tuyệt đối. Holdout có 200,000 ván mới; kết quả không được dùng để sửa thông số hay thay ứng viên. Thời lượng thực, mức hấp dẫn, khả năng học và độ khó phù hợp vẫn cần owner và playtest người thật.

## Bảng quyết định nhanh

| PA | Bàn / START | Rolls TB [P10–P90] | Quyết định TB* | Median proceeds dải policy (M) | Thắng dải policy** | Funding / khóa vốn dải | Đánh đổi để owner chọn |
|---|---|---|---|---|---|---|---|
| A | 16 ô / 3 START | 14.2 [12–17] | 10.0–12.0 | 69.16–74.12 | 0.0%–1.6% | 0.0%–2.3% / 0.0%–41.0% | Biên ngắn/khó: đa số policy gần như không đạt đích; chưa phù hợp MVP với economy/goal này |
| B | 18 ô / 4 START | 21.0 [18–24] | 13.6–18.2 | 89.48–95.95 | 45.2%–85.2% | 0.0%–1.1% / 0.0%–43.0% | Sinh hoạt 5M, course 8M/+4M: tích lũy tốt hơn; cần test cảm nhận chi phí học |
| C | 20 ô / 4 START | 23.3 [20–26] | 16.7–22.3 | 78.26–89.26 | 0.0%–46.0% | 0.0%–17.6% / 0.0%–41.2% | Business 15M/4M, nhiều lần ghé: dễ mở/nâng hơn; vẫn cần thoát vốn đúng ô |
| D | 20 ô / 5 START | 29.0 [26–32] | 16.8–25.4 | 88.91–99.59 | 41.2%–87.8% | 0.0%–19.2% / 0.0%–36.0% | Nhiều cơ hội và START để tích lũy; dài hơn, Savings có lợi thế rõ |

Ghi chú: (*) proxy encounter có >1 lựa chọn khả thi và funding có >1 nguồn hợp lệ; không coi mọi modal/acknowledge là quyết định có ý nghĩa. (**) Dải tám policy có chủ đích, loại cash và novice; dải quyết định/funding/khóa vốn gồm cả mười policy. Chi tiết nằm trong báo cáo kỹ thuật và CSV. Tiền là M VND giả lập, không quy đổi thành lợi nhuận năm/tháng.

## Kết luận để chọn cấu hình

Đã chạy 240 layout dice-only, 100,800 ván broad, 100,000 ván shortlist và 200,000 ván holdout. Mỗi phương án cuối có 5.000 seed mới cho từng policy. Không sửa ứng viên sau khi xem holdout.

Lương, sinh hoạt và course là các biến nhạy trong mẫu. Thêm START tăng cơ hội học/đầu tư và thời gian tích lũy, đồng thời tăng rolls. Savings thường ổn định; Stocks có upside và rủi ro giá; Bond B đổi coupon cao lấy tail loss/default; Business cần gặp lại đúng ô để thoát vốn. Không strategy nào được chứng minh thống trị mọi seed hoặc mọi cách chơi.

A được giữ làm biên ngắn/khó của frontier, **chưa phải đề xuất MVP khả dụng với economy/goal đang thử**. B/C/D thể hiện ba hướng chọn sản phẩm khác nhau. Pareto theo năm trục không tự bảo đảm mức khó hoặc trải nghiệm đạt yêu cầu; không đổi cấu hình A sau khi xem holdout.

Cash control thuần không học/đầu tư; các phương án cuối cùng bắt đầu với cùng allocation giữa các policy. Novice là synthetic, không phải dữ liệu người dùng. Meaningful decisions và modal chỉ là proxy engine, không chứng minh học được hay chơi hấp dẫn.

Đã đối chiếu 30 dòng baseline cũ và replay 3 log lịch sử. Baseline cũ còn ô Dòng tiền và/hoặc khác luật, nên không ghép trực tiếp thành A/B cho bàn MVP mới. So sánh baseline 9 loại ô với allocation khớp, paired policy/CI và sự khác biệt RNG nằm trong báo cáo chi tiết.

## Bàn cờ và kết quả

![Thứ tự các bàn shortlisted](research/core-mvp/charts/board-orders.png)

![Win rate và tail risk](research/core-mvp/charts/win-tail-risk.png)

Toàn bộ thứ tự/số lượng ô và thông số economy từng phương án: [frozen configs](research/core-mvp/frozen-configs.json). Các biểu đồ median/P10/P90, accessibility, rolls/decisions và sensitivity nằm trong [báo cáo chi tiết](research/core-mvp/technical-report.md).

## Owner cần quyết định

| Cần chốt | Căn cứ |
|---|---|
| Chọn một bàn, thứ tự ô và số START | Pareto: độ dài, coverage, khả năng nâng/bán Business, tail risk |
| Chọn vốn/allocation, lương/sinh hoạt, goal/reserve và course | OFAT và tương tác; không có win-rate đích đã phê duyệt |
| Giữ hoặc sửa thông số savings/market/fees/credit/Business | Strategy matched conditions và CI, chưa human-test |
| Sau khi duyệt mới implementation và full QA | Cần version/replay, UI, thiết bị thật, AI provider và Vercel |

Không tự chọn winner. Thời lượng tính bằng phút, trải nghiệm trên điện thoại và mức hiểu bài học tài chính cần playtest người thật. Nhánh local `codex/core-mvp-balance-lab`; production/gameplay/artwork và deployment giữ nguyên.

Kiểm tra: 12 research tests pass; 400.800 raw rows được đối chiếu lại aggregates; 40 log mẫu nghiên cứu replay đầy đủ; 30 dòng baseline cũ tái lập chính xác và 3 historical logs replay. Seed các phase không trùng, freeze trước holdout và hash artifact đều được xác nhận. Xem [verification](research/core-mvp/verification.json).

## Dữ liệu tái lập

[CSV kết quả 10 policy](research/core-mvp/strategy-results.csv) · [CSV toàn bộ economy](research/core-mvp/economy-parameters.csv) · [CSV thứ tự ô](research/core-mvp/board-orders.csv) · [JSON so sánh + CI](research/core-mvp/final-comparison.json) · [sensitivity](research/core-mvp/sensitivity.json) · [baseline audit](research/core-mvp/baseline-audit.json) · [cách chạy, scope và toàn bộ tham số](research/core-mvp/technical-report.md). Raw gzip, seed manifest, source SHA/hash, version và elapsed theo từng phase nằm cùng thư mục.

Elapsed thực: dice 70.9s; broad 513.8s; shortlist 462.9s; holdout 1089.1s.
