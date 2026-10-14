> **SUPERSEDED** — Guide solo V2.2 theo seed/mode/luật tại thời điểm đó; không dùng làm hướng dẫn mặc định V2.4. Nguồn chuẩn hiện tại: [CURRENT_MVP.md](CURRENT_MVP.md). Các phương pháp, kết quả và nội dung gốc bên dưới được giữ nguyên; lệnh lịch sử không được thực thi lại trong audit này.

# Hướng dẫn solo — playtest lãi tiết kiệm V2.2 đã được duyệt

Mục tiêu: chủ dự án đánh giá quyết định tài chính có dễ hiểu và có hậu quả hợp lý. **Chơi 6 ván**, có thể chia 2 buổi; không cần chạy mô phỏng hoặc kiểm tra visual polish. Experimental B hiện dùng **4/5/6%** theo kỳ hạn; Original và Experimental A giữ **6/7/8%**. Chỉ profile lãi của Experimental B thay đổi.

## Chuẩn bị

Chạy `npm run dev`, mở địa chỉ local Vite in ra. Mỗi lần thiết lập chọn **Experimental B ·4 vòng ·C20**; mặc định khi chơi mới lại là Original. C20 có business ở9/14/16, macro ở6. Vốn50M; mục tiêu mua80M còn10M, tức90M nguồn hợp lệ.

Nhập seed chính xác và phân bổ theo bảng. Giữ một quy tắc chung: học6M nếu còn ≥2 START và đủ cash; trả chi phí ngay trừ khi muốn ghi riêng một thử nghiệm defer; không mua nếu còn dưới10M dự phòng. Gặp cơ hội có quyền bỏ qua. Không đổi chính sách giữa ván để cố thắng.

### Kiểm tra lãi trước khi chơi

| Kỳ hạn | Experimental B: lãi mỗi START / tổng lãi đủ kỳ | Original và Experimental A: lãi mỗi START / tổng lãi đủ kỳ |
|---|---|---|
| 1 START | 4% / 4% | 6% / 6% |
| 2 START | 5% / 10% | 7% / 14% |
| 3 START | 6% / 18% | 8% / 24% |

Lãi đơn = gốc × lãi mỗi START × kỳ hạn; làm tròn đến đồng, trả cùng gốc khi đủ kỳ. Ví dụ B gửi 30M kỳ hạn 3 ở đầu ván nhận **35,4M tại START3**; gửi 5M kỳ hạn 2 trong vòng 3 nhận **5,5M tại START4**. Mỗi lần gửi là lot riêng, không tái tục. Rút trước hạn phải rút toàn lot, nhận gốc và mất toàn bộ lãi chưa trả. Cuối màn, lot chưa đáo hạn chỉ tính gốc vào nguồn hợp lệ. Kỳ hạn và luật funding không thay đổi.

## Sáu ván có mục đích

