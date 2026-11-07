# B18 MVP — Beginner UX Polish & Technical QA

Ngày: **17/10/2026**. Mục tiêu: **Phân bổ tài chính và quản lý rủi ro**.

- Nhánh: `codex/mvp-b18-ux-polish`, tạo từ đúng `ba1c8115aa241143053085089132807c48f0bc10`.
- Commit UI/logic hiển thị được kiểm chứng: **`0dc4c40d095f79034e78fcb86ad81c3d209bc80f`**. Báo cáo và evidence nằm trong commit bàn giao tiếp theo trên cùng nhánh.
- Giữ nguyên toàn bộ `src/game`, `src/data`, luật/schema/profile, board18/4 START, goal90M, vốn50M, hai khóa6M/+2M và10M/+4M, ô học5/8/13 và Bonds16. Không sửa market/fees/spread/credit/Business/Personal/trading/victory; không nghiên cứu lại cân bằng.

## Findings và thay đổi P1

| Finding | Sửa và lý do | Kiểm chứng |
|---|---|---|
| Card khóa học đưa nhiều số dự phóng lên trước nút mua | Giữ tên, giá, tăng lương, cash, trạng thái và Mua/Bỏ qua. Chuyển số START còn lại, thu nhập danh nghĩa, chênh lệch học phí, số START bù phí và điều kiện/chi phí cơ hội vào `details` đóng mặc định. Không chọn khóa thay người chơi; không đổi công thức cũ. | Hai thứ tự học, thiếu tiền, học đủ/ghé lại; mở thông tin trước khi mua; SSR kiểm tra thông tin chính nằm ngoài `details`. |
| Mobile dùng cùng một câu cho hầu hết ô | Dùng helper mô tả theo type và rules profile, chia sẻ với Desktop. Đủ9 loại ô B18; khóa cũ8M/+4M, C20 và trading/credit/sinh hoạt lịch sử lấy đúng phiên bản. | Xem cả9 loại ở320/390/1440; Mobile so sánh state, Desktop so sánh export trước/sau: không đổi. |
| Kết quả thiếu tổng kết quyết định độc lập với AI | `FinancialReview` dùng log để hiện tối đa3 dòng thực tế; các khoản khác mở rộng. Có học phí/lương thêm thực nhận, phí+spread thực trả, nợ còn lại, vốn quán chưa bán, thanh toán ngay cho biến cố khi có phát sinh. Ván giữ cash không phát sinh các mục đó dùng lương/sinh hoạt đã ghi nhận. AI Coach ghi rõ tùy chọn. | Unit test số tiền; browser so sánh học phí/lương/phí với log xuất từ ván thật. Thắng/thua xem được khi chưa gọi AI. |
| `saved` chỉ đọc một lần khi mount | Khi về Setup, lấy snapshot mới nhất, lưu đồng bộ trước khi unmount hủy timer autosave và cập nhật `saved`. Nếu lưu thất bại, giữ snapshot mới nhất trong bộ nhớ kèm thông báo. Nút phân biệt **Tiếp tục ván** và **Xem lại ván đã kết thúc**. | Regression UI tái hiện lỗi trên base tại320/390, sau sửa đều trỏ đúng ván mới. Thử quota failure và resume/import C20, B18 một khóa, schema7. |

Tiền lương thêm được lấy từ các bước **Nhận lương đã chạy**, trừ lương nền đúng profile; không dùng dự báo START để ghi nhận thu nhập. Phí/spread là tổng giá trị bán ghi trong log trừ tiền thực nhận, gồm bán tự nguyện và funding; không gộp biến động giá/credit thành phí. Dòng “thanh toán ngay cho biến cố” không được diễn giải là tổng mọi chi phí biến cố dời tới START. Vốn quán là capital engine còn ghi nhận, không phải báo giá bán hay tiền có thể huy động. Không gán những số này thành nguyên nhân giả của thắng/thua.

## P2 trong phạm vi

- HUD giải thích bằng “Tiền có thể gom sau phí & nợ”; GoalChecks/chi tiết kết quả giải thích nguồn tiền mặt, gốc tiết kiệm rút được và giá bán ròng, vẫn gọi selector hiện hữu.
- Onboarding đưa50M/90M/4 START, cách gieo–dừng–chọn và vai trò cash/dự phòng lên trước luật đầu tư nâng cao; luật chi tiết vẫn đóng mặc định. Không bắt buộc mức dự phòng.
- Setup chỉ nhắc nhẹ khi gửi đủ50M còn0 cash; vẫn bắt đầu được. Walkthrough đã dùng chính lựa chọn này để kiểm tra funding.
- Sửa focus khi đóng Modal: trả được về cả nút HTML và ô SVG. Các nút chính giữ kích thước chạm và tương phản hiện có; card gọn hơn, nút Bỏ qua dễ tiếp cận, nội dung dài cuộn được.
- Không redesign artwork, thêm luật/loại ô hoặc mở rộng tính năng gameplay. Chi tiết kết quả Desktop được thu gọn để dành chỗ cho phản hồi factual.

