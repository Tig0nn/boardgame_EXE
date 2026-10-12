# Báo Cáo Bàn Giao: Mobile App UI (Xoay Vòng Tiến Lui V2.4)

**Người phụ trách:** Phát (Mobile Game UI/UX Engineer & AI Engineer)  
**Nhánh bàn giao:** `feat/ai-mobileapp-ui`  
**Độ phân giải chuẩn:** 940 × 1672 px (Tỷ lệ Portrait Mobile chuẩn công nghệ game)  
**Trạng thái kiểm thử:** 168/168 tests PASS · TypeScript Typecheck PASS · Vite Build PASS  

---

## 1. Giới Thiệu & Mục Tiêu

Phiên bản **Mobile App UI** của *Xoay Vòng Tiến Lui* được phát triển độc lập trong thư mục `mobile_app/` nhằm mang lại trải nghiệm game di động trực quan, sống động, chuẩn mực đồ họa Isometric 3D mà vẫn bảo toàn 100% logic động cơ tài chính cá nhân chuẩn V2.4 / C20 (4 vòng, vốn 50M, lương 14M/START, mục tiêu huy động hợp lệ $\ge$ 90M VND).

---

## 2. Các Tính Năng Đã Hoàn Thiện

### 2.1. Nhân Vật 3D Hoạt Hình Con Người (Caucasian Student Character)
- **Tạo hình:** Bạn nam học sinh/sinh viên trẻ tuổi da trắng tự nhiên, ngũ quan mắt mũi miệng và lông mày rõ nét, tóc nâu hạt dẻ, áo trắng học sinh, quần jeans denim và giày thể thao.
- **Hệ thống Hoạt ảnh Skeletal Rigging:**
  - `CharacterArmature|Idle`: Đứng thở nhịp nhàng tự nhiên trên ô cờ.
  - `CharacterArmature|Run`: Chạy bước dài vui tươi lướt mượt mà giữa các ô.
  - `CharacterArmature|Jump`: Bật nhảy ăn mừng phấn khích khi hoàn thành vòng hoặc thắng game.
  - `CharacterArmature|Wave`: Chạm tay vào nhân vật để phát âm thanh chào và vẫy tay chào người chơi.
- **Tự động Xoay Hướng Mắt/Mặt Theo Đường Đi (Dynamic Movement Heading):**
  - Tự động tính toán vector $(\Delta x, \Delta y)$ giữa ô hiện tại và ô kế tiếp.
  - Khi di chuyển qua từng cạnh bàn cờ Isometric, nhân vật tự động quay mặt nhìn thẳng về phía trước theo hướng đi của ô tiếp theo.
  - Tích hợp bộ đệm nội suy `interpolation-decay="150"` giúp góc xoay lướt êm ái, tự nhiên như game 3D thực thụ.
  - Khi đứng yên, người chơi có thể dùng ngón tay vuốt xoay 360° ngang dọc tự do ngắm nhìn nhân vật; sau 4 giây hoặc khi gieo xúc xắc sẽ tự động hồi phục về góc nhìn bàn cờ.

### 2.2. Xúc Xắc 3D Khối Lập Phương & Kiến Trúc Dynamic Face Mapping
- **Mặt Trên Cùng Khóa Chặt 100% (Top Face = value):** Áp dụng kiến trúc Dynamic Face Mapping loại bỏ vĩnh viễn lỗi lệch góc Euler trong CSS 3D. Mặt trên cùng đối diện mắt người chơi luôn hiển thị chính xác 100% số chấm tương ứng với số bước nhảy thực tế và huy hiệu kết quả `🎲 {value} Bước`.
- **Chuẩn Casino Quốc Tế:** Các mặt đối diện luôn có tổng bằng 7 (Top + Bottom = 7, Front + Back = 7, Right + Left = 7).
- **Chu kỳ Bay & Neo Giữ Sân Cỏ (Flight Lifecycle):**
  - Khi bấm gieo ở Footer, xúc xắc phóng to xoay lốc xoáy bay vút lên bãi cỏ trung tâm bàn cờ.
  - Xúc xắc neo giữ cố định trên cỏ trong lúc nhân vật nhảy và khi xuất hiện bảng sự kiện / mua cổ phiếu.
  - Chỉ khi người chơi bấm **Nhận thưởng**, **Mua**, **Gửi tiết kiệm** hoặc **Bỏ qua / Tiếp tục**, xúc xắc mới từ từ bay lướt êm ái về lại vị trí trung tâm Footer (`transition: 0.75s`).

