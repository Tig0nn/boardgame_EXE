> **CURRENT** — Thiết kế candidate ngày 15/10/2026; chưa merge, chưa phát hành. Nguồn hiện hành: [CURRENT_MVP](CURRENT_MVP.md).

# Sinh hoạt định kỳ và C20 theo phiên bản

Owner đã duyệt **hướng sản phẩm**: sinh hoạt là nghĩa vụ dự đoán được tại START, còn biến cố cá nhân là chi phí bất ngờ trên bàn. **7 triệu và Candidate A chưa được duyệt là cân bằng/bố trí cuối cùng**. Nhánh `codex/periodic-living-expenses` xuất phát đúng `34f91eaa8e04fd0e98b62b15ab2b408477e6a2ff`, không thay nhánh cũ.

## Hợp đồng phiên bản

| Phiên | Sinh hoạt | Bàn |
| --- | --- | --- |
| Metadata vắng hoặc `v2.4-on-landing` | 7 triệu khi dừng đúng ô 4/15; không trừ tại START | C20 lịch sử; A20 lịch sử vẫn nguyên |
| `v2.6-periodic-start` | 7 triệu mỗi vòng hoàn tất, gồm vòng 4; setup không thu | `boardRevision=c20-v2.6-a`; ô 4 Cổ phiếu, ô 15 Vàng |

[Policy](../src/game/living-expenses.ts) giữ hằng số candidate riêng, không sửa `RULES.livingCost` của lịch sử. [Engine](../src/game/engine.ts) giữ mặc định API replay cũ; [Mobile factory](../mobile_app/src/game/session.ts) chọn policy mới tường minh. Root Web chưa đổi mặc định sinh hoạt. Không migrate state đang chạy, không thay C20 gốc. [Snapshot](../src/game/state.ts) chỉ thêm hai khóa khi có metadata; [export](../src/game/log.ts) lưu thêm config 7M/completed-start, bàn và phiên trong từng before/after.

[Replay](../scripts/diagnostics/replay-game-log.ts) kiểm tra khớp metadata, config và bàn trước khi thực thi; cấm đổi policy/bàn giữa ván. Log thiếu metadata dùng API lịch sử, không đi qua mặc định mới của Mobile. Các fixture UI lịch sử được pin on-landing riêng, không viết lại log cũ.

## Máy trạng thái START

[Settlement](../src/game/settlement.ts): thị trường → lương/khóa học → kinh doanh → savings/Bond → **sinh hoạt** → nợ → nghĩa vụ hẹn → summary → ví → vòng kế/kết quả. Legacy vẫn có sáu bước tổng cộng; periodic có bảy. Mọi bước khác giữ thứ tự tương đối và công thức cũ. Không đổi RNG, thắng/thua, coupon, default/recovery hoặc Customer Preferences.

Con trỏ tăng trước khi gọi collectPayment. Thiếu cash thì dùng nguyên flow bắt buộc: cash trước, savings toàn khoản/tài sản tài chính/vay hợp lệ; không bán Business khẩn cấp. Funding tiếp tục từ nợ, không lặp sinh hoạt. Mỗi START có một schedule “Chi phí sinh hoạt”, cashDelta âm và expensePaid là số thực dùng ngay; phần huy động được ghi ở funding. Summary nominal −7M không bị cộng lần hai vào tổng cashflow. Khi insolvent không chạy những START tương lai.

Gốc nợ đến hạn vẫn lấy từ snapshot trước START; vay mới để huy động không tự trở thành khoản nợ cũ. Lãi khoản vay mới tại START cuối vẫn được cộng vào nợ theo công thức cũ. Kết quả được mở sau khi trả sinh hoạt vòng 4 và ghé ví. Chi phí cá nhân 8/18, sửa xe/khám bệnh/gia đình, lựa chọn ngay/hẹn và mức tiền trong [events](../src/data/events.ts) giữ nguyên.

