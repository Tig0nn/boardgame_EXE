# PR #8 — Rà soát cuối, CI và Mobile Preview

Ngày kiểm tra: 13/10/2026. PR: https://github.com/Tig0nn/boardgame_EXE/pull/8.

**Kết luận: BLOCKED.** Các kiểm tra mã nguồn và CI đã qua; chưa có URL Vercel Mobile Preview hoạt động được xác minh. Chủ dự án cần hoàn tất Preview riêng và kiểm tra Mobile/API trước khi merge. Không có thao tác merge. Project Web production được giữ nguyên.

## 1. Phạm vi và Git

- Nhánh giữ nguyên: `feat/mobile-v2-4-engine-integration`.
- HEAD khi bắt đầu: `8e53aa52beb8b34b84f7e4aa5249fec470ea20bd`; local, remote và PR head khớp; working tree sạch.
- Base được đối chiếu: `main` tại `406d36ba6091f3fd651fd60d34cc73b79f6325cf`.
- Không làm lại tích hợp, không thay luật tài chính, artwork, nhân vật, xúc xắc, âm thanh hoặc replay đã hoàn tất. Không chạy lại mô phỏng 180.000 ván.
- Các thay đổi tập trung đã push: `0ff6611` thêm CI; `014c15b` sửa hai React trong bundle Mobile; `91e530c` sửa import TypeScript của Function sau biên dịch. Báo cáo và bằng chứng được lưu trong commit tài liệu tiếp theo.

## 2. GitHub Actions và kiểm tra local

Workflow `.github/workflows/pr-checks.yml` chạy khi PR nhắm `main`, một job `verify`, timeout 15 phút. Dùng Node 22, action v6 chốt theo SHA, quyền `contents: read`, checkout không giữ credential. Không dùng AI key hoặc secret triển khai; không bỏ qua lỗi.

Run tại code HEAD `91e530c9daa3c239ec1b8b0f853c39943d8a32f6`: **SUCCESS**.

[GitHub Actions run 38382349925](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38382349925), [job verify](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38382349925/job/115245619593). Đã đọc log job: Ubuntu 24.04, Node **22.23.3**, không bị cắt log.

| Bước bắt buộc | Kết quả thực tế |
| --- | --- |
| `npm ci` | Qua |
| `npm ci --prefix mobile_app` | Qua trên Linux |
| `npm test` | 186/186 qua, 0 lỗi |
| `node --experimental-strip-types --test scripts/diagnostics/*.test.ts` | 21/21 qua, 0 lỗi |
| `npm run lint` | Qua |
| `npm run build` | Qua |
| `npm run build --prefix mobile_app` | Qua |

Local Windows/Node 22.14.0 cũng qua hai clean install, lint, hai build và các test trên. Lần đầu `npm ci` Mobile gặp `EPERM` vì Vite giữ native binding; dừng đúng tiến trình của repository rồi cài lại thành công. Hai audit báo 0 vulnerability. Đã khôi phục Vite Mobile ở cổng 5174. Dependency gốc, manifest và lockfile Mobile giữ nguyên, gồm `three@0.183.2` và `@types/three@0.183.0`.

Run trước: [0ff6611 — 186 + 19 test](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38380190566), [014c15b — 186 + 20 test](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38381922787). Commit tài liệu tiếp theo sẽ kích hoạt một run mới; không gán kết quả của run cũ cho SHA mới chưa kiểm tra.

Notice duy nhất được đọc: `ubuntu-latest` dự kiến chuyển sang Ubuntu 26 từ 19/10/2026; không phải lỗi check. Workflow chạy checks, còn việc đặt `PR checks / verify` thành required check thuộc cấu hình bảo vệ nhánh của chủ repository.

## 3. Hai lỗi được xác nhận và sửa

### Bundle Mobile có hai React

Build thành công chưa đảm bảo app chạy. Trước sửa, phục vụ `mobile_app/dist` bằng Vite preview cho trang trắng, lỗi `Cannot read properties of null (reading 'useRef')`, bundle `index-DA6YqOjF.js`. Component chia sẻ từ root và renderer Mobile resolve hai package React riêng, dù cùng phiên bản 19.3.0.