| Ván | Seed / gửi đầu / kỳ hạn | Cách chơi | Điểm cần đánh giá |
|---|---|---|---|
|1. Saving có dự phòng |`XVTL-V2-2` /30M /3 START|Ưu tiên saving; ởbank gửi85% phần cash vượt10M, kỳ hạn=min(3, START còn lại). Bỏ qua stock/bond/gold/business.|Dự phòng20M có giúp học và trả chi phí? Có lot nào phải rút/mất lãi? Cuối vòng3 gốc/lãi đầu ván có đúng30M+5,4M nếu giữ đủ?|
|2. Business |`XVTL-V2-6` /0 /1|Giữ cash cho cơ sở20M; mua vòng1–2 nếu còn10M dự phòng. Ở lần gặp sau mới cân nhắc một nâng5M đúngtrend, chỉ khi còn≥3 START. Tìm bán từ vòng3, không mua lại.|Mua rồi nút nâng phải khóa. Không bán tạiSTART hoặc funding. Bán sớm mất income sau đó nhưng bảo đảm cash: quyết định có đáng cân nhắc?|
|3. Đầu tư rủi ro |`XVTL-V2-0` /0 /1|Mỗi ôstock mua tối đa10M khi đủ dự phòng; ghi lý do dựa trên forecast/chart. Có thể mua gold3M để so spread; bond5M chỉ nếu còn≥2 START và yield đáo hạn dương. Không đầu tư business/saving.|Chart/forecast giúp chọn exposure hay chỉ gây cảm giác đoán giá? Phí/spread có làm mua muộn kém? Credit-tightening ởvòng3 tạo tác động thấy được?|
|4. Diversified |`XVTL-V2-0` /15M /1|Stock/bond/gold tối đa5/5/3M; bank25% phần dư term1. Business chỉ khi còn≥3 START và mua xong vẫn≥10M cash; không bắt buộc mua mọi thứ.|Nhiều loại tài sản có giảm rủi ro cash hay làm phân tán vốn/khó đạt ticket20M? So với ván3 cùng seed, đâu là đánh đổi?|
|5. Emergency rút lot |`XVTL-V2-2` /40M /3|Policy saving như ván1; khi thiếu, ưu tiên rút **toàn lot** rồi trả thiếu. Không mua tài sản khác.|Mất lãi có đúng và được hiểu trước khi xác nhận? Gốc dư có vềcash, nghĩa vụ có hết?|
|6. Emergency vay |`XVTL-V2-2` /40M /3|Giữ cùng quy tắc ván5, nhưng ưu tiên **vay vừa đủ** trong hạn mức khi thiếu. Không vay để mua đầu tư. SauSTART đọc gốc+lãi thực trả.|So chi phí vay với lãi forfeited; có thể trả bằng lương/maturity không? Có lần vay nào đáng hơn rút nhưng tăng rủi ro thanh khoản về sau?|

Seed là đường đi, **không phải đáp án chiến thắng**. Các số benchmark dưới đây chỉ đúng khi action/policy khớp; nếu chọn lượng/mã/defer khác, kết quả cuối khác là bình thường. Không cần ép kết quả của mình giống runner.

**Checkpoint cụ thể để dễ tái hiện:**

- Ván2 seed6: business vòng2 lượt11 ởô14, lượt12 ởô16; có thể mua20M rồi lần sau nâng5M. Vòng3 lượt17 trở lạiô14 để bán; nếu đợi đếnvòng4 lượt23 cònô9. Macro demand-boom vòng4 lượt22. Đây là đường đi xác nhận bằng engine; ván browser V2.1 cùng seed cũng đã hoàn tất, nhưng trước đây dùng chính sách bán vòng4 và hai lần nâng nên không dùng kết quả đó làm expected cho guide.
- Ván5/6 seed2: học6M lượt1, bỏbusiness lượt2, nhậnthưởng2M lượt3; living7M lượt4 còn thiếu **1M**. Rút40M làm mất **7,2M** lãi; vay1M để trả thiếu tạo gốc1M +lãi0,1M tạiSTART1. Gốc tiết kiệm vẫn40M, đáo hạnSTART3 nhận47,2M nếu không rút. Seed2 có3 macro trong toàn ván.
- Với **toàn policy runner V2.2** (bank85% excess, trả ngay, học khi≥2START), ván1 cuối **99.205.000đ**, ván5 **96.355.000đ**, ván6 **100.046.500đ**. Đây là kết quả engine, không phải cả ba ván đã được chơi bằng browser. Nếu thao tác khác, dùng JSON để giải thích chênh lệch, không gọi ngay là bug. Dữ liệu và lệnh tái lập: [báo cáo triển khai](V2_2_IMPLEMENTATION_REPORT.md).

Ở ván3/4, đọc giá bond so mệnh giá100k: giữ đủ2 coupon nhận110k cho mỗi unit; mua trên110k không tự lời chỉ vì nhãn coupon5%. Gold gross10M bán nhận khoảng9,603M trước biến động. Forecast nói về START sắp tới, không bảo đảm các vòng sau cùng regime. Business quote chưa bán **không giúp** mua mục tiêu90M.

