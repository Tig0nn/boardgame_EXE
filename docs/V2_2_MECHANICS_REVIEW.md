> **HISTORICAL** — Nghiên cứu và cập nhật phê duyệt V2.2; các câu chờ phê duyệt bên dưới ghi lại trình tự cũ, không phải trạng thái hiện tại. Nguồn chuẩn hiện tại: [CURRENT_MVP.md](CURRENT_MVP.md). Các phương pháp, kết quả và nội dung gốc bên dưới được giữ nguyên; lệnh lịch sử không được thực thi lại trong audit này.

# V2.2 — Rà soát và chốt cơ chế gameplay

Ngày: **11/10/2026**. Chủ dự án là người playtest duy nhất. Phạm vi: cơ chế, kế toán, thí nghiệm offline và hướng dẫn solo; chưa làm lại UX hoặc giao diện.

> Cập nhật sau phê duyệt: profile 4/5/6% đã được triển khai riêng cho ván Experimental B mới. Xem [báo cáo triển khai V2.2](V2_2_IMPLEMENTATION_REPORT.md) và [guide đã cập nhật](V2_2_SOLO_TEST_GUIDE.md). Nội dung nghiên cứu bên dưới ghi lại thời điểm trước phê duyệt; các số 5.000 seed và manifest44 file là bằng chứng lịch sử, không phải trạng thái kiểm tra sau thay đổi. Runner nghiên cứu hiện chọn profile tường minh thay cho gán tạm global rates để giữ đúng controls cũ. Không ghi đè kết quả nghiên cứu cũ.

## Quyết định đề nghị

**Đề nghị gói V2.2 chỉ thay một nhóm tham số cho cấu hình Experimental B 4/C20: tiết kiệm kỳ hạn 1/2/3 từ 6/7/8% xuống 4/5/6% mỗi START. Giữ mọi luật và giá trị khác. Gói này CHƯA ĐƯỢC TRIỂN KHAI, cần chủ dự án phê duyệt.** Original3/A20 và đối chứng Experimental A4/A20 tiếp tục giữ6/7/8%; không thay global config làm mất baseline. Khi duyệt, log phải ghi rõ profile lãi thực của ván: so A/B khi đó đổi cả board và rate, không còn là đối chứng riêng board. Không đề nghị tăng lợi nhuận business, bỏ giới hạn bán business, tăng số macro, đổi xúc xắc hay hạ mục tiêu để nâng tỷ lệ thắng.

Lý do chính là tương quan lợi nhuận chắc chắn, kỳ hạn và khả năng giữ nguyên gốc khi rút sớm; không phải mong muốn thắng đúng 50%. Đây là khuyến nghị cân bằng trong mô hình game, **không phải lỗi kế toán**. Không có lỗi tài chính mới được xác nhận cần patch production trong đợt này.

Phương án đã đo 4/5/6% vẫn cho tiết kiệm vai trò đáng kể: median nguồn huy động 92,086M, lợi thế ghép seed TB 6,894M so với tiền mặt có học; bond, gold và business vẫn không bị ép ngang kết quả. Nếu chưa duyệt, tiếp tục solo trên bản hiện tại 6/7/8%; không cần chờ hoặc thêm một vòng nghiên cứu lớn.

## 1. Phạm vi và bằng chứng

Đã đọc báo cáo [triển khai V2](V2_IMPLEMENTATION_REPORT.md), [cân bằng V2](V2_BALANCE_REPORT.md), [độ dài](V2_GAME_LENGTH_ANALYSIS.md), [bàn cờ](V2_BOARD_BALANCE_ANALYSIS.md), [readiness V2.1](V2_1_PLAYTEST_READINESS.md); audit `src/game`, `src/data`, tests và runner diagnostic hiện có.

Cấu hình chính: **Experimental B, 4 vòng, C20, 50M ban đầu, mua 80M + dự phòng 10M =90M huy động hợp lệ**. Original **3 vòng/A20 vẫn là mặc định chính thức**; Experimental A 4/A20 vẫn có sẵn. Không thay board, mode, dice, deadline, goal, event, rates hoặc UI production; không deploy Vercel. Repo không có `.git`, nên bảo vệ bằng SHA-256 **44 file**: toàn bộ source sản phẩm, tests hiện có, package/lock. Tất cả hash trước/sau khớp.

**Đã xác nhận bằng chạy thực tế:** 20 nhóm ×5.000 seed =**100.000 ván**, kế toán từng ván sai số 0đ, đường đi/forecast ghép seed khớp, hoàn tất đủ 4 settlement. Một số nhóm là controls tương đương, không phải 20 ý tưởng độc lập. Đây là heuristic hợp luật, không chứng minh chiến lược tối ưu.

**Suy luận có căn cứ:** ý nghĩa giáo dục, đánh giá mạnh/yếu và gói cân bằng. **Chưa xác nhận:** trải nghiệm của chủ dự án, mức mệt mỏi/dễ hiểu, tính tối ưu của policy hoặc tham số đề xuất. Phiên này không chạy browser playthrough mới; replay lại ba JSON browser V2.1 đã tải thật thành công. Không gọi kiểm tra engine là browser verification.