**Giới hạn quan trọng:** với trạng thái hợp lệ hiện tại, lương ≥14M vào ví trước 7M sinh hoạt; Business V2.4 không âm, maturity/Bond payments không trừ cash. Vì thế cash ngay trước sinh hoạt ≥14M: không thể tự nhiên thiếu khoản này. Nhánh funding/insolvency của sinh hoạt vẫn được phòng vệ, nhưng browser phải dùng fixture salary=0 có nhãn rõ. Không hạ lương hoặc đảo thứ tự để tạo một ván huy động giả. Không suy ra mọi loại insolvency đều bất khả thi.

## Giao diện và sáu bước hướng dẫn

[START selector](../mobile_app/src/game/start-summary.ts) đọc năm financial schedules của legacy hoặc sáu của periodic. Tổng nhận/chi lấy cash thật cùng funding, đối chiếu chênh lệch ví; livingPaid nằm trong paid. Khoản chờ Bond không phải cash, default không phải tiền chi thêm. Giữ issuer cards, zero trung tính, details đóng, Forecast vs. Reality và CTA ví ngoài vùng cuộn.

[Tutorial/Sổ tay](../mobile_app/src/components/Tutorial.tsx) giữ đúng sáu bước. Bước 5 nói “Mỗi khi hoàn thành một vòng và qua START, bạn nhận lương và tự động thanh toán 7 triệu tiền sinh hoạt.” Đồng thời nhắc giữ thanh khoản và dự phòng biến cố cá nhân riêng. Board Guide và nhãn/effect Mobile lấy boardFor của **phiên đang mở**. Không có phép trừ tiền trong React. Skip/persist/tutorial reopening giữ nguyên.

## Handoff designer — cần duyệt artwork riêng

Đã xem trực tiếp [playboard.PNG](../mobile_app/public/assets/playboard.PNG). Ảnh minh họa có icon cũ/lệch nghĩa đã ghi nhận ở các handoff trước; không thể dùng icon ảnh để quyết định luật. Các tọa độ vẫn lấy [tiles.json](../mobile_app/src/data/tiles.json), còn type/category/label luôn bị ghi đè bằng bàn active từ engine. Không sửa PNG, GLB, audio hoặc dice.

| Ô 1-based | Tâm canvas 940×1672 | Nghĩa candidate | Handoff |
| --- | --- | --- | --- |
| 4 | x242, y955 | Stocks, investment, “Cổ phiếu” | Icon chart, mặt tím; giữ tâm/đường đi/pawn anchor |
| 15 | x762, y791 | Gold, investment, “Vàng” | Icon vàng, mặt vàng; giữ tâm/đường đi/pawn anchor |

[BoardView](../mobile_app/src/components/BoardView.tsx) hiện phủ hai nhãn rõ “4 · Cổ phiếu” và “15 · Vàng” trong candidate; legacy không có nhãn thay thế. Đây là lớp trình bày tạm, không phải artwork mới đã phê duyệt. Designer cần xuất bản asset riêng hoặc face overlay được duyệt, kiểm ba kích thước, không ghi đè ảnh phục vụ replay cũ. Các lệch icon khác của ảnh có trước vẫn cần owner/designer review riêng.

## Nghiên cứu và quyết định còn mở

[Balance report](PERIODIC_LIVING_EXPENSES_BALANCE_REPORT.md) so sánh sáu cấu hình trên 18.000 ván hợp lệ, không thay tham số bản chơi. 7M/A khó rõ rệt; thay bàn không tự giải quyết chênh lệch. Chưa có defect về định tuyến buộc phải bỏ A, nên giữ đúng candidate được yêu cầu. Owner cần chọn độ khó/mức tiền, bàn và artwork trước release; chưa tự đổi sang 5M/6M.

[Implementation report](PERIODIC_LIVING_EXPENSES_IMPLEMENTATION_REPORT.md) ghi kiểm chứng local và các giới hạn. CI lịch sử V2.4 có **186 product tests + 21 diagnostics** ở SHA cũ; không dùng con số đó như kết quả Actions của nhánh mới.
