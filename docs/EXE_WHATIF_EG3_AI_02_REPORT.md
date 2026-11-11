**EG3-AI-02 PASS trong phạm vi các adapter đã kiểm chứng.**

Workspace `C:\Users\Admin\EXE-whatif-demo`, branch `feat/b18-whatif-deep-analysis-v2`, HEAD `759a6fe1879816a716e21e38cc91eecd3fe5f50a`.

| Luồng | Bằng chứng cuối ván |
|---|---|
| Gold C1 | Mock chọn buy4 → Worker hiện có → chờ xác nhận sale25 → +104.006 VND ở cash, totalWorth và liquidatableFunds |
| Bank cũ | `frozen-screen-cash-roi`, skip36 → gửi tiết kiệm → +200.000 VND ở cả ba chỉ số |
| Bank mở rộng | `browser-390-trades`, skip28 tại ô 6 và skip40 tại ô 17 đều replay độc lập đến vòng 4, +200.000 VND ở cả ba chỉ số |
| Course mới | `frozen-holdout-diversified-roi`, skip49 → course-basic cho -2.000.000 VND và skip72 → course-basic cho -4.000.000 VND ở cả ba chỉ số, recurringIncome tăng 2.000.000 VND theo engine |
| Course cần follow-up | Lịch sử mới dựng bằng transition native từ prefix C1 bỏ Basic37 rồi mua Basic54. Fork thử học tại 37 làm Basic54 bất hợp lệ. Chờ xác nhận skip54, từ chối token cũ và thao tác đồng thời, sau đó replay độc lập đến cuối ván |
| Partial Gold sale trong Bank | Lịch sử native C1 đổi sale84 thành bán một phần. Fork Bank28 vẫn giữ chính xác lệnh sale84 và hoàn tất kiểm chứng |

`endgame-whatif-paired.ts` sở hữu việc tiến phase, phát lại lệnh gốc trên hai nhánh, kiểm tra prefix Actual, kiểm tra RNG/market/bối cảnh bên ngoài, giữ nguyên identity lệnh Alternative, phát hiện rejection và kiểm tra kết thúc cùng mốc. Mọi phép tính và giao dịch dùng engine/selectors B18 hiện có.

Gold tiếp tục dùng API, Worker, transcript và follow-up hiện có. Wrapper Gold giữ riêng hạn chế chỉ bán toàn bộ Gold, quote phí/spread, các diagnostic cũ và giới hạn GOLD_LIMITS. Hạn chế partial sale của Gold không còn lan sang Bank/Course. Mười characterization test đã chạy PASS trên code cũ trước khi refactor và PASS sau refactor.

Contract adapter gồm `matches`, `alternatives` và native fork được probe trên prefix đã replay. Lớp điều phối enumerate catalog hợp lệ, xác nhận lại selection đầy đủ trước fork, phát lại recorded actions, giữ transcript follow-up riêng và chỉ tạo comparison sau independent replay của Alternative. Worker riêng cho adapter mở rộng giữ một source và một branch, kiểm tra thứ tự request và catalog membership. Client kiểm tra ID, phase, proof và delta, thu hồi kết quả khi hủy hoặc timeout.

Phạm vi và lựa chọn triển khai hiện tại

