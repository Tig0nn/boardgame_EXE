# EXE AI Companion — Release Readiness Patch 1

2026-11-05 · workspace `EXE-companion-beta` · branch `feat/b18-ai-companion-public-beta` · base `e4045125684a9fd3da30a911fd91cb6687c5c586`.

**Hai vấn đề readiness đã được xử lý để Owner duyệt lại manifest. HOLD trước GitHub/Hosted Preview vẫn giữ nguyên.** Không tạo project/repository, không stage/commit/push/merge/deploy, không thay Production. Nội dung 39 câu đã ACCEPT giữ nguyên.

## Package hiện hành

- **[Manifest Patch 1](qa/release-readiness-patch1/release-manifest.json)** và [SHA-256](qa/release-readiness-patch1/release-manifest.sha256).
- **[157 file đề nghị commit](qa/release-readiness-patch1/commit-files.txt)**, [exclusions cụ thể](qa/release-readiness-patch1/exclusions.json), [audit đủ 594 candidates](qa/release-readiness-patch1/candidate-audit.json).
- [QA summary đã lọc đường dẫn riêng tư](qa/release-readiness-patch1/sanitized-qa-summary.json), [source hashes](qa/release-readiness-patch1/source-files.json), [preservation](qa/release-readiness-patch1/preservation.json).
- [Release README cập nhật](../release/beta/README.md). Proposal cũ dưới `closed-beta-release` là lịch sử local, không còn là danh sách cần publish.

Source diff cập nhật được giữ local tại `docs/qa/release-readiness-patch1/source.diff`; không đưa thêm một bản sao source lớn vào GitHub. Khi commit được phê duyệt, Git diff cùng source hashes là nguồn review chính.

## 1. Build gate: project ID, không dùng project name

`release/beta/build-policy.ts` nay đối chiếu:

| Giá trị | Nguồn / trạng thái |
| --- | --- |
| `VERCEL_PROJECT_ID` | Actual ID do Vercel cấp; chưa có project thật trong nhiệm vụ này |
| `EXE_AI_BETA_EXPECTED_PROJECT_ID` | Expected ID do Owner phê duyệt độc lập; **chưa cấu hình** |
| `EXE_AI_BETA_PREVIEW=1` | Approval flag riêng, vẫn bắt buộc |
| `VERCEL_ENV=preview` | Environment bắt buộc; Production luôn bị từ chối |

Khi `VERCEL=1`, thiếu actual ID, thiếu expected ID, ID rỗng/có khoảng trắng thừa hoặc mismatch đều **REFUSE**. Project name không thể thay thế ID hoặc vượt gate. Không lấy `expected=actual` tự động, không đặt ID giả cho project chưa tồn tại và không ghi concrete ID vào source/manifest. Các ID trong unit tests là chuỗi synthetic được đánh dấu rõ, không phải cấu hình deployment.

Sau một phê duyệt riêng cho việc tạo project Beta, Owner kiểm tra exact ID trong project settings, phê duyệt giá trị đó rồi set expected ID làm biến **build-only, Preview-scoped** trên project Beta. Không dùng tiền tố `VITE_`, không đưa ID vào query/client config, không dùng shared Production env. Expected ID là identifier không phải password, nhưng là cấu hình cần kiểm soát quyền sửa. Để unset thì hosted build tiếp tục fail closed.

Client gate không đổi: query `?aiBeta=1` không vượt Production gate. Vite optimization vẫn `production`; local QA dùng target Preview và approval flag trong process local, không cấu hình hoặc giả mạo ID dịch vụ. Config chỉ define hai cờ client, `envPrefix=[]`, dotenv OFF; actual/expected project IDs không đưa vào client bundle hoặc build-info JSON.

Unit tests đã chạy **RED: 3 FAIL / 2 PASS** trên implementation cũ, rồi **GREEN: 11/11 PASS** khi gồm cả bộ gate trước đó. Đã cập nhật assertion cũ để dùng ID match thay vì name match. Không sửa P4, canonical validators hay Semantic core.

