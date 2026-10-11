# Phân tích cân bằng bàn cờ V2

Ngày phân tích: **11/10/2026**. Chẩn đoán offline trên **4 vòng, mục tiêu huy động hợp lệ 90M**; không phải thay đổi luật đã phê duyệt.

> Cập nhật V2.1 (11/10/2026): C20 nay có thể chọn trong Experimental B, vẫn giữ Original 3 vòng/A20 làm mặc định. Các mô tả engine cho phép mua rồi nâng ngay cùng encounter bên dưới là hành vi **V2 tại thời điểm nghiên cứu**, đã được sửa: V2.1 chỉ mở nâng cấp từ encounter kinh doanh tiếp theo. Heuristic của nghiên cứu vốn chỉ thực hiện một giao dịch kinh doanh/encounter, nên không bị đổi kết quả. Đã đối chiếu 60.000 ván A20/C20 và 25.000 ván baseline 3 vòng; kết quả khớp. Xem [báo cáo V2.1](V2_1_PLAYTEST_READINESS.md) và [kết quả đối chiếu](simulations/v2_1-policy-impact.json). Các CLI lịch sử kiểm tra hash nguồn sẽ dừng sau cập nhật được phép này; giữ nguyên manifest lịch sử, dùng script đối chiếu V2.1 để tái kiểm tra.

## Khuyến nghị trước

**Giữ 20 ô. Ưu tiên playtest C20: 3 ô kinh doanh, 1 macro, giữ 2 khóa học và mọi số lượng khác như hiện tại.** Đây là phương án thay duy nhất macro ô 14 thành kinh doanh, chưa sửa bàn sản phẩm. Không tối ưu để đạt tỷ lệ thắng 50% hay ép các tài sản ngang nhau. C20 ưu tiên thêm cơ hội mua/nâng/bán kinh doanh và giữ khả năng tiếp cận khóa học cho người mới; vẫn còn biến động thị trường thường và một ô macro.

Cần xem quyết định này như **khuyến nghị từ các heuristic và mô hình**, chưa có bằng chứng playtest người thật về mức dễ hiểu, mệt mỏi hay niềm vui. Kích thước 20 hợp lý hơn việc kéo dài bàn chỉ để thêm lượt. Bàn 16 có thể dùng để nghiên cứu trải nghiệm ngắn, bàn 24 chưa cho thấy lý do đủ mạnh để ưu tiên làm mặc định.

**Phân bổ khuyến nghị C20:** START×1, Ngân hàng×2, Cổ phiếu×2, Trái phiếu×2, Vàng×2, Kinh doanh×3, Khóa học×2, Sinh hoạt×2, Biến cố cá nhân×2, Macro×1, Dòng tiền×1. Vị trí tính từ 1, chiều di chuyển hiện tại; dãy chính xác ở mục bố trí.

## Phạm vi, dữ liệu và chính sách

Đã đọc ba báo cáo triển khai/cân bằng/độ dài; kiểm tra board, config, engine, transactions, market và mô hình chẩn đoán trước. Giữ nguyên 50M vốn đầu, 14M/START, học 6M/+3M, mục tiêu 80M +10M dự phòng, giá/lãi/phí, d6, luật qua START và thứ tự settlement. Bản chính thức vẫn **3 vòng, 20 ô**. Chỉ ghi script và báo cáo/kết quả mới; không deploy Vercel.

- **235.000 ván đã hoàn tất:** 25.000 tái lập baseline 3 vòng; 210.000 ván thử nghiệm =7 bàn ×6 chính sách ×5.000 seed. Seed chung `XVTL-V2-0`…`XVTL-V2-4999`.
- Tái lập toàn bộ trường baseline 3 vòng và cả 6 nhóm đối chứng 4 vòng từ báo cáo độ dài. So sánh biểu diễn JSON chính xác; chỉ chuẩn hóa số 0 có dấu từ tổng dòng tiền rỗng, không làm tròn kết quả để cho qua sai khác.
- Dùng engine thật và policy cũ; chỉ thay BOARD/RULES.tiles/RULES.laps trong tiến trình thử nghiệm riêng, đồng bộ và phục hồi bằng finally. Không ghi cấu hình thử vào source; kiểm tra hash 56 file trước/sau từng bố trí.
- **Cùng 20 ô:** xác nhận đường xúc xắc, vị trí và forecast khớp theo seed; mọi ô non-START đều rút một RNG khi encounter, macro không rút RNG phụ. **16/24:** chỉ ghép cùng seed, không có đường đi vật lý giống hệt; số lượt và thời điểm event/normal thay stream tiêu thụ. Chênh lệch gồm cả kích thước, phân bổ và vị trí.
- Tiền mặt không học/đầu tư. Tiết kiệm gửi đầu 40M kỳ hạn 3, gửi thêm 85% phần vượt dự phòng tại bank. Cổ phiếu mua tối đa 25M, mã theo turn modulo 6. Kết hợp gửi đầu 15M kỳ hạn 1, các ticket stock/bond/gold 5/5/3M, bank 25% phần dư. Không nhìn giá tương lai hoặc RNG tương lai.
- Trừ tiền mặt, học khi đủ Cash và còn ≥2 START. Mua/nâng kinh doanh ở vòng 1–3, bán tại đúng ô trong vòng 4; heuristic chỉ thực hiện một giao dịch kinh doanh mỗi visit. **Engine cho phép nhiều giao dịch trong cùng event**, có thể mua rồi nâng ngay nếu đủ Cash; heuristic không tận dụng điều đó. Đối chứng bán vòng 3–4 **đồng thời dừng mua/nâng từ vòng 3**, không mở lại sau bán: giữ nguyên policy của nghiên cứu độ dài. Đây là khác biệt policy, không sửa quyền bán của engine; chỉ so với policy vòng cuối trong cùng bàn rồi so cùng policy giữa các bàn. Đối chứng hai vòng chạy riêng cho business-heavy; chưa chạy cho diversified.
- Mua tự chọn dùng Cash sau dự phòng 10M; ticket tối thiểu policy 1M với tài sản tài chính. Funding giữ thứ tự rút toàn khoản gửi → stock → bond → gold → nợ giới hạn. Không bán tự chọn tại START trong heuristic này.

### Định nghĩa để tránh nhầm số lần dừng và giao dịch

“Lần gặp” là event non-START thực sự được xử lý, kể cả đích pending ở vòng kế. Raw landing bao gồm vị trí dư sau lượt cuối; đích non-START đó bị engine bỏ qua, không tạo cơ hội mua hoặc chi phí. START trong bảng kiểm kê chỉ là **dừng chính xác ở START**, không phải số lần lĩnh lương; cả qua START lẫn dừng chính xác đều settlement một lần, tổng 4 lần/ván hoàn tất.

“Thời điểm quyết định có lựa chọn” là một encounter có thể giao dịch hợp lệ, mua khóa học chưa sở hữu, hoặc có nhiều phương án thanh toán; không đếm macro acknowledge, sinh hoạt bắt buộc hay khóa học đã mua. Điều kiện engine cho tài sản tài chính là Cash≥1đ, business20M, nâng5M, học6M. Đây là đếm lựa chọn khả thi, chưa chứng minh giá trị giáo dục từng lựa chọn. Giao dịch thực tế được đếm riêng; không tính gửi đầu ván là lần ghé bank.

“Không khả dụng do Cash” là visit đúng tài sản policy nhắm đến nhưng thiếu ngân sách theo dự phòng/ticket nêu trên. Việc policy không muốn mua muộn và đạt trần nâng cấp được ghi riêng; không coi chúng là cấm giao dịch của engine. Số cơ hội pháp lý tại business có thể là bán tài sản đang giữ, nên khả năng mua/nâng/bán còn có trường riêng. Lãi business đã bán =thu nhập đã nhận +tiền bán −giá mua −nâng cấp; chưa bán có P/L chu kỳ là null, không phải 0.

Các tỷ lệ là trên toàn bộ 5.000 ván trừ khi ghi “trong người mua”. Quantile lấy floor((n−1)×p), đơn vị **M = triệu đồng**. JSON có Wilson95% và CI ghép seed cho chênh lệch thắng; độ bất định chỉ phản ánh mẫu seed dưới mô hình, không phản ánh sai số policy/người chơi hoặc hiệu chỉnh nhiều so sánh.

## Phân bổ và vị trí chính xác

| Loại ô | A20 | B20 | C20 | D20 | E20 | F16 | G24 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Xuất phát | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| Ngân hàng | 2 | 2 | 2 | 2 | 2 | 1 | 3 |
| Cổ phiếu | 2 | 2 | 2 | 2 | 2 | 1 | 2 |
| Sinh hoạt | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| Đầu tư bản thân | 2 | 1 | 2 | 2 | 1 | 2 | 2 |
| Kinh tế | 2 | 2 | 1 | 2 | 2 | 2 | 2 |
| Trái phiếu | 2 | 2 | 2 | 2 | 2 | 1 | 3 |
| Biến cố cá nhân | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
| Kinh doanh | 2 | 3 | 3 | 2 | 3 | 2 | 3 |
| Vàng | 2 | 2 | 2 | 2 | 2 | 1 | 3 |
| Dòng tiền | 1 | 1 | 1 | 1 | 1 | 1 | 1 |