## 2. Thiết kế thí nghiệm tái lập

Seed chung `XVTL-V2-0`…`XVTL-V2-4999`. Tất cả dùng engine production thật với **mode C20 tường minh**. Rate candidate chỉ gán tạm trong process offline đồng bộ và `finally` khôi phục; không ghi config sản phẩm. Action không rút thêm RNG. Tất cả 100.000 ván có đường die/vị trí/scenario giống control cùng seed; số roll TB **23,3152**.

Chính sách chung: dự phòng trước mua 10M, không mua bằng nợ, chi phí bắt buộc trả ngay; học một lần nếu đủ cash và còn ≥2 START. Course ở 2 START chỉ hòa vốn, nên đây không phải policy tối ưu theo chi phí cơ hội. Funding mặc định rút toàn một lot tiết kiệm → bán toàn stock → bond → gold → vay; không tự bán ở START. Không nhìn RNG hoặc giá tương lai.

| Nhóm | Policy khác biệt |
|---|---|
| `cash` / `cash-course` | Không đầu tư; nhóm thứ hai có học theo quy tắc chung, để không gán lợi ích học cho tài sản |
| `saving` | Gửi đầu 40M, term3; bank gửi 85% phần vượt dự phòng, term=min(3, START còn lại) |
| `saving-456` | Chính xác policy trên, chỉ lãi offline 4/5/6% |
| `saving-30M` | Gửi đầu 30M, còn lại như `saving` |
| `saving-debt-first` | Policy 40M, khi thiếu ưu tiên vay vừa đủ trong hạn mức để giữ lot; fallback nguồn hợp lệ khác |
| `stocks` | Mỗi encounter mua tối đa 25M, tối thiểu 1M, mã theo turn modulo6 |
| `stocks-forecast` | Như trên nhưng không mua thêm ở scenario `uncertain`; không bán danh mục đang giữ theo forecast |
| `stocks-momentum` | Cùng ticket/quy tắc; chọn mã tăng nhiều nhất qua tối đa 12 điểm giá đang công khai; tie theo ID |
| `stocks-partial-funding` | Như `stocks`; emergency bán lượng gross nhỏ nhất đủ net trả thiếu, làm tròn/phí đúng engine |
| `bonds` / `bonds-yield` | Ticket tối đa25M, chỉ mua khi còn ≥2 START; nhóm yield chỉ mua nếu giá <110% mệnh giá (coupon2×5% + gốc) |
| `gold` / `gold-forecast` | Ticket tối đa25M; nhóm forecast chỉ mua thêm khi `uncertain` |
| `diversified` | Gửi đầu15M term1; stock/bond/gold ticket5/5/3M; bank25% phần dư term1; business như policy vòng cuối |
| `business-final` | Mua/nâng vòng1–3, bán tại encounter vòng4; tối đa một giao dịch business/encounter |
| `business-early` | Mua/nâng vòng1–2, tìm bán vòng3–4; không mua lại sau bán |
| `business-final-no-upgrade` | Chỉ mua vòng1–2, không nâng; bán vòng4 |
| `business-early-no-upgrade` | Cùng cửa sổ mua vòng1–2, không nâng; bán vòng3–4 |
| `business-early-selective-upgrade` | Mua vòng1–2; nâng khi còn ≥3 START, đúng scenario; bán vòng3–4 |

Trong 4 vòng, điều kiện còn ≥3 START chính là vòng1–2: nhóm selective khớp hoàn toàn `business-early`, được giữ như kiểm tra consistency, không tính là cải tiến riêng. So `business-final-no-upgrade` với `business-final` **đồng thời đổi nâng cấp và cửa sổ mua**, không được diễn giải là tác động thuần của nâng cấp. Hai nhóm no-upgrade kiểm soát cùng cửa sổ mua để tách ảnh hưởng bán; selective so với early-no-upgrade tách việc nâng.

Tài sản được mua theo horizon; không gửi quá deadline, không mở bond2 kỳ khi còn1. Diversified giữ heuristic lịch sử, có thể mua bond muộn: cần phân biệt đây là hạn chế policy tham chiếu, không là lỗi maturity.

## 3. Kết quả chính

M = triệu VND. Huy động đã trừ phí/spread, nợ, nghĩa vụ; **không gồm business chưa bán**. SD là độ lệch chuẩn tổng kết quả, bao gồm chi phí đường đi; không phải volatility thuần tài sản.