## Ghi lại và xuất dữ liệu

Ở mỗi START ghi nhanh: vòng, cash, salary14M hoặc17M, savings matured (gốc/lãi), coupon/gốc bond, business income, nợ/nghĩa vụ. Ván hoàn tất4 vòng phải có **4 lần salary và4 settlement**, không phải chỉ đếm số lần die dừng chính xác START.

Trước refresh/đóng trang/chơi mới, mở **Nhật ký →Tải nhật ký JSON**, hoặc tạiResult chọn **Tải nhật ký quyết định**. Kiểm tra file `.json` thật có trong Downloads và mở được. Rename để phân biệt ví dụ `solo-05-rut-lot-XVTL-V2-2.json`; không sửa nội dung. Log mới **schema5**, có `savingsProfile.id` và `rates`, mode/board/laps/seed, rolls/encounters, mọi action/funding, before/after, lockedcapital và finalresult. B mới phải có `v2.2-c20`, rates `0.04/0.05/0.06`; A20 dùng `v2.1-standard`. Log V2.1/schema4 cũ vẫn replay với lãi cũ, kể cả C20; không sửa log cũ để áp lãi mới. Không có autosave/import UI/backend; không cần gửi dữ liệu cho dịch vụ bên ngoài.

Mỗi ván chỉ thêm một dòng ghi chú theo mẫu:

```text
Ván / seed / mode / gửi đầu / term:
Quyết định khó nhất và lý do:
Rolls / thiếu tiền / rút lot / bán khẩn cấp / vay:
Business mua-nâng-bán / vốn còn khóa:
Final lawful proceeds / thắng-thua / file JSON:
Chỗ không hiểu hoặc số tiền nghi sai (vòng, lượt, trước→sau):
Thời gian thực chơi / có thấy lượt lặp hoặc mệt không:
```

Nếu nghi lỗi, giữ JSON và ghi đúng vòng/lượt/action. Đối chiếu **nguồn huy động hợp lệ**, không chỉ tài sản ròng. Không refresh để reroll hoặc đổi seed khi thua. Nếu không gặp một nhánh, đánh dấu “không gặp”; không coi là đã test. Insolvency tự nhiên không bảo đảm ở6 ván; nhánh này đã có engine tests/fixture browser V2.1, không cần cố phá sản chỉ để đạt checklist.

## Chốt sau sáu ván

Trả lời5 câu, không lấy tỷ lệ thắng6 ván làm cân bằng thống kê:

1. Saving có quá rõ ràng là lựa chọn tốt nhất dù đã tính dự phòng/mất lãi, hay vẫn có quyết định về lot và kỳ hạn?
2. Business có cho phép lập kế hoạch thu nhập–nâng–thoát vốn? Có hiểu vì sao quote cao mà chưa bán vẫn thua?
3. Forecast/chart/yield có thay đổi lựa chọn rủi ro một cách giải thích được?
4. Bán vừa đủ, rút lot, vay và defer có hậu quả tiền rõ ràng, không bất ngờ do phép tính?
5. 90M có tạo mục tiêu đầu tư hợp lý mà không làm mọi ván chỉ trông chờ xúc xắc?

Gói savings4/5/6% trong [review](V2_2_MECHANICS_REVIEW.md) đã được phê duyệt và triển khai cho **ván Experimental B mới**. Hãy ghi feedback về lựa chọn kỳ hạn, dự phòng và chi phí vay/rút lot; không cần mở thêm hàng loạt biến thể. Original3/A20 vẫn là mặc định và có thể chơi một ván baseline tùy chọn, không thay thế sáu vánC20. So Experimental A với B hiện đổi cả board và lãi, nên không quy toàn bộ chênh lệch cho một yếu tố.
