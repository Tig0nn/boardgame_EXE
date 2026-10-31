# Mỏ Hỗn — What-if video walkthrough (75–85 giây)

## Chuẩn bị

1. Dùng worktree `_exe-workstreams/b18-whatif-demo`, branch `feat/b18-whatif-demo`. Baseline remote thực dùng là `dd4c1a1fb915b006d4bd86c8adec7b793a499641`; commit đề xuất `883b64b…` chưa có trên remote. Xem báo cáo trước khi áp dụng vào checkout khác.
2. Chạy `npm ci`, `npm ci --prefix mobile_app`, rồi `npm run dev --prefix mobile_app -- --host 127.0.0.1`.
3. Mở **http://127.0.0.1:5174/?whatIfDemo=repair&repairAi=1** ở Chrome. Chọn responsive viewport **390×844**, zoom 100%. Đóng DevTools console và các cửa sổ không cần thiết.
4. Đây là phiên developer riêng, không ghi save thật. Sự kiện sửa xe hiện ngay, tiền mặt **50 triệu**. Không cần gieo xúc xắc để tìm sự kiện. Nếu quay lại: refresh hoặc **Tái hiện sửa xe**.
5. Có thể tắt âm thanh trên HUD khi về bàn. Không cần API key hay chạy server Gemini. Không dùng `vite preview` cho clip này: production cố ý không có What-if/fixture.

## Kịch bản quay

| Thời gian | Thao tác | Lời dẫn gợi ý |
| --- | --- | --- |
| 0–10 giây | Quay sự kiện “Chiếc xe cần sửa”, dừng ở số dư 50 triệu và hai lựa chọn | “Mỏ Hỗn cho mình thử các quyết định tài chính bằng tiền ảo và thấy rõ cái giá của từng lựa chọn.” |
| 10–23 giây | Chọn **Sửa ngay — 4.000.000 ₫**. Về bàn, dừng ở số dư **46 triệu** | “Mình chọn sửa ngay, trả 4 triệu. Đây là quyết định thật trong ván, nên tiền mặt còn 46 triệu.” |
| 23–37 giây | Nhấn **✨ Nếu tôi chọn cách khác?**. Dừng ở pre-decision cash 50 triệu và thẻ Actual | “What-if lấy đúng trạng thái trước quyết định này để chạy lại hai phương án bằng engine.” |
| 37–53 giây | Đưa thẻ What-if sửa tạm vào giữa màn hình | “Nếu sửa tạm, mình chỉ trả 1 triệu hôm nay, còn 49 triệu tiền mặt. Nhưng có thêm nghĩa vụ 4 triệu ở lần qua Xuất phát tiếp theo. Tổng cam kết là 5 triệu.” |
| 53–68 giây | Cuộn xuống bài học và giới hạn mô phỏng | “Sửa tạm giữ lại 3 triệu trước mắt, đổi lại tổng chi phí cao hơn 1 triệu. Trả ít hôm nay không đồng nghĩa trả ít hơn.” |
| 68–82 giây | Dừng ở ghi chú scope, nhấn **← Quay về ván đang chơi**, rồi gieo xúc xắc | “Đây chỉ là tác động tại lúc quyết định, chưa mô phỏng tương lai. Mình đóng lại và tiếp tục chính ván đang chơi.” |

Không nói “AI dự đoán tương lai”, “sửa tạm đã thanh toán hết” hoặc “tính năng đã ra production”. Premium là nhãn demo; chưa có thanh toán/mở khóa trả phí.

## Những số phải xuất hiện trong clip

| | Actual: sửa ngay | What-if: sửa tạm |
| --- | ---: | ---: |
| Cash trước quyết định | 50 triệu | 50 triệu |
| Cash sau quyết định | 46 triệu | 49 triệu |
| Đã trả ngay | 4 triệu | 1 triệu |
| Nghĩa vụ mới | 0 | 4 triệu tại Xuất phát |
| Tổng chi phí cam kết | 4 triệu | 5 triệu |

Nếu chọn **sửa tạm thật**, hai thẻ đảo vai trò: Actual 49 triệu và nghĩa vụ 4 triệu; alternative sửa ngay 46 triệu. Nhấn **Tái hiện sửa xe** để quay biến thể này. Cả hai đã được kiểm ở 390px và 320px.

## Kiểm tra nhanh trước khi bấm Record

- Sự kiện đúng, tiền trước quyết định 50 triệu; chưa hiện nút What-if trước khi chọn.
- Hai tab Companion vẫn có ở màn sự kiện. Không cần gửi câu hỏi cho clip What-if.
- Sau chọn thật, nút What-if hiện rõ trên bàn.
- Mở modal thấy cả Actual và What-if; cuộn xuống đọc được toàn bài học và ghi chú scope.
- Nút quay về luôn có; Escape/nút đóng cũng hoạt động. Mở lại trước lượt tiếp theo giữ đúng so sánh.
- Sau khi gieo xúc xắc, so sánh cũ bị bỏ. Để quay lại từ đầu, dùng fixture reset, không cố mở dữ liệu lượt cũ.

## Nếu cần trình diễn thiếu tiền

Dùng http://127.0.0.1:5174/?whatIfDemo=repair&repairAi=1&cash=low. Cash 2 triệu + khoản tiết kiệm 48 triệu là phân bổ setup hợp lệ. Chọn sửa tạm thật, rồi mở What-if. Alternative sửa ngay phải ghi **đã trả 2 triệu, còn thiếu 2 triệu, chưa hoàn tất thanh toán**. Không dùng biến thể này làm clip chính 75 giây vì cần giải thích thêm về funding.

Biến thể http://127.0.0.1:5174/?whatIfDemo=repair&repairAi=1&cash=funding có 500 nghìn cash. Chọn thật phải xử lý funding; What-if không xuất hiện. Đây là kiểm tra trạng thái, không phải lỗi thiếu CTA.

Evidence và giới hạn thiết bị/baseline: [EXE_WHATIF_DEMO_REPORT.md](EXE_WHATIF_DEMO_REPORT.md).