| Policy | Thắng | p10 | Median | p90 | SD |
|---|---:|---:|---:|---:|---:|
| Cash | 20,32% | 67,500 | 81,500 | 94,000 | 10,239 |
| Cash + course | 33,16% | 70,500 | 85,000 | 98,000 | 10,746 |
| Saving 6/7/8 | 63,52% | 75,725 | 94,895 | 111,343 | 13,688 |
| Saving 4/5/6 offline | 56,20% | 74,523 | 92,086 | 107,664 | 12,845 |
| Saving đầu30M | 67,08% | 78,594 | 95,700 | 111,112 | 12,684 |
| Saving ưu tiên vay | 69,64% | 80,180 | 96,391 | 111,677 | 12,234 |
| Stocks | 46,28% | 70,678 | 88,709 | 109,746 | 15,519 |
| Stocks forecast | 46,12% | 72,292 | 88,659 | 107,773 | 14,282 |
| Stocks momentum | 47,08% | 70,717 | 88,773 | 110,406 | 15,930 |
| Stocks bán vừa đủ | 47,58% | 71,000 | 89,154 | 110,218 | 15,582 |
| Bonds | 41,26% | 72,800 | 87,344 | 101,101 | 11,156 |
| Bonds lọc yield | 41,56% | 72,816 | 87,500 | 101,161 | 11,156 |
| Gold | 40,38% | 70,881 | 87,028 | 102,902 | 12,334 |
| Gold forecast | 37,52% | 71,272 | 86,000 | 100,601 | 11,456 |
| Diversified | 42,86% | 68,030 | 87,288 | 106,705 | 14,860 |
| Business bán vòng4 | 41,28% | 65,250 | 86,400 | 107,398 | 16,263 |
| Business tìm bán vòng3–4 | 43,34% | 70,519 | 87,577 | 103,924 | 13,178 |
| Business không nâng, bán4 | 42,46% | 68,200 | 87,100 | 106,247 | 14,633 |
| Business không nâng, bán3–4 | 43,08% | 70,807 | 87,554 | 103,397 | 12,751 |
| Business selective (control tương đương) | 43,34% | 70,519 | 87,577 | 103,924 | 13,178 |

Đối chứng Cash+course giúp tách nhiễu đường đi. Chênh lệch TB cùng seed / SD của chênh lệch so control này: saving **+9,606M /4,720M**; candidate456 **+6,894M /3,612M**; stocks **+5,070M /10,516M**; bond-yield **+2,543M /1,861M**; gold **+2,348M /5,439M**; business-early **+2,965M /7,426M**. Đây gồm thay đổi thời điểm học/funding do ngân sách, không phải ROI tài sản thuần. Tổng ticket tái đầu tư cũng khác nhau: không coi cùng số seed là cùng exposure vốn hoặc cùng thời gian nắm giữ, không suy ra Sharpe hay dominance toán học.

## 4. Audit tám nhóm cơ chế

### 4.1 Tiết kiệm: mạnh về tương quan lợi nhuận/rủi ro

Hiện tại term1/2/3 trả **6% /14% /24% tổng lãi đơn** sau1/2/3 START; không tự tái tục. Gửi trong vòngL, termT đáo hạn START L+T−1. Gửi sát START vẫn nhận đầy đủ một kỳ: luật đếm checkpoint, không tính lãi theo số roll; **không phải lỗi**, không đề nghị đổi sang prorata.

Gốc không chịu biến động giá; rút khẩn cấp toàn lot mất toàn bộ lãi chưa trả nhưng không mất gốc. Cuối màn lot chưa đáo hạn chỉ tính gốc, không tính lãi hứa hẹn. Khoản đầu ván không cần gặp bank, tạo lợi thế tiếp cận so với các tài sản phải đợi ô: bank TB2,160 lần, 7,96% ván không gặp bank, nhưng vẫn gửi được ở setup.

Trong mô hình, 40M term3 nhận9,6M chắc chắn nếu giữ đủ. Bond đúng mệnh giá chỉ trả10% hai START; cổ phiếu phải chịu giá và phí; gold mất3% spread +1% phí trên phần sau spread. Saving vì vậy có lợi thế đáng kể trước chi phí cơ hội. Không đồng nhất “gốc an toàn” với “kết quả toàn ván không rủi ro”: cash thấp có thể lỡ học hoặc mất lãi lớn.

Policy40M rút toàn lot: thiếu0,3968 episode/ván, gốc rút TB15,721M, mất lãi TB3,751M. Gửi đầu30M giảm episode còn0,1456, mất lãi1,019M, thắng tăng3,56 điểm%; chênh TB +0,967M nhưng median chênh ghép seed **−0,137M**, nên không tốt hơn trên mọi đường đi. Prioritize-debt tăng TB1,959M, vay xuất hiện37,84% ván, lãi nợ TB0,187M: chi phí vay nhỏ có thể tránh hủy một lot lớn. Không có tiền tự sinh hoặc nợ bị bỏ qua; đây là lựa chọn funding hợp luật.

Candidate456 giảm TB **2,712M** so saving hiện tại, CI chuẩn ghép cặp95% **[−2,746;−2,679]M**, thắng giảm7,32 điểm%. Lợi ích so Cash+course vẫn6,894M. Chỉ thử candidate trên policy rút lot mặc định; **chưa đo candidate kết hợp vay-first/30M hoặc policy tối ưu**. Không lấy56,20% làm mục tiêu hiệu chỉnh. Kết luận: đủ căn cứ đề nghị giảm vừa phải lãi đảm bảo; không cần cùng lúc thêm phạt rút, cấm vay hay thay kỳ hạn.

