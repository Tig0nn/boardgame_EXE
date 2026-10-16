# Core MVP B18 — nghiên cứu nhiều khóa học

**Đề xuất chính:** 2 khóa **độc lập**: **6M/+2M** và **10M/+4M**, giữ **3 ô học tại 5/8/13**, đổi ô 16 thành **Trái phiếu** (I2-choice/L3-bonds). **Dự phòng:** 3 cấp tuần tự, mỗi cấp **8M/+3M**, giữ 4 ô học gốc (S3-flat/L4-original). Đây là đề xuất để Owner review, chưa triển khai.

**Giới hạn quan trọng:** cả hai cải thiện cơ hội cân nhắc học, nhưng Savings + Course vẫn mạnh nhất trong tập heuristic và thiếu tiền quá hiếm để chứng minh bài học dự phòng. Chưa có phương án được chứng minh thỏa trọn vẹn mọi mục tiêu giáo dục. Không gọi đây là tối ưu toàn cục hoặc bằng chứng người chơi đã học.

## Nguồn và thiết kế thực nghiệm

Base **00e77a19691c109e8cb7079b83591463c3eb6136**, nhánh B18 đã push trước nghiên cứu. Nhánh nghiên cứu **codex/mvp-b18-course-balance-lab**; policy/kế toán tài sản tái dùng từ **d04b8ad** trong bản sao tạm. Production engine/UI và replay lịch sử không sửa. 18 ô/4 START, 50M vốn, 14M lương, 5M sinh hoạt, 90M mục tiêu, tài sản/phí/credit/market/Business/personal/funding giữ nguyên.

**167.972 ván:** screening 53.312 (14 hệ ×7 bàn +3 hệ đối chứng cùng tổng economics); shortlist 50.148 (6 thiết kế triển vọng +baseline theo layout và đối chứng 2/3/4 khóa); holdout 64.512 (3 ứng viên +3 baseline ×448 seed ×24 policy). Holdout lock commit **ce24f64**, trước mọi lần chạy holdout; không tinh chỉnh sau kết quả. Seed các phase rời nhau; paired cùng seed/policy khi so curriculum, đồng thời kiểm tra RNG/path khi đổi bàn. Không full-grid khổng lồ, không chạy lại nghiên cứu400.800 ván.

Tất cả setup thí nghiệm 0M savings/term3; không phải luật ép người chơi. 14/21/24 heuristic theo phase gồm không học, học sớm, học tất cả, ROI theo START còn lại, reserve 0/5/10/15, savings, Stocks, Gold, Bonds AA/B, Business, diversified, risk-aware và novice synthetic. Điều kiện ngoài khóa học giữ cùng nhau trong từng cặp. [Phương pháp/định nghĩa/tái lập](research/multi-course/README.md), [kiểm chứng](research/multi-course/verification.json).

## Tất cả phương án

Mỗi cặp dưới là **học phí/tăng lương mỗi START**, đơn vịM. Phạm vi6–12M/1–4M là screening, không phải thông số Owner đã chốt. Rationale từng hệ lưu trong config; các hệ rich/costly/never-payback là đối chứng để nhận diện cực đoan, không mặc định là thiết kế tốt.

