# Báo Cáo Bàn Giao Module: AI Post-Game Financial Coach

**Người phụ trách:** Phát (AI Engineer)  
**Nhánh làm việc:** `feat/ai-postgame-coach`  
**Trạng thái kiểm thử:** 168/168 tests PASS · ESLint PASS · Production Build PASS  

---

## 1. Giới thiệu Tính Năng

Tính năng **AI Post-Game Financial Coach** là một người bạn đồng hành tài chính thông minh, vui nhộn và thân thiện cho người chơi sau khi kết thúc ván board game *Xoay Vòng Tiến Lui*:
- Chỉ kích hoạt sau khi ván chơi kết thúc (`game.phase === 'finished'`).
- Phân tích sâu sắc các quyết định (mua khóa học, thời điểm bán kinh doanh, gửi tiết kiệm, danh mục tài sản, nợ vay) dựa trên các con số VND thực tế từ engine.
- Mách nước mẹo chiến thuật thực chiến giúp người chơi dễ dàng chạm tay vào chiến thắng ở ván sau.
- **Bảo vệ tính toàn vẹn (Grounding):** 100% nhận định của AI đều trích dẫn bằng chứng thực tế từ ván chơi, chống ảo giác (hallucination), không bao giờ tính toán sai lệch hay can thiệp vào logic của game engine.

---

## 2. Hướng Dẫn Tích Hợp Cho UI Owner (Chỉ cần 1 dòng code)

UI Owner có thể gắn trực tiếp component `AICoachPanel` vào màn hình hiển thị kết quả cuối ván (trong `src/components/GameDialogs.tsx` ở phần modal Result):

```tsx
import { AICoachPanel } from '../ai/AICoachPanel'

// Bên trong Result Dialog khi ván kết thúc (game.phase === 'finished'):
<AICoachPanel game={game} />
```

### Các đặc tính an toàn:
- **Tự cô lập lỗi (Graceful degradation):** Nếu chưa có API key hoặc mạng chập chờn, component tự hiển thị thông báo trung thực và nút "Thử lại", tuyệt đối không bao giờ làm crash màn hình kết quả của game.
- **Độc lập styling:** Sử dụng CSS có scope rõ ràng (`src/ai/aiCoach.css`), không làm ảnh hưởng tới layout hay style hiện có của game.

---

## 3. Cấu Hình Môi Trường (Environment Variables)

Hệ thống sử dụng Google Gemini API với cơ chế tự động fallback model ổn định cao (`gemini-3.5-flash-lite`, `gemini-3.6-flash`, `gemini-flash-lite-latest`, `gemini-flash-latest`).

1. **Khi chạy Local:**
   - Tạo file `.env.local` ở thư mục gốc (đã được cấu hình trong `.gitignore`, không bao giờ bị lộ ra ngoài):
     ```env
     GEMINI_API_KEY=your_gemini_api_key_here
     ```
   - Chạy lệnh `npm run dev`. Middleware trong `vite.config.ts` sẽ tự động chuyển tiếp request tới Gemini API một cách an toàn.

2. **Khi triển khai Vercel (Production):**
   - Vào Settings dự án trên Vercel > Environment Variables.
   - Thêm biến `GEMINI_API_KEY` với giá trị API Key của dự án.
   - Endpoint `api/ai-coach.ts` sẽ hoạt động dưới dạng Vercel Serverless Function hoàn toàn tự động.

---

## 4. Trang Kiểm Thử Giao Diện Độc Lập (Dev Preview Harness)

Bạn có thể chạy dự án và mở ngay trang sau trên trình duyệt để kiểm tra:
👉 **`http://localhost:5173/preview-ai.html`**

Trang này hỗ trợ:
- **Chế độ Mock Data:** Xem trước giao diện phân tích AI mẫu cho cả 4 kịch bản (Thắng cuộc >90M, Thua kẹt vốn kinh doanh, Rút tiết kiệm trước hạn, Phá sản) ngay lập tức mà không cần có API key.
- **Chế độ Gọi API Gemini Thật:** Gửi dữ liệu ván đấu thực tế lên `/api/ai-coach` để kiểm tra phản hồi trực tiếp từ LLM.
- **Nút "Sinh ván chơi thật mới từ Engine":** Tạo ra các ván chơi 4 vòng ngẫu nhiên hoàn toàn mới từ chính game engine để kiểm thử tính sống động và chính xác của AI Coach.

---

## 5. Ranh Giới Mã Nguồn (Code Ownership)

Module AI được thiết kế hoàn toàn độc lập, tuân thủ nguyên tắc không can thiệp vào các vùng cốt lõi của game:
- `src/ai/**`: Facts builder, types, validation grounding schema, handler và component giao diện.
- `api/ai-coach.ts`: Vercel Serverless Function endpoint.
- `tests/ai-coach-*.test.ts`: Bộ unit test và integration test riêng biệt.
- **Vùng không chỉnh sửa:** Toàn bộ `src/game/**`, `src/data/**`, `src/components/GameDialogs.tsx` và các test engine cũ được giữ nguyên trạng 100%.

---

## 6. Lệnh Kiểm Tra Chất Lượng (Quality Gates)

Tất cả các lệnh sau đều đã được kiểm tra và vượt qua tuyệt đối:
```sh
npm test          # 168/168 tests pass (155 engine tests + 13 AI tests)
npm run lint      # 0 error, 0 warning
npx tsc -b        # Typecheck TypeScript không lỗi
npm run build     # Production bundle compile thành công
```