### A20 — 20 ô

Bàn hiện tại, đối chứng.

1. start → 2. bank → 3. stocks → 4. living → 5. course → 6. macro → 7. bonds → 8. personal → 9. business → 10. gold → 11. obligation → 12. stocks → 13. bank → 14. macro → 15. living → 16. business → 17. course → 18. personal → 19. gold → 20. bonds


### B20 — 20 ô

Chỉ thay khóa học ô 17 bằng kinh doanh; giữ khóa học ô 5. Đo thay số lượng tối thiểu, kể cả nhược điểm hai ô kinh doanh liền nhau.

1. start → 2. bank → 3. stocks → 4. living → 5. course → 6. macro → 7. bonds → 8. personal → 9. business → 10. gold → 11. obligation → 12. stocks → 13. bank → 14. macro → 15. living → 16. business → 17. business → 18. personal → 19. gold → 20. bonds


### C20 — 20 ô

Chỉ thay macro ô 14 bằng kinh doanh; giữ macro ô 6. Tách tác động giảm macro khỏi giảm khóa học.

1. start → 2. bank → 3. stocks → 4. living → 5. course → 6. macro → 7. bonds → 8. personal → 9. business → 10. gold → 11. obligation → 12. stocks → 13. bank → 14. business → 15. living → 16. business → 17. course → 18. personal → 19. gold → 20. bonds


### D20 — 20 ô

Giữ mọi số lượng; từng cặp cách 10 ô. Khóa học đến sớm hơn, kinh doanh ở ô 7/17 thay 9/16.

1. start → 2. bank → 3. course → 4. living → 5. stocks → 6. macro → 7. business → 8. personal → 9. bonds → 10. gold → 11. obligation → 12. bank → 13. course → 14. living → 15. stocks → 16. macro → 17. business → 18. personal → 19. bonds → 20. gold


### E20 — 20 ô

Cùng số lượng với B; kinh doanh ô 2/9/16, khoảng 7/7/6, khóa học ô 3. So B để phân biệt cùng phân bổ nhưng khác vị trí.

1. start → 2. business → 3. course → 4. living → 5. stocks → 6. macro → 7. bank → 8. personal → 9. business → 10. gold → 11. obligation → 12. bonds → 13. bank → 14. living → 15. stocks → 16. business → 17. gold → 18. personal → 19. macro → 20. bonds


### F16 — 16 ô

16 ô: bỏ một bank/stock/bond/gold; giữ hai business/course/living/personal/macro và một Dòng tiền. Kinh doanh cách 8 ô.

1. start → 2. bank → 3. course → 4. living → 5. stocks → 6. macro → 7. business → 8. personal → 9. obligation → 10. bonds → 11. course → 12. living → 13. gold → 14. macro → 15. business → 16. personal


### G24 — 24 ô

24 ô: thêm một business/bank/bond/gold so A; không thêm nghĩa vụ hoặc shock. Business ô 7/14/21; lấp khoảng bằng tài sản thay phí.

1. start → 2. bank → 3. course → 4. living → 5. stocks → 6. macro → 7. business → 8. personal → 9. bonds → 10. gold → 11. obligation → 12. bank → 13. course → 14. business → 15. living → 16. stocks → 17. gold → 18. macro → 19. bank → 20. personal → 21. business → 22. bonds → 23. gold → 24. bonds


Mã loại: course =Đầu tư bản thân/khóa học; personal =Biến cố cá nhân, không phải đầu tư bản thân. B/C giữ các vị trí khác đúng A; D chỉ đổi vị trí, giữ mọi số lượng; E có cùng phân bổ với B nhưng giãn kinh doanh 7/7/6 ô và đưa khóa học lên đầu. F/G là phương án kích thước kèm phân bổ, không phải thí nghiệm nhân quả chỉ thay chiều dài. Row/col/UI của bàn thay thế chưa được thiết kế; mô phỏng chỉ dùng thứ tự logic.

## Kiểm kê bàn hiện tại A20

Mọi chiến lược có cùng đường đi và event exposure ở A20 trong mẫu; dùng tiền mặt để tránh lẫn quyết định đầu tư. Cột không gặp dựa trên event đã xử lý; START dùng raw landing riêng.

| Ô | Loại | Category | Raw/ván | Event/ván | Không gặp | V1 | V2 | V3 | V4 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Xuất phát | income | 1,16 | — | 25,56% | — | — | — | — |
| 2 | Ngân hàng | investment | 1,24 | 1,01 | 31,80% | 0,16 | 0,28 | 0,29 | 0,28 |
| 3 | Cổ phiếu | investment | 1,24 | 1,04 | 29,28% | 0,19 | 0,28 | 0,28 | 0,29 |
| 4 | Sinh hoạt | obligation | 1,21 | 1,07 | 28,30% | 0,22 | 0,29 | 0,28 | 0,28 |
| 5 | Đầu tư bản thân | income | 1,21 | 1,11 | 27,30% | 0,26 | 0,28 | 0,29 | 0,29 |
| 6 | Kinh tế | shock | 1,24 | 1,20 | 23,64% | 0,32 | 0,30 | 0,29 | 0,29 |
| 7 | Trái phiếu | investment | 1,22 | 1,22 | 23,04% | 0,37 | 0,29 | 0,30 | 0,27 |
| 8 | Biến cố cá nhân | shock | 1,10 | 1,10 | 27,94% | 0,24 | 0,28 | 0,28 | 0,30 |
| 9 | Kinh doanh | investment | 1,12 | 1,12 | 26,80% | 0,27 | 0,29 | 0,28 | 0,28 |
| 10 | Vàng | investment | 1,13 | 1,13 | 26,72% | 0,27 | 0,28 | 0,29 | 0,29 |
| 11 | Dòng tiền | obligation | 1,16 | 1,16 | 25,62% | 0,29 | 0,29 | 0,29 | 0,29 |
| 12 | Cổ phiếu | investment | 1,16 | 1,16 | 25,20% | 0,29 | 0,30 | 0,29 | 0,28 |
| 13 | Ngân hàng | investment | 1,15 | 1,15 | 25,54% | 0,29 | 0,29 | 0,29 | 0,29 |
| 14 | Kinh tế | shock | 1,12 | 1,12 | 26,88% | 0,27 | 0,27 | 0,28 | 0,29 |
| 15 | Sinh hoạt | obligation | 1,14 | 1,14 | 25,76% | 0,29 | 0,28 | 0,29 | 0,28 |
| 16 | Kinh doanh | investment | 1,15 | 1,15 | 25,42% | 0,29 | 0,29 | 0,28 | 0,29 |
| 17 | Đầu tư bản thân | income | 1,14 | 1,14 | 26,32% | 0,28 | 0,29 | 0,28 | 0,28 |
| 18 | Biến cố cá nhân | shock | 1,14 | 1,14 | 25,80% | 0,28 | 0,28 | 0,29 | 0,29 |
| 19 | Vàng | investment | 1,15 | 1,15 | 25,76% | 0,29 | 0,29 | 0,29 | 0,28 |
| 20 | Trái phiếu | investment | 1,13 | 1,13 | 26,68% | 0,28 | 0,28 | 0,29 | 0,28 |

| Nhóm | Lần gặp TB | Không gặp cả ván | V1 | V2 | V3 | V4 | Không gặp V1–3 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Xuất phát | 1,16 | 25,56% | 0,29 | 0,29 | 0,30 | 0,29 | 35,58% |
| Ngân hàng | 2,16 | 7,96% | 0,45 | 0,58 | 0,57 | 0,57 | 15,60% |
| Cổ phiếu | 2,20 | 6,94% | 0,48 | 0,58 | 0,57 | 0,57 | 14,64% |
| Sinh hoạt | 2,21 | 7,12% | 0,51 | 0,57 | 0,57 | 0,56 | 14,24% |
| Đầu tư bản thân | 2,25 | 7,46% | 0,54 | 0,57 | 0,57 | 0,57 | 13,86% |
| Kinh tế | 2,32 | 6,16% | 0,59 | 0,57 | 0,57 | 0,58 | 12,64% |
| Trái phiếu | 2,35 | 5,26% | 0,65 | 0,57 | 0,59 | 0,55 | 10,52% |
| Biến cố cá nhân | 2,24 | 6,96% | 0,52 | 0,55 | 0,58 | 0,59 | 13,84% |
| Kinh doanh | 2,27 | 5,90% | 0,56 | 0,58 | 0,57 | 0,56 | 12,54% |
| Vàng | 2,28 | 6,92% | 0,56 | 0,58 | 0,58 | 0,57 | 13,44% |
| Dòng tiền | 1,16 | 25,62% | 0,29 | 0,29 | 0,29 | 0,29 | 35,76% |

Bốn category rộng của engine: trung bình encounter/ván và xác suất không gặp (đặt trong ngoặc). Income chỉ đếm khóa học; bốn lần nhận lương tại START được báo riêng, không trộn vào cơ hội học.