| Hệ | Mở khóa | Các khóa: cost/boost(M) | START để hoàn vốn từng khóa |
|---|---|---|---|
| A-baseline | Tuần tự | 8.00/4.00 | 2 |
| S2-rich | Tuần tự | 6.00/4.00; 6.00/3.00 | 2/2 |
| S2-extension | Tuần tự | 8.00/4.00; 10.00/2.00 | 2/5 |
| S2-even | Tuần tự | 8.00/3.00; 10.00/3.00 | 3/4 |
| S2-costly | Tuần tự | 10.00/3.00; 12.00/2.00 | 4/6 |
| I2-choice | Độc lập | 6.00/2.00; 10.00/4.00 | 3/3 |
| I2-moderate | Độc lập | 6.00/2.00; 10.00/3.00 | 3/4 |
| S3-rich | Tuần tự | 6.00/4.00; 8.00/3.00; 10.00/2.00 | 2/3/5 |
| S3-decay | Tuần tự | 6.00/3.00; 8.00/2.00; 10.00/1.00 | 2/4/10 |
| S3-flat | Tuần tự | 8.00/3.00; 8.00/3.00; 8.00/3.00 | 3/3/3 |
| I3-choice | Độc lập | 6.00/1.00; 8.00/2.00; 12.00/4.00 | 6/4/3 |
| I3-moderate | Độc lập | 6.00/2.00; 8.00/3.00; 10.00/3.00 | 3/3/4 |
| S4-decay | Tuần tự | 6.00/4.00; 8.00/3.00; 10.00/2.00; 12.00/1.00 | 2/3/5/12 |
| I4-even | Độc lập | 8.00/2.00; 8.00/2.00; 8.00/2.00; 8.00/2.00 | 4/4/4/4 |
| M2-total24 | Độc lập | 12.00/4.00; 12.00/4.00 | 3/3 |
| M3-total24 | Độc lập | 6.00/2.00; 6.00/2.00; 12.00/4.00 | 3/3/3 |
| M4-total24 | Độc lập | 6.00/2.00; 6.00/2.00; 6.00/2.00; 6.00/2.00 | 3/3/3/3 |

M2/M3/M4 cùng **24M tổng phí, +8M tổng lương**, mọi khóa hoàn vốn sau 3 START; so độ chia nhỏ và số encounter cần thiết, thay vì lẫn tổng độ hào phóng với số khóa. Các khóa độc lập giống economics trong M4 không tạo4 lựa chọn tài chính khác nhau, chỉ thêm các lần mua.

| Layout | Ô học (1-based) | Thay thế so B18 |
|---|---|---|
| L4-original | 5/8/13/16 | Giữ nguyên |
| L3-bank | 5/8/13 | 16→bank |
| L3-personal | 5/8/13 | 16→personal |
| L3-bonds | 5/8/13 | 16→bonds |
| L2-bond-bank | 5/8 | 13→bonds; 16→bank |
| L2-stock-bank | 5/8 | 13→stocks; 16→bank |
| L2-spaced | 5/13 | 8→bonds; 16→bank |

Mọi layout có 18 ô/4 START và đúng9 loại. Ô16 là repeat kém hữu ích đã thử trong nghiên cứu trước. Không mặc định thay bằng Personal: screening so Bank/Bonds/Personal ở cùng vị trí; hai layout L2-bond-bank/L2-spaced giữ cùng số lượng tile để tách một phần spacing. [Bảng đủ 119 tổ hợp](research/multi-course/ALL_ARMS.md), [toàn bộ policy screening](research/multi-course/screen-policy-results.csv), [đối chứng cùng economics](research/multi-course/screen-control-policy-results.csv).

## Dữ liệu thực nghiệm: chất lượng ô học

Bảng sau dùng trung bình đều5 heuristic đã nêu trong phương pháp; gặp ô dựa trên path thực, các tỷ lệ khả dụng phụ thuộc policy. “Hết khóa” khác “còn khóa nhưng không đủ cash/không kịp hoàn vốn”. ROI dương chỉ xét course đang đủ cash và lương thực hiện trong START còn lại; không phải chứng minh quyết định tối ưu cho người thật.

| Arm | Lần ghé/ván | Còn khóa | Đủ cash mua | Hết khóa | Có ROI dương đủ cash | Khóa mua/ván |
|---|---:|---:|---:|---:|---:|---:|
| Baseline1/4 ô | 4.56 | 28.3% | 27.7% | 71.7% | 24.2% | 0.96 |
| Chính: I2/3 ô | 3.37 | 70.8% | 69.9% | 29.2% | 34.1% | 1.39 |
| Dự phòng: S3/4 ô | 4.56 | 86.0% | 84.0% | 14.0% | 46.7% | 1.82 |
| Loại: S2/2 ô | 2.22 | 78.4% | 77.1% | 21.6% | 54.6% | 1.25 |

Baseline còn nhiều popup sau khi mua duy nhất một khóa. S3/4 ô ít hết khóa nhất trong holdout, nhưng không thắng mặc định vì cần nhiều vốn và dễ học quá muộn. I2/3 ô tạo lựa chọn chi6M hoặc10M và được chọn thứ tự; vẫn còn khoảng 29% encounter hết khóa trong suite. S2/2 ô cho nhiều cơ hội lợi nhuận dễ đạt hơn, nhưng rủi ro “cứ học rồi gửi Bank” cao hơn, nên không chọn chính.

