# B18 Multi-Course — báo cáo triển khai candidate

Ngày kiểm chứng: 16/10/2026. Mục tiêu giáo dục: **Phân bổ tài chính và quản lý rủi ro**.

## Nhánh và nguồn

- Candidate: `codex/mvp-b18-multi-course`.
- Commit engine: `e1ab5f0`; commit gameplay/UI được kiểm chứng: **`db33c9cc8fafd911156aa51a2a66ec41c378cd21`**. Báo cáo, script và evidence được bàn giao bằng commit tiếp theo trên cùng nhánh.
- Base production: `00e77a19691c109e8cb7079b83591463c3eb6136`; remote HEAD đã fetch và xác nhận không có thay đổi mới hơn.
- Nghiên cứu được duyệt: `a44686e988540fdee04498d547b0703c221e7b24`, frozen `I2-choice__L3-bonds`. Không merge nhánh research; chỉ đưa curriculum, board revision và fixture cần thiết vào candidate.
- Không sửa dữ liệu/replay lịch sử, không chạy lại 167.972 ván. Nhánh nguồn và checkout lồng sẵn có của người dùng được bảo toàn.

## Gameplay và tương thích

| Nội dung | Candidate mới | Ván B18 một khóa đã lưu |
|---|---|---|
| Gameplay profile | `core-mvp-b18-multi-course-v1` | `core-mvp-b18-v1` |
| Curriculum | `b18-i2-choice-v1` | Một khóa 8M / +4M |
| Board revision | `b18-l3-bonds-v1` | `b18-core-v1` |
| Export schema | 7 | 6 |
| Khóa học | Cơ bản **6M / +2M**, nâng cao **10M / +4M** mỗi START | Giữ nguyên |
| Ô 16 | Trái phiếu | Đầu tư bản thân |

Hai khóa độc lập, mua theo bất kỳ thứ tự nào, mỗi khóa một lần. `ownedCourses` lưu riêng `basic`/`advanced` trong state và mọi snapshot; `coursePurchased` vẫn là cờ “đã học ít nhất một khóa” để giữ cách hạch toán tương ứng với simulator. UI mới dùng sở hữu riêng, không dùng cờ này để kết luận đã học đủ.

Engine kiểm tra đúng phase, vị trí ô khóa học, tiền mặt và quyền encounter trước khi thu phí. Mỗi lần ghé tối đa một lần mua thành công; lỗi không đổi state. Lần ghé tiếp theo, kể cả cùng vòng, mua được khóa còn lại. Không mở funding/vay mới cho học phí tự nguyện, không mua tại START/ô khác, luôn có Bỏ qua. Học cả hai trả đúng 16M, lương thành 20M; settlement trả mức lương mới từ START kế tiếp, không sửa các kỳ đã trả và không hoàn học phí.

Bàn mới giữ 18 ô/4 START, đúng ba ô khóa học **5/8/13** và ba ô Trái phiếu **3/10/16**. Chỉ ô 16 đổi loại. Desktop/Mobile dùng board theo profile; ván cũ không bị thay bàn. Vốn 50M, lương nền 14M, sinh hoạt 5M, mục tiêu huy động hợp lệ 90M và toàn bộ cơ chế tài sản, phí/spread, credit, Business, personal/macro/funding giữ nguyên. Không đặt mức dự phòng bắt buộc.

Factory lịch sử `createCoreMvpGame`/`createPlayerGame` vẫn giữ luật cũ; entry point người chơi mới gọi `createMultiCourseGame`. Import/save/replay kiểm tra schema/profile/curriculum/board, sở hữu hợp lệ, không trùng và lương tương ứng. Ván C20 và schema4/5/6 tiếp tục theo phiên bản của mình, không suy đoán luật từ field mới hoặc tự migrate.

## UI đã cập nhật

Desktop/Mobile dùng chung `CourseChoices`: tên, phí, mức tăng lương, trạng thái Chưa học/Đã học/Không đủ tiền, số START còn lại, thu nhập danh nghĩa và chênh lệch so với học phí. Phép tính chỉ xét START còn lại nếu ván tới đủ những mốc đó, chưa cộng lương đã nhận, chưa tính chi phí cơ hội/bất ngờ; không trình bày là lợi nhuận bảo đảm hay tự chọn khóa tốt hơn. Cả hai hoàn thành thì chỉ hiện thông tin ngắn và Tiếp tục. Sổ tay, tutorial, board và dữ kiện course gửi AI Coach đã cập nhật đúng curriculum mới.