| Category | A20 | B20 | C20 | D20 | E20 | F16 | G24 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| investment | 11,27 (0,00%) | 12,41 (0,00%) | 12,39 (0,00%) | 11,31 (0,00%) | 12,47 (0,00%) | 6,77 (0,02%) | 15,89 (0,00%) |
| income | 2,25 (7,46%) | 1,11 (27,30%) | 2,25 (7,46%) | 2,20 (7,70%) | 1,04 (29,28%) | 2,21 (7,30%) | 2,20 (7,64%) |
| shock | 4,56 (0,34%) | 4,56 (0,34%) | 3,44 (1,24%) | 4,59 (0,28%) | 4,59 (0,24%) | 4,54 (0,44%) | 4,58 (0,26%) |
| obligation | 3,37 (1,54%) | 3,37 (1,54%) | 3,37 (1,54%) | 3,35 (1,74%) | 3,35 (1,74%) | 3,35 (1,78%) | 3,39 (1,48%) |

Không nên coi mọi ô có xác suất giống nhau trong màn hữu hạn: ô đầu sau START thiếu một lần tiếp cận từ vị trí dư ban đầu và đích dư cuối bị bỏ. Ví dụ ô 2 nhận 1,01 encounter/ván, ô 7 nhận 1,22. Trong trạng thái dài hạn, xấp xỉ mỗi ô non-START được dừng **1/3,5 lần mỗi vòng**, thay vì số ô của loại đó chia kích thước bàn rồi coi đó là số gặp/vòng. Tính renewal chính xác bên dưới đã tính đầu màn và kết thúc hữu hạn.

## So sánh truy cập giữa các bàn

Số lần gặp trung bình, không phải số lần mua. START vẫn có định nghĩa riêng.

| Loại | A20 | B20 | C20 | D20 | E20 | F16 | G24 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Xuất phát | 1,16 | 1,16 | 1,16 | 1,16 | 1,16 | 1,16 | 1,13 |
| Ngân hàng | 2,16 | 2,16 | 2,16 | 2,17 | 2,38 | 1,01 | 3,29 |
| Cổ phiếu | 2,20 | 2,20 | 2,20 | 2,25 | 2,25 | 1,11 | 2,28 |
| Sinh hoạt | 2,21 | 2,21 | 2,21 | 2,19 | 2,19 | 2,24 | 2,24 |
| Đầu tư bản thân | 2,25 | 1,11 | 2,25 | 2,20 | 1,04 | 2,21 | 2,20 |
| Kinh tế | 2,32 | 2,32 | 1,20 | 2,35 | 2,35 | 2,29 | 2,33 |
| Trái phiếu | 2,35 | 2,35 | 2,35 | 2,27 | 2,29 | 1,14 | 3,42 |
| Biến cố cá nhân | 2,24 | 2,24 | 2,24 | 2,24 | 2,24 | 2,24 | 2,25 |
| Kinh doanh | 2,27 | 3,41 | 3,39 | 2,36 | 3,28 | 2,36 | 3,50 |
| Vàng | 2,28 | 2,28 | 2,28 | 2,26 | 2,27 | 1,15 | 3,41 |
| Dòng tiền | 1,16 | 1,16 | 1,16 | 1,16 | 1,16 | 1,12 | 1,16 |

Xác suất không gặp loại ô trong cả 4 vòng:

| Loại | A20 | B20 | C20 | D20 | E20 | F16 | G24 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Xuất phát | 25,56% | 25,56% | 25,56% | 25,56% | 25,56% | 26,04% | 26,62% |
| Ngân hàng | 7,96% | 7,96% | 7,96% | 7,82% | 7,34% | 30,22% | 1,68% |
| Cổ phiếu | 6,94% | 6,94% | 6,94% | 6,74% | 6,74% | 26,30% | 7,42% |
| Sinh hoạt | 7,12% | 7,12% | 7,12% | 8,18% | 8,18% | 7,06% | 7,00% |
| Đầu tư bản thân | 7,46% | 27,30% | 7,46% | 7,70% | 29,28% | 7,30% | 7,64% |
| Kinh tế | 6,16% | 6,16% | 23,64% | 6,26% | 5,62% | 6,76% | 6,20% |
| Trái phiếu | 5,26% | 5,26% | 5,26% | 6,22% | 6,88% | 25,86% | 1,54% |
| Biến cố cá nhân | 6,96% | 6,96% | 6,96% | 6,96% | 6,96% | 6,48% | 6,80% |
| Kinh doanh | 5,90% | 1,22% | 1,38% | 6,22% | 2,14% | 5,44% | 1,44% |
| Vàng | 6,92% | 6,92% | 6,92% | 7,10% | 6,48% | 25,76% | 1,66% |
| Dòng tiền | 25,62% | 25,62% | 25,62% | 25,62% | 25,62% | 26,80% | 25,70% |

Thời điểm cơ hội kinh doanh/khóa học; “không gặp sớm” là không gặp vòng 1–3, không suy ra đã mua được khi gặp:

| Bàn | Nhóm | V1 | V2 | V3 | V4 | Không gặp sớm |
| --- | --- | --- | --- | --- | --- | --- |
| A20 | Kinh doanh | 0,56 | 0,58 | 0,57 | 0,56 | 12,54% |
| A20 | Đầu tư bản thân | 0,54 | 0,57 | 0,57 | 0,57 | 13,86% |
| B20 | Kinh doanh | 0,85 | 0,87 | 0,85 | 0,84 | 3,70% |
| B20 | Đầu tư bản thân | 0,26 | 0,28 | 0,29 | 0,29 | 37,64% |
| C20 | Kinh doanh | 0,84 | 0,85 | 0,85 | 0,85 | 4,24% |
| C20 | Đầu tư bản thân | 0,54 | 0,57 | 0,57 | 0,57 | 13,86% |
| D20 | Kinh doanh | 0,65 | 0,57 | 0,58 | 0,55 | 11,70% |
| D20 | Đầu tư bản thân | 0,48 | 0,57 | 0,57 | 0,58 | 15,82% |
| E20 | Kinh doanh | 0,72 | 0,86 | 0,85 | 0,84 | 5,94% |
| E20 | Đầu tư bản thân | 0,19 | 0,28 | 0,28 | 0,29 | 41,58% |
| F16 | Kinh doanh | 0,66 | 0,57 | 0,55 | 0,58 | 10,82% |
| F16 | Đầu tư bản thân | 0,48 | 0,58 | 0,57 | 0,58 | 14,56% |
| G24 | Kinh doanh | 0,93 | 0,86 | 0,86 | 0,85 | 4,12% |
| G24 | Đầu tư bản thân | 0,48 | 0,58 | 0,56 | 0,58 | 15,22% |

## Kết quả 4 vòng, cùng mục tiêu 90M

“Mốc lựa chọn” chưa cộng funding; funding được báo riêng trong JSON. “GD tự chọn” tính các giao dịch qua form và khóa học, không tính trả sinh hoạt bắt buộc. Cột rolls là trung bình.