### 4.2 Stocks, bonds, gold: có vai trò riêng, không cần buff đồng loạt

Stock mua fractional units ở giá hiện tại, normal chỉ cập nhật tại START, shock cập nhật ngay; bán gross theo giá hiện tại trừ1% phí. Stock-heavy P/L tài chính TB **+5,102M**, 29,64% ván có P/L âm, upsidep90 tổng109,746M. Mean normal stock trước sector/own noise theo scenario: growth11%, uncertain−3%, recovery6,5%. Tiếp cận TB2,204 lần;6,94% ván không gặp. Có rủi ro và upside thực, không là lựa chọn vô dụng; buying muộn chịu phí cho ít kỳ thu nhập.

Bond: units=tiền/giá thị trường; mệnh giá sở hữu=units×100k, coupon5% **mệnh giá**, hai START hoàn mệnh giá, không hoàn giá mua premium. Giữ đáo hạn không có default ngẫu nhiên. Mua giá110k và giữ đủ hai coupon có tổng110k: hòa vốn danh nghĩa trước chi phí cơ hội; giá cao hơn có thể lỗ dù “coupon5%”. Emergency bán bị giá thị trường và1,5% phí. Lọc yield giảm tỷ lệ P/L tài chính âm **4,48% →0% trong mẫu**, tăng TB0,089M, CI[0,082;0,097]M. Vẫn có thể kém Cash+course ở một số seed do timing/học/liquidation. Không tuyên bố mọi seed không lỗ. So sánh premium/discount/maturity là bài học hữu ích; saving hiện tại làm bond kém hấp dẫn về lãi đảm bảo. Không sửa coupon hoặc thêm default.

Gold: net sale ≈96,03% gross (spread3%, rồi fee1%); normal mean theo growth/uncertain/recovery là1%/7,5%/3%. Một kỳ mean growth còn không bù spread; credit-tightening tăng vàng8% trong khi cổ phiếu giảm. Gold-heavy P/L TB+2,363M, âm32,26% ván; không được mô tả “an toàn như tiết kiệm”. Policy chỉ mua khi uncertain giảm P/L âm xuống13,44%, exposure ticket TB42,948M →16,994M, nhưng tổng lời/thắng cũng giảm. Đây là giảm exposure, không chứng minh forecast làm mất giá trị. Giữ vàng làm hedge có chi phí, không ép làm tài sản tích lũy tốt ngang stock.

Diversified hiện tại không mặc nhiên giảm rủi ro: business vẫn khóa, nhiều tài sản cùng chịu macro, phân tán vốn có thể làm lỡ ticket20M. Median87,288M; **17,298** thao tác tiền tệ TB so stock8,653 hoặc saving8,389, nên policy này nặng tương tác hơn. Không buff để mọi danh mục cùng thắng.

### 4.3 Business: khả thi nhưng bị deadline và quyền bán chi phối

Mở20M, thu hồi khởi điểm70%; nâng5M thêm700k/START +1M khi đúng trend, thu hồi50%, max6 tầng. Thu nhập nền3M×trend, cộng macro income impact; recoverable capital thay đổi theo normal return trừ8% depreciation, rồi shock. Không sửa công thức này.

Nâng chỉ được từ encounter tiếp theo sau mua; nhiều tầng trong encounter sau vẫn hợp luật nếu đủ tiền/trần. Bán chỉ ở ô business, không ở START/funding. Bán xóa vốn, tầng và marker mua; multiplier macro toàn thị trường giữ lại. Đây đã là fix V2.1, regression hiện tại pass.

| Policy | Mua / toàn ván | Tầng TB / toàn ván | Bán / toàn ván | Khóa / người mua | Giá vốn khóa TB / toàn ván | Lãi thực median / nhóm đã bán |
|---|---:|---:|---:|---:|---:|---:|
| Vòng4 |95,76%|1,5644|62,34%|34,90%|9,452M|8,401M|
| Vòng3–4 |87,92%|0,7996|77,74%|11,58%|2,506M|3,991M|
| Không nâng, bán4, chỉ mua1–2 |87,92%|0|57,34%|34,78%|6,116M|8,519M|
| Không nâng, bán3–4, chỉ mua1–2 |87,92%|0|77,74%|11,58%|2,036M|3,993M|

Mở cửa bán sớm hơn có chi phí thật: mất dòng tiền tương lai và khả năng tăng giá thu hồi. Trong đối chứng **cùng entry1–2, không nâng**, bán3–4 tăng TB0,215M, CI[0,027;0,403]M, nhưng p90 thấp hơn và chỉ22% seed có proceeds cao hơn. Không được hiểu “luôn bán sớm”. Policy legacy early so final tăng1,117M và2,06 điểm% thắng, nhưng đồng thời bỏ mua/nâng vòng3; đây là gói policy, không tác động thuần cửa bán.

