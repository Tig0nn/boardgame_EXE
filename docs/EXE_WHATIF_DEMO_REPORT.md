# EXE — Premium What-if MVP demo report

Ngày QA: **31/10/2026** (Asia/Bangkok). Trạng thái: **implementation và QA hoàn tất trên baseline remote đã xác minh; chờ Owner review**. Chưa push, merge, deploy, gọi Gemini hoặc bật tính năng trên production.

## 1. Git isolation và baseline

- Repository: `Tig0nn/boardgame_EXE`.
- Branch local: `feat/b18-whatif-demo`.
- Worktree: `_exe-workstreams/b18-whatif-demo`.
- Baseline đề xuất `883b64b09da312b57cffaa29a5fb119bb4196e36` **không truy cập được**: GitHub Commit API trả 422 “No commit found”; Git fetch object trả “not our ref”. Môi trường này không có checkout trên máy Phát. Không thể xác minh nội dung hoặc diff với commit đó.
- Baseline thực dùng: **`dd4c1a1fb915b006d4bd86c8adec7b793a499641`**, HEAD đã push của `feat/b18-universal-ai-companion` khi bắt đầu.
- Xác minh `aeaae9521254d184ff1fdaffdf0d4062d0eca2dd` (repair Companion hai tab) là ancestor của baseline thực dùng. B18 multi-course, Map và Companion hiện có đã được kiểm trong browser.
- Không đọc/lấy thay đổi chưa commit từ `b18-semantic-understanding-v1`; không sửa checkout gốc của Phát. Không khẳng định tương thích với phần Semantic P4 chưa được cung cấp. Khi đưa patch về máy nhóm, cần đối chiếu baseline local trước khi áp dụng.

## 2. Luồng đã hoạt động

Sự kiện **Chiếc xe cần sửa** → chọn thật một phương án → trở về bàn chơi → **✨ Nếu tôi chọn cách khác?** → hai thẻ Actual / What-if → bài học → quay về ván đang chơi → gieo xúc xắc tiếp.

| Chỉ số tại cùng trạng thái trước quyết định | Sửa ngay | Sửa tạm |
| --- | ---: | ---: |
| Tiền mặt trước quyết định | 50.000.000 ₫ | 50.000.000 ₫ |
| Tiền mặt sau quyết định | 46.000.000 ₫ | 49.000.000 ₫ |
| Đã thanh toán ngay | 4.000.000 ₫ | 1.000.000 ₫ |
| Nghĩa vụ mới tại lần qua Xuất phát tiếp theo | 0 ₫ | 4.000.000 ₫ |
| Tổng chi phí cam kết | 4.000.000 ₫ | 5.000.000 ₫ |

Sửa tạm giữ lại **3 triệu tiền mặt** ngay lúc này, đổi lại **1 triệu tổng chi phí cao hơn**. Các số là kết quả engine tại baseline thực dùng, không lấy từ mô tả cũ hoặc AI.

Đây là **mô phỏng tác động tại thời điểm quyết định**; không tái mô phỏng toàn ván, không dự báo khả năng thắng, thu nhập, RNG hoặc thanh toán tương lai.

## 3. Engine và tính toàn vẹn

- `simulateRepairWhatIf` dùng `canChoose`, validation course/board, `eventsForGame`, hai lần `decide` trên hai bản clone độc lập của **cùng** pre-decision state, và selector `totalWorth`.
- Cash, khoản đã trả, nghĩa vụ phát sinh và trạng thái funding lấy từ kết quả/financial log engine. Chi phí lựa chọn chưa hoàn tất lấy từ options chính thức; không cộng phí/lãi huy động vốn chưa xảy ra.
- Không gọi `roll`, `advance`, `fundPayment` hoặc RNG trong mô phỏng. Chỉ trả DTO chứa số liệu hiện tại; không trả seed, RNG, thị trường, log hay trạng thái tương lai cho UI.
- Session chỉ giữ DTO của quyết định vừa được chấp nhận; action dùng revision cũ bị từ chối. Hành động thật tiếp theo, session mới, restore/import hoặc home/resume bỏ DTO. DTO không vào save/replay.
- Session mặc định **OFF**. App chỉ opt-in trong `import.meta.env.DEV` bằng `?whatIf=1` hoặc fixture. Bản production bỏ fixture dynamic import và không thể bật bằng URL.
- Không đổi luật, engine transition, schema, action IDs, save slot hoặc replay lịch sử. Không sửa AI Companion/server hay tích hợp thanh toán Premium.

### Trường hợp chưa đủ tiền

Fixture `&cash=low` bắt đầu với 2 triệu tiền mặt và 48 triệu tiết kiệm hợp lệ. Chọn sửa tạm thật: còn 1 triệu, đã tạo nghĩa vụ 4 triệu. Nhánh sửa ngay: đã trả 2 triệu, tiền mặt 0, **còn thiếu 2 triệu**, chưa hoàn tất thanh toán. UI hiện điều kiện funding, không gọi nhánh đó “đã trả đủ”.

