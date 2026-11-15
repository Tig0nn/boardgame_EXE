# CHƯƠNG 1: CỜ TỶ PHÚ TÀI CHÍNH (PLAYBOARD B18)
## HỆ THỐNG THIẾT KẾ MỸ THUẬT & GIAO DIỆN (DESIGN SYSTEM)
**Tiêu chuẩn:** Mobile-First Canvas 1080 × 2400 px (20:9 / 9:20)  
**Tác giả:** Senior Game Manager Creator 2026  

---

## 1. NGUYÊN TẮC THIẾT KẾ CHỦ ĐẠO
1. **Thiết kế Mobile-First (Một ngón tay cái):** Toàn bộ tương tác trọng yếu (đổ xúc xắc, xác nhận mua bán, đóng mở sổ tay) đều nằm gọn trong bán kính 70% tầm với của ngón tay cái ở nửa dưới màn hình điện thoại.
2. **Phong cách Playful Fantasy + Realism:** Đồ họa tươi sáng, thân thiện, gamification cao nhưng số liệu tài chính chân thật (VND chuẩn xác).
3. **Typography duy nhất: Fredoka:**
   - Hỗ trợ 100% tiếng Việt có dấu.
   - Thể hiện tính playful, dễ đọc trên màn hình điện thoại từ 5.8 đến 6.9 inch.

---

## 2. BẢNG MÀU THƯƠNG HIỆU (COLOR PALETTE & TOKENS)

| Nhóm màu | Mã Hex | Tên Token | Mục đích sử dụng |
| :--- | :---: | :--- | :--- |
| **Chủ đạo (Primary)** | `#0284C7` | `brand-cyan-600` | Nền biển đảo, khung bản đồ chính, thanh tiêu đề lớn |
| **Thứ cấp (Secondary)** | `#0EA5E9` | `brand-cyan-500` | Trạng thái hover, glow hiệu ứng bản đồ |
| **Tài chính Xanh (Success)** | `#16A34A` | `finance-green-600` | Tiền lời, tăng giá cổ phiếu/vàng, đệm tiền mặt an toàn |
| **Vàng Kim (Gold / Wealth)**| `#F59E0B` | `wealth-amber-500` | Thẻ vàng, điểm thưởng, huy hiệu chiến thắng, cup vinh danh |
| **Trái Phiếu (Fixed Income)** | `#2563EB` | `bond-blue-600` | Thẻ trái phiếu, lãi suất coupon, tổ chức phát hành uy tín |
| **Cảnh Báo (Warning)** | `#EA580C` | `alert-orange-600` | Đệm tiền mặt mỏng (5M - 10M), biến cố cá nhân |
| **Nguy Cấp (Danger)** | `#DC2626` | `danger-red-600` | Báo động đỏ (< 5M), nợ xấu, nguy cơ phá sản |
| **Nền Tối (Dark Neutral)** | `#0F172A` | `neutral-slate-900`| Khung chữ, backdrop modal, badge trạng thái |
| **Nền Sáng (Light Surface)** | `#FFFFFF` | `surface-white` | Thẻ card nổi, khung hội thoại, nền bảng P&L |

---

## 3. QUY CHUẨN TYPOGRAPHY (FREDOKA)

```css
/* Typography Scale */
--font-family-main: 'Fredoka', -apple-system, BlinkMacSystemFont, sans-serif;

--text-title-screen: 800 24px/1.2 var(--font-family-main);     /* Tiêu đề màn hình chính */
--text-title-modal:  800 18px/1.25 var(--font-family-main);    /* Tiêu đề hộp thoại popup */
--text-subtitle:     700 14px/1.3 var(--font-family-main);     /* Phụ đề, tên ô cờ */
--text-body-bold:    700 12px/1.35 var(--font-family-main);    /* Số tiền VND, trạng thái */
--text-body-regular: 500 11.5px/1.4 var(--font-family-main);  /* Diễn giải, mô tả tin tức */
--text-caption:      700 9.5px/1.2 var(--font-family-main);    /* Badge, nhãn danh mục */
```

---

## 4. QUY CHUẨN GIAO DIỆN CÁC THÀNH PHẦN (COMPONENT SPECS)

### 4.1. Bàn Cờ 18 Ô Cố Định (Fixed Board Canvas)
- Chiều rộng: 100% viewport, tỷ lệ giữ khung chuẩn `390 × 420 px` ở giữa màn hình.
- 18 ô cờ được bố trí hình vành đai khép kín (Perimeter Ring):
  - Ô bo góc tròn `border-radius: 12px`.
  - Hiệu ứng đổ bóng nổi 3D: `box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15)`.
  - Con xúc xắc (Pawn Token) nhảy mượt mà với hoạt ảnh nhún tiếp đất: `cubic-bezier(0.34, 1.56, 0.64, 1)`.

### 4.2. Khung Chỉ Báo Đệm An Toàn Tiền Mặt (Emergency Buffer Indicator)
Tích hợp trên tất cả các Modal giao dịch (Cổ phiếu, Vàng, Tiết kiệm, Trái phiếu):
- **Cấu trúc:**
  - Hàng trên: Số tiền mặt còn lại sau giao dịch (`money(cashAfter)`).
  - Hàng dưới: Thanh thanh khoản 3 nấc kèm biểu tượng khiên (`🛡️ Safe` / `⚠️ Warning` / `🚨 Danger`).
  - Lời khuyên công thái học ngắn gọn: Cảnh báo người chơi nếu số tiền còn lại không đủ chi trả cho 1 biến cố y tế (6.000.000 VND).

### 4.3. Nút Đổ Xúc Xắc Trung Tâm (Roll Button)
- Đường kính: `108 px`.
- Vị trí: Neo vững chắc ở góc dưới bên phải hoặc chính giữa phía dưới bàn cờ.
- Hiệu ứng: Glow phát sáng dạng sóng xung kích (Pulse Ring Animation) khi đến lượt đi; nhún `scale(0.92)` khi người chơi chạm ngón tay.