Tách riêng nâng sớm (entry/exit giữ nguyên) tăng TB **0,107M**, CI[0,072;0,142]M; delta p10 **−0,939M**, median0, p901,408M; không nâng vẫn43,08% thắng so43,34%. Nâng không tự động là bước tiến tốt nhất. Marginal5M chỉ thu hồi2,5M lúc thêm, còn mất thời gian/khấu hao và phải bán; chỉ một START tăng tối đa1,7M chưa chắc bù mất vốn. Nâng muộn là lựa chọn thường kém, không là bug.

Business TB3,391 encounter, chỉ1,38% không gặp toàn ván. Dù C20 cải thiện tiếp cận, còn rủi ro không gặp cửa bán. Nhóm đã bán có selection bias; không dùng lời8,401M của người bán để nói mọi người mua lời tương tự. **Giữ liquidity restriction** để bảo toàn bài học thoát vốn; chưa cần tăng income/recovery.

Thu nhập business thấp nhất theo config hiện tại =3M×0,75 +(0,3−1)×2M =**0,85M**, chưa tính nâng. Do đó nhánh “lỗ vận hành âm” engine hỗ trợ **không tự xảy ra trong bounds hiện tại**. Rủi ro business nằm ở mất vốn thu hồi/cơ hội bán, không ở lỗ cash vận hành. Ghi đúng phạm vi giáo dục này; không thêm phạt để ép nhánh âm xảy ra.

### 4.4 Personal investment và lương

Khóa học6M, +3M mỗi START còn lại, mua một lần. Net trực tiếp nếu mua vòng1/2/3/4 trong màn4 lần lượt **+6M/+3M/0/−3M**. Mua sớm là lợi ích chắc chắn có chi phí cơ hội6M; mua vòng3 hòa vốn danh nghĩa, vòng4 bị chi phối về tiền nếu không có mục tiêu học ngoài game. Không nên tự mua vì thấy nút nâng.

Cash+course so cash tăng TB **3,592M**, thắng +12,84 điểm%, không phải lợi nhuận cổ phiếu hay business. Gặp courseTB2,248 lần, mua86,14% theo policycontrol; khoảng1,387 visit/ván không phát sinh mua, gồm cả đã học, không đủ cash hoặc không muốn học muộn. Không gọi toàn bộ chúng là ô lỗi/thừa: hai vị trí tạo khả năng gặp sớm, không phải hai lần tăng lương. Giữ giá/lương và cả hai ô.

### 4.5 Sinh hoạt và biến cố

Sinh hoạt7M **chỉ khi dừng đúng ô**, không trừ thêm tại START. TB2,208 lần=15,456M/ván; p10/median/p90 chi phí **7/14/28M**, min0/max49M trong mẫu. Extra due (personal và nghĩa vụ khác) TB10,359M, p10/median/p904/10/17,5M. Cash-control cùng vốn/lương đã có SD10,239M: đường đi tạo chênh kết quả lớn trước mọi đầu tư.

Chi phí cao hơn chênh giữa nhiều policy; giảm risk tài sản không xóa được luck ở chi phí. Chưa phân rã phương sai nhân quả từng nguồn; không khẳng định living giải thích một tỷ lệ variance cụ thể. Hiện có shortage, liquidation và funding thực; **chưa cần tăng bills, shock hoặc phí nhân tạo**. Giữ nguyên để chủ dự án đánh giá cảm giác công bằng qua seed có chi phí khác nhau.

### 4.6 Macro, forecast và chart

C20 có1 ô macro ở6: TB **1,1984/ván**, không gặp **23,64%**, đúng1 lần42,02%, ≥2 lần34,34%, max4 trong mẫu. **76,36%** có ít nhất1 macro; mọi ván còn4 normal market updates. Đủ cho bài học bất định trong đa số ván, **không đảm bảo mỗi ván được thấy macro**. Solo dùng seed2 có3 macro hoặc seed0 cócredit-tightening; không thêm event bảo đảm/ẩn balancing. Mỗi shock áp một lần ngay encounter, price marker có event; normal sau đó lấy giá sau shock làm nền, không áp lại shock.

Forecast công khai đúng **regime của START sắp tới**, không công bố draw lợi suất hoặc sự kiện tương lai. Forecast tiếp theo độc lập, nên dùng growth để suy ra cả3 kỳ nắm giữ sẽ tăng là sai. Stock-filter forecast không tăng thắng (46,12% so46,28%), nhưng p10 tăng1,615M, SD giảm15,519→14,282M, P/L âm29,64→20,70%. Thông tin có giá trị để chọn mức rủi ro, không là nút thắng chắc.

Chart hiển thị giá thật, shock và lịch sử; coupon/mệnh giá/giá bond giúp tính yield. Lịch sử khởi tạo dùng stream khác và mô hình **không có momentum/autocorrelation programmed** cho future normal innovation. Tuy nhiên không được kết luận chart vô dụng: momentum policy đo được TB **+0,404M**, CI[0,289;0,518]M so stockblind, SD tổng cao hơn. Nhóm không macro (1.182 seed): delta−0,090M, CI[−0,261;0,081]M; nhóm cómacro(3.818): +0,557M, CI[0,417;0,697]M.

