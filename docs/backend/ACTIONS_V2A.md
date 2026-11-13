# EXE Phase 2A · Xử lý hành động trên server

Phase 2A dùng engine tại checkpoint B18 `e30bbd034d0b014e9a9b6c40ef1a7356a2f5db8a` và phát triển từ Backend V1 `504947ad11bd9094d53630e7caad56c56b6a9072`. V1 session ở state version 0 chạy được với API mới. Môi trường nghiệm thu dùng PostgreSQL Docker và volume riêng của Phase 2A.

## Đối chiếu engine canonical

| Thành phần | Hành vi trên Node.js |
| --- | --- |
| `createMultiCourseGame` | Sinh seed 128 bit qua Web Crypto ở lần tạo. Replay truyền lại seed đã lưu. |
| `advance` | Engine xử lý `forecast`, `summary` và `rebalancing`. Khi qua START, engine tiếp tục landing nếu có. Advance sau rebalancing vòng cuối chốt ván. |
| `roll` | Chạy ở `rolling`. Engine tự gieo D6, xác định landing và gọi encounter hoặc settlement. |
| `canChoose` và `decide` | Dùng event/options của B18. API cho phép bốn option trong Phase 2A. Engine quyết định tác động và nghĩa vụ. |
| RNG và thị trường | FNV-1a và Mulberry32 giữ cursor trong state. Lịch sử thị trường khởi tạo từ seed phụ. Encounter, thị trường START và cập nhật tín dụng dùng dữ liệu/cursor canonical. Timestamp thị trường là chỉ số lịch sử hoặc lượt chơi. |
| Save và replay | `serializeLog` và `restoreSavedGame` chạy trên Node. Các wrapper lưu cục bộ gọi `window.localStorage` khi được gọi từ browser. `replayGameLog` là verifier Node trong diagnostics. |
| Kết quả | `victory` và `liquidatableFunds` xác định outcome và số nguyên VND. Chỉ ghi kết quả khi `phase=finished`. |

Một action API có thể tạo nhiều mục log canonical hoặc đổi phase mà không tạo mục log. Lịch sử SQL ghi từng lệnh theo sequence, độc lập với sequence của log trong save schema 7.

## Transaction và retry

Dưới `READ COMMITTED`, backend khóa dòng session bằng `SELECT … FOR UPDATE OF game_sessions`, với điều kiện ID và owner. Sau khi lấy khóa, backend đối chiếu action đã lưu theo key trước khi kiểm tra trạng thái active và expected version. Idempotency bao gồm action ID, payload và expected version. Với action đã commit, backend trả state/result của chính snapshot tại sequence đó, kể cả khi session đã tiến xa hơn hoặc đã kết thúc.

Action mới đọc snapshot hiện tại, dùng engine xác thực phase và chạy transition. Trong cùng transaction, backend thêm action, snapshot kế tiếp, cập nhật session, rồi ghi game result nếu engine kết thúc. Sequence bằng state version sau action, tăng một từ version hiện tại. Backend chỉ gửi HTTP 200 sau khi transaction commit. Lỗi trước commit rollback toàn bộ thay đổi. PostgreSQL giữ ràng buộc unique theo session/key và session/sequence. [PostgreSQL row locks](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS) · [Drizzle transactions](https://orm.drizzle.team/docs/transactions)

Schema và ba migration V1 đáp ứng Phase 2A. Kết quả terminal tham chiếu final snapshot theo session/version. Snapshot giữ chuỗi canonical nguyên bản để phục hồi và kiểm chứng replay. Response trả projection của state cho owner. Seed, cursor RNG, lịch sử giá sinh từ seed và engine log ở lại server.

## Phạm vi tiếp theo

Phase 2A hỗ trợ `advance`, `roll` và `choose` với `skip`, `acknowledge`, `defer`, `temporary` tại event tương ứng. Phiên đến `funding` sẽ chờ action funding ở giai đoạn sau. Các lựa chọn mua khóa học, giao dịch Trading/Bank/Business, funding và thao tác tài sản ở rebalancing nằm ngoài phạm vi 2A.

Ưu tiên tiếp theo là funding và các lựa chọn event còn lại, với parity cho từng nguồn tiền và nhánh insolvency. Sau đó thêm state-read endpoint để client đồng bộ khi version conflict, rồi mở Trading/Bank/Business theo từng nhóm có kiểm thử replay và atomicity. Frontend production chưa kết nối. Semantic P4 giữ HOLD.
