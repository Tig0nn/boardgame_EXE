# XOAY VÒNG TIẾN LUI — ĐẶC TẢ GAMEPLAY V2

**Ngày khóa bản làm việc:** 10/10/2026  
**Mục đích:** Cơ sở triển khai prototype, kiểm thử tự động và hiệu chỉnh cân bằng.  
**Định nghĩa trạng thái:** `CHỐT` = người dùng đồng ý trực tiếp hoặc ủy quyền chốt; `THỬ NGHIỆM` = thông số/công thức mẫu cần mô phỏng trước khi quyết định giữ; `CẦN BÁO CÁO` = Codex phải phân tích, không tự coi là luật đã chốt.

## 1. Trải nghiệm và quy tắc cốt lõi

- **CHỐT:** Trò chơi bàn cờ tung xúc xắc 1–6, cơ hội/chi phí/sự kiện nằm rải rác; người chơi quyết định sử dụng vốn để đạt mục tiêu tài chính trong số vòng hữu hạn.
- **CHỐT:** Ngẫu nhiên thật, dùng seed để tái hiện; không chỉnh xúc xắc/sự kiện ngầm theo tình trạng người chơi.
- **CHỐT:** Không có một tài khoản «Quỹ dự phòng» riêng; số tiền mặt còn giữ là khả năng dự phòng.
- **CHỐT:** Không tích hợp AI thật trong prototype; engine tính kết quả và ghi log có cấu trúc để AI có thể phân tích sau.
- **CHỐT:** Không có ô Market cập nhật giá đơn thuần; giá chỉ cập nhật tại START và sự kiện kinh tế bất ngờ theo luật bên dưới.

### 1.1. Thông số mẫu

| Tham số | Giá trị | Trạng thái |
| --- | ---: | --- |
| Vốn ban đầu | 50.000.000đ | THỬ NGHIỆM, kế thừa prototype |
| Số vòng | 3 | THỬ NGHIỆM, kế thừa prototype |
| Giá món đồ mục tiêu | 80.000.000đ | THỬ NGHIỆM |
| Tiền mặt cần giữ **sau khi mua** | 10.000.000đ | THỬ NGHIỆM; thay cách kiểm tra cũ chỉ tính net worth |
| Lương cơ bản mỗi lần qua START | 14.000.000đ | CHỐT cho bản thử nghiệm |
| Đầu tư cho bản thân: học phí | 6.000.000đ | CHỐT cho bản thử nghiệm |
| Đầu tư cho bản thân: tăng lương | +3.000.000đ/lần qua START kế tiếp | CHỐT cho bản thử nghiệm |
| Số lần mua khóa học | Tối đa 1/màn | CHỐT cho bản thử nghiệm |
| Số ô trên bàn, tỷ lệ các ô | Chưa khóa | CẦN BÁO CÁO, hiệu chỉnh bằng mô phỏng |
| Lãi/lỗ của tài sản, chi phí, spread, phí vay | Cấu hình tập trung | THỬ NGHIỆM, phải kiểm thử |

**Cảnh báo quan trọng:** `80M + 10M` nghĩa là người chơi cần huy động đủ tiền mua món đồ **và còn 10M sau mua**. Không được biến điều này thành chỉ `netWorth >= 80M AND cash >= 10M`. Cách đánh giá theo tài sản có thể huy động quy định ở mục 8; chỗ khác biệt với prototype cũ phải được ghi rõ trong báo cáo.

## 2. Bàn cờ và các ô

- **CHỐT:** `START` — mốc hoàn tất vòng, nhận thu nhập và quyết toán theo thứ tự nhất quán; cho **bán** cổ phiếu, trái phiếu, vàng nhưng không **mua**. Không được bán kinh doanh tại START.
- **CHỐT:** `Ngân hàng` — mở các khoản tiết kiệm mới; có chọn kỳ hạn. Phân bổ tiền đầu ván một lần là ngoại lệ không cần chờ ô Ngân hàng.
- **CHỐT:** `Cổ phiếu`, `Trái phiếu`, `Vàng` — mỗi nhóm có ô riêng, rải rác; mua tài sản khi dừng đúng ô; có thể bố trí nhiều ô cùng loại.
- **CHỐT:** `Kinh doanh` — được đầu tư ban đầu, nâng cấp theo xu hướng, hoặc bán; **chỉ** bán kinh doanh tại ô này.
- **CHỐT:** `Sự kiện kinh tế ngẫu nhiên` — cú sốc tích cực/tiêu cực lên các loại tài sản; cập nhật giá **ngay** khi kích hoạt.
- **CHỐT:** `Chi phí sinh hoạt` — người chơi bắt buộc trả **chỉ khi dừng đúng ô**; **không kích hoạt khi chỉ đi ngang qua**; không trừ lại chi phí sinh hoạt cố định ở START.
- **CHỐT:** `Biến cố tài chính cá nhân` — tình huống như chi phí y tế, hỏng xe... với các cách giải quyết tài chính.
- **CHỐT:** `Dòng tiền & nghĩa vụ` — thưởng, dòng tiền, trả góp/vay... theo từng event; không khôi phục một nhóm «chi tiêu vui chơi» không có lợi ích tương ứng.
- **CHỐT:** `Đầu tư cho bản thân` — khóa học tăng lương định kỳ theo mục 5.