Fixture `&cash=funding` bắt đầu với 500 nghìn tiền mặt. Chọn sửa tạm thật đi vào funding; **không hiện nút What-if**. Sau khi vay trả phần thiếu, nút vẫn không hiện vì số liệu sau huy động vốn không còn là kết quả của một quyết định đơn lẻ từ snapshot gốc. Scope MVP này không mô phỏng chuỗi tài trợ vốn.

## 4. Files thay đổi

| File | Nội dung |
| --- | --- |
| `src/game/what-if.ts` | Mô phỏng hai nhánh, validation, DTO số liệu |
| `mobile_app/src/game/session.ts` | Capture quyết định, opt-in mặc định OFF, xóa dữ liệu cũ |
| `mobile_app/src/App.tsx` | CTA/modal, chặn action khi đang xem, tùy chọn không autosave cho fixture |
| `mobile_app/src/main.tsx` | Dynamic entry developer-only |
| `mobile_app/src/components/WhatIfModal.tsx` | Hai thẻ, bài học, giới hạn, nút quay về |
| `mobile_app/src/components/what-if.css` | Mobile layout, scroll, focus; override chỉ trong What-if đối với theme dialog cũ |
| `mobile_app/src/dev/repair-fixture.ts` | Natural first-turn repair bằng seed cố định và setup hợp lệ |
| `mobile_app/src/dev/WhatIfDemo.tsx` | Phiên demo riêng, restart, không đọc/ghi save thật |
| `mobile_app/src/dev/what-if-demo.css` | Thanh điều khiển developer |
| `tests/what-if.test.ts` | Truth, non-mutation, RNG, funding, stale session, default OFF, fixture validity |
| `scripts/diagnostics/what-if-browser.mjs` | Browser QA có thể chạy lại |
| `scripts/diagnostics/what-if-replays.ts` | 81 replay lịch sử và 6 fixture replay, không ghi đè evidence cũ |
| `docs/EXE_WHATIF_DEMO_REPORT.md` | Báo cáo này |
| `docs/EXE_WHATIF_VIDEO_WALKTHROUGH.md` | Hướng dẫn chạy/quay 60–90 giây |
| `docs/playtests/whatif-demo/2026-10-31/*` | Screenshots, kết quả và log QA mới |

## 5. Kiểm thử thực tế

| Kiểm tra | Kết quả |
| --- | --- |
| `npm test` | **740/740 PASS**, gồm 8 test What-if mới |
| Diagnostic/SSR `scripts/diagnostics/*.test.ts` | **90/90 PASS** |
| Browser What-if | **11/11 PASS**. Xem `browser-results.json`: cả hai lựa chọn ở 390/320; shortfall; financing; close/back/Escape/reopen; tiếp tục; reset/reload; real App save/home/resume/restart; Companion; 320×568; production OFF |
| Browser regression Companion hiện có | **18/18 PASS**: tabs, câu hỏi offline, invalidation, loading/unmount, feature OFF, onboarding, Map, keyboard focus; 320/375/390 |
| Historical replay | **81/81 PASS**, hash bytes khớp baseline evidence |
| Natural fixture replay | **6/6 PASS**, ba allocations × hai lựa chọn |
| Lint | PASS |
| Root TypeScript + production build | PASS |
| Mobile strict TypeScript + production build | PASS; Vite có cảnh báo chunk >500 kB, không phải build failure |
| State/RNG/save | Deep-frozen input và session state khớp engine control; browser save giữ nguyên khi mở/đóng; fixture không ghi đè sentinel save |
| Network | Không có request API/Gemini trong browser QA; tài nguyên ngoài localhost bị chặn trong test |

Lần diagnostic đầu gặp thiếu thư mục `node_modules/.tmp`; đã tạo thư mục và chạy lại đầy đủ PASS. Browser QA phát hiện legacy theme ép dialog thành flex row; đã sửa bằng CSS có scope riêng và kiểm lại layout. Nút xúc xắc có animation liên tục; browser test tap tọa độ thật sau khi kiểm enabled thay vì chờ bounding box đứng yên. Không thay gameplay để né lỗi.

Môi trường QA: Node 24.22.1, npm 11.9.0, Chromium 153 headless + Playwright, mobile viewport emulation/touch. Chromium được cài bên ngoài repo do bản browser mặc định không tải được trong môi trường này. Không đổi dependency/lockfile sản phẩm. **Chưa kiểm trên Safari/iOS/Android thiết bị thật.**

### Screenshots

Các ảnh top so sánh và ảnh cuộn cuối là hai vị trí của cùng một modal, không phải hai màn khác nhau.

