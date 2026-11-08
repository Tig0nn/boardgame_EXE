# CHƯƠNG 1: CỜ TỶ PHÚ TÀI CHÍNH (PLAYBOARD B18)
## TÀI LIỆU THIẾT KẾ GAME & LOGIC TÌNH HUỐNG (GDD)
**Phiên bản:** 2.6 (Hiệu chuẩn thực tế 2026)  
**Tác giả:** Senior Game Manager Creator 2026  
**Dự án:** PlayBoard — Game Giáo Dục Tài Chính Cá Nhân & Khởi Nghiệp  

---

## 1. TỔNG QUAN GAME & MỤC TIÊU CỐT LÕI

### 1.1. Tuyên Bố Sứ Mệnh (Game Vision)
Chương 1 trang bị cho người chơi tư duy làm chủ tài chính cá nhân trong bối cảnh nền kinh tế Việt Nam năm 2026. Thay vì lối chơi may rủi của cờ tỷ phú truyền thống, PlayBoard B18 buộc người chơi phải cân đối giữa **tăng trưởng tài sản** và **bảo toàn thanh khoản dự phòng**, ra quyết định đầu tư thông minh bám sát bản tin vĩ mô để tích lũy đủ số vốn 90M VND bước vào hành trình Khởi nghiệp ở Chương 2.

### 1.2. Thông Số Ván Chơi Tiêu Chuẩn (Game Metadata)
- **Bàn cờ:** 18 ô (B18 Mobile-First Layout).
- **Số vòng chơi:** Đúng 4 vòng (Đại diện cho 4 Quý của năm 2026).
- **Xúc xắc:** 1–6 mặt (RNG xác định theo Seed).
- **Vốn khởi điểm:** `50.000.000 VND`.
- **Dòng tiền cơ bản tại ô Xuất Phát (START):**
  - Thu nhập định kỳ (Lương): `+14.000.000 VND / vòng`.
  - Chi phí sinh hoạt tối thiểu: `-5.000.000 VND / vòng` (hoặc `-7.000.000 VND` tùy điều kiện kinh tế).
- **Mục tiêu chiến thắng:**
  $$\text{Tổng tài sản hợp lệ (Total Worth)} \ge 90.000.000\text{ VND}$$
  *(Bao gồm: Tiền mặt + Tiết kiệm ngân hàng + Cổ phiếu + Trái phiếu + Vàng + Giá trị thu hồi tiệm kinh doanh - Nợ xấu).*

---

## 2. KIẾN TRÚC 18 Ô BÀN CỜ (B18 TILE TAXONOMY)

Bàn cờ 18 ô được phân bổ theo tỷ lệ công thái học và xác suất di chuyển:

| Ô số | Loại ô | Tên hiển thị | Tác vụ tài chính khi dừng chân | Cơ chế kinh tế thực tế |
| :---: | :--- | :--- | :--- | :--- |
| **0** | `start` | **Xuất Phát (START)** | Nhận lương, trừ sinh hoạt phí, nhận lãi tiết kiệm/trái phiếu, chia cổ tức tiệm F&B, cập nhật giá thị trường. | Điểm kết toán tài chính (Financial Settlement) định kỳ cuối mỗi quý. |
| **1** | `course` | **Học Kỹ Năng** | Đầu tư 8M VND (hoặc 6M) để nâng cấp chuyên môn; vĩnh viễn tăng thu nhập lương +4M/vòng. | Lợi suất đầu tư vào bản thân (Human Capital ROI) là khoản đầu tư tốt nhất ở giai đoạn đầu đời. |
| **2** | `bank` | **Ngân Hàng** | Gửi tiết kiệm kỳ hạn 1–3 vòng với lãi suất 6% - 8%/vòng; rút trước hạn mất toàn bộ tiền lãi. | Kênh phòng thủ thanh khoản; hình thành thói quen kỷ luật tài chính. |
| **3** | `stocks` | **Cổ Phiếu** | Mua cổ phiếu niêm yết (Công nghệ, Ngân hàng, Sản xuất) với lô tối thiểu 10M VND; chịu phí 1%. | Kênh tăng trưởng thặng dư cao nhất nhưng chịu rung lắc theo chu kỳ thị trường. |
| **4** | `personal`| **Biến Cố Cá Nhân**| Rút ngẫu nhiên: Viện phí (5M-6M), Sửa xe (4M-5M), Trợ cấp gia đình (3M-3.5M). | Thử thách khả năng chịu đựng của Quỹ dự phòng khẩn cấp (Emergency Buffer). |
| **5** | `gold` | **Vàng Trú Ẩn** | Mua vàng miếng/nhẫn theo chỉ số giá thực tế; chênh lệch mua/bán (Spread) 3%, phí bán 1%. | Kênh bảo toàn giá trị chống lạm phát, bứt phá mạnh mẽ trong Quý 2 & Quý 4/2026. |
| **6** | `business`| **Tiệm Kinh Doanh**| Đầu tư mở cơ sở F&B (20M VND); có thể nâng cấp thêm tối đa 6 lần để tăng doanh thu. | Tạo dòng tiền thu nhập thụ động tại ô START; rủi ro kẹt vốn nếu không kịp thu hồi. |
| **7** | `obligation`| **Nghĩa Vụ Tài Chính**| Thanh toán hóa đơn phát sinh, tiền điện nước, hợp đồng dịch vụ (1.5M - 2.5M VND). | Chi phí ẩn và nghĩa vụ bắt buộc trong cuộc sống thực. |
| **8** | `bonds` | **Trái Phiếu** | Mua trái phiếu doanh nghiệp (An Tâm vs Bứt Phá); nhận lãi coupon 5% - 8%/kỳ tại START. | Kênh lợi suất cố định, mô phỏng rủi ro tín dụng và khả năng trả nợ của tổ chức phát hành. |
| **9** | `macro` | **Biến Động Vĩ Mô**| Kích hoạt cú sốc kinh tế: Tín dụng thắt chặt, Nhu cầu bùng nổ, hoặc Phục hồi cung ứng. | Tác động toàn diện tức thời lên định giá toàn bộ danh mục tài sản. |
| **10**| `bank` | **Ngân Hàng 2** | Cơ hội gửi thêm tiền nhàn rỗi hoặc hoạch định lại dòng tiền. | Giúp người chơi tích lũy dự phòng trước nửa sau của vòng cờ. |
| **11**| `stocks` | **Cổ Phiếu 2** | Mua bổ sung cổ phiếu khi xuất hiện cơ hội giá tốt. | Tối ưu hóa điểm vào lệnh (Entry Point) của danh mục. |
| **12**| `personal`| **Biến Cố 2** | Thử thách thanh khoản lần 2 trong vòng cờ. | Kiểm tra xem người chơi có "all-in" hết tiền mặt hay không. |
| **13**| `gold` | **Vàng Trú Ẩn 2** | Điểm tích trữ vàng đón chu kỳ tăng giá. | Khuyến khích gia tăng tỷ trọng vàng trước khi sang vòng mới. |
| **14**| `course` | **Học Kỹ Năng 2** | Cơ hội thứ hai để mua khóa học nếu vòng trước bỏ lỡ. | Cơ hội sửa sai cho người chơi nhận ra tầm quan trọng của nâng cao kỹ năng. |
| **15**| `business`| **Nâng Cấp F&B** | Nâng cấp trang thiết bị, cải tiến menu cho tiệm kinh doanh. | Nâng cao biên lợi nhuận hoạt động của tiệm. |
| **16**| `bonds` | **Trái Phiếu 2** | Tích lũy trái phiếu hưởng lãi coupon cho các vòng sau. | Tăng cường dòng tiền thụ động tại vạch đích. |
| **17**| `macro` | **Biến Động Vĩ Mô 2**| Cú sốc kinh tế cuối vòng trước khi bước vào kỳ quyết toán START. | Kiểm tra độ vững chắc của danh mục đầu tư trước khi chốt sổ vòng. |

---

## 3. LOGIC MÔ PHỎNG 4 VÒNG THEO 4 QUÝ NĂM 2026 (RL ENGINE)

### 3.1. Vòng 1: Quý 1/2026 — Khởi Động & Bứt Phá Công Nghệ
- **Bối cảnh vĩ mô:** Thanh khoản dồi dào đầu năm, làn sóng AI và chuyển đổi số bùng nổ.
- **Biến động tài sản:**
  - Cổ phiếu công nghệ (XV-MAY, XV-HAT): `[-5%, +35%]`.
  - Tiệm kinh doanh F&B: Khởi sắc, nhu cầu tích cực `[+15%, +50%]`.
  - Vàng: Tích lũy đi ngang `[-5%, +15%]`.
  - Trái phiếu: Ổn định `[+3%, +7%]`.
- **Logic chiến lược:**
  - Nâng cấp kỹ năng (Mua khóa học 8M $\rightarrow$ lương tăng lên 18M). Sau 4 vòng, đem lại tổng thặng dư `+16M VND` (Net lời 8M).
  - Đầu tư tiệm kinh doanh hoặc mua cổ phiếu công nghệ với một phần vốn.
  - **Quy tắc vàng:** Luôn giữ tối thiểu `10.000.000 VND` tiền mặt làm đệm khẩn cấp.