| Bàn | Policy | Thắng | p10 M | Median M | p90 M | Rolls | Mốc lựa chọn | GD tự chọn |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A20 | Tiền mặt | 20,32% | 67,50 | 81,50 | 94,00 | 23,32 | 16,54 | 0,00 |
| A20 | Tiết kiệm | 63,52% | 75,72 | 94,89 | 111,34 | 23,32 | 13,72 | 2,41 |
| A20 | Cổ phiếu | 46,86% | 70,48 | 88,89 | 110,50 | 23,32 | 14,58 | 2,96 |
| A20 | Kinh doanh: bán vòng 4 | 31,60% | 63,95 | 82,32 | 103,32 | 23,32 | 15,23 | 2,99 |
| A20 | Kết hợp | 38,56% | 67,68 | 85,73 | 104,84 | 23,32 | 15,11 | 11,07 |
| A20 | Kinh doanh: bán vòng 3–4 | 37,60% | 68,40 | 85,65 | 102,71 | 23,32 | 15,23 | 2,56 |
| B20 | Tiền mặt | 20,32% | 67,50 | 81,50 | 94,00 | 23,32 | 16,54 | 0,00 |
| B20 | Tiết kiệm | 61,32% | 75,00 | 94,10 | 109,95 | 23,32 | 13,87 | 2,19 |
| B20 | Cổ phiếu | 43,30% | 68,90 | 87,21 | 109,35 | 23,32 | 15,09 | 2,72 |
| B20 | Kinh doanh: bán vòng 4 | 39,96% | 63,60 | 85,25 | 108,06 | 23,32 | 16,16 | 3,80 |
| B20 | Kết hợp | 40,48% | 67,03 | 86,33 | 106,34 | 23,32 | 15,94 | 11,46 |
| B20 | Kinh doanh: bán vòng 3–4 | 39,82% | 68,62 | 86,43 | 103,86 | 23,32 | 16,16 | 3,11 |
| C20 | Tiền mặt | 20,32% | 67,50 | 81,50 | 94,00 | 23,32 | 17,66 | 0,00 |
| C20 | Tiết kiệm | 63,52% | 75,72 | 94,89 | 111,34 | 23,32 | 14,09 | 2,41 |
| C20 | Cổ phiếu | 46,28% | 70,68 | 88,71 | 109,75 | 23,32 | 15,38 | 2,96 |
| C20 | Kinh doanh: bán vòng 4 | 41,28% | 65,25 | 86,40 | 107,40 | 23,32 | 16,35 | 4,01 |
| C20 | Kết hợp | 42,86% | 68,03 | 87,29 | 106,70 | 23,32 | 16,18 | 11,68 |
| C20 | Kinh doanh: bán vòng 3–4 | 43,34% | 70,52 | 87,58 | 103,92 | 23,32 | 16,35 | 3,32 |
| D20 | Tiền mặt | 22,54% | 67,00 | 82,00 | 94,00 | 23,32 | 16,53 | 0,00 |
| D20 | Tiết kiệm | 63,70% | 75,00 | 95,10 | 111,46 | 23,32 | 13,66 | 2,45 |
| D20 | Cổ phiếu | 48,64% | 70,23 | 89,46 | 111,92 | 23,32 | 14,72 | 2,97 |
| D20 | Kinh doanh: bán vòng 4 | 32,88% | 63,60 | 82,52 | 105,25 | 23,32 | 15,27 | 3,07 |
| D20 | Kết hợp | 40,28% | 67,33 | 86,27 | 105,99 | 23,32 | 15,15 | 11,00 |
| D20 | Kinh doanh: bán vòng 3–4 | 39,50% | 68,20 | 86,00 | 104,00 | 23,32 | 15,27 | 2,63 |
| E20 | Tiền mặt | 22,54% | 67,00 | 82,00 | 94,00 | 23,32 | 16,53 | 0,00 |
| E20 | Tiết kiệm | 62,20% | 74,93 | 94,52 | 109,87 | 23,32 | 14,45 | 2,20 |
| E20 | Cổ phiếu | 45,30% | 68,26 | 87,99 | 110,09 | 23,32 | 15,56 | 2,71 |
| E20 | Kinh doanh: bán vòng 4 | 37,34% | 63,45 | 84,03 | 106,47 | 23,32 | 16,20 | 3,60 |
| E20 | Kết hợp | 41,60% | 66,23 | 86,51 | 107,45 | 23,32 | 16,11 | 11,66 |
| E20 | Kinh doanh: bán vòng 3–4 | 38,04% | 68,16 | 86,00 | 102,52 | 23,32 | 16,20 | 2,89 |
| F16 | Tiền mặt | 19,44% | 67,00 | 81,50 | 93,50 | 18,74 | 11,97 | 0,00 |
| F16 | Tiết kiệm | 59,34% | 74,00 | 93,60 | 109,10 | 18,74 | 9,27 | 1,69 |
| F16 | Cổ phiếu | 42,02% | 70,60 | 87,28 | 105,34 | 18,74 | 10,44 | 1,96 |
| F16 | Kinh doanh: bán vòng 4 | 32,30% | 63,85 | 82,41 | 105,22 | 18,74 | 10,69 | 3,07 |
| F16 | Kết hợp | 34,66% | 66,22 | 84,17 | 104,35 | 18,74 | 10,62 | 6,93 |
| F16 | Kinh doanh: bán vòng 3–4 | 37,68% | 67,90 | 85,65 | 103,97 | 18,74 | 10,69 | 2,65 |
| G24 | Tiền mặt | 20,46% | 67,00 | 81,00 | 94,00 | 27,91 | 21,11 | 0,00 |
| G24 | Tiết kiệm | 65,48% | 76,76 | 95,71 | 111,94 | 27,91 | 17,36 | 3,07 |
| G24 | Cổ phiếu | 47,50% | 70,02 | 88,82 | 112,19 | 27,91 | 18,89 | 2,99 |
| G24 | Kinh doanh: bán vòng 4 | 40,70% | 65,55 | 85,51 | 108,84 | 27,91 | 19,84 | 4,08 |
| G24 | Kết hợp | 44,70% | 69,70 | 88,00 | 108,98 | 27,91 | 19,57 | 14,23 |
| G24 | Kinh doanh: bán vòng 3–4 | 42,80% | 70,00 | 87,56 | 105,27 | 27,91 | 19,84 | 3,38 |

### Cơ hội khả dụng, mua khóa học và khó khăn thanh khoản

“Visit đầu tư” đếm cả 5 loại tài sản; “thiếu Cash” chỉ đếm tài sản policy muốn giao dịch. Rút gửi/bán ép buộc là ít nhất một lần/ván. Nợ là từng vay trong ván; nợ cuối và số lần/giá trị funding, lãi mất có đầy đủ trong JSON.

| Bàn | Policy | Visit đầu tư | Đủ ngân sách | Thiếu Cash | Mua học | Rút gửi | Bán ép | Từng vay | Insolvent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A20 | Tiền mặt | 11,27 | 11,27 | 0,00 | 0,00% | 0,00% | 0,00% | 0,00% | 0,00% |
| A20 | Tiết kiệm | 11,27 | 6,54 | 0,57 | 81,60% | 37,84% | 0,00% | 0,00% | 0,00% |
| A20 | Cổ phiếu | 11,27 | 9,25 | 0,10 | 85,24% | 0,00% | 9,38% | 0,00% | 0,00% |
| A20 | Kinh doanh: bán vòng 4 | 11,27 | 11,26 | 0,01 | 86,14% | 0,00% | 0,00% | 0,00% | 0,00% |
| A20 | Kết hợp | 11,27 | 10,48 | 0,85 | 85,96% | 0,68% | 0,14% | 0,00% | 0,00% |
| A20 | Kinh doanh: bán vòng 3–4 | 11,27 | 11,26 | 0,01 | 86,14% | 0,00% | 0,00% | 0,00% | 0,00% |
| B20 | Tiền mặt | 12,41 | 12,41 | 0,00 | 0,00% | 0,00% | 0,00% | 0,00% | 0,00% |
| B20 | Tiết kiệm | 12,41 | 6,77 | 0,58 | 60,08% | 36,80% | 0,00% | 0,00% | 0,00% |
| B20 | Cổ phiếu | 12,41 | 9,75 | 0,10 | 61,98% | 0,00% | 9,48% | 0,00% | 0,00% |
| B20 | Kinh doanh: bán vòng 4 | 12,41 | 12,39 | 0,02 | 62,36% | 0,00% | 0,00% | 0,00% | 0,00% |
| B20 | Kết hợp | 12,41 | 11,29 | 1,26 | 62,36% | 0,52% | 0,16% | 0,00% | 0,00% |
| B20 | Kinh doanh: bán vòng 3–4 | 12,41 | 12,39 | 0,02 | 62,36% | 0,00% | 0,00% | 0,00% | 0,00% |
| C20 | Tiền mặt | 12,39 | 12,39 | 0,00 | 0,00% | 0,00% | 0,00% | 0,00% | 0,00% |
| C20 | Tiết kiệm | 12,39 | 6,80 | 0,57 | 81,60% | 37,84% | 0,00% | 0,00% | 0,00% |
| C20 | Cổ phiếu | 12,39 | 9,83 | 0,10 | 85,24% | 0,00% | 9,38% | 0,00% | 0,00% |
| C20 | Kinh doanh: bán vòng 4 | 12,39 | 12,37 | 0,01 | 86,14% | 0,00% | 0,00% | 0,00% | 0,00% |
| C20 | Kết hợp | 12,39 | 11,28 | 1,25 | 85,92% | 0,72% | 0,16% | 0,00% | 0,00% |
| C20 | Kinh doanh: bán vòng 3–4 | 12,39 | 12,37 | 0,01 | 86,14% | 0,00% | 0,00% | 0,00% | 0,00% |
| D20 | Tiền mặt | 11,31 | 11,31 | 0,00 | 0,00% | 0,00% | 0,00% | 0,00% | 0,00% |
| D20 | Tiết kiệm | 11,31 | 6,49 | 0,54 | 81,80% | 41,98% | 0,00% | 0,00% | 0,00% |
| D20 | Cổ phiếu | 11,31 | 9,31 | 0,12 | 84,04% | 0,00% | 5,08% | 0,00% | 0,00% |
| D20 | Kinh doanh: bán vòng 4 | 11,31 | 11,29 | 0,01 | 84,18% | 0,00% | 0,00% | 0,02% | 0,00% |
| D20 | Kết hợp | 11,31 | 10,45 | 0,96 | 84,16% | 1,84% | 0,40% | 0,00% | 0,00% |
| D20 | Kinh doanh: bán vòng 3–4 | 11,31 | 11,29 | 0,01 | 84,18% | 0,00% | 0,00% | 0,02% | 0,00% |
| E20 | Tiền mặt | 12,47 | 12,47 | 0,00 | 0,00% | 0,00% | 0,00% | 0,00% | 0,00% |
| E20 | Tiết kiệm | 12,47 | 7,08 | 0,76 | 58,42% | 31,68% | 0,00% | 0,00% | 0,00% |
| E20 | Cổ phiếu | 12,47 | 10,14 | 0,13 | 58,42% | 0,00% | 4,38% | 0,00% | 0,00% |
| E20 | Kinh doanh: bán vòng 4 | 12,47 | 12,45 | 0,02 | 58,42% | 0,00% | 0,00% | 0,02% | 0,00% |
| E20 | Kết hợp | 12,47 | 11,53 | 1,11 | 58,42% | 1,78% | 0,16% | 0,02% | 0,00% |
| E20 | Kinh doanh: bán vòng 3–4 | 12,47 | 12,45 | 0,01 | 58,42% | 0,00% | 0,00% | 0,00% | 0,00% |
| F16 | Tiền mặt | 6,77 | 6,77 | 0,00 | 0,00% | 0,00% | 0,00% | 0,00% | 0,00% |
| F16 | Tiết kiệm | 6,77 | 3,88 | 0,16 | 83,50% | 41,92% | 0,00% | 0,00% | 0,00% |
| F16 | Cổ phiếu | 6,77 | 6,10 | 0,00 | 85,36% | 0,00% | 1,84% | 0,00% | 0,00% |
| F16 | Kinh doanh: bán vòng 4 | 6,77 | 6,77 | 0,01 | 85,44% | 0,00% | 0,00% | 0,00% | 0,00% |
| F16 | Kết hợp | 6,77 | 6,34 | 0,51 | 85,44% | 1,24% | 0,00% | 0,00% | 0,00% |
| F16 | Kinh doanh: bán vòng 3–4 | 6,77 | 6,77 | 0,01 | 85,44% | 0,00% | 0,00% | 0,00% | 0,00% |
| G24 | Tiền mặt | 15,89 | 15,89 | 0,00 | 0,00% | 0,00% | 0,00% | 0,00% | 0,00% |
| G24 | Tiết kiệm | 15,89 | 8,39 | 1,04 | 82,10% | 41,62% | 0,00% | 0,00% | 0,00% |
| G24 | Cổ phiếu | 15,89 | 12,45 | 0,14 | 84,68% | 0,00% | 4,68% | 0,00% | 0,00% |
| G24 | Kinh doanh: bán vòng 4 | 15,89 | 15,83 | 0,04 | 84,78% | 0,00% | 0,00% | 0,00% | 0,00% |
| G24 | Kết hợp | 15,89 | 13,99 | 2,17 | 84,76% | 2,32% | 0,28% | 0,00% | 0,00% |
| G24 | Kinh doanh: bán vòng 3–4 | 15,89 | 15,84 | 0,03 | 84,78% | 0,00% | 0,00% | 0,00% | 0,00% |

