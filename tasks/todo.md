> **SUPERSEDED** — Checklist V2.2 đã hoàn tất, không phải việc còn thiếu của MVP V2.4. Nguồn chuẩn hiện tại: [CURRENT_MVP.md](../docs/CURRENT_MVP.md). Các phương pháp, kết quả và nội dung gốc bên dưới được giữ nguyên; lệnh lịch sử không được thực thi lại trong audit này. Roadmap hiện tại: [tasks/current.md](current.md).

# V2.2

- [x] Đọc báo cáo và code tài chính hiện tại.
- [x] Lưu manifest44 file bảo vệ production; không có lỗi tài chính production mới xác nhận.
- [x] Runner/test policy diagnostic, giữ tương thích controls cũ.
- [x] Hoàn tất100.000 ván paired + dữ liệu máy đọc; tái chạy sau sửa metric conditional, kết quả funds/win giữ nguyên.
- [x] Viết V2_2_MECHANICS_REVIEW và V2_2_SOLO_TEST_GUIDE (6 ván).
- [x] Verification90 production +19 diagnostic, lint/typecheck/build,3 JSON browser replay, hash44/44; review phạm vi không đổi sản phẩm.

Đã hoàn tất nghiên cứu/verification. Quyết định savings4/5/6 chỉ là đề nghị chờ chủ dự án duyệt; không phải công việc production đang bỏ dở. Chưa có feedback solo người thật.

## Profile được duyệt — triển khai V2.2

- [x] Nhánh riêng `feat/v2-2-savings-profile`.
- [x] Profile riêng theo game; UI/lot/state/log/settlement nhất quán, global financial config không đổi.
- [x] 19 regression mới; schema4 lịch sử và schema5 mới replay đúng, re-export log cũ đúng số tiền.
- [x] 6.000 ván so sánh paired, 0đ sai số kế toán, 3.000 cặp có path khớp.
- [x] Browser C20 đủ 4 vòng/26 roll, cả 3 kỳ hạn, JSON tải thật và replay xác nhận102,8M.
- [x] Toàn bộ109 tests +19 diagnostic; lint, typecheck, build pass.
- [x] Guide và báo cáo triển khai tiếng Việt; review diff phạm vi, không push/merge/deploy.