### 3.2. Vòng 2: Quý 2/2026 — Áp Lực Lạm Phát & Sóng Vàng Trú Ẩn
- **Bối cảnh vĩ mô:** Áp lực lạm phát toàn cầu gia tăng, căng thẳng địa chính trị khiến dòng tiền tìm kênh trú ẩn an toàn. Giá vàng trong nước và thế giới phá đỉnh lịch sử.
- **Biến động tài sản:**
  - **Vàng bùng nổ:** `[+12%, +26%]` (Lợi nhuận ròng vượt trội).
  - Cổ phiếu: Phân hóa mạnh, rung lắc `[-22%, +16%]`.
  - Doanh thu tiệm F&B: Chậm lại nhẹ do giá nguyên liệu tăng.
- **Logic chiến lược:**
  - **Tập trung gom Vàng:** Phân bổ 15M - 20M vào Vàng để thu về 2.5M - 5M tiền lời từ chênh lệch giá.
  - Không vay nợ đầu cơ cổ phiếu lúc này.

### 3.3. Vòng 3: Quý 3/2026 — Tín Dụng Thắt Chặt & Phòng Thủ Dòng Tiền
- **Bối cảnh vĩ mô:** Ngân hàng thắt chặt hạn mức tín dụng, thị trường tài chính thận trọng cao độ. Nguy cơ phát sinh các biến cố cá nhân đột xuất.
- **Biến động tài sản:**
  - Cổ phiếu: Rung lắc mạnh, dễ giảm giá `[-15%, +10%]`.
  - Trái phiếu & Tiết kiệm: Trở thành kênh an toàn nhất (nhận coupon đều đặn 5% - 8%).
  - Vàng: Giữ vững ở vùng giá cao `[+2%, +18%]`.
- **Logic chiến lược:**
  - Giữ vững kỷ luật đệm tiền mặt $\ge 10\text{M VND}$.
  - Không bán tháo Vàng; nhận coupon trái phiếu để thanh toán chi phí sinh hoạt.

### 3.4. Vòng 4: Quý 4/2026 — Mùa Chốt Sổ & Về Đích 90 Triệu
- **Bối cảnh vĩ mô:** Tháng 11–12/2026: Doanh nghiệp hoàn thành kế hoạch năm, mùa mua sắm cuối năm đẩy doanh thu F&B lên đỉnh cao. Vàng tiếp tục giữ đỉnh.
- **Biến động tài sản:**
  - Tiệm kinh doanh: Đạt điểm hòa vốn và sinh lời tối đa.
  - Vàng: Giữ giá đỉnh cao.
- **Logic chiến lược:**
  - Hiện thực hóa lợi nhuận: Bán một phần Vàng/Cổ phiếu nếu cần bổ sung tiền mặt.
  - Cán mốc $\ge 90\text{M VND}$ để đạt chiến thắng tuyệt đối và mở khóa Chương 2.

---

## 4. HỆ THỐNG DILEMMA TRADE-OFFS & CHẤM ĐIỂM SỨC KHỎE TÀI CHÍNH

### 4.1. Quy Chuẩn Quỹ Dự Phòng Khẩn Cấp (`SAFE_EMERGENCY_BUFFER = 10.000.000 VND`)
Mỗi khi người chơi thực hiện giao dịch (mua cổ phiếu, gửi tiết kiệm, gom vàng, mở tiệm), hệ thống tính toán ngay lập tức:
$$\text{Tiền mặt sau giao dịch} = \text{Tiền mặt hiện tại} - \text{Số tiền giao dịch}$$
- **Xanh lá (`Safe` - Tiền mặt $> 10\text{M}$):** An toàn, đủ sức chịu 2 biến cố liên tiếp.
- **Hổ phách (`Warning` - $5\text{M} \le \text{Tiền mặt} \le 10\text{M}$):** Cảnh báo đệm mỏng, rủi ro nếu gặp viện phí.
- **Đỏ nguy cấp (`Danger` - Tiền mặt $< 5\text{M}$):** Báo động đỏ! Nếu gặp biến cố, người chơi sẽ bị ép phá sản (Insolvent) hoặc phải bán tháo tài sản chịu phạt nặng.

### 4.2. Hệ Thống Đánh Giá 4 Trụ Cột (Financial Health Score /100)
1. **Dòng Tiền & Runway (25 điểm):** Duy trì tiền mặt và thanh khoản, không vỡ nợ.
2. **Đa Dạng Hóa Danh Mục (25 điểm):** Có ít nhất 3 kênh tài sản trở lên.
3. **Hiệu Suất Sinh Lời (25 điểm):** Đạt mức tăng trưởng thặng dư $\ge 40\text{M VND}$ trên vốn ban đầu 50M.
4. **Kiểm Soát Rủi Ro (25 điểm):** Không có nợ xấu lãi cao (10%/vòng) và không kẹt vốn tiệm kinh doanh.

**Xếp hạng:** Hạng `S` ($\ge 90$ + Thắng), `A` ($\ge 80$), `B` ($\ge 70$), `C` ($\ge 60$), `D` ($< 60$).