- Bank nhận các quyết định skip đã ghi tại ô Bank hợp lệ, gồm nhiều quyết định trong một lịch sử. Giữ ngân sách giả định 5.000.000 VND và term 1 của EG3-AI-01. Native engine kiểm tra tiền mặt, thời điểm giao dịch, đáo hạn và lãi. Thay đổi khoản gửi đã tồn tại, các term khác và ngân sách tùy ý cần adapter riêng.
- Course hỗ trợ skip → course-basic và course-basic → skip khi native legality probe thành công. Lát cắt mới được chứng minh là skip → course-basic. Fork khóa Advanced và các nhóm Stocks/Bonds/Business chưa có adapter.
- Lệnh Course sau fork bị từ chối có thể được thay bằng skip hợp lệ sau xác nhận tường minh. Các lệnh tài chính bị từ chối, funding, early terminal/insolvency, lệch exogenous state và kết thúc không cùng mốc đều dừng trước khi công bố comparison. Đây là giới hạn policy của feature. Thử nghiệm hiện tại không đòi hỏi thay transition engine.
- Catalog giới hạn 16 quyết định ứng viên, tối đa 8 follow-up, work budget tối đa 30 giây và deadline Worker 35 giây. Catalog được tạo từ legality của fork, không chọn phương án dựa trên kết quả tương lai.
- Mock Gemini vẫn dùng grammar giới hạn và yêu cầu số quyết định khi catalog có nhiều lựa chọn. Provider thật có thể cắm vào `WhatIfProvider` với cùng bước validate ID. Tích hợp server, credential hợp lệ và kiểm thử Gemini live còn là công việc tiếp theo.

Kiểm chứng

- 234/234 test PASS, gồm 206 test hồi quy có sẵn và 28 test EG3. Các ca gồm rejection sau fork, partial Gold sale, funding, insolvency, RNG/market divergence, cancellation, deadline, stale response và packed-save immutability.
- TypeScript mobile và ESLint trên source thay đổi PASS. Build mobile chạy trong bộ nhớ PASS và kiểm tra entry/Worker EG3 DEV bị loại khỏi bundle production mặc định.
- Chromium DEV PASS cho Gold, Bank và Course. Cả năm Worker được đóng, không có page error hoặc request API/ra ngoài. Course đã kiểm tra ở 390 và 320 px.
- SHA-256 của cả năm file thuộc EG2C vẫn khớp bản ghi application, cả hai patch qua reverse check. Git có 10 tracked modified như baseline và staging trống.

Source và test thêm/sửa

- `mobile_app/src/game/endgame-whatif-paired.ts`
- `mobile_app/src/game/endgame-whatif-gold-reconcile.ts`
- `mobile_app/src/game/what-if-ai/decision-adapters.ts`
- `mobile_app/src/game/what-if-ai/decision-replay.ts`
- `mobile_app/src/game/what-if-ai/decision-client.ts`
- `mobile_app/src/game/what-if-ai/decision.worker.ts`
- `mobile_app/src/game/what-if-ai/bank-replay.ts`
- `mobile_app/src/game/what-if-ai/orchestrator.ts`
- `mobile_app/src/game/what-if-ai/mock-gemini.ts`
- `mobile_app/src/game/what-if-ai/native-worker.test.ts`
- `mobile_app/src/game/what-if-ai/paired-replay.test.ts`
- `mobile_app/src/game/what-if-ai/decision-replay.test.ts`
- `mobile_app/src/dev/what-if-ai-page.tsx`
- `mobile_app/src/dev/what-if-ai.css`

DEV mở bằng `npm --prefix mobile_app run dev -- --host 127.0.0.1`, sau đó truy cập `http://127.0.0.1:5174/what-if-ai.html` và chọn Course.

Bằng chứng tại [regression.tap](playtests/whatif-endgame/2026-11-10/eg3-ai-02-01/regression.tap), [browser-smoke.mjs](playtests/whatif-endgame/2026-11-10/eg3-ai-02-01/browser-smoke.mjs), [Course 390px](playtests/whatif-endgame/2026-11-10/eg3-ai-02-01/course-390.png) và [Course 320px](playtests/whatif-endgame/2026-11-10/eg3-ai-02-01/course-320.png).

Chạy lại regression bằng `node --experimental-strip-types --test --test-concurrency=2 mobile_app/src/game/endgame*.test.ts mobile_app/src/game/what-if-ai/*.test.ts scripts/diagnostics/what-if-bank-historical.test.ts`. Chạy lại browser bằng `node docs/playtests/whatif-endgame/2026-11-10/eg3-ai-02-01/browser-smoke.mjs` từ repository root với quyền chạy Chromium và socket loopback.
