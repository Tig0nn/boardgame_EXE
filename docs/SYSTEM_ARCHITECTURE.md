# PLAYBOARD: MASTER SYSTEM ARCHITECTURE DOCUMENT (SAD)
## Kiến Trúc Hệ Thống Tổng Thể Toàn Diện Cho Game App 3 Chương (2026 Edition)
**Kiến trúc sư trưởng:** Phát (Owner & Lead Game Developer)  
**Biên soạn & Thiết kế:** Senior Game Manager Creator 2026  
**Dự án:** PlayBoard (`https://github.com/philipsgn/PlayBoard.git`)  
**Tiêu chuẩn:** Mobile-First Canvas 1080 × 2400 px · Hybrid 3D Three.js + React 19 · TypeScript 5.6+  

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG (SYSTEM OVERVIEW)

PlayBoard là ứng dụng game giáo dục tài chính đa chương trình thế hệ mới, vận hành trên nền tảng Mobile Web / PWA và đóng gói Native (Capacitor iOS & Android). Ứng dụng kết hợp giữa logic tính toán kinh tế thực tế chuẩn xác (100% bằng VND) và trải nghiệm thị giác sống động với mô hình **Hybrid 3D Three.js + Taktile 2D UI**.

### 1.1. Sơ Đồ Khối Kiến Trúc Phân Tầng (Layered Architecture)

```mermaid
flowchart TD
    subgraph UI_Layer["1. LỚP GIAO DIỆN & TƯƠNG TÁC (PRESENTATION LAYER)"]
        Canvas3D["ThreeSceneManager (WebGL / Three.js)<br/>• Quán cafe 3D bốc khói<br/>• Sa bàn đô thị 3D Isometric<br/>• Xúc xắc & Nhân vật 3D (.glb)"]
        ReactUI["Taktile 2D UI (React 19 + Tailwind)<br/>• Typography Fredoka tiếng Việt<br/>• Thẻ tình huống Polaroid 3D Tilt<br/>• Bảng P&L kẹp gỗ Kraft kéo thả"]
    end

    subgraph Coordination_Layer["2. LỚP ĐIỀU PHỐI TRUNG TÂM (ORCHESTRATION LAYER)"]
        MSM["MasterSessionManager<br/>• Hồ sơ người chơi (Player Profile)<br/>• Điều phối luồng chuyển tiếp 3 Chương (Ch1 -> Ch2 -> Ch3)<br/>• Cơ chế chuyển giao vốn (90M VND Carryover)<br/>• Quản lý lưu trữ & Checkpoint (Save/Load)"]
    end

    subgraph Engine_Layer["3. LỚP CỖ MÁY TÍNH TOÁN KINH TẾ (MICRO-ENGINES LAYER)"]
        E1["Chapter 1 Engine: Cờ Tỷ Phú B18<br/>• 18 Ô Bàn cờ & Vĩ mô 4 Quý 2026<br/>• 5 Kênh tài sản & Quỹ khẩn cấp 10M<br/>• Thuật toán Total Worth ≥ 90M"]
        E2["Chapter 2 Engine: Coffee Startup<br/>• Quản lý P&L theo tháng (Tháng 1..3)<br/>• Định phí & Biến phí F&B thực tế<br/>• Điểm hòa vốn & Runway tiền mặt"]
        E3["Chapter 3 Engine: Chain & Franchise<br/>• Quản trị chuỗi 3-5 cửa hàng<br/>• Doanh thu Nhượng quyền & Royalty<br/>• Bếp trung tâm & Gọi vốn Cap Table"]
    end

    subgraph Infrastructure_Layer["4. LỚP DỊCH VỤ DÙNG CHUNG (INFRASTRUCTURE & SERVICES)"]
        Storage["Storage Adapter (Capacitor Preferences / LocalStorage)"]
        Audio["SoundFX & BGM Engine (AudioContext Web API)"]
        AssetRes["Asset Resolver (assetUrl thông minh cho GitHub Pages & Native)"]
        RNGCore["Deterministic RNG (Seed-based XorShift Generator)"]
    end

    UI_Layer --> Coordination_Layer
    Coordination_Layer --> Engine_Layer
    Engine_Layer --> Infrastructure_Layer
    UI_Layer --> Infrastructure_Layer
```

---

## 2. LỚP ĐIỀU PHỐI TRUNG TÂM (`MasterSessionManager`)

`MasterSessionManager` là đầu mối điều phối dữ liệu duy nhất (Single Source of Truth) trong toàn bộ ứng dụng, đảm bảo tính liên kết xuyên suốt giữa 3 Chương mà không làm phát sinh sự phụ thuộc chéo (Circular Dependencies).

### 2.1. Cấu Trúc Dữ Liệu Hồ Sơ Toàn Ván (Master Session Schema)