**THỬ NGHIỆM:** Giữ số ô ban đầu của dự án nếu phù hợp; phân bố lại ô để có cơ hội gặp từng nhóm. Không tuyên bố phân bố là cân bằng trước khi xem báo cáo tần suất dừng ô từ hàng nghìn seed.

## 3. Quy trình một lượt, vòng và START

- Khi roll, quân cờ đi đúng 1–6 ô. Chỉ ô **đích dừng** mới kích hoạt (ngoại lệ duy nhất: đi qua START).
- Qua START kích hoạt xử lý vòng đúng **một lần**, kể cả nếu roll vượt START và dừng ở một ô xa hơn.
- **Thứ tự chuẩn đề xuất để lập trình và test** (thiết kế kỹ thuật, giữ cố định và hiển thị cho người chơi):
  1. Kết thúc vòng vừa đi: tính biến động giá **thông thường** từ giá hiện tại sau mọi cú sốc trong vòng; ghi một mốc mới lên biểu đồ.
  2. Nhận lương cơ bản + tiền tăng lương đã kích hoạt; thanh toán dòng tiền kinh doanh theo xu hướng áp dụng cho vòng vừa kết thúc.
  3. Xử lý coupon/lãi trái phiếu và khoản tiết kiệm đáo hạn, chỉ một lần theo ID khoản.
  4. Xử lý nghĩa vụ đến hạn, lãi/nợ; nếu thiếu Cash thì tạm dừng cho người chơi chọn nguồn tiền.
  5. Mở **quyền bán chủ động tại START** đối với stock/bond/gold và xem danh mục; không cho phép mua.
  6. Ghi summary và snapshot; nếu đã kết thúc số vòng thì xét mục tiêu và hiện Result. Nếu chưa kết thúc, cập nhật xu hướng/dự báo cho vòng tiếp theo.
- Nếu cú roll vừa đi qua START và dừng vào ô mới: giải quyết START + dự báo vòng mới **trước khi** xử lý ô đích. Không mở lượt roll thứ hai. Nếu vừa kết thúc vòng cuối, kết thúc tại START, không kích hoạt thêm ô phía sau.
- **Chỉ START** tạo lương thường kỳ. Không cộng lương ở đầu màn, không cộng lại nếu refresh, quay lại dialog hoặc reload state.
- Biến động thông thường chỉ tính **một lần** mỗi vòng. Cú sốc sự kiện áp dụng ngay và không bị tính lại tại START.

## 4. Tiền mặt, tiết kiệm, thanh khoản và thanh toán

### 4.1 Tiền gửi có kỳ hạn

- Người chơi được phân bổ vốn lần đầu giữa Cash và các khoản tiết kiệm. Sau đó chỉ mở tiết kiệm khi dừng ô Ngân hàng.
- Cho chọn kỳ hạn **1, 2 hoặc 3 lần qua START** và số tiền gửi. Dùng lãi suất phụ thuộc kỳ hạn được cấu hình; màn hình ghi rõ «lãi game/vòng», không diễn giải thành lãi năm ngoài đời.
- Mỗi lần gửi tạo `DepositLot` riêng: `id`, `principal`, `startLap`, `maturityLap`, `rate`, `status`, `earnedInterest`.
- Chưa đáo hạn vẫn được gửi thêm nhưng thành **khoản mới**. Mỗi khoản đáo hạn một lần rồi vốn + lãi về Cash; không tự tái tục.
- Rút trước hạn để giải quyết thiếu tiền: **rút toàn bộ một khoản gửi** ở bản MVP; mất lãi kỳ hạn chưa được trả của khoản đó; tiền còn dư sau thanh toán tiếp tục là Cash. Màn hình phải báo trước tổn thất.
- Không thể tạo khoản gửi với kỳ hạn vượt số vòng còn lại mà không cảnh báo rõ sẽ chưa đáo hạn trong màn.

