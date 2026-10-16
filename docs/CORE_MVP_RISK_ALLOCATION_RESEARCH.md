# CORE MVP — Phân bổ tài chính và quản lý rủi ro

**Research only — chưa chọn winner, chưa Final QA.** Tiếp nối **45b0c4d** và **33de122**, trên nhánh **codex/core-mvp-risk-allocation**. Bảo toàn cả hai đợt cũ; không sửa production, merge hoặc deploy. M = triệu VND.

## Dữ liệu thực nghiệm

**27.800 ván mới:** audit 2.400; screening 6.600; reserve gốc 2.160; reserve biến thể 2.160; cash+course control 480; holdout 14.000. Không chạy lại 400.800 ván balance hoặc 31.800 ván trading cũ. Audit dùng 120 seed riêng/bàn; screening/control dùng 120 seed chung/strategy; holdout dùng 400 seed riêng, shortlist/policy đóng băng trước khi chạy. Thống kê có mục đích là trung bình đều 9 heuristic, tách cash và novice; **400 seed, không phải 3.600 quan sát độc lập**. Proxy tiếp xúc/menu không chứng minh việc học.

### B vs D gốc theo mục tiêu giáo dục

| Proxy — screening, 120 seed/strategy | B gốc | D gốc |
| --- | --- | --- |
| Số ô / START | 18 / 4 | 20 / 5 |
| Gặp personal ≥1 | 79.2% | 80.0% |
| Personal 0 / 1 / 2+ | 20.8% / 47.5% / 31.7% | 20.0% / 39.2% / 40.8% |
| Personal trung bình | 1.20 | 1.36 |
| Gặp Sự kiện ≥1 | 68.3% | 85.0% |
| Course sau mua (lượt/ván) | 3.30 | 5.79 |
| Bước quyết định / encounter có quyết định | 17.96 / 14.61 | 23.32 / 18.79 |
| Shock khi giữ tài sản (≥1) | 30.6% | 43.5% |
| Business mua / nâng cấp / bán (*) | 85.8% / 52.5% / 72.5% | 100.0% / 90.0% / 90.8% |
| Proceeds mean / P10 / worst10 (M) | 90.31 / 81.32 / 76.78 | 93.92 / 83.14 / 78.28 |
| Thắng, tham khảo | 54.5% | 66.0% |

(*) Hành động thực tế của strategy Business, không phải tỷ lệ chuỗi đủ cả ba bước. Audit độc lập trước thí nghiệm thấy personal vắng ở 28,3% B và 20,0% D; khác screening là biến thiên mẫu. Coverage từng loại ô, affordability→exit, shock theo tài sản và chuỗi Business có ở [learning-exposure.csv](research/risk-allocation/learning-exposure.csv), [business-capabilities.csv](research/risk-allocation/business-capabilities.csv), [audit](research/risk-allocation/PHASE1_AUDIT.md). Gặp ô không bảo đảm đủ tiền hoặc chọn đầu tư.

### Biến thể và holdout

Chỉ đổi course **ô 13 B / ô 18 D** thành personal, theo vị trí nhiều lượt ghé sau mua nhất trong audit; không đổi tiền hay ba tình huống. Screening giảm tỷ lệ không gặp personal 16,7 / 15,8 điểm % ở B/D, đủ ngưỡng mở rộng. Holdout:

| Ứng viên | Personal ≥1 | Personal 2+ | Course chết | Bước quyết định | Roll/ván | Mean M | Worst10 M | Thắng |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B-personal | 92.5% | 71.3% | 2.33 | 19.05 | 21.08 | 85.38 | 70.95 | 28.6% |
| D-personal | 98.0% | 85.0% | 4.72 | 24.68 | 29.04 | 86.74 | 69.12 | 35.1% |
| D | 83.5% | 45.8% | 6.21 | 23.28 | 29.04 | 93.19 | 78.38 | 62.9% |

