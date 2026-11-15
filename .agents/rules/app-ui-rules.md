# PlayBoard UI & Graphics Rules (Antigravity & Coding Agents)

Bộ quy tắc này định nghĩa các nguyên tắc phát triển giao diện và đồ họa dành cho Agent khi làm việc cùng **Phát (Owner & Lead Game Developer / Kiến Trúc Sư Trưởng)** trong dự án **PlayBoard**.

---

## 1. Nguyên Tắc Cốt Lõi: Toàn Quyền Sáng Tạo & Tối Ưu Hóa (Full Authority)

1. **Quyền sở hữu độc lập:**
   - Dự án **PlayBoard** (`https://github.com/philipsgn/PlayBoard.git`) là sản phẩm độc lập của Phát.
   - Phát và Agent có toàn quyền tạo mới, tái cấu trúc và mở rộng toàn bộ codebase (Game Engine, Mini-games, UI/UX, Three.js 3D, Assets).
2. **Kiến trúc Đa Chương (Multi-Chapter Architecture):**
   - **Chương 1 (PlayBoard Cờ Tỷ Phú B18):** Bàn cờ tài chính cá nhân 18 ô (Vốn 50M $\rightarrow$ Mục tiêu $\ge 90\text{M VND}$).
   - **Chương 2 (Khởi Nghiệp Quán Cà Phê):** F&B Realistic Management Simulator (Vượt 3 tháng đầu, đạt điểm hòa vốn, bảng P&L gỗ retro).
   - **Chương 3 (Mở Rộng Chuỗi & Nhượng Quyền):** Coffee Chain & Franchise (3–5 cửa hàng, Bếp trung tâm, Gọi vốn Thiên thần định giá 5 Tỷ Đồng).
3. **Tiêu chuẩn UI/UX & Graphics:**
   - Mobile-First Canvas (9:20 / 20:9), kích thước chuẩn 1080 × 2400 px, tối ưu công thái học một ngón tay cái.
   - Phông chữ duy nhất: **Fredoka** hỗ trợ 100% tiếng Việt có dấu.
   - Thẩm mỹ: Playful Gamification + Lively Fantasy + Dynamic Emotional Experience.
   - **Đồ họa Hybrid 3D Three.js:** Khóa cứng 60 FPS trên mobile, cơ chế Lazy Mount, On-Demand rendering (ngừng render vòng lặp khi mở modal), bắt buộc dọn dẹp WebGL Context khi unmount.

---

## 2. Tiêu Chuẩn Kỹ Thuật & Cổng Kiểm Thử Bắt Buộc

Trước khi kết thúc bất kỳ lượt nâng cấp nào hoặc tạo commit mới:
```sh
npm test                                                                        # 360 Unit tests engine (100% PASS)
node --experimental-strip-types --test scripts/diagnostics/mobile-final-ui.test.ts # 8 Tests UI Mobile (100% PASS)
npm run lint                                                                    # Code sạch, 0 lỗi cú pháp
npm run build                                                                   # Build web bundle thành công
npm --prefix mobile_app run build                                               # Build mobile app bundle thành công
```
