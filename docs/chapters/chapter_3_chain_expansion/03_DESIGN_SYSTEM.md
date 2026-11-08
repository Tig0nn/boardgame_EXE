# CHƯƠNG 3: MỞ RỘNG CHUỖI & NHƯỢNG QUYỀN (COFFEE CHAIN & FRANCHISE)
## HỆ THỐNG THIẾT KẾ MỸ THUẬT & GIAO DIỆN (DESIGN SYSTEM)
**Aesthetic Theme:** Corporate Headquarters & City Map Dashboard  
**Tiêu chuẩn:** Mobile-First Canvas 1080 × 2400 px  
**Tác giả:** Senior Game Manager Creator 2026  

---

## 1. PHONG CÁCH NGHỆ THUẬT (VISUAL IDENTITY)
Chương 3 nâng tầm trải nghiệm thị giác thành **Trung Tâm Điều Hành Chuỗi Đô Thị Hiện Đại (Modern City Chain HQ & Growth Dashboard)**:
- Không gian điều hành doanh nghiệp cao cấp: Bản đồ thành phố isometric với các ghim định vị cửa hàng trực thuộc và nhượng quyền.
- Giao diện tài chính chuyên nghiệp: Biểu đồ doanh thu chuỗi đa chi nhánh, bảng phân bổ cổ phần (Cap Table) dạng biểu đồ tròn trực quan, thanh trượt đàm phán định giá Pre-money.

---

## 2. BẢNG MÀU CHỦ ĐẠO (CORPORATE TOKENS)

| Token Name | Hex Code | Tên màu tiếng Việt | Ứng dụng giao diện |
| :--- | :---: | :--- | :--- |
| `hq-navy-950` | `#0B1120` | Xanh Đen Trụ Sở | Nền không gian điều hành trung tâm, nền bảng đồ |
| `hq-slate-900` | `#0F172A` | Xanh Thép Doanh Nghiệp | Thẻ thông số chi nhánh, bảng đàm phán Term Sheet |
| `chain-cyan-500` | `#06B6D4` | Xanh Ngọc Chuỗi F&B | Biểu tượng chuỗi, đường liên kết cung ứng Bếp trung tâm |
| `branch-owned-500`| `#3B82F6` | Xanh Dương Trực Thuộc | Ghim cửa hàng trực thuộc 100% vốn công ty |
| `branch-franchise-500`| `#8B5CF6` | Tím Thạch Anh Nhượng Quyền| Ghim cửa hàng đối tác nhượng quyền (Franchise Pin) |
| `valuation-gold-500` | `#F59E0B` | Vàng Kim Định Giá | Huy hiệu 5 Tỷ Đồng, biểu đồ Cap Table cổ phần sáng lập |
| `hq-white-50` | `#F8FAFC` | Trắng Bạch Kim | Chữ tiêu đề số liệu lớn, viền card nổi bật |

---

## 3. THIẾT KẾ CÁC THÀNH PHẦN GIAO DIỆN CHÍNH (UI COMPONENTS)

### 3.1. Bản Đồ Đô Thị Đa Chi Nhánh (City Chain Map)
- Bản đồ thành phố nhìn từ trên cao (Top-down Stylized 2.5D):
  - Ghim xanh dương (`🔵`): Quán Trực thuộc (Hiển thị doanh thu + lợi nhuận ròng hàng tháng).
  - Ghim tím (`🟣`): Quán Nhượng quyền (Hiển thị khoản phí Royalty 5% thu về).
  - Tòa nhà trung tâm (`🏛️`): Bếp trung tâm (Central Kitchen), có các đường sáng xung nhịp kết nối nguyên liệu tới từng chi nhánh.

### 3.2. Bảng Phân Bổ Cổ Phần (Cap Table Interactive Wheel)
- Biểu đồ tròn trực quan thể hiện cơ cấu sở hữu:
  - Phần màu vàng kim: **Cổ phần của Người Sáng Lập (Founder)** — Ví dụ: `75%`.
  - Phần màu xanh tím: **Cổ phần Nhà Đầu Tư Thiên Thần (Angel Fund)** — Ví dụ: `20%`.
  - Phần màu xanh ngọc: **Quỹ Quyền Chọn Cho Nhân Viên (ESOP Pool)** — Ví dụ: `5%`.
- Khi người chơi kéo thanh trượt định giá Pre-money, tỷ lệ biểu đồ tròn tự động dịch chuyển mượt mà kèm con số phần trăm cập nhật tức thời.

### 3.3. Bảng Đàm Phán Thuật Ngữ Đầu Tư (Investor Term Sheet Modal)
- Khung modal phong cách hợp đồng đầu tư sang trọng:
  - Dòng 1: Tên Quỹ đầu tư & Uy tín (Tier 1 vs Tier 2 Angel).
  - Dòng 2: Số tiền cam kết rót vốn (`1.500.000.000 VND`).
  - Dòng 3: Điều khoản kèm theo (Ghế hội đồng quản trị, quyền phủ quyết, cam kết doanh thu).
  - Nút bấm ký kết to rõ màu Vàng kim phủ bóng: `✍️ KÝ KẾT HỢP ĐỒNG ĐẦU TƯ`.
