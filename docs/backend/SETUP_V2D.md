# Phase 2D · Setup B18

| Lựa chọn trên Mobile | Engine B18 và backend |
| --- | --- |
| Nhập số tiền gửi hoặc chọn nhanh 0, 10, 20, 50 triệu VND | Engine nhận toàn bộ dải số nguyên 0–50 triệu VND. API trước V2D luôn dùng 0. V2D nhận giá trị qua `setup.initialSavings`. |
| Kỳ hạn 1, 2, 3 vòng. Mobile chọn sẵn 3. | Factory mặc định 1. V2D giữ mặc định API cho request cũ và nhận kỳ hạn đang hiển thị qua `setup.savingsTerm`. Lãi mỗi kỳ lần lượt là 4%, 5%, 6%. |
| Mã hành trình để chơi lại | Factory local hỗ trợ seed do người chơi nhập. API tạo seed phía server. |
| Tiếp tục ván local hoặc mở tệp nhật ký | Đây là luồng phục hồi ván đã có. API server tiếp tục session đã lưu theo ID và owner. |

## Genesis và replay

Server gọi `createMultiCourseGame(undefined, initialSavings, savingsTerm)`. Factory trừ gốc khỏi tiền mặt, mở lot đầu ván nếu số tiền dương, tính kỳ đáo hạn từ vòng 1, rồi ghi `setup` vào lịch sử engine. Tổng vốn đầu ván vẫn là 50 triệu VND. Gửi đủ 50 triệu là hợp lệ và để lại 0 tiền mặt. Không có giao dịch Bank riêng ở version 0.

PostgreSQL ghi setup vào `game_sessions` cùng profile và snapshot version 0 trong một transaction. Session cũ nhận 0 VND và 1 kỳ theo mặc định trước V2D. Schema save vẫn là 7. Replay dựng lại từ seed server và setup, rồi áp dụng action history. Replay từ nhật ký đọc gốc và kỳ hạn từ lot ban đầu, hoặc dùng mặc định nếu không có lot. Kỳ hạn được lưu riêng trên session ngay cả khi không có khoản gửi.

## Hành trình kiểm chứng

Ván mới qua HTTP dùng 10 triệu VND trong 3 kỳ. Sau khi tạo, GET trả 40 triệu tiền mặt và lot đáo hạn ở START vòng 3. Suite kiểm tra số lãi 1,8 triệu, reconnect, bốn checkpoint, kết quả chính thức, replay schema 7 và snapshot PostgreSQL qua từng action. Suite nền tảng kiểm tra upgrade database V2C4 có session cũ, hai request tạo đồng thời, owner isolation và hai biên vốn.

Khi nối frontend, client cần gửi kỳ hạn đang hiển thị để giữ mặc định 3 kỳ của Mobile. Cách hiển thị chơi lại bằng mã và mở tệp nhật ký trong giao diện có server là quyết định sản phẩm còn lại. Kiểm thử Phase 2D đi qua HTTP local với JWT/JWKS test.

[Hợp đồng API](./API_CONTRACT_V1.md) · [Hướng dẫn Windows](../../apps/api/README.md)