Có vay hiếm trong mẫu: D20/business-heavy, D20/business-exit-window, E20/business-heavy và E20/diversified mỗi nhóm 1/5.000 ván (0,02%); không phải bốn seed độc lập. Tất cả trả hết trước cuối màn. Cả 42 nhóm không có nợ cuối hoặc insolvency; đây là kết quả mẫu, không phải cam kết mọi policy đều an toàn.

### Ghép seed: khác biệt bố trí giữ nguyên policy

Chênh lệch tỷ lệ thắng tính điểm phần trăm; CI95% gần đúng từ cặp seed. 16/24 gồm thay đổi đường đi RNG, không phải cùng chuỗi die/scenario.

| Bàn so A | Policy | Δ thắng (pp) | CI95% (pp) | Δ huy động TB M |
| --- | --- | --- | --- | --- |
| B20 | Tiền mặt | 0,00 | 0,00 … 0,00 | 0,00 |
| B20 | Tiết kiệm | -2,20 | -2,65 … -1,75 | -1,01 |
| B20 | Cổ phiếu | -3,56 | -4,08 … -3,04 | -1,40 |
| B20 | Kinh doanh: bán vòng 4 | 8,36 | 7,38 … 9,34 | 2,54 |
| B20 | Kết hợp | 1,92 | 1,00 … 2,84 | 0,58 |
| C20 | Tiền mặt | 0,00 | 0,00 … 0,00 | 0,00 |
| C20 | Tiết kiệm | 0,00 | 0,00 … 0,00 | 0,00 |
| C20 | Cổ phiếu | -0,58 | -1,28 … 0,12 | -0,45 |
| C20 | Kinh doanh: bán vòng 4 | 9,68 | 8,65 … 10,71 | 3,25 |
| C20 | Kết hợp | 4,30 | 3,38 … 5,22 | 1,35 |
| D20 | Tiền mặt | 2,22 | 0,94 … 3,50 | 0,16 |
| D20 | Tiết kiệm | 0,18 | -1,34 … 1,70 | -0,09 |
| D20 | Cổ phiếu | 1,78 | 0,21 … 3,35 | 0,42 |
| D20 | Kinh doanh: bán vòng 4 | 1,28 | -0,40 … 2,96 | 0,31 |
| D20 | Kết hợp | 1,72 | 0,04 … 3,40 | 0,50 |
| E20 | Tiền mặt | 2,22 | 0,94 … 3,50 | 0,16 |
| E20 | Tiết kiệm | -1,32 | -2,84 … 0,20 | -0,79 |
| E20 | Cổ phiếu | -1,56 | -3,12 … -0,00 | -1,10 |
| E20 | Kinh doanh: bán vòng 4 | 5,74 | 4,38 … 7,10 | 1,38 |
| E20 | Kết hợp | 3,04 | 1,56 … 4,52 | 0,75 |
| F16 | Tiền mặt | -0,88 | -2,41 … 0,65 | -0,12 |
| F16 | Tiết kiệm | -4,18 | -5,98 … -2,38 | -1,78 |
| F16 | Cổ phiếu | -4,84 | -6,71 … -2,97 | -2,14 |
| F16 | Kinh doanh: bán vòng 4 | 0,70 | -1,11 … 2,51 | 0,31 |
| F16 | Kết hợp | -3,90 | -5,73 … -2,07 | -1,21 |
| G24 | Tiền mặt | 0,14 | -1,37 … 1,65 | -0,15 |
| G24 | Tiết kiệm | 1,96 | 0,28 … 3,64 | 0,70 |
| G24 | Cổ phiếu | 0,64 | -1,23 … 2,51 | 0,24 |
| G24 | Kinh doanh: bán vòng 4 | 9,10 | 7,28 … 10,92 | 3,45 |
| G24 | Kết hợp | 6,14 | 4,30 … 7,98 | 2,74 |

## Kinh doanh: tiếp cận, nâng cấp và thanh lý

Mua/nâng/bán là giao dịch thực tế. Tỷ lệ nâng, bán và khóa trong bảng này lấy **trên người đã mua**, còn tỷ lệ mua lấy toàn bộ ván. Policy kết hợp giữ bán vòng cuối.

| Bàn | Policy | Mua | Nâng/người mua | Số tầng TB/người mua | Bán/người mua | Khóa/người mua | Thu nhập TB M | Lãi median đã bán M | Thắng/người mua |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A20 | Kinh doanh: bán vòng 4 | 87,42% | 63,44% | 0,95 | 48,48% | 51,52% | 12,04 | 6,71 | 32,37% |
| A20 | Kinh doanh: bán vòng 3–4 | 75,20% | 42,77% | 0,51 | 73,83% | 26,17% | 9,08 | 3,91 | 40,53% |
| A20 | Kết hợp | 72,14% | 44,11% | 0,56 | 48,32% | 51,68% | 9,12 | 3,17 | 38,18% |
| B20 | Kinh doanh: bán vòng 4 | 96,28% | 83,13% | 1,64 | 65,75% | 34,25% | 13,86 | 8,63 | 40,96% |
| B20 | Kinh doanh: bán vòng 3–4 | 89,18% | 63,76% | 0,91 | 88,34% | 11,66% | 9,09 | 4,18 | 42,54% |
| B20 | Kết hợp | 82,12% | 61,23% | 0,91 | 65,83% | 34,17% | 9,45 | 3,42 | 43,33% |
| C20 | Kinh doanh: bán vòng 4 | 95,76% | 82,02% | 1,63 | 65,10% | 34,90% | 13,69 | 8,40 | 42,25% |
| C20 | Kinh doanh: bán vòng 3–4 | 87,92% | 62,40% | 0,91 | 88,42% | 11,58% | 9,09 | 3,99 | 45,59% |
| C20 | Kết hợp | 82,72% | 61,27% | 0,94 | 64,51% | 35,49% | 9,46 | 3,44 | 44,66% |
| D20 | Kinh doanh: bán vòng 4 | 88,26% | 65,94% | 1,04 | 48,52% | 51,48% | 12,55 | 7,51 | 34,13% |
| D20 | Kinh doanh: bán vòng 3–4 | 76,54% | 47,24% | 0,59 | 74,08% | 25,92% | 9,50 | 4,33 | 42,98% |
| D20 | Kết hợp | 74,56% | 50,13% | 0,68 | 48,02% | 51,98% | 10,10 | 4,47 | 41,44% |
| E20 | Kinh doanh: bán vòng 4 | 94,02% | 80,15% | 1,58 | 63,45% | 36,55% | 13,42 | 7,98 | 38,59% |
| E20 | Kinh doanh: bán vòng 3–4 | 84,76% | 58,94% | 0,85 | 87,09% | 12,91% | 8,89 | 3,61 | 40,59% |
| E20 | Kết hợp | 87,30% | 67,24% | 1,10 | 63,62% | 36,38% | 10,59 | 4,80 | 42,77% |
| F16 | Kinh doanh: bán vòng 4 | 89,08% | 64,50% | 0,99 | 49,30% | 50,70% | 12,43 | 7,70 | 33,32% |
| F16 | Kinh doanh: bán vòng 3–4 | 77,80% | 46,35% | 0,57 | 73,14% | 26,86% | 9,56 | 4,83 | 40,77% |
| F16 | Kết hợp | 78,98% | 50,47% | 0,69 | 49,25% | 50,75% | 10,09 | 4,52 | 35,60% |
| G24 | Kinh doanh: bán vòng 4 | 95,78% | 83,02% | 1,73 | 64,31% | 35,69% | 14,30 | 8,73 | 41,32% |
| G24 | Kinh doanh: bán vòng 3–4 | 88,34% | 65,38% | 0,99 | 87,53% | 12,47% | 9,59 | 4,33 | 45,17% |
| G24 | Kết hợp | 80,22% | 61,78% | 0,98 | 63,97% | 36,03% | 10,26 | 4,27 | 46,62% |