**Suy luận, chưa tách nhân quả:** chart có thể gián tiếp chọn sector có lợi trước các shock lặp lại. Mean một macro tech+2,67%, bank−3,67%, manufacturing+6% (ba event cùng xác suất); banking được bù phần nào bằng own-vol thấp hơn nhưng không có cơ chế coupon/dividend riêng. Các mã cùng sector cũng rất giống nhau ngoài volatility. Đây là bất đối xứng có thật trong config, chưa chứng minh dominance stochastic hoặc chart dự báo innovation. Không thêm indicator/AI hoặc đổi shock sector trong gói tối thiểu; không tuyên bố cả6 mã có cơ hội ngang nhau. CI là mẫu seed/heuristic, không bằng chứng thị trường thật và chưa hiệu chỉnh nhiều so sánh.

### 4.7 Nợ, deferred obligations và insolvency

Vay chỉ để giải quyết payment bắt buộc còn thiếu, hạn mức30M, lãi10% đến START kế. Settlement thu salary/business/maturity trước khi trả nợ; thiếu có thể funding tiếp, không tự vay. Khoản vay mới ở START cuối được cộng lãi một lần và trừ khỏi lawful proceeds; không biến mất do kết thúc. Deferred được trừ nghĩa vụ ngay rồi settlement xóa liability khi trả, không trừ hai lần.

Deferral có premium: medical5→6M, family3→3,5M, bills2→2,5M, contract1,5→2M, repair4M ngay hoặc1+4M sau. Nếu có thể vay **toàn đúng khoản ngay** ở10% một kỳ, tổng trả5,5/3,3/2,2/1,65M tương ứng thường rẻ hơn defer; nếu chỉ thiếu một phần, ưu thế vay còn lớn hơn. Nhưng deferral không dùng hạn mức vay ngay, có thể giữ liquidity đến sau salary/maturity; không hoàn toàn redundant khi hạn mức đã dùng. Đây là bất đối xứng chi phí được thiết kế, không lỗi tự động hạch toán. Không giảm premium hoặc thêm loan mới trong đợt này.

Trong20 nhóm không có insolvency hoặc nợ tồn cuối; **không chứng minh engine không thể insolvency**. Vay xuất hiện37,84% nhóm saving-debt-first; principal được trả ở START, lãi vẫn giảm kết quả. Groupstock bán vừa đủ giảm gross forced sale TB **5,237M→0,299M**, tăng proceedsTB0,398M, CI[0,317;0,479]M; có seed vẫn kém hơn do giữ risk tiếp. Funding có quyết định thật, không cần áp phạt emergency ngoài phí hiện tại.

Seed `XVTL-V2-2`: gửi40M term3; học6M lượt1, skipbusiness lượt2, thưởng2M lượt3; living7M lượt4 thiếu **1M**. Rút lot40M mất9,6M lãi hứa hẹn; vay1M trả1,1M tại START1 giữ lot. Với toàn policy runner, kết quả lần lượt **98.497.000đ /103.225.100đ**. Chênh cuối không bằng9,5M vì policy rút tiền có thể tái gửi sau đó. Đây là ví dụ cụ thể về kích thước lot và chi phí cơ hội, không phải “vay luôn tốt”.

### 4.8 Goal và liquidation

Lawful proceeds =cash +gốc savings active +net sale stock/bond/gold −debt −obligations −payment remaining. Không cộng lãi tiết kiệm chưa earned, không cộng quote business còn khóa. Business đã bán thànhcash hợp lệ. Tài sản ròng và proceeds vì vậy khác nhau có chủ đích. Result xét khả năng mua80M còn10M; không cần autoexecute purchase để tính đúng. Biên89.999.999 thua/90.000.000 thắng và insolvent không thắng đã có regression.

Giữ **90M**. Cash+course median85M, đầu tư có vai trò; không có tiêu chuẩn cần cân mọi strategy về cùng xác suất. Hậu xử lý cùng ván theo ngưỡng tổng (không sửa goal engine):

| Tổng ngưỡng giả định | Cash | Cash+course | Saving hiện tại | Stocks | Business early |
|---|---:|---:|---:|---:|---:|
|85M|37,60%|50,94%|75,74%|60,06%|58,00%|
|90M hiện tại|20,32%|33,16%|63,52%|46,28%|43,34%|
|95M|8,44%|17,92%|49,62%|34,00%|29,10%|
|100M|2,46%|7,52%|35,66%|23,42%|16,86%|

Nâng goal để trị riêng saving làm tất cả đường chơi khác khó hơn và không giải quyết risk-adjusted reward. Không hạ goal để cứu business thiếu thanh khoản.

## 5. Gói cơ chế cuối đề xuất, theo impact/effort