```typescript
export interface MasterPlayerProfile {
  playerId: string;
  playerName: string;
  createdAt: number;
  lastActive: number;
  
  // Trạng thái mở khóa & Tiến độ
  unlockedChapters: {
    chapter1: boolean;           // Mặc định: true
    chapter2: boolean;           // Mở khóa khi Thắng Ch1 (Total Worth >= 90M)
    chapter3: boolean;           // Mở khóa khi Thắng Ch2 (Hòa vốn & Lãi dương)
  };
  activeChapter: 1 | 2 | 3;
  
  // Dữ liệu chuyển giao thành quả (Carryover Data)
  carryoverFromChapter1?: {
    finalNetWorth: number;       // Số tiền tích lũy được (>= 90.000.000 VND)
    startingCapitalForCh2: number; // Vốn khởi nghiệp chuyển sang Chương 2
    financialHealthGrade: 'S' | 'A' | 'B' | 'C' | 'D';
    completedAt: number;
  };
  
  carryoverFromChapter2?: {
    finalMonthlyCashflow: number; // Dòng tiền thặng dư hàng tháng
    accumulatedCash: number;     // Tiền mặt dự trữ chuyển sang làm vốn mở chuỗi
    brandReputation: number;     // Điểm uy tín thương hiệu ban đầu cho Ch3
    completedAt: number;
  };
  
  // Trạng thái lưu trữ từng chương
  savedStates: {
    chapter1?: Chapter1SavedState;
    chapter2?: Chapter2SavedState;
    chapter3?: Chapter3SavedState;
  };
}
```

### 2.2. Cơ Chế Chuyển Giao Dòng Vốn Giữa Các Chương (Carryover Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Player as Người Chơi
    participant Ch1 as Chương 1 Engine (B18)
    participant MSM as MasterSessionManager
    participant Ch2 as Chương 2 Engine (Coffee Shop)
    participant Ch3 as Chương 3 Engine (Chain Expansion)

    Player->>Ch1: Hoàn thành 4 Vòng chơi (4 Quý 2026)
    Ch1->>Ch1: Kết toán Total Worth = 97.200.000 VND (≥ 90M)
    Ch1->>MSM: Gửi tín hiệu CHIẾN THẮNG + Payload Tài Sản
    MSM->>MSM: Mở khóa unlockedChapters.chapter2 = true
    MSM->>MSM: Khởi tạo carryoverFromChapter1 (Vốn: 97.200.000 VND)
    MSM->>Player: Hiển thị Màn hình Vinh danh & Mở khóa Chương 2
    
    Player->>MSM: Bắt đầu Chương 2
    MSM->>Ch2: Khởi tạo CoffeeShopState với Cash = 97.200.000 VND
    Player->>Ch2: Vận hành 3 tháng, đạt điểm hòa vốn & Lãi ròng > 0
    Ch2->>MSM: Gửi tín hiệu CHIẾN THẮNG Chương 2
    MSM->>MSM: Mở khóa unlockedChapters.chapter3 = true
    MSM->>Ch3: Khởi tạo ChainState mang theo Uy tín & Dòng tiền thặng dư
```

---

## 3. PIPELINE ĐỒ HỌA HYBRID 3D TỐI ƯU MOBILE (`ThreeSceneManager`)

Để giải quyết bài toán hiệu năng, chống tràn RAM và tránh tình trạng mất ngữ cảnh đồ họa (WebGL Context Loss) trên iOS Safari / Android WebView, toàn bộ phần hiển thị 3D được quản trị qua một kiến trúc tập trung.

### 3.1. Vòng Đời Render Có Kiểm Soát (Controlled Lifecycle)

```mermaid
stateDiagram-v2
    [*] --> Unmounted : Màn hình chưa hiển thị
    Unmounted --> Initializing : User mở màn hình 3D
    Initializing --> ActiveLoop : Tạo Canvas, nạp GLTF, kích hoạt RAF
    ActiveLoop --> PausedLoop : User mở Modal P&L / Thẻ Tình Huống tĩnh
    PausedLoop --> ActiveLoop : User đóng Modal, quay lại tương tác 3D
    ActiveLoop --> Disposing : User chuyển Chương / Rời màn hình
    PausedLoop --> Disposing : User chuyển Chương / Rời màn hình
    Disposing --> Unmounted : dispose() Geometry, Material, Texture, Renderer
```

### 3.2. Quy Tắc Giải Phóng Bộ Nhớ WebGL Bắt Buộc (Disposal Contract)
Mọi component 3D trong dự án (máy pha cà phê, thành phố 3D, xúc xắc 3D) bắt buộc phải triển khai hàm dọn dẹp bộ nhớ:
```typescript
export function cleanUpThreeScene(
  scene: THREE.Scene, 
  renderer: THREE.WebGLRenderer
) {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach((mat) => mat.dispose());
      } else if (object.material) {
        object.material.dispose();
      }
    }
  });
  renderer.dispose();
  renderer.forceContextLoss();
}
```

---

## 4. BẢO MẬT & KIỂM SOÁT TÍNH TOÀN VẸN DỮ LIỆU

1. **Chống Sai Số Số Thực (Zero Floating-Point Drift):** Mọi phép tính tiền tệ đều được làm tròn về số nguyên VND (`Math.round()` hoặc `Math.floor()`) trước khi lưu vào State, tuyệt đối không lưu số lẻ như `35.00000000001 VND`.
2. **Deterministic Seed-based Replay:** Cùng một chuỗi hạt giống (`seed`), thứ tự ra xúc xắc, biến cố vĩ mô và giá cả thị trường sẽ tái hiện chuẩn xác 100%, phục vụ cho việc kiểm thử tự động và chống gian lận.
3. **Quy Chuẩn Kiểm Thử Khép Kín (Regression Testing Gate):**
   - Bộ 360 unit tests hiện hữu phải pass 100% trước bất kỳ thay đổi nào.
   - Thêm bộ test độc lập cho Chapter 2 (`tests/chapter2_pnl.test.ts`) và Chapter 3 (`tests/chapter3_chain.test.ts`).