| Arm | Policy | 0 khóa | 1 | 2 | 3 | 4 | Học phí/ván(M) | Tăng lương thực nhận(M) | Net trực tiếp(M) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Chính: I2/3 ô | cash-roi | 12.3% | 32.6% | 55.1% | 0.0% | 0.0% | 12.08 | 16.76 | 4.68 |
| Chính: I2/3 ô | savings-roi | 15.4% | 41.7% | 42.9% | 0.0% | 0.0% | 10.53 | 14.43 | 3.90 |
| Chính: I2/3 ô | novice | 9.4% | 33.0% | 57.6% | 0.0% | 0.0% | 11.85 | 12.65 | 0.80 |
| Dự phòng: S3/4 ô | cash-roi | 4.2% | 20.8% | 34.4% | 40.6% | 0.0% | 16.91 | 22.43 | 5.52 |
| Dự phòng: S3/4 ô | savings-roi | 16.7% | 39.5% | 21.4% | 22.3% | 0.0% | 11.95 | 15.88 | 3.93 |
| Dự phòng: S3/4 ô | novice | 8.7% | 27.0% | 30.8% | 33.5% | 0.0% | 15.13 | 14.84 | -0.29 |
| Loại: S2/2 ô | cash-roi | 13.4% | 33.5% | 53.1% | 0.0% | 0.0% | 8.38 | 15.94 | 7.55 |
| Loại: S2/2 ô | savings-roi | 20.3% | 35.0% | 44.6% | 0.0% | 0.0% | 7.46 | 14.49 | 7.03 |
| Loại: S2/2 ô | novice | 32.6% | 41.1% | 26.3% | 0.0% | 0.0% | 5.63 | 9.04 | 3.41 |

## Win, proceeds và rủi ro — holdout

448 seed/policy. Win kèm Wilson95%; mean/median/P10/worst10 đơn vịM. Worst10 là mean nhóm10% proceeds thấp nhất. Các dòng là heuristic tổng hợp, không phải nhóm người chơi. Mean CI và tail CI đầy đủ trong [CSV](research/multi-course/holdout-policy-results.csv), [tail bootstrap400 lần](research/multi-course/holdout-tail-intervals.json).

| Arm | Policy | Win% [CI95%] | Mean | Median | P10 | Worst10 |
|---|---|---:|---:|---:|---:|---:|
| Chính: I2/3 ô | cash-roi | 23.2% [19.5…27.3] | 86.17 | 87.00 | 80.00 | 77.39 |
| Chính: I2/3 ô | cash-all | 19.9% [16.4…23.8] | 83.29 | 84.00 | 75.00 | 71.82 |
| Chính: I2/3 ô | savings-roi | 65.6% [61.1…69.9] | 92.06 | 92.40 | 85.00 | 82.24 |
| Chính: I2/3 ô | savings-all | 51.6% [46.9…56.2] | 89.82 | 90.14 | 81.00 | 77.11 |
| Chính: I2/3 ô | diversified-roi | 52.7% [48.1…57.3] | 90.45 | 90.54 | 79.78 | 75.32 |
| Chính: I2/3 ô | business-roi | 41.7% [37.3…46.4] | 88.56 | 88.08 | 77.87 | 73.30 |
| Chính: I2/3 ô | novice | 12.5% [9.8…15.9] | 76.20 | 76.73 | 60.92 | 53.85 |
| Dự phòng: S3/4 ô | cash-roi | 32.4% [28.2…36.8] | 87.01 | 87.00 | 81.00 | 78.05 |
| Dự phòng: S3/4 ô | cash-all | 22.5% [18.9…26.6] | 84.93 | 85.00 | 76.00 | 72.80 |
| Dự phòng: S3/4 ô | savings-roi | 65.8% [61.3…70.1] | 92.03 | 92.10 | 85.00 | 82.56 |
| Dự phòng: S3/4 ô | savings-all | 59.8% [55.2…64.3] | 90.99 | 91.12 | 81.64 | 77.58 |
| Dự phòng: S3/4 ô | diversified-roi | 51.6% [46.9…56.2] | 90.57 | 90.30 | 79.75 | 75.34 |
| Dự phòng: S3/4 ô | business-roi | 44.9% [40.3…49.5] | 89.22 | 88.92 | 78.20 | 73.81 |
| Dự phòng: S3/4 ô | novice | 9.8% [7.4…12.9] | 74.98 | 75.52 | 59.45 | 52.63 |
| Loại: S2/2 ô | cash-roi | 46.9% [42.3…51.5] | 89.04 | 89.00 | 80.00 | 78.07 |
| Loại: S2/2 ô | cash-all | 43.8% [39.2…48.4] | 88.47 | 88.00 | 80.00 | 76.86 |
| Loại: S2/2 ô | savings-roi | 83.5% [79.8…86.6] | 97.00 | 96.98 | 88.20 | 85.39 |
| Loại: S2/2 ô | savings-all | 83.0% [79.3…86.2] | 96.91 | 96.78 | 88.29 | 84.76 |
| Loại: S2/2 ô | diversified-roi | 65.8% [61.3…70.1] | 93.67 | 93.56 | 81.62 | 76.11 |
| Loại: S2/2 ô | business-roi | 54.5% [49.8…59.0] | 91.47 | 91.00 | 79.20 | 74.73 |
| Loại: S2/2 ô | novice | 22.8% [19.1…26.9] | 80.09 | 80.62 | 63.61 | 56.77 |

