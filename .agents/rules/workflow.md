# WORKFLOW & ATOMIC SCOPE ISOLATION RULES
**Dành cho:** AI Coding Agents & Mobile UI Engineers  
**Dự án:** *PlayBoard* — Game Giáo Dục Tài Chính Đa Chương Trình (2026 Edition)  
**Nguyên tắc tối thượng:** "Đọc Tài Liệu Trước — Thiết Kế Một Lần Duy Nhất Một Phạm Vi — Kiểm Tra Toàn Diện"  

---

## 1. NGUYÊN TẮC CỐT LÕI (CORE TENETS)

1. **DOCUMENTATION-FIRST (Luôn Đọc Tài Liệu Trước):**
   - Không được phép viết bất kỳ dòng code, style CSS hay thay đổi JSX/TypeScript nào nếu chưa đọc tài liệu thiết kế và kỹ thuật tương ứng.
   - Tài liệu là nguồn chân lý duy nhất quy định kích thước canvas 1080 × 2400 px, phông chữ Fredoka, màu sắc và hành vi tương tác kinh tế thực tế.
2. **ATOMIC SCOPE ISOLATION (Thiết Kế Đơn Phạm Vi):**
   - Mỗi task / prompt chỉ tập trung vào **đúng một Component, một Micro-Engine hoặc một Module duy nhất**.
   - Tuyệt đối cấm chỉnh sửa dây chuyền sang các file/component khác trong cùng một lượt thực thi.
   - Khi hoàn thành phạm vi hiện tại, phải chạy kiểm thử và xác nhận trạng thái sạch sẽ trước khi chuyển sang phạm vi tiếp theo.
3. **ZERO REGRESSION (Bảo Vệ Tính Toàn Vẹn Hệ Thống):**
   - Mọi thay đổi code không được phép làm hỏng bất kỳ bài test nào trong số 360 bài test unit hiện hữu của toàn dự án.

---

## 2. QUY TRÌNH PHÁT TRIỂN 5 BƯỚC BẮT BUỘC (5-STEP EXECUTION WORKFLOW)

Mọi lượt thực thi liên quan đến logic hoặc giao diện người dùng phải tuân theo thứ tự 5 bước nghiêm ngặt sau:

```
[BƯỚC 1: ĐỌC TÀI LIỆU] ──► [BƯỚC 2: KHOANH VÙNG PHẠM VI] ──► [BƯỚC 3: TRIỂN KHAI CODE]
                                                                         │
[BƯỚC 5: NGHIỆM THU PHẠM VI] ◄── [BƯỚC 4: CHẠY CỔNG KIỂM THỬ] ◄────────┘
```

---

### BƯỚC 1: ĐỌC TÀI LIỆU ĐẶC TẢ TƯƠNG ỨNG (CONTEXT & DOC INGESTION)
Trước khi mở file code, Agent phải đọc tối thiểu các tài liệu quy chuẩn:
1. `AGENTS.md` (Gốc dự án) — Nắm bắt bối cảnh toàn cục và bảng tiến độ thực tế.
2. `docs/SYSTEM_ARCHITECTURE.md` & `docs/AGENTS_SOP.md` — Nắm bắt vai trò chuyên môn (Engine, 3D Graphics, UI/UX, QA Gatekeeper) và ranh giới trách nhiệm.
3. Thư mục `docs/chapters/` của chương tương ứng:
   - `01_GAME_DESIGN_DOCUMENT.md` — Logic tình huống, công thức tài chính.
   - `02_PLAYER_HANDBOOK.md` — Trải nghiệm và mục tiêu người chơi.
   - `03_DESIGN_SYSTEM.md` — Tokens màu sắc, Typography Fredoka, Component specs.
   - `04_TECH_ARCHITECTURE.md` — Data models, State machine, Reducer contracts.

---

### BƯỚC 2: KHOANH VÙNG PHẠM VI ĐỘC NHẤT (SCOPE ISOLATION)
- Xác định chính xác **duy nhất file code được chỉ định** (ví dụ: `src/game/market.ts` hoặc `mobile_app/src/components/RoundChallengeModal.tsx`).
- Khóa toàn bộ các file khác. Nếu phát hiện một component khác cần sửa, hãy ghi chú lại để thực hiện ở task tiếp theo, tuyệt đối **không được sửa gộp**.

---

### BƯỚC 3: TRIỂN KHAI CODE CHUẨN MỰC (IMPLEMENTATION)
- **Nếu là UI:**
  - Font chữ: `font-family: 'Fredoka', sans-serif;`.
  - Nút bấm: Cấu trúc 3D nhún xuống khi chạm (`translateY(3px)` hoặc `scale(0.94)`).
  - Khung viền và padding: Tối ưu công thái học một ngón tay cái trên màn hình 1080 × 2400 px, không che khuất Dynamic Island hay thanh điều hướng vuốt.
- **Nếu là Engine Logic:**
  - TypeScript thuần túy, không nhập DOM/UI.
  - Tuyệt đối không lưu số thực trôi nổi; làm tròn số nguyên VND.
- **Nếu là 3D Graphics:**
  - Three.js tối ưu 60 FPS, on-demand render và dọn dẹp WebGL Context sạch sẽ khi unmount.

---

### BƯỚC 4: VƯỢT QUA CỔNG KIỂM THỬ TỰ ĐỘNG (QUALITY GATEWAY)
Chạy đầy đủ 4 lệnh kiểm tra chất lượng và đảm bảo 100% pass:
```powershell
npm test                                                                        # 360 unit tests phải pass 100%
node --experimental-strip-types --test scripts/diagnostics/mobile-final-ui.test.ts # 8 mobile UI tests phải pass 100%
npm run build                                                                   # Vite Web build thành công không lỗi asset
npm --prefix mobile_app run build                                               # Vite Mobile App build thành công
```

---

### BƯỚC 5: XÁC MINH PHẠM VI & GIT STATUS (SCOPE VERIFICATION)
- Chạy lệnh `git status`.
- Kiểm tra danh sách file bị thay đổi: Xác nhận **chỉ có duy nhất file component / module được chỉ định** (và tài liệu liên quan) nằm trong danh sách modified.
- Nếu phát hiện file ngoài phạm vi bị sửa đổi vô ý, phải revert ngay lập tức trước khi báo cáo hoàn thành.
