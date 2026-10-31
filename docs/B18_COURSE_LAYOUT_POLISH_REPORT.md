# B18 — Bố cục chọn khóa học

Ngày 20/10/2026 · Chờ Owner review.

Nhánh `codex/b18-course-layout-polish`, tạo từ đúng `f96a8f6fdedaaa6151dfd108084a090b738a942f`. Commit source sau kiểm tra cuối: **`0c60f1c6516d686785bfea0981a8728f5cb7d3eb`** (gồm thay đổi layout ở `12ad3d0` và giữ vùng chạm nút chú giải). Không tạo PR, không merge hoặc thao tác phát hành.

## Thay đổi

Chỉ **hai file sản phẩm** được sửa:

| File | Thay đổi và lý do |
|---|---|
| `src/components/course-choices.css` | Một cột ở mọi chiều rộng, bỏ breakpoint viewport 600px. Modal hẹp trên desktop không còn chia hai card cạnh nhau. Tên và badge luôn xếp theo cùng cấu trúc. Label ở trên, giá trị nổi bật ở dưới; card tự cao theo nội dung, không fixed height. |
| `src/components/CourseChoices.tsx` | Thêm class `course-facts` cho hai chỉ số chính; ghi rõ “Lương tăng mỗi lần qua ô Xuất phát”; đổi summary thành “Xem thu nhập dự kiến”. Không đổi biểu thức tài chính, điều kiện disabled hoặc callback. |

Nút mua full width, tối thiểu 44px. Nút “Bỏ qua” trở lại luồng cuộn bình thường, không phủ accordion/card/nút mua. Cả modal là vùng cuộn duy nhất; không thêm vùng cuộn bên trong card. Thêm padding theo safe area, cho phép wrap khi tăng cỡ chữ; focus trong card dùng viền xanh đậm trên nền sáng. Giữ palette và style của các modal khác.

Thứ tự trong card: **tên + trạng thái → học phí → lương tăng → dự kiến thu nhập → nút mua**. Ghi chú tăng lương từ lần qua ô Xuất phát tiếp theo/học phí không hoàn lại và nút Bỏ qua vẫn sau hai card. Khi đã học cả hai, giữ màn xác nhận ngắn và nút Tiếp tục như trước.

`src/game/courses.ts`, engine, data/config, RNG, save/schema/replay và dependencies không đổi. Giá 6M/10M, tăng lương +2M/+4M, số kỳ còn lại, công thức dự kiến, action `course-basic`, `course-advanced`, `skip` và cách gọi `onChoose` giữ nguyên.

## QA

| Kiểm tra | Kết quả |
|---|---|
| Product tests | **351/351 PASS**, gồm thứ tự học, một giao dịch mỗi encounter, thiếu tiền, save/resume và replay. [Log](playtests/b18-course-layout/product-tests.txt) |
| SSR liên quan | **2/2 PASS**: multi-course UI và beginner UX. Bổ sung đã học cơ bản, chỉ đủ tiền một khóa và render không đổi state. Giữ kiểm tra đã học nâng cao/cả hai/legacy. [Log](playtests/b18-course-layout/ssr-tests.txt) |
| Lint / TypeScript | PASS; typecheck Mobile và shared. |
| Mobile production build | PASS, chỉ build cục bộ. [Log](playtests/b18-course-layout/build-mobile.txt) |
| Historical replay | **81/81 PASS**, danh sách cố định, không đổi golden. |
| Evidence lịch sử | **1.598 artifact** theo 7 manifest khớp raw SHA256; không ghi đè bằng chứng cũ. [JSON](playtests/b18-course-layout/compatibility.json) |
| UI thực | **30 tổ hợp** = 6 trạng thái × 5 viewport, **142 check sau sửa**, 0 finding layout/JavaScript page error. [Kết quả](playtests/b18-course-layout/after/results.json) |
| Giao dịch qua UI | **20 lần mua**: đúng action, số tiền trừ, mức tăng lương, thêm đúng một khóa và rời encounter. **10 lần bỏ qua/tiếp tục**: tiền và sở hữu không đổi. |
| Accordion / bàn phím | Mở và đóng cả hai phần dự kiến bằng Enter; xem thông tin không đổi byte save ở cả 30 tổ hợp. Focus nhìn rõ, nút mua/skip đi tới và click trial được. |
| Chữ lớn | Cỡ chữ tính toán tăng **200%** ở 320px và 1440px: không tràn ngang hoặc mất CTA, số tiền wrap trong card khi cần. Đây là phóng lớn chữ bằng CSS trong kiểm thử, không phải zoom native. |

Sáu trạng thái: chưa học và đủ tiền; thiếu tiền cho cả hai; chỉ đủ tiền khóa cơ bản; đã học cơ bản; đã học nâng cao; đã học cả hai. Các checkpoint là prefix replay hợp lệ từ nhật ký đã lưu, nhập bằng UI thật. [Provenance](playtests/b18-course-layout/checkpoints/provenance.json) ghi nguồn/seed/vòng/lượt; không sửa field save để tạo tình huống, không chạy nghiên cứu cân bằng mới.

