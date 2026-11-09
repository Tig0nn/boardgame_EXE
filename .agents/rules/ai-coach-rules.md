# AI Coach Development Rules (Antigravity & Coding Agents)

Bộ quy tắc này hướng dẫn chi tiết cách viết mã, kiểm thử và xử lý an toàn cho tính năng AI Coach của Phát.

---

## 1. Nguyên Tắc Dữ Liệu & Fact Builder (`src/ai/facts.ts`)

1. **Chỉ gọi khi ván kết thúc:** `game.phase === 'finished'`.
2. **Deterministic & Engine-Driven:** Toàn bộ số liệu tài chính (`liquidatableFunds`, `totalWorth`, `victory`, `cash`, `debt`, `obligations`) phải được lấy từ các selector chính thức của game (`src/game/selectors.ts`).
3. **Số nguyên VND chuẩn:** Không tự ý đổi thành số thực (float triệu) trong tính toán logic nghiệp vụ.
4. **Giới hạn dung lượng Facts:**
   - Số lượng bằng chứng (`evidence`) tối đa **8 items** đại diện cho các sự kiện/quyết định then chốt nhất của ván.
   - Tuyệt đối **không** gửi log snapshot thô, không gửi chuỗi lịch sử giá toàn bộ hoặc JSON game 15MB.
   - Dung lượng payload JSON gửi lên server không được vượt quá **10 KB**.
5. **Cấu trúc bằng chứng (Evidence):**
   - Mỗi bằng chứng phải có `id` duy nhất và có `kind` thuộc tập:
     `'goal-result' | 'liquidity-gap' | 'business-locked' | 'savings-withdrawal' | 'savings-maturity' | 'borrowing' | 'business-buy' | 'business-upgrade' | 'business-sale' | 'course' | 'asset-trade' | 'macro-shock' | 'expense' | 'insolvency'`.
   - Nội dung `fact` phải súc tích, mô tả sự kiện thực tế trong ván chơi.

---

## 2. Nguyên Tắc Phản Hồi LLM (Gemini System Prompt & Grounding)

1. **Grounding tuyệt đối:** Mọi nhận xét (`insight`) từ LLM bắt buộc phải trích dẫn ít nhất một `evidenceId` có thật trong `CoachFacts.evidence`. Nếu ID không tồn tại trong danh sách facts, server phải loại bỏ hoặc từ chối kết quả.
2. **Không phán xét, không khuyên bảo đời thực:**
   - Giọng điệu khách quan, khích lệ, mang tính giáo dục tài chính.
   - Không shaming người chơi (không gọi là "thiếu hiểu biết", "liều lĩnh", "sai lầm tệ hại").
   - Không đưa ra lời khuyên mua bán chứng khoán, bất động sản hay sản phẩm tài chính thật ngoài đời.
3. **Giới hạn số lượng:** Tối đa 3 insights ngắn gọn.
4. **Đề xuất ván sau (`tryNext`):** Phải là một *thử nghiệm học tập giả định* (learning experiment), không được cam kết kết quả thắng hay tính toán what-if kỳ diệu.

---

## 3. Nguyên Tắc Bảo Mật & Hạ Tầng Serverless

1. **Không rò rỉ API Key:**
   - Biến môi trường chứa API Key (`GEMINI_API_KEY`) chỉ tồn tại trên môi trường serverless (Vercel Project Settings) và file `.env.local` ở máy local của lập trình viên.
   - Nghiêm cấm dùng tiền tố `VITE_` cho API Key vì Vite sẽ bundle key vào mã JavaScript gửi xuống client browser.
   - Tuyệt đối không commit file `.env` hoặc `.env.local` vào Git repo.
2. **Chống lạm dụng (Abuse Prevention & Rate Limit):**
   - Serverless handler phải áp dụng rate limiting cơ bản (in-memory IP limiter: tối đa 5 request / phút / IP).
   - Thiết lập timeout nghiêm ngặt cho LLM call (8–10 giây) và `maxOutputTokens` vừa đủ (khoảng 600–800 tokens).
3. **Graceful Fallback:**
   - Khi API lỗi, quá tải, hết quota, hoặc chưa cấu hình API key: Client phải hiển thị thông điệp trung thực *"Phân tích AI hiện chưa sẵn sàng"*.
   - Tuyệt đối không hardcode câu trả lời tĩnh rồi mạo danh là "AI tạo ra".
   - Mọi lỗi AI không bao giờ được làm treo hoặc gián đoạn màn hình Result hay nút "Tải nhật ký quyết định".

---

## 4. Nguyên Tắc Đóng Gói Component (`AICoachPanel.tsx`)

1. **Component tự trị (Self-contained):** Chứa đủ logic fetching, loading spinner, error state, hiển thị insights, retry (tối đa 2 lần).
2. **Props hợp đồng:**
   ```tsx
   export interface AICoachPanelProps {
     game: GameState;
   }
   ```
3. **Scoped Styling:** CSS của component phải được scoped (CSS module hoặc prefix rõ ràng `.ai-coach-...`), không ghi đè css của các modal/dialog khác.
4. **Không sửa `GameDialogs.tsx`:** Việc gắn component vào Result sẽ do bạn làm UI thực hiện hoặc được toggle qua dev harness.
