# EXE Phase 2C2 · Bank trên server

Phase 2C2 bắt đầu từ V2C1 `99fde7653873e43e47c154643bb48d4562acbe7c` và dùng engine B18 multi-course hiện có. PostgreSQL local dùng project và volume riêng `exe-backend-v2c2`. Ba migration V1 đủ cho luồng này.

| Nghiệp vụ | Canonical transition và phase |
| --- | --- |
| Gửi tiết kiệm | `trade` với `kind: "deposit"` tại encounter Bank. `transact` trừ tiền mặt, tạo lot và đưa ván về `rolling`. Mỗi lượt ghé mở tối đa một khoản. |
| Đáo hạn | Engine tự trả gốc và lãi ở START theo kỳ hạn 1, 2 hoặc 3. Lãi B18 là 4%, 5% hoặc 6% mỗi kỳ tương ứng, tính lãi đơn và làm tròn theo engine. Lot có ngày đáo hạn sau vòng cuối vẫn được giữ theo luật B18. |
| Rút sớm | `fund` với `source: "savings"` khi có khoản thiếu bắt buộc. Rút toàn bộ một lot active, mất lãi kỳ hạn. |
| Vay | `fund` với `source: "debt"`. Tối đa bằng số còn thiếu và hạn mức vay còn lại. B18 có hạn mức 30 triệu VND. |
| Trả nợ | `trade` với `kind: "repay"` tại phase `rebalancing` sau START. Engine kiểm tra gốc và tiền mặt đủ trả gốc cộng lãi. Trước START cuối, lãi là 10% trên phần gốc trả, làm tròn VND. Tại checkpoint cuối, engine áp dụng 0 lãi bổ sung cho lệnh trả nợ vì phần lãi đến hạn hoặc lãi vay mới đã được xử lý ở settlement. |

START tự thu gốc và lãi của dư nợ có trước settlement. Khi tiền mặt không đủ, engine tạm dừng để Funding. Lãi vay mới trong settlement cuối được cộng vào dư nợ theo engine. Khi hết nguồn huy động hợp lệ mà nghĩa vụ còn thiếu, engine kết thúc với `insolvent`. Kết quả chính thức được ghi cùng action và snapshot trong transaction. UI Bank và Rebalance hiện có đều gọi các transition canonical tương ứng. API chưa có khoản vay chủ động tại Bank, rút một phần hoặc tự chọn ngày tất toán.

## Quote, state và replay

`POST /v1/game-sessions/:id/bank-quote` đọc snapshot đã commit của owner, kiểm tra version và chạy thử transition canonical trên state trong bộ nhớ. Preview gửi dùng `depositPreview`. Preview trả nợ và Funding lấy lãi, tiền dùng để trả khoản thiếu và lãi mất từ log engine của transition thử. Quote có thể mô tả bước settlement tiếp theo, vẫn giữ nguyên state, RNG và dữ liệu lưu. Khi execute, server kiểm tra lại dưới row lock và tính theo snapshot hiện tại. [PostgreSQL row locking](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)

State trả danh sách lot tiết kiệm, lãi suất, hạn mức, số còn vay được, `netWorth` (danh mục trừ nợ), `totalWorth` (đã trừ nghĩa vụ và khoản thiếu đang chờ) và `liquidatableFunds` (nguồn huy động hợp lệ theo engine). `fundingOptions` tiếp tục mô tả nguồn tiền tại Funding. `canDeposit` và `canRepay` cho biết phase và khả năng thực hiện.

Kiểm thử HTTP tạo session thật, chọn một đường chơi tự nhiên theo seed đã lưu và chạy các lệnh qua API. Ván mở hai khoản gửi, vay một phần để Funding, rút sớm một khoản, nhận gốc và lãi khoản còn lại tại START, mua vàng, trả nợ theo lịch và kết thúc đủ bốn vòng. Test đọc lại sau reconnect, so khớp từng snapshot với replay từ action history và kiểm tra lại bằng replay schema 7. Ca trả nợ chủ động dùng fixture START có dư nợ. Các regression Funding tiếp tục kiểm tra insolvency và rollback kết quả.

## Phạm vi tiếp theo

Business và các giao dịch tài sản chủ động tại phase `rebalancing` thuộc các bước sau. Phase 2C2 chỉ mở lệnh trả nợ canonical tại checkpoint đó. Bước tiếp theo nên triển khai Business với parity cho mua, nâng cấp, bán và dòng tiền tại START. Semantic P4 tiếp tục HOLD.