Ví dụ chính Savings+ROI: mean **92.06M** (CI95 91.57…92.56M), P10 **85.00M** (bootstrap95 84.13…85.82M), worst10 **82.24M** (bootstrap95 81.19…83.26M). Dự phòng Savings+ROI mean **92.03M**. Các khác biệt nhỏ cần đọc CI, không chỉ thứ hạng point estimate.

Đối chứng không học tại layout chính:

| Policy không học | Win | Mean(M) | P10(M) | Worst10(M) |
|---|---:|---:|---:|---:|
| cash-none | 0.0% | 81.49 | 77.00 | 74.70 |
| savings-none | 45.1% | 88.83 | 81.56 | 79.00 |
| stocks-none | 7.4% | 83.07 | 76.31 | 73.66 |
| business-none | 21.9% | 83.92 | 73.31 | 69.78 |
| diversified-none | 34.6% | 86.42 | 75.65 | 71.67 |

Học tăng proceeds so no-course trong các cặp, nhưng net salary không bằng hiệu quả tổng. Chính Savings+ROI có course net trực tiếp **3.90M**, paired proceeds so Savings không học **+3.23M** (CI95 3.00…3.47M), do chi phí cơ hội và lựa chọn sau học. [Paired contrasts](research/multi-course/holdout-paired.csv).

## ROI học sớm/học muộn và chiến lược học tất cả

Bảng lý thuyết dùng số START còn lại, giả định sống tới cuối ván; không dự báo giá/RNG. Lương bắt đầu ở START tiếp theo và học phí không hoàn trả. Kết quả thực nhận từng khóa/thời điểm mua có trong [course ROI CSV](research/multi-course/holdout-course-roi.csv) và raw rows.

| Khóa | Phí(M) | Boost(M) | Còn4 START: net | Còn3 | Còn2 | Còn1 |
|---|---:|---:|---:|---:|---:|---:|
| Chính/c1 | 6.00 | 2.00 | 2.00 | 0.00 | -2.00 | -4.00 |
| Chính/c2 | 10.00 | 4.00 | 6.00 | 2.00 | -2.00 | -6.00 |
| Dự phòng/mỗi cấp | 8.00 | 3.00 | 4.00 | 1.00 | -2.00 | -5.00 |

Ở thiết kế chính, cả hai khóa cần tối thiểu3 START để hoàn vốn; với 2 START còn lại, việc học đã lỗ trực tiếp trước cả chi phí cơ hội. Policy ROI vì thế không mua sau vòng 2. Khóa6M/+2M hoàn vốn đúng3 START nhưng có thể kém gửi tiết kiệm nếu chỉ hòa vốn; policy ROI không chiết khấu yield thay thế, nên kết quả chưa phải optimum.