Khả năng hành động tại ô kinh doanh theo trạng thái trước giao dịch (business-heavy, bán vòng 4). Những cột này là số encounter/ván; có thể chồng nhau, không được cộng thành số lượt độc lập. Mua hợp lệ chưa áp hạn chót policy; số “chặn muộn” gồm cả visit sau khi đã bán.

| Bàn | Visit | Mua hợp lệ | Mua đủ dự phòng | Nâng hợp lệ | Bán hợp lệ | Chặn thiếu Cash | Chặn muộn | Không gặp trước V4 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A20 | 2,27 | 1,01 | 1,01 | 1,26 | 1,26 | 0,01 | 0,14 | 12,54% |
| B20 | 3,41 | 1,17 | 1,17 | 2,23 | 2,23 | 0,02 | 0,21 | 3,70% |
| C20 | 3,39 | 1,19 | 1,19 | 2,20 | 2,20 | 0,01 | 0,23 | 4,24% |
| D20 | 2,36 | 1,01 | 1,01 | 1,35 | 1,35 | 0,01 | 0,13 | 11,70% |
| E20 | 3,28 | 1,18 | 1,18 | 2,09 | 2,09 | 0,02 | 0,24 | 5,94% |
| F16 | 2,36 | 1,03 | 1,03 | 1,33 | 1,33 | 0,01 | 0,14 | 10,82% |
| G24 | 3,50 | 1,20 | 1,19 | 2,31 | 2,31 | 0,04 | 0,23 | 4,12% |

Ảnh hưởng policy tìm bán hai vòng cuối trong **cùng bàn**:

| Bàn | Δ thắng (pp) | CI95% (pp) | Δ huy động TB M | Khóa: V4 → V3–4 |
| --- | --- | --- | --- | --- |
| A20 | 6,00 | 5,04 … 6,96 | 2,52 | 51,52% → 26,17% |
| B20 | -0,14 | -1,22 … 0,94 | 0,73 | 34,25% → 11,66% |
| C20 | 2,06 | 0,98 … 3,14 | 1,12 | 34,90% → 11,58% |
| D20 | 6,62 | 5,62 … 7,62 | 2,53 | 51,48% → 25,92% |
| E20 | 0,70 | -0,37 … 1,77 | 1,08 | 36,55% → 12,91% |
| F16 | 5,38 | 4,43 … 6,33 | 2,38 | 50,70% → 26,86% |
| G24 | 2,10 | 0,96 … 3,24 | 1,09 | 35,69% → 12,47% |

Tìm bán hai vòng cuối giảm khóa vốn nhưng không mặc nhiên tăng thắng: B20 là 39,96% → 39,82%, còn C20 là 41,28% → 43,34%. Bán sớm và ngừng nâng/mua sớm cũng mất kỳ thu nhập/cơ hội; dùng CI trong bảng, không coi mọi chênh lệch nhỏ là chắc chắn.

Trong heuristic này, mua và nâng diễn ra ở các visit khác nhau; **đó là hạn chế policy, không phải luật engine**. Người chơi có thể mua rồi nâng nhiều tầng ngay cùng event nếu đủ Cash. Sau khi giữ cơ sở qua START để thu nhập vận hành, việc bán vẫn cần quay lại đúng ô trước deadline; stock/bond/gold có thể thanh lý ở START/thiếu tiền và tính quote ròng cuối màn. Vì thế số ô bằng nhau chưa tạo khả năng sử dụng tương đương. A20 có 51,52% người mua còn vốn khóa; C20 còn 34,90%. Các tỷ lệ này đếm người mua, không phải phần trăm tiền vốn bị khóa. Đây là bằng chứng về thanh khoản/đường đi dưới policy, không đủ căn cứ để tự tăng thu nhập business. Cần tách P/L đã bán, giá trị sổ sách và huy động hợp lệ; JSON lưu riêng cả ba.

## Khóa học: tiếp cận và visit lặp

Dùng business-heavy để so cùng policy học; khác biệt Cash do đầu tư kinh doanh cũng có thể đổi tỷ lệ mua. Tần suất visit và không gặp sớm lấy từ đường đi, không phụ thuộc việc đã mua.

| Bàn | Visit TB | Không gặp | Không gặp V1–3 | Mua học | Visit sau đã học TB | Không có cơ hội đủ Cash sớm | Mua V1/V2/V3 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A20 | 2,25 | 7,46% | 13,86% | 86,14% | 1,31 | 13,86% | 46,94% / 25,86% / 13,34% |
| B20 | 1,11 | 27,30% | 37,64% | 62,36% | 0,39 | 37,64% | 25,68% / 21,04% / 15,64% |
| C20 | 2,25 | 7,46% | 13,86% | 86,14% | 1,31 | 13,86% | 46,94% / 25,86% / 13,34% |
| D20 | 2,20 | 7,70% | 15,82% | 84,18% | 1,26 | 15,82% | 42,28% / 27,82% / 14,08% |
| E20 | 1,04 | 29,28% | 41,58% | 58,42% | 0,34 | 41,58% | 19,06% / 22,84% / 16,52% |
| F16 | 2,21 | 7,30% | 14,56% | 85,44% | 1,27 | 14,56% | 43,50% / 28,32% / 13,62% |
| G24 | 2,20 | 7,64% | 15,22% | 84,78% | 1,27 | 15,22% | 42,28% / 28,88% / 13,62% |

Visit sau mua khóa học không còn cho thêm tăng lương, nên thừa về giao dịch. Tuy nhiên ô thứ hai cũng cứu cơ hội cho người bỏ lỡ hoặc chưa đủ Cash lần đầu. Không suy ra “thấy hai ô khóa học” tương đương mua hai lần. B/E một khóa học giảm dialog lặp nhưng tăng rủi ro không tiếp cận bài học về thu nhập.

## Sinh hoạt, shock cá nhân và thông tin forecast

Dùng cash-heavy để tách chi phí khỏi lãi/lỗ tài sản. Chi phí sinh hoạt cố định 7M mỗi lần dừng đúng ô; đi ngang không trả. Extra gồm cá nhân và phí Dòng tiền; Dòng tiền cũng có thể bốc bonus, không phải mọi lần đều là nghĩa vụ âm.

| Bàn | Sinh hoạt TB M | p10/med/p90 M | Extra TB M | Cá nhân/ván | Macro/ván | Không macro | Vòng có macro | Vòng ≥2 macro | corr(funds,living) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A20 | 15,46 | 7,00 / 14,00 / 28,00 | 10,36 | 2,24 | 2,32 | 6,16% | 49,72% | 8,24% | -0,84 |
| B20 | 15,46 | 7,00 / 14,00 / 28,00 | 10,36 | 2,24 | 2,32 | 6,16% | 49,72% | 8,24% | -0,84 |
| C20 | 15,46 | 7,00 / 14,00 / 28,00 | 10,36 | 2,24 | 1,20 | 23,64% | 29,96% | 0,00% | -0,84 |
| D20 | 15,30 | 7,00 / 14,00 / 28,00 | 10,36 | 2,24 | 2,35 | 6,26% | 50,26% | 8,54% | -0,85 |
| E20 | 15,30 | 7,00 / 14,00 / 28,00 | 10,36 | 2,24 | 2,35 | 5,62% | 50,21% | 8,56% | -0,85 |
| F16 | 15,65 | 7,00 / 14,00 / 28,00 | 10,29 | 2,24 | 2,29 | 6,76% | 49,31% | 7,99% | -0,84 |
| G24 | 15,66 | 7,00 / 14,00 / 28,00 | 10,32 | 2,25 | 2,33 | 6,20% | 49,58% | 8,72% | -0,84 |

Dấu hiệu macro ảnh hưởng giá: phần tổng |log-price change| do macro cho stock (trung bình 6 mã), bond, gold; “đảo dấu” là tỷ lệ 8 chuỗi giá ×4 vòng mà dấu nhân tố normal khác dấu normal+macro. Đây là mô tả price path, không phải kiểm định forecast đúng/sai hoặc thí nghiệm loại macro hoàn toàn.