| Nội dung | 390px | 320px |
| --- | --- | --- |
| Sự kiện / Companion hai tab | [390](playtests/whatif-demo/2026-10-31/390-full-01-event.png) | [320](playtests/whatif-demo/2026-10-31/320-full-01-event.png) |
| Actual sửa ngay / What-if sửa tạm | [390](playtests/whatif-demo/2026-10-31/390-full-03-comparison.png) | [320](playtests/whatif-demo/2026-10-31/320-full-03-comparison.png) |
| Actual sửa tạm / What-if sửa ngay | [390](playtests/whatif-demo/2026-10-31/390-temporary-03-comparison.png) | [320](playtests/whatif-demo/2026-10-31/320-temporary-03-comparison.png) |
| Bài học / giới hạn | [390](playtests/whatif-demo/2026-10-31/390-full-04-lesson.png) | [320](playtests/whatif-demo/2026-10-31/320-full-04-lesson.png) |
| Chơi tiếp | [390](playtests/whatif-demo/2026-10-31/390-full-05-continue.png) | [320](playtests/whatif-demo/2026-10-31/320-full-05-continue.png) |

Bổ sung: [Funding alternative](playtests/whatif-demo/2026-10-31/320-shortfall.png), [actual funding](playtests/whatif-demo/2026-10-31/390-actual-funding.png), [real App](playtests/whatif-demo/2026-10-31/390-real-app-whatif.png), [320×568](playtests/whatif-demo/2026-10-31/320x568-lesson.png).

## 6. Chạy local và chạy QA

Trong worktree:

```bash
npm ci
npm ci --prefix mobile_app
npm run dev --prefix mobile_app -- --host 127.0.0.1
```

- Demo chính: **http://127.0.0.1:5174/?whatIfDemo=repair&repairAi=1**
- Demo alternative thiếu tiền: http://127.0.0.1:5174/?whatIfDemo=repair&repairAi=1&cash=low
- Demo actual phải funding: http://127.0.0.1:5174/?whatIfDemo=repair&repairAi=1&cash=funding
- Companion universal + What-if: http://127.0.0.1:5174/?whatIfDemo=repair&universalAi=1
- Luồng App bình thường opt-in: http://127.0.0.1:5174/?whatIf=1&repairAi=1 (dùng save bình thường của App).

Đây là URL trên máy chạy Vite, không phải preview được deploy. Fixture dùng `createMultiCourseGame('whatif-demo-2', savings, 1) → advance → roll`: gặp sửa xe tự nhiên ở lượt 1, ô 4. Không tiêm event/state/RNG, không có kết quả mock. Refresh hoặc **Tái hiện sửa xe** tạo lại cùng pre-decision state. Trong fixture, nút Home/restart cũng tạo lại fixture, không về Map. Fixture không mount App save/restore và `GameExperience` nhận `persist={false}`.

Kiểm tra:

```bash
npm test
node -e "require('node:fs').mkdirSync('node_modules/.tmp',{recursive:true})"
node --experimental-strip-types --test scripts/diagnostics/*.test.ts
node scripts/diagnostics/what-if-replays.ts
npm run lint
npm run build
npm run build --prefix mobile_app
```

Browser script cần Playwright và Chromium cài ngoài dependency sản phẩm. Có thể cài vào một thư mục QA riêng; đặt `PLAYWRIGHT_MODULE` là đường dẫn tới package Playwright, `CHROMIUM_PATH` nếu dùng browser riêng, `CHROMIUM_ARGS` là JSON array nếu môi trường cần launch flags. Sau đó:

```bash
node scripts/diagnostics/what-if-browser.mjs
node scripts/diagnostics/repair-ai-browser.mjs
```

Script What-if tự chạy dev server cổng 5191 và production preview cổng 5192. Companion regression dùng cổng 5186. Các cổng phải trống; đây chỉ là local QA, không deploy. Các diagnostic hiện có có thể in cảnh báo HMR port 24678 khi chạy song song, nhưng assertions đều PASS.

## 7. Giới hạn và review

- Chỉ một sự kiện sửa xe B18 multi-course; chưa có full-game counterfactual hay so sánh các sự kiện khác.
- Review chỉ tồn tại ngay sau quyết định trả được bằng cash, trước action thật tiếp theo. Không phục hồi What-if sau reload/home/import; chủ ý không giữ dữ liệu ván cũ.
- Alternative chưa đủ cash chỉ mô phỏng khoản đã dùng và khoản thiếu; không tự chọn nguồn vốn. Actual qua funding không cung cấp What-if sau khi tài trợ vốn hoàn tất.
- Không có paywall, entitlement, thanh toán Premium, Gemini, production flag hoặc deployment.
- Chưa có QA thiết bị thật; font/emoji trong headless có thể khác máy quay. Cần Owner xem trực tiếp trên thiết bị quay.
- Baseline local đề xuất chưa có trên remote: trước khi đưa thay đổi vào checkout nhóm, Owner cần đối chiếu với `883b64b…` và Semantic P4 đã commit. Không tự merge.

Xem [kịch bản video](EXE_WHATIF_VIDEO_WALKTHROUGH.md). Dừng tại đây để Owner review implementation và evidence.