| Arm | Savings+ROI trừ Savings+học tất cả, mean paired(M) [CI95] | Win ROI / học tất cả |
|---|---:|---:|
| Chính: I2/3 ô | 2.24 [1.96…2.52] | 65.6% / 51.6% |
| Dự phòng: S3/4 ô | 1.04 [0.71…1.38] | 65.8% / 59.8% |
| Loại: S2/2 ô | 0.10 [-0.09…0.28] | 83.5% / 83.0% |

Đây là lý do không chọn S2-rich dù dễ thắng hơn: Savings+học tất cả đạt **83.0%**, mean **96.91M**, gần Savings+ROI; paired delta chỉ 0,10M và CI chứa0. Việc học theo thời gian gần như không cần thiết với heuristic này. Chính I2 tạo chi phí đáng kể khi học thiếu cân nhắc; S3 cũng có chi phí cơ hội và tail xấu hơn khi học tất cả.

## Dự phòng, thanh khoản và seed nhiều Personal

Holdout thay riêng learning reserve 0/5/10/15M tại thiết kế chính, giữ financial reserve/Bank behavior10M:

| Learning reserve | Mean proceeds(M) | Win | Cash tối thiểu sau học, mean có điều kiện(M) | Course net(M) | Funding | Vay |
|---|---:|---:|---:|---:|---:|---:|
| 0M | 92.80 | 70.3% | 22.47 | 4.68 | 0.0% | 0.0% |
| 5M | 92.73 | 69.9% | 22.81 | 4.61 | 0.0% | 0.0% |
| 10M | 92.06 | 65.6% | 26.03 | 3.90 | 0.0% | 0.0% |
| 15M | 91.70 | 63.2% | 30.80 | 3.44 | 0.0% | 0.0% |

Reserve0 so10 tăng mean **0.73M** (paired95 0.60…0.86M) nhưng không phát sinh funding trong mẫu. Cash-only reserve 0/5/10/15 không ràng buộc việc học ở các seed này. Ở cả ba ứng viên, policy có chủ đích không funding/rút sớm/vay/phá sản; novice S2 có 1/448 funding, chính và dự phòng0/448. Với0/448, Wilson upper95 vẫn **0.9%**, không phải rủi ro bằng0.

Có **34/448 seed gặp ít nhất3 Personal** (cùng nhóm seed ở ba layout holdout). Chính Savings+ROI trong nhóm này mean **83.31M**, win **0.0%**, so mean **92.06M** toàn mẫu; bị hao tiền rõ nhưng vẫn không funding. Nhóm34 seed có CI rộng và được chọn theo exposure, không phải biến cố thực nghiệm ngẫu nhiên riêng. Giữ nguyên ba sự kiện/lựa chọn, kể cả quyền hoãn trả.

**Vấn đề thiết kế chưa giải quyết:** thu nhập14M nhận trước sinh hoạt5M, vốn50M, quyền hoãn Personal và guard của heuristic làm thiếu thanh khoản rất hiếm. Nghiên cứu này không chứng minh giữ reserve là bắt buộc hoặc người chơi đã hiểu reserve. Không sửa lương/sinh hoạt/event/market để ép ra kết quả.

## Vai trò tài sản và nguy cơ áp đảo

Tại thiết kế chính, cùng ROI course guard10M và policy tài sản hiện có:

| Policy | Win | Mean(M) | Worst10(M) | Vốn đầu tư giao dịch cộng dồn(M) | Phí+spread(M) |
|---|---:|---:|---:|---:|---:|
| stocks-roi | 37.7% | 87.75 | 77.02 | 22.50 | 0.24 |
| gold-roi | 29.7% | 86.75 | 77.35 | 21.60 | 0.92 |
| bond-a-roi | 33.5% | 87.52 | 76.26 | 31.28 | 0.17 |
| bond-b-roi | 32.4% | 85.85 | 69.27 | 27.03 | 0.15 |
| business-roi | 41.7% | 88.56 | 73.30 | 21.23 | 0.00 |
| diversified-roi | 52.7% | 90.45 | 75.32 | 70.45 | 0.63 |
| risk-aware-roi | 50.9% | 90.32 | 75.59 | 64.27 | 0.53 |
| savings-roi | 65.6% | 92.06 | 82.24 | 57.36 | 0.00 |