| Bàn | Macro abs(log) stock | Bond | Gold | Đảo dấu normal | Visit đầu tư sau macro TB |
| --- | --- | --- | --- | --- | --- |
| A20 | 36,10% | 29,34% | 33,72% | 13,19% | 3,22 |
| B20 | 36,10% | 29,34% | 33,72% | 13,19% | 3,75 |
| C20 | 22,64% | 17,64% | 20,82% | 7,71% | 2,87 |
| D20 | 36,48% | 29,65% | 34,08% | 13,29% | 3,13 |
| E20 | 36,44% | 29,60% | 34,04% | 13,38% | 3,02 |
| F16 | 35,78% | 29,19% | 33,33% | 13,11% | 1,24 |
| G24 | 36,34% | 29,68% | 33,84% | 13,16% | 4,95 |

Ở A20, sinh hoạt p10–p90 là 7,00–28,00M, khoảng rộng 21,00M so với 40M cần tăng từ vốn ban đầu. Tương quan với huy động là -0,84 ở cash-heavy: biến thiên chi phí có ý nghĩa lớn. Đây là liên hệ quan sát có covariance với các encounter khác; chưa chứng minh một tỷ lệ variance nhân quả và chưa có ngưỡng người chơi cho “quá mức”. Không tự giảm 7M hoặc thay ô sinh hoạt.

A/B/C giữ nguyên living/personal/obligation và cùng paths: cash-heavy khớp, làm đối chứng tốt cho thay course/macro. C giảm macro TB 2,32 → 1,20; forecast vẫn là trạng thái trend/normal của vòng, macro là cú sốc sau đó. Mức chi phối giá giảm có thể giúp người mới đọc forecast, nhưng chưa chứng minh hiểu biết người chơi tăng. Macro không ghi đè scenarioId; policy nâng business theo trend vẫn dùng forecast công khai.

## Kích thước, số lượt và thời lượng

D6 có kỳ vọng 3,5 ô/lượt. Kỳ vọng số roll cho bốn circuit gần 4N/3,5 cộng sai số overshoot cuối; không làm tròn từng vòng thành N/3,5 rồi reset vị trí. Engine giữ vị trí dư ở vòng tiếp, chỉ bỏ đích dư ở vòng cuối. Renewal tính chính xác xác suất tới từng khoảng cách dọc đường và dừng ở ≥4N; không đổi RNG hoặc xúc xắc để khớp kỳ vọng.

| Bàn | Rolls lý thuyết | Rolls mô phỏng | Rolls/vòng | Visit đầu tư/ván | Event dialog/ván | Mốc lựa chọn: kết hợp | Mốc/vòng |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A20 | 23,33 | 23,32 | 5,83 | 11,27 | 21,45 | 15,11 | 3,78 |
| B20 | 23,33 | 23,32 | 5,83 | 12,41 | 21,45 | 15,94 | 3,98 |
| C20 | 23,33 | 23,32 | 5,83 | 12,39 | 21,45 | 16,18 | 4,04 |
| D20 | 23,33 | 23,32 | 5,83 | 11,31 | 21,45 | 15,15 | 3,79 |
| E20 | 23,33 | 23,32 | 5,83 | 12,47 | 21,45 | 16,11 | 4,03 |
| F16 | 18,76 | 18,74 | 4,69 | 6,77 | 16,87 | 10,62 | 2,66 |
| G24 | 27,90 | 27,91 | 6,98 | 15,89 | 26,06 | 19,57 | 4,89 |

**Ước tính, chưa đo người chơi:** 6–10 giây/roll và animation, 10–20 giây/mốc lựa chọn, 3–5 giây/dialog chỉ xác nhận, 8–15 giây/forecast, summary hoặc checkpoint (12 mốc/4 vòng). Phân tách dialog có lựa chọn và dialog xác nhận để tránh cộng thời gian đọc cùng event hai lần. Chưa tính setup/result, đọc luật, xem biểu đồ dài, funding phát sinh hoặc trao đổi nhiều người.

| Bàn | Phút thấp–cao: kết hợp | Chênh roll so A |
| --- | --- | --- |
| A20 | 6,8–12,5 | 0,00 |
| B20 | 6,9–12,7 | 0,00 |
| C20 | 6,9–12,7 | 0,00 |
| D20 | 6,8–12,5 | 0,00 |
| E20 | 6,9–12,7 | 0,00 |
| F16 | 5,6–10,2 | -4,57 |
| G24 | 8,0–14,7 | 4,59 |

Giữ cùng hai ô business/living/personal/macro trong F16 không khiến mỗi nhóm được gặp ít hơn theo tỷ lệ 16/20; giảm số bank/stock/bond/gold mới là nguyên nhân cơ hội tài sản tài chính giảm. Tương tự G24 có thêm bank/bond/gold/business nên số cơ hội tăng do phân bổ, không tự động do mỗi ô được ghé thường hơn. Cùng tile count mỗi loại cho xác suất gặp dài hạn xấp xỉ không đổi mỗi circuit; vị trí hữu hạn tạo phần sai khác còn lại. Bàn 24 thêm khoảng 4,59 lượt/ván nhưng vẫn chỉ bốn salary/settlement. Nhiều dialog hơn chưa tự chứng minh chiều sâu; trần nâng, khóa học một lần và policy không mua một số tài sản tạo visit lặp.

## Đánh giá công bằng chiến lược và xếp hạng

Sáu trục được xét riêng: **(1)** tiếp cận lựa chọn, **(2)** giữ sự khác nhau giữa các nhóm đầu tư, **(3)** rủi ro và thanh khoản, **(4)** phụ thuộc die, **(5)** thời lượng/mệt mỏi, **(6)** khả năng học cho người mới. Bảng sau dùng proxy đo được cho 1/3/4/5/6 và mô tả cấu trúc cho 2; chúng không phải điểm chất lượng hoặc phép đo tâm lý. “Học” dùng cùng business-heavy, không đại diện mọi người mới.

| Bàn | 1. Mốc lựa chọn kết hợp | 2. Khác biệt chiến lược | 3. Người mua khóa vốn | 4. Không business V1–3 | 5. Rolls | 6. Mua học; macro/ván |
| --- | --- | --- | --- | --- | --- | --- |
| A20 | 15,11 | 5 nhóm; business khó thoát | 51,52% | 12,54% | 23,32 | 86,14%; 2,32 |
| B20 | 15,94 | 5 nhóm; 3 business, 1 học | 34,25% | 3,70% | 23,32 | 62,36%; 2,32 |
| C20 | 16,18 | 5 nhóm; 3 business, 1 macro | 34,90% | 4,24% | 23,32 | 86,14%; 1,20 |
| D20 | 15,15 | 5 nhóm; cặp cách đều | 51,48% | 11,70% | 23,32 | 84,18%; 2,35 |
| E20 | 16,11 | 5 nhóm; business giãn | 36,55% | 5,94% | 23,32 | 58,42%; 2,35 |
| F16 | 10,62 | 5 nhóm; 4 loại chỉ 1 ô | 50,70% | 10,82% | 18,74 | 85,44%; 2,29 |
| G24 | 19,57 | 5 nhóm; nhiều bank/bond/gold | 35,69% | 4,12% | 27,91 | 84,78%; 2,33 |

Xếp hạng dưới đây là đánh giá thiết kế có căn cứ từ truy cập/thanh khoản/thời lượng, **không phải điểm số tối ưu khách quan**. Ưu tiên người mới hiểu thu nhập, lựa chọn tài sản và hạn chót; giữ đặc tính khác nhau của tài sản thay vì cân mọi tỷ lệ thắng.

| Hạng | Bàn | Căn cứ và đánh đổi theo sáu tiêu chí |
| --- | --- | --- |
| 1 | C20 | Thêm business cho nhiều bước mua/nâng/bán; giữ hai cơ hội học và các tài sản; ít macro hơn, không thêm lượt. Giảm rủi ro giá cũng làm các chiến lược đổi tương đối; một phần người chơi không gặp macro. |
| 2 | B20 | Thay tối thiểu khóa học lặp bằng business, tăng cơ hội thanh lý. Khóa vốn và tiếp cận business tốt hơn E trong mẫu dù hai business sát nhau; mất khóa học thứ hai làm giảm khả năng học sớm. |
| 3 | E20 | Ba business giãn 7/7/6, khóa học sớm, giữ hai macro. Giao dịch đa dạng trong 20 ô; một khóa học làm quyền tiếp cận thu nhập phụ thuộc die hơn. Spacing đều chưa chứng minh tốt hơn B về tiếp cận/thanh lý. |
| 4 | D20 | Dễ đọc nhịp bàn và giữ đủ hai khóa học; không tăng số lượng business, nên vẫn phụ thuộc cửa sổ bán một vòng. Spacing đều cải thiện vài loại nhưng không bảo đảm công bằng bằng nhau. |
| 5 | G24 | Nhiều lựa chọn tài sản, ba business; chi phí bắt buộc không được thêm. Dài hơn và thêm dialog; chưa đủ bằng chứng chiều sâu bù sự mệt mỏi cho người mới. |
| 6 | A20 | Đầy đủ loại bài học, kích thước hợp lý; business chỉ hai ô và bị khóa vốn nhiều. Có thể giữ làm baseline, chưa có lỗi luật buộc thay ngay. |
| 7 | F16 | Ngắn hơn nhưng bank/stock/bond/gold chỉ một ô; dễ bỏ lỡ cả loại tài sản. Business vẫn hai ô và nghĩa vụ/shock chiếm tỷ trọng bàn cao hơn; phù hợp nghiên cứu tutorial hơn làm bàn chính đa tài sản. |