### 4.2 Thiếu Cash

- Nếu gặp khoản phải trả lớn hơn Cash, dùng Cash có sẵn trước, phần còn thiếu yêu cầu người chơi chọn nguồn theo thứ tự **do người chơi quyết định**: rút từng khoản Saving, bán Stock/Bond/Gold, hoặc vay nếu còn hạn mức.
- **CHỐT:** Đây là ngoại lệ **bán khẩn cấp** dù chưa tới START; áp giá bán hiện hành (và spread/phí nếu có), tuyệt đối không cho bán Kinh doanh bằng ngoại lệ này.
- Cho dùng kết hợp nhiều nguồn. Không bán quá tài sản đang nắm, không rút tiết kiệm hai lần, không vay tiền vô hạn rồi thắng bằng khoản vay.
- Nếu không có nguồn hợp lệ và không thể vay, kết thúc với trạng thái `insolvent`/thất bại rõ ràng; không để dialog không thể thoát hoặc game bị kẹt.
- Khi bán chủ động ở START và bán khẩn cấp, **cùng một mô hình giá bán**, chỉ khác lý do, quyền truy cập và thông điệp giáo dục. Phí bán khẩn cấp thêm nếu có phải được công khai trước và có trong config.

## 5. Lương và đầu tư cho bản thân

- Lương cơ bản mẫu = **14M/lần qua START**, cộng trực tiếp vào Cash đúng một lần/vòng.
- Ô `Đầu tư cho bản thân`: một khóa học mẫu **6M ngay, tăng lương +3M mỗi lần START tiếp theo**, chỉ mua tối đa một lần trong màn; được phép bỏ qua.
- Hiệu lực ngay từ **lần đi qua START tiếp theo sau quyết định**, không truy lĩnh kỳ cũ. Khoản học phí không được hoàn lại hoặc bán lại.
- Hiển thị trước quyết định: chi phí hiện tại, tiền mặt sau chi, thu nhập tăng thêm/vòng, số kỳ còn lại và tổng tăng thu nhập dự kiến đến cuối màn (không coi là tiền chắc chắn để mua ngay).
- Không thêm energy/skill XP/reputation/hạnh phúc ở MVP. Có thể thêm khóa học khác sau khi test, không ở lần triển khai này.

## 6. Tài sản đầu tư

### 6.1 Cổ phiếu hoàn toàn giả lập

- **CHỐT:** Doanh nghiệp, mã giao dịch, lịch sử giá, giá tương lai đều **hư cấu**. Không lấy dữ liệu chứng khoán thật, không sử dụng tên/mã công ty thật.
- **THỬ NGHIỆM:** 3 ngành x 2 công ty = 6 cổ phiếu (Công nghệ, Ngân hàng, Sản xuất). Đây là doanh nghiệp **tiêu biểu giả lập** của các ngành, không được viết «top cổ phiếu» theo kết quả thị trường thật.
- Mỗi mã có `id`, `name`, `sector`, `currentPrice`, `volatility`, `priceHistory`, `holdings` theo số đơn vị hoặc tiền đầu tư quy đổi nhất quán.
- Tạo chuỗi lịch sử 12 mốc trước khi ván bắt đầu bằng RNG seed tách riêng (`historySeed`), **không tiêu thụ RNG dùng cho xúc xắc/event/market tương lai**. Người chơi **không xem được giá tương lai**.
- Giá chuyển động từ ảnh hưởng chung thị trường + ngành + biến động riêng theo seed. Cùng ngành có liên hệ nhưng không hoàn toàn đồng nhất. Event kinh tế tạo một lần thay đổi có thể khác nhau cho từng mã.
- Mỗi lần thay đổi giá sinh record `{timestamp: gameTurn, lap, kind: 'normal'|'shock', eventId?, priceBefore, priceAfter, returnRate}`. Giá trên chart == giá giao dịch == giá định giá danh mục.
- Mua tại ô Cổ phiếu; bán tại START hoặc bán khẩn cấp để trả nghĩa vụ. Không thêm tự do mua giữa lượt hoặc tại START.

### 6.2 Trái phiếu

- Trái phiếu dùng người phát hành **giả lập**; có giá mua, lãi coupon, kỳ hạn, thời gian nhận lãi và thu hồi vốn, rủi ro tín dụng, giá bán trước hạn.
- Thẻ thông tin và lịch dòng tiền là trọng tâm, không cần đồ thị nến. Coupon/maturity không được trả lặp khi reload hoặc pause settlement.
- Cho bán tại START hoặc khẩn cấp theo giá thị trường đã tính; phân biệt **giá bán trước hạn** với mệnh giá, không cam kết thu hồi đủ vốn.

