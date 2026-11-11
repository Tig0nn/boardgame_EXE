**EG3-AI-03 PASS trong phạm vi in-game DEV và mock HTTP. Gemini LIVE_NOT_RUN.**

Đường chạy hiện tại dùng App thật và slot What-if ở màn hình kết quả. Người chơi chọn nhóm quyết định, nhập câu hỏi tiếng Việt, xem đề xuất, xác nhận trước khi native Worker chạy và xác nhận riêng các follow-up. Endpoint server riêng là `/api/what-if-provider`. Companion API tiếp tục dùng implementation hiện có.

Khởi chạy từ repository root bằng `node --experimental-strip-types scripts/what-if-ai-dev.ts`, rồi mở `http://127.0.0.1:5196/?endgameWhatIf=1&whatIfAi=1`. Khôi phục hoặc chơi xong một ván B18 bốn vòng để mở nút “Hỏi AI về lựa chọn khác”. Đây là tích hợp trong App ở môi trường DEV trên loopback. Trang fixture độc lập của EG3-AI-02 vẫn là một entry riêng.

| Lớp kiểm chứng | Kết quả |
|---|---|
| Mock HTTP | PASS qua Node HTTP thật và qua endpoint cùng origin của Vite/App |
| Gold C1 | PASS, xác nhận proposal → dừng ở lần bán → xác nhận skip → +104.006 VND ở cash, totalWorth và liquidatableFunds |
| Bank | PASS trên fixture độc lập, xác nhận proposal → +200.000 VND ở cả ba chỉ số |
| Course có follow-up | PASS với lịch sử được dựng bằng transition native từ C1, Actual skip37 rồi Basic54. Proposal Basic37 làm Basic54 trùng lặp. Người chơi phải xác nhận skip54 trước khi có comparison |
| ID không tồn tại | PASS, backend/client từ chối và UI không hiển thị comparison |
| Ambiguous | PASS, yêu cầu làm rõ câu hỏi và chưa có nút xác nhận replay |
| Provider timeout | PASS, deadline trả lỗi công khai và chưa có số liệu |
| Đóng lúc HTTP/Worker đang chạy | PASS, bỏ quyền công bố kết quả và dọn toàn bộ Worker |
| Duplicate click | PASS, mỗi câu hỏi chỉ gọi provider một lần và mỗi xác nhận chỉ tạo một replay |
| Save và official result | PASS, đối chiếu byte save và nội dung official result trước/sau từng ca App |
| Gemini live | LIVE_NOT_RUN, chưa cấu hình credential và quyền truy cập live cho milestone này |

Payload đề xuất chỉ có operation, câu hỏi tối đa 240 ký tự và tối đa 16 tuple kind/decisionId/alternativeId/lap/turn. Client lấy catalog từ Worker đã kiểm chứng và xác nhận exact membership lần nữa sau HTTP. Payload giải thích chỉ có kind, direction và confirmedFollowUp từ comparison đã xác minh. Server trả claim ID được phép, còn UI dùng câu giải thích cố định gắn với dữ kiện engine. Mọi số tiền trên UI lấy từ replay B18.

Ingress có schema đóng, giới hạn body 8 KiB và từ chối field save/state/history/amount bổ sung. Câu hỏi chứa mẫu email, số điện thoại, URL, control character hoặc mẫu API key bị từ chối. Endpoint DEV yêu cầu Origin/Host loopback khớp cùng custom request header. Phản hồi có no-store và không chứa lỗi nội bộ. Server tái sử dụng bộ đọc body và limiter của Companion qua import, không thay đổi các module đó.

Giới hạn mặc định gồm 12 request mỗi địa chỉ trong 10 phút, tối đa 64 địa chỉ, tối đa 2 request đang xử lý và 100 lượt provider cho một process. Một panel tối đa 8 lượt HTTP, deadline server 5 giây và client 7 giây. Reserve concurrency trước khi đọc body và reserve call budget ngay trước provider để giữ giới hạn khi chạy đồng thời. Native Worker tiếp tục dùng các giới hạn EG3-AI-02.

Adapter Gemini nằm hoàn toàn ở server. Constructor chụp configuration, đòi hỏi accessApproved và allowLiveTraffic cùng model, key và transport được inject. Launcher hiện tại luôn chọn mock và không đọc key từ environment. Adapter được kiểm tra bằng HTTP response giả lập, gồm schema ID và output budget 256 token. Cấu hình live và tích hợp backend production có xác thực/quota bền vững vẫn thuộc bước tiếp theo cần Owner cho phép. Hợp đồng tham chiếu từ [Gemini API](https://ai.google.dev/api/generate-content?hl=en) và [quản lý khóa](https://ai.google.dev/gemini-api/docs/api-key?authuser=2&hl=en).

240/240 test PASS, gồm baseline 234 và 6 test HTTP/security mới. TypeScript mobile/root, ESLint trên source thêm/sửa và build mobile trong bộ nhớ PASS. Bundle production mặc định loại runtime provider in-game. Tám ca Chromium App PASS, page errors trống và network ngoài endpoint không được phép trống. Harness chặn các request Google Fonts có sẵn của App bằng CSS rỗng, được ghi riêng trong interceptedFonts.

Các file source/test thêm hoặc sửa

- `src/ai/what-if/contracts.ts`
- `src/ai/what-if/server.ts`
- `src/ai/what-if/mock-server-provider.ts`
- `src/ai/what-if/gemini.ts`
- `src/ai/what-if/transport.test.ts`
- `mobile_app/src/game/what-if-ai/http-provider.ts`
- `mobile_app/src/game/what-if-ai/in-game-controller.ts`
- `mobile_app/src/components/endgame-what-if/InGameAiEntry.tsx`
- `mobile_app/src/components/endgame-what-if/in-game-ai.css`
- `mobile_app/src/game/endgame-analysis-app-binding.ts` thêm guarded replayText cho Worker Bank/Course trong cùng App capture
- `mobile_app/src/dev/EndgameWhatIfDev.tsx` nối entry AI qua opt-in DEV whatIfAi
- `scripts/what-if-ai-dev.ts`

Branch `feat/b18-whatif-deep-analysis-v2`, HEAD `759a6fe1879816a716e21e38cc91eecd3fe5f50a`, staging trống và tracked diff vẫn là 10 file baseline. Hai patch EG2C qua reverse check đủ 10 hunk. Phạm vi hiện tại hoàn thành qua feature-owned modules, không có protected diff đang chờ Owner duyệt.

Bằng chứng tại [regression.tap](playtests/whatif-endgame/2026-11-10/eg3-ai-03-01/regression.tap), [8 ca App và HTTP payload](playtests/whatif-endgame/2026-11-10/eg3-ai-03-01/browser-results.json), [browser runner](playtests/whatif-endgame/2026-11-10/eg3-ai-03-01/browser.mjs), [Gold](playtests/whatif-endgame/2026-11-10/eg3-ai-03-01/gold-app.png), [Bank](playtests/whatif-endgame/2026-11-10/eg3-ai-03-01/bank-app.png) và [Course](playtests/whatif-endgame/2026-11-10/eg3-ai-03-01/course-app.png).

Chạy lại browser runner bằng `node --experimental-strip-types docs/playtests/whatif-endgame/2026-11-10/eg3-ai-03-01/browser.mjs` từ repository root với quyền chạy Chromium và socket loopback. Test transport riêng dùng `node --experimental-strip-types --test src/ai/what-if/transport.test.ts`.