| Ưu tiên | Hiện tại → đề nghị | Vấn đề/bằng chứng | Tác động dự kiến / trade-off giáo dục | Effort và tests cần có |
|---|---|---|---|---|
| **P1, duy nhất cần đổi tham số** | Experimental B savings6/7/8 →**4/5/6% mỗi START**, lãi đơn; term/maturity/gốc/withdraw giữ nguyên; A20 giữ lãi cũ | Lãi tổng24% term3 chắc chắn; matchedsaving+9,606M so cashcourse, cao hơn stock+5,070M với downside nhỏ hơn. Candidate giảmTB2,712M nhưng vẫn+6,894M | Giảm opportunity cost bỏ saving; bond coupon5% trở nên có vai trò hơn; long-term saving vẫn hấp dẫn. Trade-off: người chọn an toàn khó đạt goal hơn; funding/mất lãi vẫn quan trọng, cash-debt-first chưa thử dưới candidate | Vừa: cần lãi theo profile của ván thay vì sửa ECONOMY global để giữ baseline. Chỉ sau approval: test term1/2/3 maturity, rút sớm, terminalgốc; UI/log đúng profile/version; Original/A vẫn6/7/8; replay log V2.1 dùng lãi cũ; paired old/new cả funding40M/30M/vay-first |
| **P1, giữ luật** | Business20M/3M, nâng5M/+700k/+1M, max6, recovery70%/50%, selltileonly →giữ | Sale-risk giảm rõ khi có kế hoạch3–4; nâng sớm lợi ích nhỏ, nâng muộn có opportunity cost; không cần buff | Giữ bài học tài sản tạo dòng tiền nhưng có thể không thanh lý kịp. Trade-off: có ván vốn có giá nhưng không giúpgoal | Không code. Regress initialbuy/lock/upgrade encounter sau/sell/reset/START restriction; solo seed6 |
| **P1, giữ luật** |4/C20 experimental,50M,14M, goal80+10; Original3/A20 default →giữ | Cash+course33,16%, các tài sản có đường tới90M; tăng goal che vấn đềsavings | Dễ so trước/sau một biến; không phát sinh luật mới | Không code; tests mode,4salary/settlement,maturitylap4, finalovershoot |
| **P2, giữ luật và cách dạy đúng** | Stock/bond/gold, course6/+3, macro/events/debt10%/fees →giữ | Forecast giảm downside, bondyield giúp tránhpremium, goldhedge cóspread, coursemuộn yếu, funding có payoff | Đa dạng vai trò mà không làm mọi strategy ngang nhau. Trade-off: có lựa chọn kém nếu dùng sai horizon; cần chủ dự án hiểu lý do | Không code; giá/units/coupon/sale net, nghĩa vụ, insolvency, replay; dùng guide solo |

Không cần một gói nhiều buff/nerf. Những lựa chọn “mua course cuối màn”, “nâng business sát deadline”, “bond premium cao” là quyết định tài chính thường kém, **không phải lỗi cần khóa nút**. Không thêm prorata interest, bán business ở START, phân bổ lại board, taxes, loan loại mới, AI hoặc multiplayer.

### Phân loại quyết định còn lại

- **Lỗi xác nhận mới:** không có trong phạm vi kiểm tra. Không sửa production, không có bug fix chưa viết regression. Bug mua+nâng cùng encounter đã được V2.1 sửa và test lại pass.
- **Khuyến nghị cân bằng chờ duyệt:** chỉ savings4/5/6. Mọi số production hiện tại vẫn6/7/8.
- **Giới hạn đã biết, chấp nhận cho solo:** business không có lỗ vận hành âm tự nhiên; bond không default; chart không có predictive-momentum model; macro không bảo đảm từng ván; sector chưa cân bằng riêng; course chỉ mua một lần, visit sau ít ý nghĩa; funding whole-lot tạo cliff.
- **Tương lai tùy chọn, không phải blocker:** đa dạng hóa sector hoặc thêm thông tin horizon/yield tốt hơn chỉ nếu chủ dự án thấy cần sau cơ chế ổn định. Không đưa vào gói V2.2, không mở nghiên cứu/code mới trong đợt này. Visual polish để sau.

## 6. Verification đã thực hiện

| Kiểm tra | Kết quả xác nhận |
|---|---|
| `npm test` | **90/90 pass**, không fail/skipped; includes Original3/A20,4A20,4C20, pricing/funding/goal/business |
| Diagnostic suite | **19/19 pass** (15 cũ +4 mới); hook default giữ run fields, explicitC20 đúng encounters, rate restore cả khi throw, replay20policies; metric conditional không coi null là0 |
| `npm run lint` | Pass sau sửa unused binding trong script mới |
| `npx tsc -b` | Pass |
| Strict diagnostic typecheck | Pass; TS6 cần `--ignoreConfig` khi truyền file trực tiếp |
| `npm run build` | Pass,47modules; JS302,93kB gzip92,68kB; CSS26,97kB gzip6,54kB |
|100.000 simulation games| Hoàn tất4 vòng; accounting residual0; cash/debt/units không âm; salary/normal/shock không lặp; maturity không trễ, goal đúng |
| Đọc lại gzip độc lập | Pass100.000 rows, **1.112 phân phối số**, boolean rates, goal sensitivity, macro histogram, paired deltas, seed uniqueness/order, pathhash; win/median5 controls khớp lịch sử |
| Replay JSON browser V2.1 | Original17roll/3salary/75.200.000đ; A25/4/92.384.234đ; B26/4/116.734.938đ; snapshot/actions/finalJSON khớp |
| Source protection |44/44 SHA-256 khớp, gồm rates, board, dice, goal, UI, test cũ, package/lock |

