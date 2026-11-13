# Phase 2C4 · START và Rebalancing

Phase 2C4 dùng B18 Multi-Course, board 18 ô, bốn vòng và save schema 7. Backend tiếp tục dùng engine đã đăng ký ở V2C3.

## Quyết toán START

`roll` kích hoạt quyết toán khi đi tới hoặc vượt START. Khi vượt qua, ô đích chờ đến sau checkpoint. Engine bảo vệ theo vòng và tăng con trỏ trước mỗi bước có thể dừng chờ Funding.

1. Cập nhật thị trường định kỳ cho vòng hiện tại. Các cú sốc từ ô Macro được xử lý khi gặp ô.
2. Cộng lương cơ bản và phần tăng từ khóa học.
3. Ghi nhận dòng tiền Business theo vốn, nâng cấp và thị hiếu. Nếu dòng tiền âm, engine tạo khoản thanh toán.
4. Chuyển gốc và lãi làm tròn của các khoản tiết kiệm đáo hạn vào tiền mặt. Xử lý coupon, gốc và tình trạng tổ chức phát hành trái phiếu theo engine.
5. Thu chi phí sinh hoạt định kỳ.
6. Thu gốc nợ có từ trước START và lãi làm tròn. Sau đó thu nghĩa vụ đã hẹn từ các sự kiện.
7. Tại START cuối, cộng lãi làm tròn của khoản vay mới trong quyết toán vào dư nợ. Lưu tổng kết và chuyển sang `summary`.

Khi thiếu tiền, engine vào `funding` hoặc chốt `insolvent` nếu hết nguồn hợp lệ. Lệnh `fund` thanh toán khoản thiếu và tiếp tục từ con trỏ đã lưu. Retry và đọc lại session dùng snapshot đã commit.

`advance` ở `summary` mở `rebalancing`. `advance` lần tiếp theo mở dự báo vòng mới và giữ ô đích chờ xử lý. Ở vòng bốn, nó chốt ván và lưu kết quả chính thức. B18 xác định thắng khi hoàn thành đủ bốn quyết toán và có ít nhất 90.000.000 VND nguồn huy động hợp lệ. Chỉ số này cộng tiền mặt, gốc tiết kiệm đang active và tiền bán ròng từ Gold, Stocks và Bonds, rồi trừ nợ và nghĩa vụ còn lại. Business chưa bán chỉ góp vào giá trị tài sản ròng.

## Thao tác và quote

| Ngữ cảnh | Thao tác |
| --- | --- |
| Ô Gold, Stocks hoặc Bonds | `trade` mua hoặc bán tài sản của ô, theo giới hạn giao dịch của lượt ghé |
| Funding | `fund` dùng nguồn được engine cho phép để thanh toán khoản thiếu, gồm rút tiết kiệm hoặc vay khi có quyền |
| START Rebalancing | `trade` bán Gold, Stocks hoặc Bonds theo lot, hoặc `trade` trả nợ. Có thể bán nhiều lần theo số dư cập nhật, kể cả vòng cuối. `advance` kết thúc checkpoint. |

Bán tại START dùng `trade` với `kind: "sell"`, VND gộp nguyên dương và asset. Stocks nhận `symbolId` hoặc phân bổ theo tỷ lệ nếu bỏ mã. Bonds yêu cầu `lotId` giao dịch được. `completeEncounter: true`, mua tài sản, gửi/rút tiết kiệm và giao dịch Business đều bị từ chối ở Rebalancing. Các hành động này có thể xuất hiện ở ô hoặc phase tương ứng.

`POST /v1/game-sessions/:id/trade-quote` mô phỏng đúng lệnh bán trên snapshot tại `expectedStateVersion`. Quote trả giá, giới hạn gộp, số lượng, phí, spread, số tiền nhận và tiền mặt sau giao dịch. `bank-quote` tiếp tục tính gốc và lãi cho trả nợ. Trước checkpoint cuối, tiền mặt phải đủ trả cả gốc và lãi. Ở checkpoint cuối, engine thu theo dư nợ đã ghi và không tính lãi trả nợ lần nữa.

Quote kiểm tra JWT, owner, trạng thái session và version. Quote chỉ đọc và không tiêu thụ RNG. Action khóa dòng session bằng `FOR UPDATE`, kiểm tra lại version và tính lại từ snapshot đã khóa. Action, snapshot, version và kết quả terminal được commit trong một transaction. Cùng key và body trả response đã commit. Cùng key với lệnh khác trả `409 IDEMPOTENCY_KEY_REUSED`. Version cũ trả `409 STATE_VERSION_CONFLICT`.

## Tích hợp client

GET session và response action có `state.start` theo vòng hiện tại, kèm phase, holdings, dư nợ, `availableActions` và kết quả terminal. Dùng `state.start.sales` để chọn asset/mã/lot, rồi lấy quote cho số tiền cụ thể. Seed, RNG và con trỏ quyết toán giữ ở server. [Hợp đồng API](./API_CONTRACT_V1.md)

Web và Mobile cần chuyển từ local engine sang session/quote/action API, xử lý JWT, đọc lại version khi xung đột và giữ key/body khi retry. Nếu frontend gọi API từ origin khác, cần cấu hình proxy cùng origin hoặc CORS trước khi thử trong trình duyệt. API tạo B18 với thiết lập canonical mặc định, trong khi màn hình Mobile hiện có chọn tiền gửi đầu ván và kỳ hạn. Cần chốt luồng thiết lập nếu frontend vẫn cung cấp lựa chọn này. Kết nối Supabase Auth thật và kiểm thử UI end-to-end thuộc bước tích hợp sau.

## Kiểm thử

`apps/api/tests/start.integration.ts` chạy trên PostgreSQL với HTTP và JWKS test. Một ván mới đi đủ bốn vòng và bán Gold, Stocks và Bonds tại START. Suite đối chiếu state tài chính sau từng action, hash của từng snapshot schema 7, kết quả lưu trong PostgreSQL và replay từ log engine. Hai fixture kiểm chứng Funding tại START cuối, lãi khoản vay mới, trả nợ và insolvency. Suite cũng kiểm tra rollback khi ghi snapshot thất bại, retry, mất response, xung đột đồng thời, quote cũ, owner khác và reconnect. Các suite V1–V2C3 bao phủ thêm giao dịch ở ô, nâng cấp/bán Business và Bank.

[Hướng dẫn Windows](../../apps/api/README.md) · [Tài liệu PostgreSQL về khóa dòng](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)