Chỉ thêm `resolve: { dedupe: ['react', 'react-dom'] }` trong `mobile_app/vite.config.ts`, theo [Vite resolve.dedupe](https://vite.dev/config/shared-options.html#resolve-dedupe).

Test mới `scripts/diagnostics/mobile-build.test.ts` build thật trong bộ nhớ và kiểm tra module graph có đúng một React. Negative control bỏ dedupe trong cấu hình build trong bộ nhớ phát hiện hai package root và thất bại như kỳ vọng; không sửa file để chạy control. Sau sửa, test qua và bundle `index-DYThO3rs.js` hoạt động.

Browser local tại `http://127.0.0.1:5187/` xác minh title **Xoay Vòng Tiến Lui — Mobile App**, ba ảnh nền/bàn cờ tải được, nhân vật 3D hiển thị, setup → forecast → gieo xúc xắc → Ngân hàng. Gửi mới 10 triệu đưa tiền mặt từ 30 triệu xuống 20 triệu và trở về bàn chơi. Đây là kiểm tra bản build local, **không phải bằng chứng Vercel Mobile đã deploy**.

### Function AI Coach import file `.ts` không tồn tại

GET `/api/ai-coach` trên Web Preview ban đầu trả HTTP 500 `FUNCTION_INVOCATION_FAILED`. Runtime log xác nhận `ERR_MODULE_NOT_FOUND: /var/task/src/ai/server/handler.ts` từ `api/ai-coach.js`.

Chỉ bật `rewriteRelativeImportExtensions` trong root `tsconfig.json`. [Vercel Node runtime](https://vercel.com/docs/functions/runtimes/node-js) đọc cấu hình TypeScript ở root; [TypeScript](https://www.typescriptlang.org/tsconfig/rewriteRelativeImportExtensions.html) hỗ trợ đổi đuôi import tương đối khi emit.

Test mới `scripts/diagnostics/ai-coach-deployment.test.ts` transpile API cùng dependency thành ESM vào thư mục tạm, import JavaScript thực sự và xác nhận GET trả 405. Test thất bại đúng `ERR_MODULE_NOT_FOUND` trước sửa và qua sau sửa; không cần provider key.

Sau preview tự động của `91e530c`, HTTP thực tế đã xác minh: GET trả **405 JSON**; POST JSON `{}` trả **400 JSON** và fallback tiếng Việt. Không gọi nhà cung cấp AI. Không tuyên bố đã xác minh phản hồi AI thật hoặc endpoint trên Vercel Mobile.

## 4. Vercel hiện phục vụ ứng dụng nào

[Preview hiện có của PR](https://boardgame-exe-git-feat-mobile-v2-15692e-tris-projects-2888207c.vercel.app) phục vụ **root Web MVP**. Browser hiển thị trang “Phố nhỏ. Ước mơ lớn.”, footer “Web MVP · V2.2”; không phải Mobile minh họa.

CLI kiểm tra project `boardgame-exe` trong team `tris-projects-2888207c`: root `.`, preset Vite, Node 24.x, build `npm run build`, output `dist`. Đã kiểm tra lại sau tác vụ và giữ nguyên. Production hiện có: https://boardgame-exe.vercel.app. Không thay cấu hình, domain hoặc promote deployment của project này. File `.vercel/project.json` local vẫn liên kết project cũ `xoay-vong-tien-lui`, không bị thay.

Đã tạo riêng project **boardgame-exe-mobile-preview**, ID `prj_mNqBP0UOsodb1WifpfNuFfKLmUpG`, cùng team. Chưa nối Git; chưa cấu hình khóa AI. Cấu hình đã tạo:

| Cấu hình Mobile riêng | Giá trị |
| --- | --- |
| Root Directory | Repository root `.`; không đặt `mobile_app` |
| Framework | Vite |
| Install | `npm ci && npm ci --prefix mobile_app` |
| Build | `npm run build --prefix mobile_app` |
| Output | `mobile_app/dist` |
| Node lúc tạo | 24.x mặc định; CI đã xác minh 22.x |

Cách build từ repository root phù hợp với source import ngoài Mobile (`../src/game`, component chung): cả hai lockfile được cài, lệnh prefix build tại Mobile, output đúng `mobile_app/dist`. Điều này đã qua clean Linux CI và local, gồm kiểm tra runtime sau sửa React. Dùng [project root ở Vercel](https://vercel.com/docs/builds/configure-a-build) cũng giữ được root `api/ai-coach.ts`. Không thêm `vercel.json` chuyển output chung của repository vì sẽ ảnh hưởng project Web.

**Lần thử hosting không thành công:** upload đầu 238,6 MB gặp lỗi mạng; lần thử tiếp dùng bộ lọc chỉ ở thư mục snapshot tạm. Bộ lọc `public/` loại nhầm cả `mobile_app/public`, làm build lỗi thiếu `/model-viewer.min.js`. Đây là lỗi đóng gói thử, không phải asset thiếu trong Git. Lệnh đã chỉ rõ `--target preview`, nhưng Vercel CLI 62.7.0 báo deployment đầu tiên là **production**. Đã kiểm tra trạng thái **ERROR** và xóa chính deployment `dpl_6wNznVNQQNnwoZ78ieD44kUNwfcL`; API sau đó trả danh sách deployment Mobile rỗng. Không có Mobile deployment hoạt động; URL lần thử đã thu hồi không được dùng làm preview. Không tiếp tục deploy khi target không bảo đảm.

Automatic approval review từ chối `vercel pull --environment=preview` vì có thể tải secret về thư mục tạm. Không thử lại bằng cách khác, không tải hoặc đọc khóa AI. MCP Vercel bị 403 với scope này; CLI có quyền đọc/tạo project riêng, nên không kết luận chủ tài khoản thiếu mọi quyền Vercel.

## 5. Hướng dẫn chủ dự án hoàn tất Preview an toàn

1. Mở dashboard team `tris-projects-2888207c`, chọn **boardgame-exe-mobile-preview**. Không chọn `boardgame-exe` hay `xoay-vong-tien-lui` để đổi build settings.
2. Trong Settings → Build and Deployment, kiểm tra root `.`, install/build/output đúng bảng trên; có thể chọn Node 22.x để khớp CI. Giữ toàn bộ `mobile_app/public`, đặc biệt `/model-viewer.min.js`, `/assets/character.glb`, `/assets/playboard.PNG`, nền và section. Nếu dùng upload lọc file, phải neo `/docs/`, `/tests/`, `/scripts/`, `/public/` ở root; không dùng `public/` không neo. Git deployment đầy đủ không cần bộ lọc thử này.
3. Trong Settings → Git, kết nối repository **Tig0nn/boardgame_EXE** với project Mobile riêng; đặt Production Branch là `main`. Nếu luồng kết nối bắt buộc tạo production deployment, dừng bước đó. Chỉ tạo deployment từ nhánh `feat/mobile-v2-4-engine-integration` khi giao diện xác nhận **Environment: Preview**. Không dùng `--prod`, promote hoặc đổi domain Web. Nếu Vercel vẫn ép deployment đầu tiên thành Production, cần chủ dự án/Vercel hỗ trợ làm rõ cơ chế trước khi tiếp tục; không lặp lệnh CLI đã bị phân loại sai.
4. Kiểm tra deployment có target **Preview**, trạng thái **Ready**, commit đúng HEAD của PR, build log chạy hai `npm ci`, Mobile build, output `mobile_app/dist`. Lưu URL thực tế vào báo cáo. Giữ Deployment Protection; đăng nhập bằng quyền được cấp khi cần, không tắt bảo vệ để thử.
5. Mở URL: phải có title Mobile, bàn cờ minh họa, nhân vật 3D, setup/forecast/dice/event và giao dịch Ngân hàng. Kiểm tra các asset ở bước 2 trả 200, đúng chữ hoa/thường trên Linux. Footer Web MVP hoặc trang root Web nghĩa là chọn sai project/output.
6. Kiểm tra `/api/ai-coach` cùng origin Mobile: GET phải trả 405 JSON; POST `{}` phải trả 400 JSON. Sau một ván thật, payload hợp lệ khi chưa có key phải nhận fallback 503, không làm mất kết quả/chặn chơi lại. Nếu route trả HTML/404/500, kiểm tra Function root `api/ai-coach.ts` và log build/runtime; không coi Vite proxy development là backend production.
7. Nếu cần AI thật, chủ dự án tự đặt **GEMINI_API_KEY** trong Environment Variables của project Mobile, chỉ môi trường **Preview**; `GEMINI_MODEL` tùy chọn. Không sao chép khóa vào source, `VITE_*`, frontend hoặc báo cáo. Sau khi cấu hình, tạo Preview mới và kiểm tra phản hồi được grounding; thành công provider vẫn chưa được xác minh trong tác vụ này.

## 6. Rà soát tài chính, replay, tài sản và bảo mật

- Diff với main rỗng đối với `src/data/config.ts` và các module transactions, settlement, business, savings, selectors, customer-preferences, modes. Những thay đổi engine trước đó chỉ thêm metadata catalog/khởi tạo; không đổi công thức hay chuỗi draw thị trường.
- Mobile session dispatch trực tiếp `advance`, `roll`, `decide`, `transact`, `fundPayment` từ engine; dùng snapshot revision chống stale action. Không tạo engine tài chính riêng cho Mobile.
- Replay lịch sử giữ catalog fictional khi thiếu version, không đổi ID holdings cũ. Suite đã qua cả log lịch sử V2.3 và snapshot/full game V2.4.
- Fix rapid trade taps `7fb3ac2` nằm trong ancestry; bằng chứng gốc `docs/playtests/mobile-v2-4/browser-verification.json` có `tradingUnlockAfterRejectedTap: true`. Giữ nguyên bằng chứng funding/double tap/replay; không tuyên bố đã chạy lại toàn bộ browser playtest trong review này.
- Diff artwork/assets Mobile, `BoardView`, `Character3D` và audio so với `b410b20` rỗng. Không thay tranh, model, xúc xắc hay âm thanh trong final review.
- Kiểm tra pattern key/token/private key trong source/frontend/API/scripts/tests không phát hiện secret thực; `.env` bị ignore, chỉ `.env.example` được track. Không thêm AI key vào CI hoặc frontend. Không coi pattern scan là chứng minh tuyệt đối toàn lịch sử Git không có secret.
- Giữ các dependency fixes gốc; Linux `npm ci` và build đã chứng minh khả năng cài mới, bổ sung giới hạn còn mở trong báo cáo tích hợp cũ.

## 7. Mô phỏng và vấn đề không chặn

Giữ nguyên [báo cáo tích hợp](MOBILE_V2_4_FINANCIAL_INTEGRATION_REPORT.md) và `docs/simulations/v2_4-savings-lot-comparison.json`: **180.000 ván**, 10.000 paired seeds × 3 strategy × 3 allocation × 2 policy, **257,829 giây**, 9/9 tổ hợp giữ cùng đường dice. Không rerun hoặc thay kết quả.

Ví dụ actual Reserve/20M: A − B tăng lawful proceeds trung bình **2,718 triệu**, tăng thắng **8,90 điểm phần trăm**. Aggressive/40M: A giảm thắng **7,72 điểm phần trăm**, giảm proceeds **1,755 triệu**. Insolvent 0% trong các heuristic này không chứng minh mọi cách chơi đều an toàn. Khoảng tin cậy paired-normal mang tính mô tả, không điều chỉnh multiple comparisons; compact log simulation không thay replay đầy đủ. **Giữ Policy A đã duyệt**, không đưa hạn chế Policy B vào production.

Vấn đề không chặn riêng phần code: các icon chưa đúng nghĩa đã ghi trong báo cáo artwork; chưa thử iOS/Android vật lý, WebGL/audio/touch thực tế và provider AI thật; rate limiter hiện theo bộ nhớ từng process, không phải quota chung toàn hệ thống. Không mở rộng review thành đợt thiết kế hoặc hardening mới.

## 8. Chạy Mobile và bàn giao

Từ repository root:

```powershell
npm ci
npm ci --prefix mobile_app
npm run dev --prefix mobile_app
```

Mở `http://localhost:5174/` hoặc URL Vite in ra. Dừng Vite trước khi clean install trên Windows nếu gặp file native đang được sử dụng. Development AI cần terminal root chạy `npm run dev` ở 5173; proxy Mobile trỏ `/api` tới đó. Khóa provider chỉ ở backend; thiếu AI không chặn gameplay.

Kiểm tra bản build tĩnh:

```powershell
npm run build --prefix mobile_app
npm run preview --prefix mobile_app
```

Vite preview chỉ phục vụ frontend tĩnh, không tự chạy Function API. Browser runner đầy đủ có sẵn `scripts/verify-mobile-engine.mjs`, có thể dùng `UI_URL` trỏ server build và module Playwright đã cài khi cần kiểm chứng thêm.

Bằng chứng review mới: `docs/playtests/pr8-final/verification.json`. Các file thay đổi mới chỉ gồm workflow, hai cấu hình compiler/bundler, hai regression test, báo cáo này và JSON bằng chứng. Không commit thư mục snapshot tạm, `.vercel`, `.env`, dependency cài sẵn hoặc `dist`; thư mục upload tạm đã được dọn.

**BLOCKED — chưa an toàn để chốt merge theo yêu cầu review này cho đến khi Mobile Preview riêng được xác minh cùng route API.** Phần code/CI đã qua; không còn lỗi công thức tài chính hoặc artwork được xác nhận trong phạm vi rà soát. Không tự merge hoặc phát hành production.