### 2.3. Hệ Thống Âm Thanh & Nhạc Nền Thư Giãn (Audio & Procedural BGM)
- **Cơ chế Mở Khóa Tự Động (Mobile Audio Unlock):** Tự động bắt sự kiện `touchstart`/`click` đầu tiên trên màn hình để mở khóa WebKit AudioContext trên iOS Safari và Android.
- **Nhạc nền Procedural Lo-Fi:** Chuỗi hợp âm Pentatonic ấm áp qua bộ lọc Lowpass Filter êm dịu, không tốn dung lượng tải MP3 nặng.
- **Bộ SFX sinh động:** Tiếng xúc xắc lăn lách cách, tiếng bước chân nhảy ô, tiếng tiền keng khi nhận lương, tiếng mở hộp cơ hội to rõ trên loa điện thoại. Nút bật/tắt âm thanh tức thì trên Header.

### 2.4. Giao Diện & Bàn Cờ Chơi Game
- **Top HUD & Header:** Thiết kế tối giản, bo cong nhẹ nhàng trong suốt (Glassmorphism), hiển thị Tiền mặt, Lương/vòng, và nút Âm thanh.
- **Bàn Cờ 20 Ô C20 Isometric:** Căn chỉnh tọa độ pixel chuẩn xác cho 20 ô với hiệu ứng vòng tròn phát sáng Pulse Glow tại ô quân cờ đang đứng.
- **Footer Điều Khiển:** Nút xúc xắc trung tâm nổi bật, các icon chức năng mở Ví tài sản (Tiền mặt, Tiết kiệm, Cổ phiếu, Trái phiếu, Vàng, Doanh nghiệp, Nợ) và Nhật ký giao dịch tài chính.

---

## 3. Cấu Trúc Mã Nguồn (Source Code Architecture)

```
mobile_app/
├── index.html                   # HTML entry point nạp Google model-viewer Web Component
├── package.json                 # Cấu hình dependency (React, TypeScript, Vite)
├── tsconfig.json                # TypeScript config
├── vite.config.ts               # Vite bundler config (Port 5174, Host 0.0.0.0)
├── public/
│   └── assets/
│       ├── character.glb        # Model 3D bạn học sinh nam da trắng đã tối ưu rigging
│       ├── main-background.png  # Hình nền phố thị & bãi cỏ Isometric
│       ├── playboard.PNG        # Bàn cờ 20 ô Isometric
│       ├── sectionplay.PNG      # Bảng gỗ hiển thị số vòng chơi
│       └── xucxac.PNG           # Texture xúc xắc
└── src/
    ├── App.tsx                  # Controller chính điều phối State, Game Loop, Bước nhảy
    ├── main.tsx                 # React DOM bootstrap
    ├── components/
    │   ├── BoardView.tsx        # Bàn cờ Isometric, camera viewport & đĩa hào quang
    │   ├── Character3D.tsx      # Quản lý model 3D, heading xoay hướng & animation
    │   ├── Dice3D.tsx           # Xúc xắc 3D Dynamic Face Mapping & chu kỳ bay
    │   ├── TopHud.tsx           # Thanh trạng thái tài chính phía trên
    │   ├── BottomBar.tsx        # Thanh công cụ Footer điều khiển
    │   ├── EventModal.tsx       # Bảng tương tác sự kiện ô cờ & mua tài sản
    │   ├── LapSummaryModal.tsx  # Bảng tổng kết vòng & nhận lương
    │   ├── PortfolioModal.tsx   # Drawer chi tiết danh mục đầu tư & nợ vay
    │   ├── HistoryModal.tsx     # Nhật ký biến động dòng tiền
    │   └── Toast.tsx            # Thông báo trạng thái nhanh
    ├── data/
    │   ├── tiles.json           # Dữ liệu tọa độ 20 ô cờ C20 độc quyền cho mobile
    │   └── economy.json         # Cấu hình kinh tế chuẩn V2.4 (50M vốn, 14M lương, 4 vòng)
    └── utils/
        └── audio.ts             # Bộ tổng hợp Procedural Lo-Fi BGM & SFX tự động unlock
```

---

## 4. Hướng Dẫn Khởi Chạy Dự Án

### Khởi chạy môi trường Dev:
```sh
cd mobile_app
npm install
npm run dev
```
Trình duyệt sẽ mở tại `http://localhost:5174/` hoặc quét mã QR / truy cập theo địa chỉ Network IP trên điện thoại kết nối cùng mạng Wi-Fi.

### Kiểm tra build sản phẩm:
```sh
cd mobile_app
npm run build
```
Kết quả build hoàn tất trong ~400ms với bundle tối ưu hoá cao.

---

## 5. Cam Kết Tính Toàn Vẹn Hệ Thống
- 100% logic tài chính gốc tại `src/game/**`, `src/data/**`, `src/ai/**`, `tests/**` được bảo toàn nguyên vẹn.
- Toàn bộ 168 tests gốc của dự án vượt qua tuyệt đối (168/168 PASS).
- Thư mục tài liệu nội bộ `app_ui_docs/` và `.agents/` được giữ riêng tư tại máy cục bộ (Local only), không đẩy lên repository.