### 6.3 Vàng

- Giá và lịch sử đều **giả lập**, có biểu đồ và hai báo giá: **người chơi mua vào** và **người chơi bán ra** (spread mua–bán).
- Không tạo lãi định kỳ. Giá biến động theo thường kỳ hoặc cú sốc; mua tại ô Vàng, bán tại START hoặc khi thiếu tiền.

### 6.4 Kinh doanh

- Đầu tư ban đầu chỉ tại ô Kinh doanh; nhận thu nhập mỗi START **sau khi đã đầu tư**, không nhận tiền ngược về START đã qua.
- Khi dừng lại ô Kinh doanh được nâng cấp **nhiều lần** với vốn bỏ thêm, hoặc bán cơ sở. Không bán ở START và **không bán khẩn cấp**.
- Nâng cấp tạo thu nhập cơ bản tăng bền vững. Nâng cấp đúng xu hướng hiện tại nhận **bonus** tạm thời. Xu hướng đổi: giữ phần cơ bản, mất/đổi phần bonus tương ứng; số tầng nâng cấp được lưu riêng theo từng xu hướng, không ghi đè.
- Thu nhập tại START = thu nhập kinh doanh cơ bản + tăng thu nhập bền vững từ nâng cấp + thưởng các nâng cấp trùng xu hướng hiện tại + tác động kinh tế hiện hành.
- Giá bán căn cứ vốn còn lại và diễn biến kinh doanh; **không mặc định được hoàn vốn đủ**. Vốn bị khóa cho đến khi vào đúng ô Kinh doanh, vì vậy **không được tính là tiền sẵn có để thắng** nếu chưa bán.
- **THỬ NGHIỆM:** Chi phí vốn, thu nhập và công thức giá bán đặt trong một file config, không hardcode trong UI. Codex có thể đặt cấu hình mẫu nhưng phải báo chính xác mọi giả định và chạy mô phỏng cho cả tình huống thời gian hoàn vốn vượt số vòng của màn.

## 7. Dự báo, sự kiện kinh tế, biểu đồ

- Trước mỗi vòng game hiển thị dự báo có độ tin cậy hữu hạn. Dự báo là dữ kiện để suy xét, không cho biết tương lai chính xác.
- **Sự kiện kinh tế bất ngờ:** Khi roll và dừng đúng ô, chọn kịch bản với seeded RNG; có thể làm một loại tài sản tăng và loại khác giảm. Tác động **ngay lập tức** lên giá đang giao dịch, lưu history và log; không chờ START.
- Nếu event làm giá cổ phiếu giảm 12% từ 100.000đ thì giá mới 88.000đ ngay, chart thêm điểm `shock`. Cuối vòng nếu biến động thường +5% thì từ 88.000đ lên 92.400đ: **không được tính lại -12%**.
- Nếu event xảy ra khi người chơi không sở hữu mã nào, giá niêm yết và biểu đồ của toàn thị trường vẫn cập nhật; sau đó người chơi có thể mua theo giá mới nếu tới đúng ô.
- Một event tác động đồng bộ tới 6 cổ phiếu, bonds/gold và trạng thái kinh doanh có liên quan. Không phải mỗi cổ phiếu tự bốc một event tách biệt. Diễn biến xu hướng không có quy luật tuyệt đối kiểu «chiến tranh luôn làm vàng tăng».
- Khóa UI thông tin lịch sử giá vào thời điểm hiện tại; chart không thấy dữ liệu của vòng chưa diễn ra. Các sự kiện lớn được đánh dấu tên và thời điểm trên chart.

## 8. Điều kiện thắng: khả năng thực sự mua mục tiêu