Thứ tự giữa các ứng viên gần nhau là nhận định cần playtest. B thực tế có tỷ lệ người mua còn vốn khóa thấp hơn C một chút; C đứng đầu do giữ cơ hội khóa học và giảm cường độ macro trong cùng số lượt. E không đứng trên B chỉ vì khoảng cách nhìn đều hơn: B có số liệu tiếp cận/thanh lý tốt hơn trong mẫu. D “dễ đọc nhịp” và giả thuyết mệt mỏi G chưa được xác minh với người chơi.

1. **Loại tài sản có quá hiếm không?** A20 hai ô mỗi loại tài sản là nền tương đối hợp lý nhưng vẫn có xác suất không gặp trong bốn vòng; dùng bảng no-encounter, không suy từ số lượng. F16 một ô tăng rủi ro bỏ lỡ. Initial savings mở được ở setup nên không gặp bank không đồng nghĩa không thể có savings; stock/bond/gold phải tới đúng ô mới mua.
2. **Business cần nhiều cơ hội hơn?** Cần quay lại đúng ô nếu muốn bán sau thời gian nhận thu nhập, thanh lý không được cứu tại START. Mua/nâng có thể làm cùng visit trong engine; heuristic một giao dịch/visit khiến lợi ích thêm ô đối với nâng cấp phụ thuộc policy. Ba ô là ứng viên phù hợp hơn hai về tiếp cận/thanh lý; chưa tự tăng lợi suất. Ngay C20 vẫn có vốn khóa và người mua muộn, nên không coi là giải quyết hết thanh khoản.
3. **Khóa học có visit dư?** Có sau khi mua, nhưng hai ô bảo vệ cơ hội lần đầu. B/E đánh đổi redundancy lấy business; C giữ hai ô để tránh cắt bài học thu nhập của người mới. Không đề xuất thêm tác dụng mới cho visit lặp.
4. **Macro có lấn forecast?** Giá có thể đảo chiều sau shock và có vòng nhiều macro; một ô giảm cường độ, không xóa rủi ro. Chỉ số giá hỗ trợ đánh giá thiết kế, chưa đo khả năng dự báo/hiểu trend. Luôn phân biệt forecast công khai và ngẫu nhiên normal/sector/idiosyncratic.
5. **Sinh hoạt có tạo variance quá lớn?** Chênh chi phí có sức nặng so mục tiêu, đặc biệt tiền mặt; chưa kết luận “quá lớn” nếu chưa biết mức thử thách người chơi mong muốn. Vị trí có thể đổi số lần gặp dù số ô không đổi, vì đầu màn và deadline không đối xứng. Chi phí thường, shock, bonus và tài sản tương quan qua đường đi nên không phân rã variance bằng cách cộng tỷ lệ độc lập.
6. **Vị trí ưu ái lựa chọn nào?** Khóa học sớm tăng số kỳ hưởng lương; bank trước chi phí có thể làm phải rút sớm, business sớm tăng số kỳ nhận thu nhập, asset gần deadline thiếu thời gian coupon/normal. E đổi vị trí nhiều loại cùng lúc; chỉ có thể nói tổng hiệu ứng bố trí, không quy riêng mọi thay đổi cho business spacing. D cũng không phải tối ưu hoán vị toàn bộ bàn.
7. **Bàn dài thêm chiều sâu hay lượt?** G24 thêm cơ hội và lượt, nhưng chưa đo chất lượng quyết định người thật. F16 tiết kiệm lượt bằng việc cắt cơ hội tài sản. Giữ 20 ô là đánh đổi thực dụng cho người mới; chưa chứng minh 20 là kích thước tối ưu duy nhất.

## Xác minh, tái lập và giới hạn

| Kiểm tra | Kết quả xác nhận |
| --- | --- |
| Tests sản phẩm | npm test: 81/81 pass, 0 fail/skipped |
| Tests chẩn đoán | 5 test board +10 test độ dài: 15/15 pass |
| Lint và build | npm run lint và npm run build exit 0; TypeScript/Vite build 46 modules, cùng JS/CSS hash tên trước |
| Typecheck chẩn đoán | Strict Node/TS exit 0 cho runner/model/statistics/test/verifier/report generator |
| Baseline | 25.000 ván 3 vòng khớp JSON gốc; A20/4 vòng khớp 6 nhóm JSON độ dài |
| Mô phỏng | 42 nhóm ×5.000 ván +25.000 baseline, exit 0 |
| Đối chiếu dòng seed | Verifier đọc lại toàn bộ JSONL gzip, tái tạo tất cả bảng summary và so JSON; kiểm tra path hashes, thứ tự seed và renewal |
| Engine invariants | Mỗi salary/normal/summary đúng một lần mỗi vòng hoàn tất; shock không lặp, maturity đúng, số dư hợp lệ, lawful funds đối chiếu sai số 0đ |
| Bảo vệ repository | 56 hash source/test/package/baseline và artifact nghiên cứu trước không đổi; runtime trở về 3 vòng/20 ô |

Không có browser playthrough cho các bàn thay thế; chưa thiết kế giao diện 16/24 ô. Đây là mô phỏng engine, không xác minh khả năng đọc bố trí trên màn hình, thời gian người thật, accessibility hoặc độ hiểu bài học. Vay đã xảy ra hiếm như bảng trên; không quan sát insolvency không đồng nghĩa bất khả thi, test tình huống hiện có kiểm tra nhánh này.

Giới hạn chính: heuristic không tối ưu, chỉ một giao dịch business/visit dù engine cho phép nhiều; cash-heavy cố ý không học; stock chọn mã theo turn nên đổi kích thước cũng đổi lựa chọn mã; không có bond-heavy/gold-heavy riêng; không chạy cửa sổ bán hai vòng cho diversified; không đảo mọi vị trí hoặc tối ưu allocation toàn cục; F/G thay nhiều yếu tố. Không có đối chứng loại bỏ riêng living/macro hoặc kiểm định giáo dục người chơi. Không suy fair/balanced từ một win rate, không suy mọi chiến lược an toàn từ mẫu không vỡ nợ.

Lệnh từ thư mục gốc repository:

```sh
node --experimental-strip-types --test scripts/diagnostics/game-length.test.ts scripts/diagnostics/board-balance.test.ts
node --experimental-strip-types scripts/analyze-board-balance.ts 5000
node --experimental-strip-types scripts/diagnostics/verify-board-balance-results.ts
node --experimental-strip-types scripts/diagnostics/render-board-balance-report.ts
node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --target es2023 --module nodenext --types node --allowImportingTsExtensions --skipLibCheck --strict scripts/analyze-board-balance.ts scripts/diagnostics/board-balance.test.ts scripts/diagnostics/verify-board-balance-results.ts scripts/diagnostics/render-board-balance-report.ts
npm test
npm run lint
npm run build
```

Smoke không ghi artifact: `node --experimental-strip-types scripts/analyze-board-balance.ts 30 --smoke`. Không chạy các bố trí đồng thời trong cùng process vì dùng shared object của engine; script luôn tuần tự. Guard bảo vệ baseline phải được lập lại có chủ đích khi repository được sửa hợp lệ trong tương lai, không bỏ guard để làm kết quả “pass”. Node22.14 phát cảnh báo TypeScript stripping experimental; không phải lỗi gameplay. Thư mục hiện tại không có metadata Git, nên dùng hash bảo vệ thay diff/commit; không tạo repository mới.

- [JSON tổng hợp](simulations/v2-board-balance-results.json): snapshot chính thức, exact allocation/sequence, lý thuyết movement, policy, seed ranges, phân phối, cohort business, transaction/availability, exposure và paired CI.
- [Audit category rộng](simulations/v2-board-category-audit.json): tổng hợp bốn category từ raw seed, kèm hash JSON nguồn; do verifier tạo sau khi đối chiếu thành công.
- [JSONL từng seed, gzip](simulations/v2-board-balance-runs.jsonl.gz): 210.000 dòng, khoảng 94,6 MB nén; mỗi dòng có layout, run, audit và pathSha256. Gzip gồm các member nối theo từng nhóm, đọc được bằng standard gunzip. Null là chưa mua/chưa bán/chưa đạt ngưỡng, khác số 0; các đại lượng không áp dụng cho category không đầu tư có null ở summary.

**Chưa triển khai bất kỳ bàn khuyến nghị nào. Chờ phê duyệt rõ ràng trước khi sửa gameplay; phần chẩn đoán và báo cáo đã hoàn tất.**
