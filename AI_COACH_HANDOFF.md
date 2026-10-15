> **CURRENT** — Bàn giao AI Coach, cập nhật 13/10/2026. Nguồn mô tả MVP chuẩn: [CURRENT_MVP.md](docs/CURRENT_MVP.md).

# AI Coach sau ván — tích hợp và giới hạn xác minh

Candidate Bond V2.5 ngày15/10: engine [bondCreditFacts](src/game/bond-credit.ts) cung cấp lựa chọn issuer, warning công khai lúc mua, concentration, coupon/gốc thực nhận, chậm trả, mất vốn và bán ròng theo vòng. [facts](src/ai/facts.ts) tạo evidence `bond-credit`/`bond-choice`; [schema](src/ai/schema.ts) chấp nhận hai kind này, vẫn tối đa8 evidence/500chars mỗi fact/10KB. Historical games không có fields mới giữ evidence cũ. Provider handler, keys server, timeout, fallback và grounding không thay đổi. [Verification](docs/BOND_V2_5_IMPLEMENTATION_REPORT.md) kiểm facts của exported games; không gọi Gemini thật để xác nhận provider.

Coach hỗ trợ giải thích ván game đã kết thúc; số tiền, thắng/thua và ngẫu nhiên vẫn do engine quyết định. [AICoachPanel](src/ai/AICoachPanel.tsx) đang gắn trong [Mobile GameResultModal](mobile_app/src/components/GameResultModal.tsx), chỉ render khi `game.phase === 'finished'` và feature flag bật. Người chơi bấm yêu cầu phân tích; không tự suy kết quả từ AI.

Root Web [GameDialogs](src/components/GameDialogs.tsx) **chưa gắn Coach panel**. Root có backend middleware/Function và [harness preview-ai.html](preview-ai.html). Hướng dẫn “UI owner chỉ cần một dòng” trong [bàn giao trước audit](https://github.com/Tig0nn/boardgame_EXE/blob/13c9c7c5fa932e50a3ba23da4b316e1dff4cdda9/AI_COACH_HANDOFF.md) là lịch sử, không chứng minh Web result đã tích hợp. [PR #8](https://github.com/Tig0nn/boardgame_EXE/pull/8) vẫn chưa merge.

## Luồng và ranh giới đảm bảo

1. [facts.ts](src/ai/facts.ts) dựng `CoachFacts` từ game finished và các selector/log deterministic.
2. Panel POST facts tới `/api/ai-coach` cùng origin, xử lý loading, error/fallback và thử lại. Thiếu backend/key không được coi là thành công AI.
3. [api/ai-coach.ts](api/ai-coach.ts) chỉ nhận POST, gọi [server handler](src/ai/server/handler.ts). Local root [vite.config.ts](vite.config.ts) có middleware tương ứng.
4. [schema.ts](src/ai/schema.ts) giới hạn payload, kiểu số nguyên VND, tối đa 8 evidence; output có 1–3 insights, bỏ HTML và lọc evidence IDs không tồn tại. Nhận xét không có ID hợp lệ bị loại; nếu không còn insight hợp lệ thì trả lỗi.
5. Handler gọi Gemini phía server, timeout 12 giây và thử danh sách model fallback trong code. Model IDs là cấu hình/candidate, không phải chứng minh provider hiện chấp nhận hoặc đã trả thành công.

Grounding kiểm tra shape và ID trích dẫn, **không xác minh ngữ nghĩa mọi câu văn hoặc bảo đảm “100% không hallucination”**. Payload client chưa phải nguồn chứng thực chống giả mạo. AI không sửa engine state, RNG, transaction hoặc victory. Giới hạn [rateLimiter.ts](src/ai/server/rateLimiter.ts) mặc định 5 request/60 giây/IP, in-memory mỗi process; không phải quota toàn deployment/cluster.

| Request/tình huống | Hành vi code / mức xác minh |
| --- | --- |
| GET | 405 JSON method rejection; đã xác nhận trên Mobile URL hiện tại |
| POST payload sai | 400 JSON/fallback; unit tests và Web Preview trước đó đã xác minh |
| POST facts hợp lệ thiếu key | 503 fallback; tests/local mock coverage, chưa dùng GET để suy điều này online |
| Provider lỗi/timeout hoặc grounding không hợp lệ | Error/fallback và retry; không thay kết quả game |
| Provider thành công | Trả output đã validate; chưa có phản hồi thật được xác nhận trong bằng chứng audit |

## Cấu hình và chạy

Local root cài dependency bằng `npm ci`, chạy `npm run dev` (mặc định 5173). Nếu cần provider thật, owner tự đặt `GEMINI_API_KEY` trong root `.env.local` bị ignore; `GEMINI_MODEL` tùy chọn. Không in, tải từ project khác hoặc commit key; không đặt tên `VITE_GEMINI_API_KEY`. [env example](.env.example) chỉ là placeholder.

Mobile: cài thêm `npm ci --prefix mobile_app`, chạy `npm run dev --prefix mobile_app`; [proxy](mobile_app/vite.config.ts) `/api` về root 5173. Nếu Web dev nhảy sang cổng khác do 5173 bận, proxy chưa tự đổi. `npm run preview --prefix mobile_app` chỉ phục vụ static build, không tự chạy API.

Hosting hiện có [Mobile URL](https://boardgame-exe-mobile-preview.vercel.app) và Function root `api/ai-coach`; project Mobile riêng đang được gắn Production. Key phải do owner cấu hình trực tiếp trong đúng project/environment được giao, không suy từ tên “preview” hoặc sao chép key Web. Audit không đọc env values hoặc xác minh key đang được đặt. [tsconfig.json](tsconfig.json) bật `rewriteRelativeImportExtensions` để emitted ESM không còn import file `.ts` thiếu trên runtime.

Harness http://localhost:5173/preview-ai.html có mock output để xem UI, và tùy chọn gọi backend. Mock không chứng minh real provider, cũng không thay ván online hoàn chỉnh. Không gọi provider hoặc ghi secret chỉ để kiểm tra documentation.

## Tests và evidence

[CI run 38421516083](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38421516083), code `13c9c7c`: toàn repository **186 product tests + 21 diagnostics**, lint và hai build qua; không phải 168 test của bàn giao AI ban đầu. Kiểm tra AI nằm trong [facts tests](tests/ai-coach-facts.test.ts), [handler/schema tests](tests/ai-coach-handler.test.ts) và [emitted ESM regression](scripts/diagnostics/ai-coach-deployment.test.ts). Tests dùng mock, không yêu cầu AI key.

[PR8 review](docs/PR8_FINAL_REVIEW.md) lưu lỗi `ERR_MODULE_NOT_FOUND` trước sửa và HTTP 405/400 sau sửa. [Mobile browser evidence](docs/playtests/mobile-v2-4/browser-verification.json) mock 503 và vẫn export/restart được; không ghi đó là phản hồi AI thật.

Còn thiếu successful provider integration test với facts một ván thật, kiểm tra output/evidence và fallback/retry trên deployment đúng environment; full online game và thiết bị thật cũng chưa hoàn tất. Theo dõi ở [tasks/current.md](tasks/current.md). Không thay rule/UI để sửa các giới hạn tài liệu này.
