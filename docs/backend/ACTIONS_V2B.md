# EXE Phase 2B · Funding, sự kiện và đồng bộ trạng thái

Phase 2B phát triển từ V2A `83cee978391226ec48617983828049bbeaaf0263` và dùng cùng engine B18 multi-course. PostgreSQL local dùng project và volume `exe-backend-v2b`. Ba migration V1 đủ cho toàn bộ luồng.

| Luồng | Canonical engine |
| --- | --- |
| Event | `eventsForGame` cung cấp ID và các option. `canChoose` kiểm tra option theo phase, event, quyền sở hữu khóa học và tiền mặt. `decide` ghi tác động. |
| Khóa học | B18 multi-course yêu cầu tiền mặt và mỗi lượt ghé mua tối đa một khóa. Engine trừ học phí và cập nhật lương cho các lần START sau. |
| Funding | `fundingSources` xác định nguồn hợp lệ. `fundPayment` dùng các quy tắc gốc về thu hồi tiền gửi, bán cổ phiếu/vàng/trái phiếu, vay nợ và số còn thiếu. |
| Hoàn tất | Khi nghĩa vụ đã trả đủ, engine áp dụng kết quả sự kiện hoặc tiếp tục cursor quyết toán START. Engine có thể mở khoản thiếu hụt tiếp theo tại START. |
| Insolvency | Engine kết thúc nếu vẫn thiếu và đã hết nguồn hợp lệ. Trong cùng transaction, API cập nhật session, snapshot, action và ghi kết quả chính thức `insolvent`. |

## Đọc lại trạng thái

`GET /v1/game-sessions/:id` giữ đối tượng `session` và bổ sung `state` cùng `result`. Một câu SELECT theo owner đọc metadata, snapshot đúng version và kết quả đã lưu. Vì cả ba được commit trong cùng transaction, GET có thể trả version trước hoặc sau một action đồng thời, với state và status tương ứng. Response gồm `availableActions`, event `options` và `fundingOptions` lấy từ phase và các selector canonical. Seed, cursor RNG, log nội bộ và lịch sử giá sinh từ seed nằm trong PostgreSQL. [PostgreSQL Read Committed](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED)

## Retry và replay

V2B giữ row lock, kiểm tra version và kiểm tra idempotency trước khi chạy action. Payload JSONB được so sánh theo giá trị, nên việc đổi thứ tự key giữ nguyên ý nghĩa của request. Retry trả snapshot tại version của action gốc, còn GET trả version hiện tại. Các trường hiển thị mới được chiếu từ snapshot khi đọc lại. Sequence, payload lệnh, seed và snapshot schema 7 giữ đủ dữ liệu để chạy lại transition từ checkpoint.

Kiểm thử PostgreSQL đối chiếu hash của snapshot với JSON do engine serialize, kiểm tra replay từ log schema 7 và từ chuỗi action, rồi kiểm tra tiền mặt, tài sản, phí, lãi mất khi rút, khoản vay và kết quả. Ca đủ bốn vòng mua cả hai khóa từ genesis canonical, đi qua các ô đầu tư bằng option `skip`. Các ca bán tài sản để funding bắt đầu từ fixture đã sở hữu tài sản bằng engine. Hai luồng event và START được kiểm tra riêng, gồm rollback ở lần ghi kết quả insolvency.

## Phạm vi tiếp theo

API chưa có lệnh mua/bán chủ động, mở khoản tiết kiệm, nâng cấp Business hoặc giao dịch/hoàn nợ lúc rebalancing. Nếu người chơi muốn thực hiện các thao tác đó, điểm dừng là encounter tài sản hoặc phase `rebalancing` tương ứng. Funding vẫn bán được tài sản đã có khi luật cho phép. Phase tiếp theo nên triển khai từng nhóm Trading/Bank/Business và rebalancing với parity cho quote, phí, số lô và retry. Semantic P4 tiếp tục HOLD.