**Có dấu hiệu Savings+Course áp đảo trong tập heuristic**: dẫn đầu win, mean và tail ở các ứng viên. Không đạt ngưỡng “gần chắc chắn” đã đăng ký (win≥95%, Wilson lower≥90%); nhưng không nên vì thế bỏ qua sự mất cân đối tương đối. Baseline B18 cũng có Savings+học tất cả thắng 83,7%, nên không quy toàn bộ ưu thế này cho multi-course. S2 còn thêm Bank ở layout, càng phải tách hiệu ứng course và layout.

Stocks/AA/Business/diversified vẫn cải thiện mean so Cash+Course, nhưng tails và vốn khóa khác nhau. Bond B coupon cao có tail kém hơn AA; Gold phí/spread làm lợi ích mean nhỏ. Không suy ra đây là xếp hạng đầu tư ngoài đời hoặc asset vô dụng: đây là những policy/ticket/exit cụ thể, không phải người chơi tối ưu. Cần giữ cảnh báo thiết kế về sức hấp dẫn tương đối của Bank, không giả vờ diversified thắng nhiều nhất hay mọi chiến lược ngang nhau.

## So2/3/4 khóa và2/3/4 ô

Đối chứng cùng tổng24M/+8M,128 seed/policy ở shortlist: trên4 ô, suite mean2/3/4 khóa =85,73/85,59/84,80M; hết khóa 30,0/13,1/4,8%, nhưng cơ hội ROI dương chỉ 20,9/22,0/22,0%. 4 khóa không tạo thêm nhiều cơ hội lợi nhuận; cần nhiều encounter sớm để nhận đủ hiệu ứng. Cash+ROI4 so2 giảm **1,86M** (paired95 -2,09…-1,62M); Savings+ROI giảm0,59M (-0,89…-0,30M). Không kết luận mọi hệ4 khóa đều kém; đây là các package được thử, gồm đối chứng economics bằng nhau.

Đổi4→3→2 ô giảm số popup học nhưng thay bằng cơ hội Bank/Bond/Stocks/Personal, không rút số roll/vòng. Spacing được tách bằng cặp cùng counts L2-bond-bank/L2-spaced. Trong holdout, toàn bộ cặp kiểm tra giữ dice/main RNG đồng bộ100%; riêng đối chứng layout của baseline chỉ 4,5–23,4% cặp giữ nguyên encounter hash. Cùng seed không đồng nghĩa cùng trải nghiệm. Không gọi chênh layout là tác động nhân quả thuần của số ô, vì loại/vị trí ô thay thế cũng khác.

Giữ3 ô với 2 khóa độc lập là thỏa hiệp cơ hội/độ lặp. Giữ4 ô với 3 cấp là dự phòng nếu Owner ưu tiên board gốc và ít encounter hết khóa hơn. Phút chơi/cognitive load chưa đo; cùng sample mean khoảng 21,07 roll/ván không chứng minh thời lượng UI/người thật bằng nhau.

## Khuyến nghị và lý do loại