Đã sửa tương phản card trên nền Mobile tối sau khi xem ảnh thực tế; modal Desktop rộng hơn để hạn chế ngắt dòng. Mobile cho cuộn nội dung và giữ nút Bỏ qua dễ tiếp cận.

## Kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| Regression `npm test` | **334/334** pass; thêm 11 test mới về curriculum/version, thứ tự học, quyền encounter, thiếu cash/thử lại, thời điểm lương, học muộn, wrap18, save và replay |
| SSR UI cũ + mới | **2/2** pass; card dùng chung, trạng thái thiếu tiền/một/đủ khóa, board cũ/mới |
| Lint | Pass |
| Build Desktop + Mobile | Cả hai pass |
| Replay toàn bộ log tự nhiên | **68/68** pass: 49 lịch sử + 13 chuyển từ frozen research + 4 ván UI đầy đủ + 2 luồng UI thiếu tiền |
| Frozen research parity | **13/13** ván, **492** hành động, **2.306** snapshot before/after khớp |
| Browser thực tế | 3 ván Mobile + 1 Desktop đầy đủ; 3 luồng thiếu tiền; reload giữa hai lần học và sau kết thúc; không ép state |
| Responsive/tương tác | 320px, 390px, Desktop1440px; 59 kiểm tra layout Mobile, 7 Desktop, 14 sổ tay/bàn; không tràn ngang hoặc lỗi JavaScript |

Một fixture DEV lịch sử có nhảy trực tiếp vị trí/lượt được tiếp tục loại khỏi replay tự nhiên, ghi hash/lý do trong `replay-verification.json`; không chỉnh fixture đó. Hai SSR test chạy tuần tự để tránh tranh cổng WebSocket của test harness.

### Đối chiếu nghiên cứu

Nguồn nguyên byte và SHA256 nằm trong [research-parity.json](playtests/core-mvp-b18-multi-course/research-parity.json), bản sao fixture trong `research-source/`. Mẫu lấy từ screening **1**, shortlist **6**, holdout **6**; có đủ chỉ cơ bản, chỉ nâng cao và cả hai thứ tự. Đây là kiểm tra tương đương hành vi, không phải chạy lại hoặc tinh chỉnh holdout.

So sánh từng snapshot tài chính của mọi log, action/financial effects, sở hữu ánh xạ, học phí, tăng lương, số START thực trả sau mua, summaries và toàn bộ state cuối ngoài log đã ánh xạ. **Market, credit, cả RNG, phí, proceeds và thắng/thua đều bằng nhau.** Không có sai khác economics cần sửa simulator.

Các sai khác có chủ đích được liệt kê đầy đủ trong JSON: metadata gameplay/curriculum/board mới; sở hữu explicit thay vì suy ra từ log research; `research-course-c1/c2` đổi thành `course-basic/advanced`; mô tả khóa học bằng tiếng Việt và schema7 thay research wrapper. Chỉ các trường định danh/biểu diễn đó được ánh xạ; so sánh JSON chuẩn hóa `-0` thành `0`. Narrative ngoài course giữ nguyên.

### Ván UI thực tế

| Thiết bị/luồng | Khóa đầu / khóa sau | Thời điểm | Huy động cuối | Kết quả |
|---|---|---|---:|---|
| Mobile390 | Nâng cao / cơ bản | Lượt2 /5, cùng vòng1; reload giữa hai lần | 94.000.000đ | Thắng |
| Mobile320 | Cơ bản / nâng cao | Lượt2 /5, cùng vòng1; reload giữa hai lần | 94.000.000đ | Thắng |
| Desktop1440 | Cơ bản / nâng cao | Lượt2 /5, cùng vòng1 | 94.000.000đ | Thắng |
| Mobile390, có giao dịch tài sản | Cơ bản / nâng cao | Vòng2 /3 | 84.635.118đ | Thua |

Ba luồng thiếu cash dùng phân bổ đầu ván 50M tiết kiệm/0 cash; cả hai nút mua bị khóa, Bỏ qua tiếp tục, không vay/funding để mua course. Script browser và JSON kết quả lưu cùng evidence. Những ván này không dùng để suy rộng tỷ lệ thắng hay kết luận người chơi đã học được kiến thức.

## Screenshots và evidence

