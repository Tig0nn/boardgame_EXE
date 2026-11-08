# CHƯƠNG 2: KHỞI NGHIỆP QUÁN CÀ PHÊ (COFFEE SHOP SIMULATOR)
## HỆ THỐNG THIẾT KẾ MỸ THUẬT & GIAO DIỆN (DESIGN SYSTEM)
**Aesthetic Theme:** Coffeehouse Artisan & Warm Retro Wood  
**Tiêu chuẩn:** Mobile-First Canvas 1080 × 2400 px  
**Tác giả:** Senior Game Manager Creator 2026  

---

## 1. PHONG CÁCH NGHỆ THUẬT (VISUAL IDENTITY)
Chương 2 chuyển đổi từ phong cách biển đảo tươi sáng của Chương 1 sang **Không Gian Quán Cà Phê Mộc Ấm Áp (Artisan Coffeehouse & Warm Wood Texture)**:
- Cảm giác gần gũi, thơm mùi cafe rang mộc, ánh đèn vàng ấm cúng.
- Giao diện tài chính được trực quan hóa thành **Hóa Đơn Giấy Kraft & Bảng Menu Gỗ Retro**, biến những con số P&L khô khan thành trải nghiệm thị giác sống động.

---

## 2. BẢNG MÀU CHỦ ĐẠO (COFFEE PALETTE & TOKENS)

| Token Name | Hex Code | Tên màu tiếng Việt | Ứng dụng giao diện |
| :--- | :---: | :--- | :--- |
| `coffee-espresso-900` | `#1E1B18` | Đen Cà Phê Espresso | Nền thanh trạng thái, chữ tiêu đề đậm, viền khung chính |
| `coffee-roast-800` | `#451A03` | Nâu Hạt Cafe Rang Đậm | Thanh điều hướng, khung bảng P&L, nền thẻ quyết định |
| `coffee-caramel-700`| `#78350F` | Nâu Caramel Ấm | Nút bấm chính, viền bo góc, biểu tượng cốc cafe |
| `coffee-amber-500` | `#D97706` | Hổ Phách Mật Ong | Điểm nhấn nổi bật, ngôi sao đánh giá, chỉ số Runway |
| `coffee-latte-100` | `#FEF3C7` | Bọt Sữa Latte Dịu Nhẹ| Nền hóa đơn giấy Kraft, bề mặt thẻ tình huống Polaroid |
| `coffee-cream-50` | `#FFFBEB` | Kem Tươi Thanh Trùng | Nền toàn màn hình, khung nhập số liệu |
| `finance-profit-600` | `#16A34A` | Xanh Lá Lợi Nhuận | Lợi nhuận ròng dương, bán vượt điểm hòa vốn |
| `finance-loss-600` | `#DC2626` | Đỏ Lỗ Vận Hành | Cảnh báo lỗ ròng, chi phí sửa chữa hỏng hóc |

---

## 3. THIẾT KẾ CÁC THÀNH PHẦN GIAO DIỆN CHÍNH (UI COMPONENTS)

### 3.1. Bảng Báo Cáo Tài Chính Tháng (Monthly P&L Wooden Board)
- Thiết kế mô phỏng kẹp hóa đơn tính tiền bằng gỗ kẹp giấy Kraft:
  - Header: Logo quán cafe & Tên tháng (`THÁNG 1 / 3 · BÁO CÁO KẾT TOÁN P&L`).
  - Dòng 1: **Tổng Doanh Thu (Revenue):** Màu xanh ngọc đậm `#047857`, có nút mở rộng xem chi tiết ly bán/ngày.
  - Dòng 2: **Chi Phí Biến Đổi (COGS):** Hiển thị rõ tiền mua hạt, sữa, ly nắp.
  - Dòng 3: **Chi Phí Cố Định (Fixed Costs):** Chi tiết tiền nhà, lương nhân viên.
  - Dòng 4 (Nổi bật nhất): **Lợi Nhuận Ròng (Net Profit):** Số tiền to, có huy hiệu `🟢 ĐÃ HÒA VỐN` hoặc `🔴 LỖ VẬN HÀNH`.

### 3.2. Thẻ Tình Huống Phong Cách Polaroid (Polaroid Decision Cards)
- Khung thẻ bo góc `border-radius: 20px`, nền trắng kem `#FFFBEB`, viền nâu mộc `2px solid #D97706`.
- Phần đầu: Hình minh họa hoạt họa 2D sinh động (Máy pha cafe, tủ lạnh bốc khói, ly cà phê muối).
- Phần thân:
  - Bối cảnh tình huống viết ngắn gọn, súc tích (dưới 35 từ).
  - 3 nút lựa chọn A / B / C xếp dọc công thái học:
    - Mỗi nút hiển thị rõ: Tên quyết định + Tác động tài chính trực tiếp (`-3.500.000 VND` hoặc `+15 ly/ngày`).
    - Hiệu ứng nhún `scale(0.96)` và âm thanh "ting" vui tai khi chọn.

### 3.3. Đồng Hồ Đo Runway Tiền Mặt & Ly Cafe Hài Lòng
- **Đồng hồ Runway (Cash Gauge):** Thanh đo ngang nằm ngay dưới Header:
  - Hiển thị: `⏱️ Runway: 3.2 Tháng (Còn 45.000.000 VND)`.
  - Màu sắc tự động đổi từ Xanh lá $\rightarrow$ Vàng $\rightarrow$ Đỏ nhấp nháy khi còn dưới 1.5 tháng.
- **Ly Cà Phê Hài Lòng (Customer Satisfaction Cup):** Biểu tượng ly cafe với làn khói bốc lên:
  - Điểm hài lòng: `85 / 100`.
  - Khói bốc cao và có trái tim bay lên khi khách hàng hài lòng!
