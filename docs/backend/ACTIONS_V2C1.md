# EXE Phase 2C1 · Trading trên server

Phase 2C1 phát triển từ V2B `7b564ebdb35726b848859df6f666d36c13d078e8` và chạy cùng engine B18 multi-course trên Node. PostgreSQL dùng project và volume local `exe-backend-v2c1`, với ba migration đã có.

## Phạm vi và parity

API nhận action `trade` theo command mobile, với payload `kind`, `asset`, `amount` và định danh canonical phù hợp. Adapter giới hạn giao dịch chủ động ở ô đang gặp của Gold, Stocks hoặc Bonds. Engine `transact` thực hiện cả mua và bán, khóa quyền giao dịch của lượt ghé và chuyển ván về `rolling`. `fund` vẫn dùng `fundPayment` khi có khoản thiếu bắt buộc. Giao dịch chủ động ở `rebalancing` thuộc giai đoạn sau.

| Tài sản | Định danh và phép tính canonical |
| --- | --- |
| Gold | Giá hiện tại và lượng vàng phân số. Bán dùng `saleQuote` tính spread và phí theo thứ tự engine. |
| Stocks | Có thể chọn `symbolId`. Engine mặc định mã đầu tiên khi mua và bán theo tỷ lệ các holding khi bỏ mã. Giới hạn bán theo giá trị làm tròn của mã hoặc danh mục. |
| Bonds | Mua yêu cầu `issuerId` đang cho phát hành. Bán yêu cầu `lotId` khả dụng, dùng `creditBondLots` và `saleQuote` của lot. Engine cập nhật số lượng, gốc, coupon và cost basis. |

Số tiền yêu cầu là số nguyên VND dương. Đơn vị tài sản có thể là số phân số của engine. Quote chạy transition thuần trên snapshot đã đọc và lấy phí/spread từ selector canonical. Cả quote và action đều kiểm tra tiền, tài sản, quyền giao dịch tại ô và định danh. Trade giữ nguyên cursor RNG và market state. Thay đổi giá do các transition START hoặc macro tương ứng vẫn do engine điều khiển.

## Version và retry

`POST /v1/game-sessions/:id/trade-quote` trả quote theo snapshot/version nhất quán của owner. Quote mang `stateVersion`, áp dụng cho payload đã gửi. Khi execute, `POST /v1/game-sessions/:id/actions` kiểm tra version dưới row lock, nạp lại snapshot và chạy `transact`. Request dùng version cũ nhận 409. Giá, fee và số dư không thuộc request schema.

Action, snapshot schema 7, version và kết quả terminal dùng transaction V2B. Retry cùng key và body trả snapshot tại version của action gốc. Test gây lỗi giữa transaction và làm rơi HTTP response sau commit để kiểm chứng rollback và retry. [PostgreSQL row locks](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)

## Nghiệm thu và bước tiếp

Bộ integration mở listener HTTP với JWT/JWKS test và tạo session bằng endpoint thật. Test đọc seed từ PostgreSQL để chọn một đường chơi tự nhiên đủ lượt mua rồi bán cả ba tài sản. Genesis và snapshot không bị ghi đè trong ca này. Mọi bước chơi thực thi qua HTTP, có kiểm tra reconnect, từng snapshot, replay từ lịch sử action và replay schema 7. Khi replay chuỗi action, payload đọc từ JSONB đi qua cùng schema với request để khôi phục thứ tự trường mà serializer canonical ghi vào log. Lựa chọn `skip` đi qua các ô Bank/Business và `advance` đi qua rebalancing để hoàn thành ván theo engine.

Bank, Business và thao tác tài chính tại START vẫn nằm ngoài action API. Bước tiếp theo nên triển khai Bank, sau đó tách Business và rebalancing thành các nhóm có kiểm thử quote, settlement và replay riêng. Semantic P4 tiếp tục HOLD.