## 2. Audit 594 candidates, gồm 424 docs

Đã đọc/scan toàn bộ text có định dạng tương ứng, gồm UTF-8 và UTF-16; ghi SHA-256, size, disposition và lý do cho từng file. Không in giá trị secret/PII trong audit.

| Phát hiện | Xử lý |
| --- | --- |
| Không phát hiện mẫu private key/provider/GitHub/AWS token, credential assignment hoặc credential URL | Kết luận theo phạm vi quét; không phải bảo đảm tuyệt đối/pentest độc lập. |
| **54 file** có đường dẫn profile máy local, chủ yếu reports/logs/patches/scripts QA cũ | Tất cả bị loại khỏi proposal, vẫn giữ nguyên local. Con số cuối bao gồm logs UTF-16. |
| **41 nhóm** có nội dung trùng SHA-256 | Loại các bản sao lịch sử; dùng evidence hiện hành. |
| **219 screenshots** lịch sử | Kiểm tra PNG metadata và xem 19 contact sheets: chủ yếu gameplay/AI/test controls, không thấy UI tài khoản/credential rõ ràng. Đây là visual triage, không phải OCR/PII certification. Cả 219 ảnh đều giữ local, không publish. |
| Full save/export và sample Owner như `owner-example-game.json`/`owner-example.json` | Không cần để tái chạy product; giữ local, không đưa vào GitHub. |
| Chín file trên 500 KiB trong tập cũ, gồm checkpoints, full save và source patches | Tất cả local-only; không cần để build/test hoặc review Git diff. |
| Raw logs, intermediate failures, full checkpoints và source diff lặp | Giữ local; publish summary hiện hành và hashes để đối chiếu. |
| `docs/qa/educational-answers-v3.zip` | Tiếp tục loại; không mở/publish transfer archive và không xóa nó. |

Ảnh đề nghị publish chỉ gồm bốn ảnh compiled Preview mới; đã xem ở độ phân giải riêng, chỉ có dữ kiện trò chơi synthetic. Không phát hiện dữ liệu tài khoản, email hoặc credential trong tập source/test/data đề nghị publish. Không tự coi việc scan không thấy secret là bằng chứng an toàn ở mọi dạng encoding/image.

## 3. Proposal tối thiểu có thể review và tái chạy

**594 → 157 file; docs 424 → 18 file.** Giữ 135 file từ proposal cũ và thêm 22 file Patch 1; 459 file cũ chuyển local-only, không xóa. Dung lượng từ khoảng **33,1 MB** xuống khoảng **3,2 MB**, xem số byte chính xác trong manifest.

157 file gồm **139 source/build/test/tool files** và **18 docs/evidence files**. Không restage các file đã có ở base commit. Giữ đủ runtime Beta và regression, không tùy tiện prune các presentation/context modules cũ mà tests/exports còn dùng.

Năm JSON dưới docs được giữ vì tests hoặc accepted-output check đang đọc trực tiếp: educational V3 BEFORE; polish BEFORE và owner-review; final-two BEFORE và AFTER. Chúng chứa projected canonical facts/answers và verdict lịch sử cho test, không phải full engine save, RNG export hay dữ liệu người dùng thật. `PENDING`/verdict cũ trong fixture là baseline lịch sử, không thay quyết định Owner đã ACCEPT 39/39. Replay inventory mới chỉ chứa 139 relative paths và hash, dùng dấu `/` để portable; không đổi log hay replay engine.

Đã kiểm tra closure theo hai cách:

1. Rerun **1.044 product tests** với preload guard từ chối đọc bất kỳ `docs/qa` input bị loại khỏi proposal: **PASS**. Guard là kiểm tra dependency test data, không phải sandbox bảo mật.
2. Kiểm tra các relative source dependencies: không có uncommitted dependency bị thiếu khỏi proposal; các tracked baseline dependencies vẫn ở commit base.

