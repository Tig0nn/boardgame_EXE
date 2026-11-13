# EXE Phase 2C3 · Business trên server

Phase 2C3 bắt đầu từ V2C2 `1fad365563bb5ca3d349ed1d86047d1b88996d96`. Backend dùng engine B18 multi-course và luật `v2.4-customer-preferences`. Ba migration V1 đủ cho luồng này. PostgreSQL local dùng project và volume riêng `exe-backend-v2c3`.

## Hợp đồng canonical

`trade` nhận `asset: "business"` và `kind: "buy" | "upgrade" | "sell"`. Engine `transact` thực hiện giao dịch tại phase `event` khi ô và event đều là Business. UI hiện có dùng cùng ba thao tác.

| Lệnh | Điều kiện và kết quả |
| --- | --- |
| Mua | Chưa sở hữu và đủ 20.000.000 VND tiền mặt. Engine ghi vốn đã đầu tư, giá thu hồi ban đầu và lượt mua, rồi chuyển sang `rolling`. |
| Nâng cấp | Từ lượt ghé sau lượt mua, tối đa một tầng mỗi lần ghé và sáu tầng khi sở hữu. Mỗi tầng tốn 5.000.000 VND. Chọn `checkin`, `budget` hoặc `taste`. Nếu bỏ trường chuyên môn, engine dùng thị hiếu hiện tại. |
| Bán | Bán toàn bộ cơ sở ở ô Business sau lượt mua. `amount` phải bằng định giá hiện tại, kể cả 0 nếu giá thu hồi bằng 0. Engine cộng tiền bán, xóa vốn và nâng cấp. Người chơi có thể bán sau nâng cấp trong cùng lượt ghé. |

START ghi dòng tiền theo `businessIncome`. B18 dùng mức nền 3.000.000 VND, cộng 700.000 VND mỗi tầng và 1.000.000 VND mỗi tầng trùng thị hiếu của vòng. Market update tại START và cú sốc macro thay đổi giá thu hồi theo luật có sẵn. Các thay đổi đó giữ nguyên công thức thu nhập B18. Sale dùng `businessSaleQuote`; nhánh Business hiện không thu phí giao dịch.

Vốn cơ sở đã đầu tư, định giá hiện tại và tiền mặt là các giá trị riêng. Định giá chưa bán nằm trong net worth. Funding và kết quả chính thức dùng `liquidatableFunds`, chỉ nhận tiền đã hiện thực hóa từ giao dịch Business hợp lệ và thu nhập đã được ghi nhận.

## Quote và state

GET session và response action bổ sung `state.business` với vốn, trạng thái sở hữu, giá bán hiện tại, thu nhập theo điều kiện vòng hiện tại, số tầng và lệnh khả dụng. Danh sách chuyên môn dùng selector canonical và thị hiếu công khai của vòng. Preview thu nhập áp dụng điều kiện hiện tại, không dự báo thị hiếu hoặc thị trường tương lai.

`POST /v1/game-sessions/:id/business-quote` đọc snapshot của owner, kiểm tra version và chạy thử `transact` trên state trong bộ nhớ. Quote trả chi phí, số tiền nhận, tiền mặt sau giao dịch, state Business và giá trị tài chính sau giao dịch. Quote giữ nguyên snapshot và RNG. Khi commit, backend kiểm tra lại version và lệnh dưới row lock, sau đó ghi action, snapshot và kết quả terminal trong cùng transaction. [PostgreSQL row locking](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)

Replay dùng cùng payload schema để đọc lại lệnh từ JSONB. Log schema 7 vẫn lưu action Business canonical. Suite PostgreSQL đối chiếu hash từng snapshot với replay theo action history và kiểm tra lại bằng verifier schema 7.

## Nghiệm thu và phạm vi tiếp theo

Ca HTTP đi từ session mới đến hoàn thành bốn vòng, mua và nâng cấp tại các lượt ghé hợp lệ, nhận thu nhập ở START rồi bán. Ca này cũng gửi tiết kiệm, mua vàng và đọc lại state sau reconnect. Fixture riêng kiểm tra vốn thiếu, giới hạn nâng cấp, định giá sau cú sốc và insolvency khi Business còn bị khóa trong vốn.

API chưa có bán một phần, rút vốn tùy ý hay bán Business trong Funding hoặc tại START. Luồng nghiệm thu dùng `advance` để đi qua rebalancing. Phase 2C4 nên đưa các giao dịch tài sản hợp lệ tại START lên server, theo đúng phase, quote và kiểm thử replay của engine. Semantic P4 tiếp tục HOLD.