| Trạng thái | Mobile320 | Mobile390 | Desktop |
|---|---|---|---|
| Chưa học | [Ảnh](playtests/core-mvp-b18-multi-course/320-basic-first-course-unlearned.png) | [Ảnh](playtests/core-mvp-b18-multi-course/390-advanced-first-course-unlearned.png) | [Ảnh](playtests/core-mvp-b18-multi-course/desktop-course-unlearned.png) |
| Một khóa | [Ảnh](playtests/core-mvp-b18-multi-course/320-basic-first-course-one.png) | [Ảnh](playtests/core-mvp-b18-multi-course/390-advanced-first-course-one.png) | [Ảnh](playtests/core-mvp-b18-multi-course/desktop-course-one.png) |
| Đủ hai khóa | [Ảnh](playtests/core-mvp-b18-multi-course/320-basic-first-course-both.png) | [Ảnh](playtests/core-mvp-b18-multi-course/390-advanced-first-course-both.png) | [Ảnh](playtests/core-mvp-b18-multi-course/desktop-course-both.png) |
| Không đủ cash | [Ảnh](playtests/core-mvp-b18-multi-course/320-course-insufficient.png) | [Ảnh](playtests/core-mvp-b18-multi-course/390-course-insufficient.png) | [Ảnh](playtests/core-mvp-b18-multi-course/desktop-course-insufficient.png) |

Các ảnh board, START, kết quả, sổ tay; replay JSON gzip; log test/lint/build và manifest SHA256 nằm trong [thư mục evidence](playtests/core-mvp-b18-multi-course/manifest.json). Evidence được hash nguyên byte và giữ nguyên line ending qua checkout Windows; source code được hash sau chuẩn hóa LF. [Browser Mobile](playtests/core-mvp-b18-multi-course/browser-verification.json), [Desktop](playtests/core-mvp-b18-multi-course/desktop-browser-verification.json), [sổ tay/bàn](playtests/core-mvp-b18-multi-course/rulebook-browser-verification.json), [replay](playtests/core-mvp-b18-multi-course/replay-verification.json).

## Tái lập và chạy local

Tại repo đã cài dependency của root và `mobile_app`, dùng Node22+:

```powershell
npm test
npm run lint
npm run build
npm --prefix mobile_app run build
node --experimental-strip-types --test --test-concurrency=1 scripts/diagnostics/core-mvp-b18-ui.test.ts scripts/diagnostics/multi-course-ui.test.ts
node --experimental-strip-types scripts/verify-multi-course-parity.ts
node --experimental-strip-types scripts/diagnostics/verify-multi-course-replays.ts
node scripts/manifest-multi-course.mjs --check
```

Parity mặc định kiểm tra fixture đã lưu với bytes tại commit research; `--write` tái tạo evidence mới trong thư mục riêng, không viết archive cũ. Clone cần có commit research (fetch `codex/mvp-b18-course-balance-lab` nếu thiếu).

```powershell
# Hai terminal riêng:
npm run dev -- --host 127.0.0.1 --port 5181 --strictPort
npm --prefix mobile_app run dev -- --host 127.0.0.1 --port 5180 --strictPort
```

Mở Desktop `http://127.0.0.1:5181`, Mobile `http://127.0.0.1:5180`. Chọn **ván mới** để dùng curriculum mới; Tiếp tục ván đã lưu cố ý giữ profile cũ. Seed `TRADING-AB-MAIN-0`, cash50M/savings0, cho hai encounter khóa học tại lượt2/5 cùng vòng1.

Browser scripts dùng Playwright và Chromium có sẵn, không thêm dependency production. Đặt `PLAYWRIGHT_MODULE` tới `playwright/index.mjs`, `BROWSER_PATH` tới Chromium nếu runtime không tìm thấy; `B18_URL`/`B18_DESKTOP_URL` mặc định có thể được chỉ định theo hai URL trên. Chạy `node scripts/diagnostics/multi-course-browser.mjs`, thêm `--rules` để kiểm tra sáu tab/bàn; `node scripts/diagnostics/multi-course-desktop-browser.mjs` cho Desktop. Browser chỉ thao tác UI, export/import/save theo engine; không inject state.

## Giới hạn và điểm dừng

Đã kiểm chứng kỹ thuật trên Chromium headless ở viewport Mobile/Desktop; chưa thử thiết bị thật, Safari/iOS, screen reader hoặc human playtest. Import xác nhận cấu trúc/phiên bản, không chứng minh save chống gian lận. Thu nhập danh nghĩa có thể không nhận đủ nếu ván mất khả năng thanh toán. Heuristic research và UI automation không chứng minh người chơi đã hiểu phân bổ/rủi ro.

**Candidate để Owner review. Không merge, không deploy Vercel, không Human Playtest, không chạy Final QA hoặc tuyên bố production-ready.**