## File production sửa

**15 file, tập trung ở presentation và vòng đời App:**

- `src/components/CourseChoices.tsx`, `course-choices.css`: progressive disclosure và bố cục card.
- `src/components/tile-information.ts`, `Board.tsx`, `mobile_app/src/components/CoreMvpBoard.tsx`: mô tả ô dùng chung, chỉ đọc.
- `src/components/financial-review.ts`, `FinancialReview.tsx`, `GameDialogs.tsx`, `mobile_app/src/components/GameResultModal.tsx`: tổng kết tài chính Desktop/Mobile.
- `mobile_app/src/App.tsx`, `components/GameSetup.tsx`: refresh save mới nhất, trạng thái ván và cảnh báo0 cash.
- `src/components/GoalChecks.tsx`, `mobile_app/src/components/TopHud.tsx`, `components/Tutorial.tsx`: ngôn ngữ cho người mới.
- `src/components/Modal.tsx`: trả focus cho SVG.

Các file còn lại là tests/script/báo cáo/evidence. SSR cũ chỉ đổi assertion “không vay mới” thành không phân biệt hoa/thường sau sửa copy; không bỏ kiểm tra hành vi.

## Baseline và kết quả QA

| Kiểm tra | Trước sửa | Sau sửa | Giải thích chênh lệch |
|---|---:|---:|---|
| Product tests |334/334|**339/339**|Thêm5 test về dữ kiện thực nhận, phí/funding, không bịa quyết định, course lịch sử và mô tả theo profile.|
| SSR UI |2/2|**3/3**|Thêm disclosure, phản hồi kết quả và nhãn save đang chơi/đã kết thúc.|
| Replay tự nhiên |68/68|**77/77**|Giữ nguyên68 log cũ, thêm9 log UI mới:5 ván đầy đủ +2 thiếu tiền học +2 funding.|
| Research parity |13/13;2306 snapshot|**13/13;2306 snapshot**|492 hành động, market/credit/RNG/tiền và outcome không đổi.|
| Lint |Pass|**Pass**|Không lỗi.|
| Build Desktop/Mobile |Pass/Pass|**Pass/Pass**|Không lỗi.|
| Byte-hash evidence candidate trước |115 artifact|**115/115 nguyên vẹn**|Không sửa archive và nguồn nghiên cứu.|

Fixture DEV lịch sử nhảy thẳng vị trí/lượt vẫn được loại khỏi replay tự nhiên, cùng hash/lý do cũ; không sửa fixture để ép khớp. Không chạy lại167.972 hoặc400.800 ván.

### Walkthrough UI thật

| Luồng đầy đủ | Tiền cuối hợp lệ | Phản hồi kiểm tra |
|---|---:|---|
| Mobile390, nâng cao→cơ bản |94.000.000đ, thắng|Học phí16M, lương thêm24M; mua lượt2/5 cùng vòng1; reload giữa hai lần.|
| Mobile320, cơ bản→nâng cao |94.000.000đ, thắng|Cùng học phí/lương; nút/scroll ở320px, đủ hai khóa và ghé lại.|
| Desktop1440, cơ bản→nâng cao |94.000.000đ, thắng|Card, course status, START và feedback.|
| Mobile390, mua/bán tài sản |84.635.118đ, thua|Học phí16M, lương thêm14M, phí/spread201.755đ khớp log.|
| Desktop1440, học muộn |84.000.000đ, thua|Học phí16M, lương thêm14M; không tự thêm dòng phí khi chưa bán tài sản.|

Ngoài5 ván đầy đủ: kiểm tra thiếu tiền học ở320/390 và Desktop; onboarding đủ6 bước; personal medical và funding bằng savings/debt; reload/resume; import C20/schema5, B18 một khóa/schema6, Multi-Course/schema7; mô phỏng quota failure. Rút savings trước hạn mất đúng9M lãi chưa nhận; vay5M ghi đúng nợ5M. Đọc đủ6 tab sổ tay ở320/390. Escape trả focus về ô, tutorial Next đưa focus tới heading, modal không tràn ngang, nút mua/bỏ qua/tiếp tục hoạt động bằng UI.

Không có lỗi JavaScript trong các walkthrough. Khi kiểm tra test harness, bộ ghi số lãi mất được chỉnh lấy đúng `funding` entry thay vì `event_resolution` cuối log; engine không sai và không bị sửa.

## Ảnh trước/sau

Mobile “trước” chụp mới tại đúng base; Desktop “trước” dùng nguyên ảnh từ evidence đã kiểm chứng của chính `ba1c811`, được ghi rõ nguồn trong JSON. Không dựng lại hình hoặc giả lập game state.