- **Chính: I2-choice/L3-bonds.** Hai khóa độc lập6M/+2M và10M/+4M, mỗi khóa một lần, tối đa một khóa/encounter. Giữ ô 5/8/13; ô 16→Trái phiếu, không thêm Bank hoặc Personal. Ít khóa và không cần prerequisite; có lựa chọn giữa chi phí nhỏ/giữ cash và boost lớn/chi nhiều hơn. Hết khóa suite29,2% so baseline gốc71,7%; ROI/đủ cash34,1% so24,2%. Học tất cả kém hơn ROI rõ về proceeds, nên lựa chọn thời điểm vẫn có hậu quả. Nhược điểm: vẫn lặp lại, lợi nhuận mean/novice thấp hơn baseline, Bank còn mạnh, chưa tạo áp lực reserve.
- **Dự phòng: S3-flat/L4-original.** Ba cấp 8M/+3M, cần cấp trước, giữ 4 ô. Economics đồng nhất dễ giải thích, hết khóa 14,0%, ROI dương46,7%; mua quá muộn lỗ rõ. Nhược điểm: thêm một cấp/prerequisite, cần vốn lớn hơn, novice mất nhiều tuition, chưa cải thiện tail hoặc reserve; không chọn chỉ vì ít popup vô nghĩa.
- **Không chọn S2-rich/L2-spaced** dù win/mean cao: học tất cả+Bank gần ROI, điều kiện học quá dễ, layout thêm Bank, chưa bảo vệ vai trò tài sản/risk management. Có thể xem như comparator dễ, không làm khuyến nghị MVP chính.
- **I3-moderate**: ba lựa chọn/ba economics nhưng nhiều course hòa vốn hoặc không kịp trả phí; menu phức tạp hơn2 khóa, novice tuition/tail kém. **S3-flat/3 ô** thiếu cơ hội dùng cấp 3 so4 ô. **I2/2 ô** giảm lặp nhưng bỏ lỡ khả năng tiếp cận khóa và learning interaction; không tốt hơn3 ô đủ rõ để ưu tiên.
- **S2-extension/S2-costly, S3-rich/S3-decay/S4-decay**: một số khóa cuối không thể hoàn vốn ngay cả mua sớm trong4 START (ví dụ10M/+2M cần 5 START,10–12M/+1M cần 10–12); “còn khóa” không thành quyết định có ích. S2-even vẫn thử nhưng không tạo ưu thế giáo dục rõ so hai lựa chọn độc lập.
- **I3-choice/I4-even và matched4**: nhiều cấp hoặc phí cho boost quá nhỏ tạo vốn sunk/ordering/menu burden;4 khóa không được mặc định tốt hơn. Các đối chứng matched2/3/4 giúp thấy giảm hết khóa không tự cải thiện economics hay chất lượng quyết định. **L3-personal** tăng hao tiền nhưng không cho thêm khóa/cơ hội tài sản; không chọn chỉ để tăng độ khó. Các layout thêm Bank/Stocks/Bonds vẫn có bảng đủ, không suy ra một replacement tối ưu toàn cục.

## Giả thuyết, bất định và bàn giao

**Giả thuyết chưa kiểm chứng:** hai lựa chọn độc lập có thể giúp người mới giải thích cash/tuition/future income; ba cấp giống nhau có thể dễ nhớ nhưng dễ mua máy móc. Simulation chỉ đo exposure, hành vi heuristic và hậu quả tài chính; không đo kiến thức, chất lượng giải thích hay phút chơi. Không thực hiện Human Playtest trong task này.

Nominal CI chưa hiệu chỉnh hàng nghìn so sánh; shortlist là exploratory và chỉ 448 holdout seed. Novice uniform-menu bị ảnh hưởng bởi số option, không đại diện người mới thật. ROI policy không định giá đầy đủ chi phí cơ hội/sự sống sót; policy assets/ticket/exit chưa tối ưu.17 curricula/7 layout là vùng khảo sát hữu hạn, không bằng chứng tối ưu toàn cục. Main/backup là ưu tiên thiết kế có điều kiện, không chứng nhận đáp ứng toàn bộ mục tiêu giáo dục.

**Kiểm chứng nghiên cứu:**6 unit tests đạt,48 foundation replay (12 baseline production),245 replay đã lưu khớp full state và metrics; mọi 167.972 ván có audit cash/course salary/Bond/trading. Một arm448 ván được tái lập từ source frozen, khớp byte/hash của cả raw gzip và replay. Các phase seed rời nhau, holdout lock còn nguyên; production/source lịch sử không đổi. [Verification](research/multi-course/verification.json), [tái lập frozen](research/multi-course/frozen-reproduction.json), [manifest artifact/source](research/multi-course/artifact-manifest.json), [raw/config/replay/source bundles](research/multi-course/README.md), [bảng 119 arms](research/multi-course/ALL_ARMS.md).

Không triển khai multi-course vào production, không merge/deploy/Final QA. Owner review hai đề xuất và hai vấn đề còn mở: Bank tương đối mạnh và pressure dự phòng quá yếu.