D biến thể so với D gốc tăng personal và giảm khoảng 1,49 course chết/ván, nhưng mean proceeds thấp hơn **6.46M** (CI95 theo cụm seed: 6.01…6.90M cho D gốc trừ biến thể). B biến thể ngắn hơn D biến thể khoảng 8 lượt gieo; mean thấp hơn 1.36M, nhưng worst10 tốt hơn khoảng 1.83M. Đây là trade-off, không phải bảng xếp hạng giáo dục.

Trong cặp course→personal, **100% chuỗi xúc xắc/RNG/thị trường/credit khớp** ở các arms có mục đích; encounter identity chỉ khớp ở seed không ghé ô bị thay (D holdout 15%). Hai loại ô đều tiêu thụ cùng số draw ở phiên bản này. B vs D có đường đi/RNG khác hoàn toàn dù seed giống; không gọi là common-random path hay causal effect thuần số ô. Có hashes/pair flags trong JSON.

### Reserve 0 / 5 / 10 / 15M

Giữ ticket, ROI khóa học, exit, funding order và seed chung; chỉ chi đầu tư/course từ cash vượt reserve. Mục tiêu cuối ván vẫn 80M + 10M, không đổi theo reserve policy. Đây là **gói phân bổ–dự phòng**, không giữ tổng vốn đầu tư bất biến. Personal chọn chi phí tổng thấp nhất nếu cash đủ, nếu thiếu thì dùng lựa chọn hoãn có sẵn; vì vậy thiếu cash tại biến cố có thể thành premium/nghĩa vụ sau START, chưa thành funding ngay.

Trên B gốc, cả ba strategy thử không funding ở 120 seed/mức. D gốc savings-first reserve0 funding/rút savings 4,2%, reserve≥5 quan sát 0%; đa dạng hóa reserve0 0,8%. D biến thể savings-first screening có 9,2% so với 0% ở reserve5, đủ ngưỡng mở rộng chọn lọc. Holdout cùng 400 seed:

| Reserve M | Funding/rút sớm | Premium personal M | Mất lãi M | Mean M | P10 M | Worst10 M | Thắng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 4.3% | 0.71 | 0.32 | 90.42 | 78.65 | 74.24 | 55.8% |
| 5 | 0.3% | 0.09 | 0.02 | 90.40 | 79.69 | 75.28 | 55.8% |
| 10 | 0.0% | 0.00 | 0.00 | 89.54 | 79.04 | 74.93 | 52.3% |

Reserve5 so với 0: mean delta **-0.02M** (CI95 -0.18…0.14M), worst10 +1.04M; win rate bằng nhau. Không kết luận 5M tối ưu. Reserve15 chỉ ở screening, không mở rộng mọi mức. Bán funding, vay và phá sản bằng 0 ở các reserve arms; **0 quan sát không có nghĩa không thể xảy ra**. [Toàn bộ 0/5/10/15M, ba strategy, bốn bàn](research/risk-allocation/reserve-all.csv).

### Phân bổ và rủi ro

Holdout D biến thể: savings-first mean/median/P10/worst10 = **89,54 / 90,22 / 79,04 / 74,93M**, thắng 52,3%; diversified = **92,31 / 91,93 / 76,43 / 71,46M**, thắng 57,0%; risk-aware = **92,26 / 92,11 / 76,69 / 71,36M**, thắng 57,8%. Đa dạng hóa/Business có mean cao hơn nhưng savings có tail tốt hơn; không chiến lược nào thắng mọi tiêu chí.

Gold trả phí+spread trung bình 1,78M/ván ở D biến thể, stocks 0,44M; bond B mất credit trung bình 0,93M, worst10 63,13M so với bond A 67,76M. Đây là kết quả heuristic thoát lệnh/ticket hiện tại, không phải kết luận tài sản ngoài đời. Risk-aware có phí thấp hơn diversified nhưng không cải thiện rõ tail. Cash thuần không mua course; control cash+course ở screening B/D gốc tăng win từ 0% lên 42,5% và proceeds +6,67/+8,35M. Vì vậy không quy toàn bộ chênh với cash cho đầu tư tài chính.