`--verify-proposal` trong audit tool kiểm tra file/hashes của package tối thiểu mà không cần local archive. Full historical audit cần evidence local đã cố ý loại; build và product tests không cần các archive đó. Repo vẫn cần cài dependencies từ lockfiles và có Playwright/Chromium phù hợp nếu chạy browser QA.

## 4. QA cuối

| Kiểm tra | Kết quả |
| --- | --- |
| Product, P4/P5, session/draft safety | **PASS 1.044/1.044**, Node |
| Product rerun với proposal-input guard | **PASS 1.044/1.044** |
| Diagnostics | **PASS 85/85** |
| Historical replays | **PASS 139/139**, giữ nguyên hashes log; inventory path được chuẩn hóa và replay lại |
| Lint, root/mobile typecheck, root/mobile builds | **PASS**; cảnh báo chunk lớn Mobile có sẵn |
| Strict release-config typecheck | **PASS** |
| Compiled Preview ON / Mobile Production OFF | **PASS 4 cases**: hai câu cuối × 320/390, trả lời offline sau khi game tải, query attack ở Production không bật AI, save/origin isolation và pending question discard |
| Browser session safety | **PASS 13 records**: main app Settings restart + 12 pending restart/import/resume qua QA component host |
| 39 accepted outputs | **Deep equality PASS**, source presenter/catalog không đổi |
| npm audit root/mobile | **UNVERIFIED**: đã rerun, registry endpoint vẫn không truy cập được; không ghi PASS/vulnerability-free |
| Hosted/project-ID thực tế/thiết bị vật lý | **NOT RUN**, chưa được tạo/deploy |

[Summary hiện hành](qa/release-readiness-patch1/sanitized-qa-summary.json) ghi các lệnh tương đối, exit codes và hashes raw logs local; không publish stack traces/profile paths. Browser QA dùng game checkpoints qua engine/save loader thật, không thay context bằng canned answer. Import/resume pending dùng component host với GameExperience/GameSetup thật; chưa chứng minh toàn bộ navigation import trên app chính hay hosted origin. Google Fonts bị chặn trong bài test offline; deterministic AI không phụ thuộc provider hoặc font đó.

Ảnh: [personal 320](qa/release-readiness-patch1/preview-personal-rules-320.png), [390](qa/release-readiness-patch1/preview-personal-rules-390.png), [macro 320](qa/release-readiness-patch1/preview-macro-compare-320.png), [390](qa/release-readiness-patch1/preview-macro-compare-390.png). Local compiled review vẫn ở `http://127.0.0.1:5314/?aiBeta=1`; QA ports riêng đã đóng sau test. Không có hosted URL mới.

## 5. Preservation và signoff

So checkpoint trước Patch 1, chỉ sửa ba file có sẵn: build policy, release README và test gate cũ. Thêm tests/tools/metadata mới; không sửa App/UI Phát, engine, save/replay, Semantic P5, What-if hoặc 39 curated answers. **34 shared AI modules và 416 file QA trước đó giữ nguyên hash; không có file bị xóa.** Manifest có SHA-256 cho source, fixture, evidence và các file review; checksum sidecar neo manifest cuối.

Audit chỉ áp dụng 594 candidates hiện tại cùng phần bổ sung Patch 1; không tuyên bố rà toàn bộ Git history/tracked base. Scan/visual triage không thay independent security review. Registry advisory audit và hosted build/install/origin/physical-device gates vẫn cần xác minh khi được phép thực hiện.

Owner cần duyệt manifest, 157 paths và exclusions; sau đó mới duyệt riêng repo/project creation, exact Beta project ID, expected-ID provisioning và Hosted Preview. Không tự thực hiện các bước này. Rollback nếu có deployment được duyệt sau này: hạn chế/gỡ deployment Beta; bỏ flag chỉ chặn build tiếp theo, không tắt bundle immutable đã phát hành. Production hiện tại được giữ nguyên.