| Màn | Trước | Sau |
|---|---|---|
| Khóa học320 |[Ảnh](playtests/b18-beginner-ux/before/320-course.png)|[Ảnh](playtests/b18-beginner-ux/after/320-course.png)|
| Khóa học390 |[Ảnh](playtests/b18-beginner-ux/before/390-course.png)|[Ảnh](playtests/b18-beginner-ux/after/390-course.png)|
| Khóa học Desktop |[Ảnh](playtests/b18-beginner-ux/before/desktop-course-unlearned.png)|[Ảnh](playtests/b18-beginner-ux/after/desktop-course-unlearned.png)|
| Mô tả Trái phiếu320 |[Ảnh](playtests/b18-beginner-ux/before/320-tile-3.png)|[Ảnh](playtests/b18-beginner-ux/after/320-tile-3.png)|
| Kết quả thua390 |[Ảnh](playtests/b18-beginner-ux/before/390-result-defeat.png)|[Ảnh](playtests/b18-beginner-ux/after/390-result-defeat.png)|
| Save sau kết thúc390 |[Ảnh](playtests/b18-beginner-ux/before/390-saved-after-result.png)|[Ảnh](playtests/b18-beginner-ux/after/390-saved-after-result.png)|
| Setup0 cash320 |[Ảnh](playtests/b18-beginner-ux/before/320-setup-zero.png)|[Ảnh](playtests/b18-beginner-ux/after/320-setup-zero.png)|
| Onboarding390 |[Ảnh](playtests/b18-beginner-ux/before/390-onboarding.png)|[Ảnh](playtests/b18-beginner-ux/after/390-onboarding.png)|

Các ảnh expanded, đủ hai khóa, từng loại ô, funding, START, kết quả thắng/thua, và dữ liệu kiểm chứng nằm trong [manifest](playtests/b18-beginner-ux/manifest.json). [Saved-game/focus regression](playtests/b18-beginner-ux/after/screens-verification.json), [compat/funding](playtests/b18-beginner-ux/after/compat-funding-verification.json), [Mobile games](playtests/b18-beginner-ux/after/browser-verification.json), [Desktop board/thua](playtests/b18-beginner-ux/after/desktop-board-verification.json), [replay](playtests/b18-beginner-ux/after-replay-verification.json).

## Tái lập

Dependency root và `mobile_app` giữ nguyên; Node22+, Playwright/Chromium runtime đã có. Không thêm dependency production.

```powershell
npm test
npm run lint
npm run build
npm --prefix mobile_app run build
node --experimental-strip-types --test --test-concurrency=1 scripts/diagnostics/core-mvp-b18-ui.test.ts scripts/diagnostics/multi-course-ui.test.ts scripts/diagnostics/b18-ux-ui.test.ts
node --experimental-strip-types scripts/verify-multi-course-parity.ts
node --experimental-strip-types scripts/diagnostics/verify-ux-replays.ts
node scripts/verify-b18-ux-evidence.mjs --check
```

Local, hai terminal riêng:

```powershell
npm run dev -- --host 127.0.0.1 --port 5191 --strictPort
npm --prefix mobile_app run dev -- --host 127.0.0.1 --port 5190 --strictPort
```

Desktop `http://127.0.0.1:5191`, Mobile `http://127.0.0.1:5190`. Script browser: `b18-ux-screens.mjs --after`, `b18-ux-games.mjs` (thêm `--rules` cho sổ tay), `b18-ux-desktop.mjs`, `b18-ux-desktop-board.mjs`, `b18-ux-compat-funding.mjs`, đều trong `scripts/diagnostics/`. Đặt `B18_URL`/`B18_DESKTOP_URL` nếu đổi cổng; đặt `PLAYWRIGHT_MODULE`/`BROWSER_PATH` nếu dùng runtime khác. Chế độ `--before` của screenshots cần server chạy đúng base. Browser dùng thao tác UI và import log thật; chỉ bài quota failure giả lập lỗi storage, không inject state.

## Giới hạn và điểm dừng

- QA trên Chromium headless tại320/390/1440; chưa xác nhận Safari/iOS, thiết bị thật, screen reader hoặc khả năng học qua Human Playtest.
- Phản hồi là bảng kê factual ngắn, không phải phân tích nhân quả đầy đủ hoặc lời khuyên đầu tư ngoài đời. Các loại phí/tiền chưa có trong log không được tự đoán.
- C20 tiếp tục giữ artwork/cách điều khiển lịch sử; không thêm hệ thống chạm ô mới lên artwork cũ trong vòng polish này. Save/import/replay vẫn được kiểm chứng.
- Không mở rộng redesign hoặc tính năng P2 có rủi ro lớn. Nếu Owner muốn audit screen reader/thiết bị thật hoặc thay artwork, cần phạm vi riêng.

**Technical QA đạt trong phạm vi trên. Candidate để Owner review; chưa merge main, chưa deploy Vercel, chưa phát hành Preview và chưa tuyên bố production-ready. Chỉ chuyển Preview sau khi Owner duyệt.**