Accounting identity từng ván: 50M +salary +bonus −livingdue −otherdue −course −debtinterest +investmentP/L +businesscashcontribution =lawfulproceeds. P/L tính coupon/redemption/sale+terminalnetquote trừ mua; savings chỉ lãi earned; businesscontribution là thu nhập +bán −mua/nâng, không cộng vốn khóa. Ledger cash delta cũng đối chiếu cashfinal−50M. Runner tái sử dụng audit này thay vì viết engine kinh tế mới.

Đã gặp và sửa lỗi **tooling** lúc phát triển: test hook ban đầu RED trước implementation; lint unusedvariable; TS6 CLI cầnignoreConfig; thống kê trường conditional (vòng mua/lãi business đã bán) nay bỏ null và không chọn cột theo seed đầu. Đã tái chạy bộ100.000 sau sửa thống kê; funds/win và các số trong bảng giữ nguyên. Trong JSON mỗi distribution có `n` thực tế, các cột conditional không nhất thiết có5.000 quan sát. Chúng không phải lỗi gameplay production. Node báo ExperimentalWarning về strip-types, lệnh vẫn pass.

### Browser và giới hạn

V2.1 đã có realbrowser full3 mode quaResult, desktop/mobile, downloadedJSON, fixtures funding/insolvency/goalboundaries; xem bằng chứng trong [readiness](V2_1_PLAYTEST_READINESS.md). Phiên này chỉ đọc bằng chứng/replay lại3 JSON, **không chơi browser mới, chưa có human solo feedback**. Productionhash và build giữ nguyên nên không có thay đổi UI cần xác minh mới trong phạm vi này. Không suy ra fixture là nhánh đã gặp tự nhiên.

Các mô phỏng dùng tập seed cũ để paired compare, không là holdout; chi phí thời gian nắm giữ dùng START, không phút/ngày thực. Mẫu5.000/nhóm có sampling error và policybias; CI chuẩn xấp xỉ cho mean paired, chưa hiệu chỉnh nhiều so sánh. Không xác minh mọi chuỗi action đối kháng hay mọi trình duyệt/thiết bị. Candidate456 chưa được người thật hoặc browser với rate mới thử vì chưa được duyệt. Không có auto-save/import UI/backend; log JSON dài, cần tải trước refresh.

## 7. Artifacts và lệnh tái lập

- [Kết quả và cấu hình](simulations/v2_2-mechanics-results.json), [100.000 run máy đọc gzip JSONL](simulations/v2_2-mechanics-runs.jsonl.gz), [đối chiếu độc lập và subgroup](simulations/v2_2-mechanics-verification.json), [hash bảo vệ](simulations/v2_2-protected-hashes.json).
- `scripts/diagnostics/mechanics-model.ts`: policy offline; `game-length-model.ts` chỉ thêm hook diagnostic mặc định tương thích. App không import các file này. Không có dependency mới.
- [Hướng dẫn solo](V2_2_SOLO_TEST_GUIDE.md):6 ván có mục đích, không yêu cầu chạy100s ván.

Chạy ở repository root, Node22.14/npm10.9.2:

```sh
node --experimental-strip-types --test scripts/diagnostics/*.test.ts
node --experimental-strip-types scripts/analyze-v2_2-mechanics.ts 5000
node --experimental-strip-types scripts/diagnostics/verify-v2_2-mechanics.ts
node --experimental-strip-types scripts/verify-v2_1-playtest-logs.ts
npm test
npm run lint
npx tsc -b
npx tsc --ignoreConfig --noEmit --strict --target es2023 --module nodenext --allowImportingTsExtensions --skipLibCheck --types node scripts/analyze-v2_2-mechanics.ts scripts/diagnostics/mechanics-model.ts scripts/diagnostics/mechanics.test.ts scripts/diagnostics/verify-v2_2-mechanics.ts
npm run build
```

Runner ghi đè **chỉ artifacts V2.2**, không ghi báo cáo/mô phỏng lịch sử. Manifest hash là snapshot trước nhiệm vụ; không cập nhật nó để bỏ qua thay đổi production về sau. CLI verification yêu cầu đầy đủ5.000 seed mỗi nhóm. Bản ghi JSONL là summary theo seed, không phải log browser schema4 đầy đủ; replay thật dùng JSON game hiện có.

**Trạng thái:** review cơ chế và verification hoàn tất; bản hiện tại sẵn sàng solo. Một quyết định cân bằng cần chủ dự án duyệt: savings4/5/6; chưa triển khai hoặc tuyên bố V2.2 rebalance đã phát hành.