Viewport: **320×740, 390×844, 430×932, 768×1024, 1440×900**. Tại 1440px, bài kiểm tra buộc modal vẫn hẹp **dưới 500px**; không dùng viewport rộng để che lỗi. Trước sửa có 32 lượt đo lỗi bố cục/tràn chữ (gồm lặp lại lúc mở accordion), sau sửa 0. Đây không phải 32 lỗi độc lập.

## Ảnh trước / sau

**27 ảnh trước + 27 ảnh sau**, gồm các trạng thái, accordion, card thứ hai và chữ lớn.

| Viewport — chưa học, đủ tiền | Trước | Sau |
|---|---|---|
| 320×740 | [Ảnh](playtests/b18-course-layout/before/320-available.png) | [Ảnh](playtests/b18-course-layout/after/320-available.png) |
| 390×844 | [Ảnh](playtests/b18-course-layout/before/390-available.png) | [Ảnh](playtests/b18-course-layout/after/390-available.png) |
| 430×932 | [Ảnh](playtests/b18-course-layout/before/430-available.png) | [Ảnh](playtests/b18-course-layout/after/430-available.png) |
| 768×1024 | [Ảnh](playtests/b18-course-layout/before/768-available.png) | [Ảnh](playtests/b18-course-layout/after/768-available.png) |
| 1440×900, modal hẹp | [Ảnh](playtests/b18-course-layout/before/1440-available.png) | [Ảnh](playtests/b18-course-layout/after/1440-available.png) |

Ảnh sau khác: [thiếu tiền](playtests/b18-course-layout/after/390-insufficient.png), [chỉ đủ một khóa](playtests/b18-course-layout/after/390-basic-only-affordable.png), [đã học cơ bản](playtests/b18-course-layout/after/390-basic-learned.png), [đã học nâng cao](playtests/b18-course-layout/after/390-advanced-learned.png), [đã học cả hai](playtests/b18-course-layout/after/390-both-learned.png), [accordion và focus](playtests/b18-course-layout/after/390-available-expanded.png), [card thứ hai](playtests/b18-course-layout/after/390-available-second-card.png), [chữ 200%](playtests/b18-course-layout/after/320-available-text-200.png). Ảnh tương ứng trước sửa có cùng tên trong `before/`.

Ảnh ở đầu modal nhỏ không chứa toàn bộ hai card; người chơi cuộn tự nhiên tới card thứ hai và Bỏ qua. Test kiểm tra CTA thực sự tới được, không coi ảnh đầu màn là toàn bộ nội dung.

## Tái lập / giới hạn

Script mới: `scripts/diagnostics/course-layout-checkpoints.ts`, `course-layout-browser.mjs`, `course-layout-compat.ts` và `scripts/verify-b18-course-layout-evidence.mjs`. Bằng chứng có `.gitattributes` giữ nguyên byte trên Windows và manifest SHA256.

```powershell
node --experimental-strip-types --test tests/*.test.ts
node --experimental-strip-types --test --test-concurrency=1 scripts/diagnostics/multi-course-ui.test.ts scripts/diagnostics/b18-ux-ui.test.ts
node node_modules/eslint/bin/eslint.js .
node node_modules/typescript/bin/tsc -p mobile_app/tsconfig.json
node node_modules/typescript/bin/tsc -b
node mobile_app/node_modules/vite/bin/vite.js build mobile_app
node --experimental-strip-types scripts/diagnostics/course-layout-checkpoints.ts
node --experimental-strip-types scripts/diagnostics/course-layout-compat.ts
# Chạy Mobile Vite ở http://127.0.0.1:5212 rồi:
node --experimental-strip-types scripts/diagnostics/course-layout-browser.mjs --after
node scripts/verify-b18-course-layout-evidence.mjs --check
```

Không chạy chế độ mặc định `before` trên source sau sửa để ghi đè ảnh gốc; tái lập baseline ở base SHA và output riêng. Browser script dùng Playwright/runtime cài sẵn, cho phép `PLAYWRIGHT_MODULE`, `BROWSER_PATH`, `COURSE_LAYOUT_URL`; không thêm dependency.

Kiểm tra lần này dùng Chromium 149.0.7827.55 với viewport/touch giả lập. **Chưa kiểm chứng iOS/Safari hoặc Android vật lý, safe-area phần cứng, screen reader và zoom native.** Console còn 404 favicon cục bộ đã có ở baseline; không phải lỗi JavaScript mới. Không thực hiện full release QA hoặc Human Playtest, không tuyên bố production-ready.

Chờ Owner review nhánh. Không merge, redeploy hoặc promote Production; không thao tác Vercel hoặc domain.
