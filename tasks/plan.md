> **SUPERSEDED** — Kế hoạch V2.2 đã hoàn tất, không phải roadmap đang hoạt động. Nguồn chuẩn hiện tại: [CURRENT_MVP.md](../docs/CURRENT_MVP.md). Các phương pháp, kết quả và nội dung gốc bên dưới được giữ nguyên; lệnh lịch sử không được thực thi lại trong audit này. Roadmap hiện tại: [tasks/current.md](current.md).

# V2.2 — chốt cơ chế (11/10/2026)

Phạm vi được chủ dự án giao: review + thí nghiệm offline + hướng dẫn solo; chỉ sửa production nếu chứng minh được lỗi tài chính. Cấu hình chính 4/C20/50M/90M, baseline 3/A20 giữ nguyên. Không deploy, không đổi cân bằng chưa duyệt.

1. Đọc báo cáo và audit settlement, giá, maturity, business, funding/goal. Lưu hash sản phẩm trước nghiên cứu.
2. Tái sử dụng runner/audit hiện có, bổ sung hook policy chỉ dùng diagnostic. Test hook và replay trước khi chạy.
3. Một đợt 5.000 seed ghép cặp: controls, savings hiện tại so 4/5/6%, business thoát vốn/nâng cấp, tài sản và forecast/chart, funding. Thay rate chỉ trong process đồng bộ, restore finally.
4. Đối chiếu kế toán từng ván, tổng hợp paired delta/CI và goal hậu xử lý. Không tìm tham số để đạt 50% thắng.
5. Ghi review tiếng Việt, gói thay đổi nhỏ ưu tiên impact/effort; hướng dẫn tối đa 5–6 ván người thật. Phân biệt đo được, suy luận và chưa xác minh.
6. Test toàn bộ + diagnostic, replay JSON browser có sẵn, lint, typecheck, build; kiểm hash production. Chỉ regression RED/GREEN nếu có lỗi xác nhận.

Tiêu chí xong: hai báo cáo + dữ liệu/CLI tái lập; không có nghiên cứu hoặc feature ngoài phạm vi; đề xuất tài chính chỉ ở báo cáo.

## Triển khai profile đã duyệt — 11/10/2026

1. Dùng nhánh `feat/v2-2-savings-profile`, giữ công việc review hiện tại.
2. Regression RED/GREEN: profile riêng theo ván; B4/C20 4/5/6, hai A20 6/7/8; không đổi global.
3. Ghi profile trong state/snapshot/schema5; fallback V2.1 thiếu profile về lãi cũ; replay và re-export schema4 đúng số tiền cũ.
4. Cập nhật preview hiện có; giữ lot độc lập, whole-lot, maturity/funding/goal.
5. So sánh 1.000 seed ×3 policy ×2 profile, audit từng ván, giữ nguyên path.
6. Browser B đầy đủ qua Result, tải JSON thật, kiểm replay; cập nhật guide/report tiếng Việt.
7. Test toàn bộ/diagnostic, lint, typecheck/build và review diff. Không push/merge/deploy.