Drawdown thô / đã loại sinh hoạt (mean): B biến thể **13.99 / 11.20M**; D biến thể **15.06 / 10.41M**. Bản điều chỉnh vẫn chứa course, personal, phí, credit và giảm giá trị thu hồi Business. Locked capital tách savings, Business chưa bán và bond không bán được; không cộng Business chưa bán vào proceeds. Bảng đủ 11 strategy, mean/median/P10/worst10, costs, drawdown, vốn khóa, actual trades và sources: [allocation-details.csv](research/risk-allocation/allocation-details.csv), [phụ lục](research/risk-allocation/ALLOCATION_APPENDIX.md).

### Economy chung

D dùng bộ economy B (giữ 20 ô/5 START) có mean 106.47M, so với B gốc 90.31M. Riêng đổi economy trên cùng bàn D tăng 12.55M (CI95 12.38…12.71M). Lương, coupon, drift, spread, goal không được tinh chỉnh; đây là đối chiếu sao chép economy đã có, gồm living và course. Khác số START/đường đi vẫn còn; không quy chênh còn lại cho số ô. Bộ economy chung chỉ là control, không đưa thành ứng viên mới.

## Giả thuyết cần người thật kiểm tra

Nhiều personal hơn có thể giúp giải thích reserve, nhưng ở reserve10 tất cả heuristic có mục đích holdout vẫn không funding/vay/phá sản. Người chơi có thể học “trả hóa đơn” mà chưa hiểu thiếu thanh khoản. Salary trước living, ticket giới hạn và quyền hoãn trả giảm áp lực tiền mặt. Savings hấp dẫn và course tăng lương có thể lấn át bài học phân bổ. Business tạo nhiều cơ hội ở D nhưng kéo dài ván và khóa vốn. Novice synthetic có funding 8,3% B biến thể / 28,5% D biến thể, bán funding 1,0% / 4,5%, không vay/phá sản; đây là noise tổng hợp, chưa đại diện người mới.

## Khuyến nghị để Owner duyệt playtest

- **B biến thể:** ứng viên ngắn hơn, ít course chết, tail tốt hơn D biến thể trong holdout; ít cơ hội Business/market hơn và còn 7,5% không personal.
- **D biến thể:** tiếp xúc personal/Business/market nhiều hơn, cần xem tải đọc và mức mất tiền có giải thích được; tail kém hơn B biến thể.
- **D gốc:** đối chứng ít áp lực chi phí, thuận tiện kiểm tra liệu thêm personal thật sự cải thiện hiểu biết; còn 16,5% không personal và nhiều course chết.

Chưa chọn winner. Không thay economy để làm kết quả đẹp. [Protocol playtest](research/risk-allocation/HUMAN_PLAYTEST.md) đo phút thật, giải thích phân bổ/reserve/price/spread/fee/credit/liquidity và hậu quả thắng/thua, có pre/post/vignette; không dùng win rate làm điểm kiến thức. C không cần dùng thêm vì các control B/D đã trả lời câu hỏi; A ngoài phạm vi.

Phương pháp, giới hạn, nguồn tái lập: [README](research/risk-allocation/README.md), manifests/source bundles/raw/replays trong thư mục nghiên cứu. CI là nominal/exploratory, không hiệu chỉnh toàn bộ phép thử; seed là cụm khi gộp heuristic. Các định nghĩa menu và locked-time proxy có giới hạn; chưa đo hành vi/học tập hay phút chơi. Chỉ sửa một lỗi ghép cặp của **phân tích** trước khi đọc holdout (reserve jobs chỉ có savings); simulator/config/policy frozen không đổi. Kiểm chứng cuối được ghi trong verification.json và artifact-manifest.json; đây là kiểm thử nghiên cứu, không Final QA.