- Trò chơi hướng tới **mua món đồ 80M và còn tối thiểu 10M tiền dự phòng**. Mục tiêu không được chỉ dựa trên tổng tài sản ròng.
- Ở cuối màn, tính **nguồn tiền có thể huy động** theo đúng quyền bán cuối màn: Cash + giá trị có thể bán hiện tại của Stock/Bond/Gold **sau spread và phí** + các khoản Saving có thể rút hợp lệ **sau mất lãi/chi phí rút sớm** − **toàn bộ khoản nợ chưa thanh toán**. Business đang khóa không tính, kể cả khi có giá trị ghi sổ.
- Điều kiện: `nguon_tien_co_the_huy_dong >= 80M + 10M`. Các khoản không thể thanh lý đúng luật không được tính. Không cộng lại tài sản đã bán, lãi đã nhận hoặc tiền vay như tài sản ròng tự do.
- Hiển thị tách biệt: `tổng giá trị tài sản`, `nợ`, `tiền mặt`, `tiền có thể huy động hợp lệ`, `giá món đồ`, `tiền còn sau mua`, `đạt/chưa đạt`.
- Để tránh tính chi phí hai lần, dùng helper duy nhất tính liquidation quote; nếu player chọn thực hiện mua giả lập ở Result thì dùng đúng quote đó, không đổi giá ngẫu nhiên.
- **CẦN BÁO CÁO:** Đo tỷ lệ chiến lược chỉ giữ Cash, chỉ tiết kiệm, ưu tiên cổ phiếu, ưu tiên kinh doanh, kết hợp, không được tự chỉnh bất lợi cho chiến lược giữ tiền.

## 9. Logging, architecture và UI

- Giữ React + TypeScript + Vite và giao diện/bàn cờ hiện có nếu có thể. Sửa engine/data trước, không viết lại ứng dụng.
- Core deterministic engine sở hữu giá, tiền, trạng thái; UI chỉ gọi actions để quyết định. Seeded RNG dùng stream tách biệt hoặc thứ tự gọi ổn định; mở modal, xem chart hoặc reload không làm kết quả roll tiếp thay đổi.
- Log trước/sau: seed, lap, turn, position, eventId, action, cash/lot/asset/debt/income deltas, shock effects theo mã, giá trước/sau, event time, lần trả lương, coupon, maturity, business payout, funding source.
- UI điện thoại tối thiểu 320px; phải thấy rõ số vòng còn lại, lương tại START, Cash, nợ, tài sản, Goal, khả năng huy động; preview chi phí và lãi khi bán/rút trước quyết định.
- Không thêm AI, xác thực, backend, multiplayer, hệ thống kỹ năng, ranking hoặc giao dịch dữ liệu tài chính thật.

## 10. Tiêu chí kiểm thử và báo cáo mô phỏng

1. Unit tests cho từng loại ô, khoảng kỳ hạn Saving, trả coupon, lương, self-investment, kinh doanh, khóa bán, market shock và chart.
2. Integration test đường đi: roll vượt START và dừng ô chi phí; roll dừng đúng ô sinh hoạt; hai shock cùng vòng; event rồi START; vừa đáo hạn vừa thiếu tiền; thanh khoản bất khả thi; vòng 3 kết thúc; kinh doanh sai xu hướng.
3. Invariants: không có tiền vô cớ, không nhận lương hai lần, không trả coupon/đáo hạn hai lần, không âm số lượng sở hữu, không nhân đôi shock, nợ không tự biến mất, tiền mua/bán đúng chart, rollback không làm đổi seed.
4. Dùng >= 5.000 seed và ít nhất 5 chiến lược có quy tắc nhất quán; báo tỷ lệ thắng, median & p10/p90 tiền có thể huy động, nợ, thiếu tiền, số lần dừng từng ô, xác suất gặp lại ô kinh doanh, tỷ lệ mua/nâng cấp/bán kinh doanh, số lần có chi phí sinh hoạt, mức ảnh hưởng do random.
5. Chạy `npm test`, `npm run build`, `npm run lint` nếu có; chạy ít nhất 1 ván thực tế bằng browser tới màn Result; kiểm tra màn 320px. Đừng nói đã thực hiện manual browser nếu không có công cụ trình duyệt.
6. Cung cấp danh sách file thay đổi, luật đã implement, số liệu theo seed, các giả định THỬ NGHIỆM, lỗi tồn đọng và quyết định cần người dùng duyệt; **không tự âm thầm cân bằng thông số** để đạt tỷ lệ thắng tùy ý.

## 11. Chú giải nhất quán

- `lap/vòng`: một lần đi hết bàn và qua START, **không mặc định tương đương một năm/quý**; phần trăm lợi tức là đơn vị game theo vòng được ghi rõ.
- `sell at START`: bán chủ động các tài sản tài chính, khác với bán khẩn cấp khi phải trả khoản thiếu; cả hai không áp dụng cho Kinh doanh.
- `liquidatable funds`: nguồn tiền có thể huy động theo đúng luật, **không phải** `netWorth`.
- `price history`: diễn biến đã xảy ra, không phải dự báo chắc chắn.
