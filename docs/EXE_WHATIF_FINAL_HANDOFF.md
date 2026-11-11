# EXE What-if — Final Source Preservation & Handoff

Ngày bàn giao 10/11/2026, Asia/Bangkok. Phạm vi hiện tại là **DEV_MOCK_STABLE**. Tài liệu này chốt source và cách tái tạo bản DEV đã kiểm chứng.

## 1. Trạng thái Git và freeze

| Mục | Kết quả đọc tại workspace |
| --- | --- |
| Repository thực tế | `C:/Users/Admin/EXE-whatif-demo` |
| Branch | `feat/b18-whatif-deep-analysis-v2` |
| HEAD | `759a6fe1879816a716e21e38cc91eecd3fe5f50a` |
| Tracked trong index | 3.803 file |
| Tracked modified | 10 file, liệt kê ở mục 3 |
| Staging | Trống |
| Untracked trước tài liệu này | 4.640 file |
| Untracked sau tài liệu này | 4.641 file, nếu workspace không có chỉnh sửa đồng thời |
| Freeze EG3-AI-10 | Cả 5/5 SHA-256 khớp |
| Source/test/tooling ứng viên | 127 file untracked và 10 file tracked modified |
| Tests trong 127 file | 24 file, gồm 22 file của bộ 305 test và 2 test legacy |
| Dependency tương đối | Đã lần theo import, export và URL Worker. Các import `?url` đã đối chiếu với fixture thật. Không thấy dependency local bị thiếu |

Các file source/test ứng viên và 10 tracked diff đều có thời gian sửa trước freeze EG3-AI-10. Chỉ năm file trong manifest có bằng chứng hash lịch sử của freeze. Mtime của các file còn lại bổ sung kiểm tra hiện diện và thứ tự thời gian. Không dùng mtime để thay thế bằng chứng hash toàn bộ tree.

[Freeze manifest EG3-AI-10](playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/freeze-manifest.json) và các summary được đọc lại, không chạy lại regression, Chromium, build hoặc stress trong lượt bàn giao này. Source sản phẩm và bằng chứng trước đó được giữ tại chỗ.

**Clone HEAD hiện tại chưa tái tạo được bản What-if hoàn chỉnh.** Toàn bộ module endgame, phần lớn EG3, fixture QA bắt buộc và nhiều công cụ đang là untracked. Owner cần bảo toàn các file dưới đây và review phần tích hợp trước khi tạo commit bàn giao.

## 2. Source EG2C và EG3 vẫn hiện diện

### EG2C

Hai patch gốc cùng application record còn nguyên ở `docs/playtests/whatif-endgame/2026-11-08/eg2c-fast-track-01/`. Application record ghi 10 hunk trên 5 file. Kiểm tra hiện tại từng hunk bằng `git apply --reverse --check` trong bộ nhớ cho kết quả **9 hunk exact PASS**.

Hunk cuối của `mobile_app/src/dev/EndgameWhatIfDev.tsx` đã được EG3 mở rộng để cho Chromium mobile đi qua luồng AI DEV. Bản hiện tại vẫn giữ `permittedBuild`, `ENDGAME_ANALYSIS_BETA`, opt-in query, `createResultDriver`, và chọn `endgameQa/endgameBeta`. Thay đổi thêm gồm `chromium`, `chromiumDesktop` và `supportedBrowser` cho `whatIfAi=1`. Vì vậy reverse-check toàn patch thứ hai trả lỗi tại hunk này. Đây là chỗ đã kế thừa và mở rộng source EG2C, cần giữ bản EG3 hiện tại khi bàn giao. Không dùng kết quả này để tuyên bố 10 hunk còn nguyên byte.

Năm file EG2C đều tồn tại thực tế gồm `App.tsx`, `main.tsx`, `dev/EndgameWhatIfDev.tsx`, `game/endgame-analysis-feature.ts` và `game/endgame-analysis-app-binding.ts` dưới `mobile_app/src/`. Feature gate production hiện có phụ thuộc build flag, bản bàn giao này sử dụng đường DEV.

### EG3-AI-01 đến EG3-AI-10

Các đường dẫn trong bảng là source thật có trong inventory mục 4, kèm tests và fixture ở mục 5.

| Milestone | Source và phần tiếp tục sử dụng |
| --- | --- |
| 01 | `game/what-if-ai/orchestrator.ts`, `mock-gemini.ts`, `gold.ts`, `bank.ts`, `bank-replay.ts`, `bank.worker.ts`, `native-worker.test.ts`. Trang `mobile_app/what-if-ai.html` và `dev/what-if-ai-page.tsx` còn hoạt động như entry fixture. Không tìm thấy report riêng tên EG3-AI-01 trong docs, source và test của pipeline vẫn có |
| 02 | `game/endgame-whatif-paired.ts`, `what-if-ai/decision-adapters.ts`, `decision-replay.ts`, `decision-client.ts`, `decision.worker.ts`, `paired-replay.test.ts`, `decision-replay.test.ts` |
| 03 | `src/ai/what-if/contracts.ts`, `server.ts`, `mock-server-provider.ts`, `gemini.ts`, `transport.test.ts`, `scripts/what-if-ai-dev.ts`, `InGameAiEntry.tsx`, controller và HTTP client |
| 04 | Adapters và native replay cho Stocks, Bonds, Business, Advanced, cùng `scripts/diagnostics/what-if-multi-asset-fixtures.ts` và `multi-asset.test.ts` |
| 05 | `flexible-catalog.ts`, `FlexibleChoices.tsx`, `flexible.test.ts`, `what-if-flexible-fixtures.ts`. Symbol, amount, issuer, lot và term dùng native legality probe |
| 06 | `natural-language.ts`, `grounded-explanation.ts`, tests tương ứng, controller và panel hỏi lại |
| 07 | Flow trong `InGameAiEntry.tsx` và `in-game-controller.ts`, phân biệt lịch sử, chọn lại phương án, retry, focus, paging và bỏ response cũ |
| 08 | `what-if-reliability-fixtures.ts`, `reliability.test.ts`, fixtures nhiều tài sản và lifecycle stress |
| 09 | `src/ai/what-if/model-provider.ts`, validator interpret/propose/explain, `transport.test.ts`, kiểm tra financial parameters và claim ID |
| 10 | `endgame-whatif-paired.ts`, `endgame-whatif-gold-identity.ts`, `endgame-whatif-gold-resume.ts`, assertion reason trong `endgame-whatif-gold-c1.test.ts` và freeze manifest |

Các tên `game/...` và `dev/...` ở bảng tương ứng thư mục `mobile_app/src/`. Source lõi Gold còn đầy đủ contract, identity, fork, reconcile, follow-up, transcript, comparison và resume. Native Worker protocol, binding, job và guarded final read vẫn nằm trong các module endgame-analysis.

## 3. Phân chia workstream và 10 tracked diff

Danh sách này phân loại theo chức năng, dependency và diff hiện tại. Nó không xác định tác giả của từng dòng. Những file core/shared cần Phát review theo hunk trước khi đưa vào commit What-if.

| File tracked modified | Phần liên quan What-if và cách bàn giao |
| --- | --- |
| `mobile_app/src/App.tsx` | File shared của Phát có nhiều thế hệ tích hợp. Review riêng repair review, Bank/Gold historical opt-in, endgame binding/session lifecycle và result action. Không lấy toàn file theo giả định chỉ có EG3 |
| `mobile_app/src/main.tsx` | Entry lazy DEV và wiring EG2C. Review gate và query |
| `mobile_app/src/components/GamePhase.tsx` | Shared core. Seam `endgameResultAction` truyền xuống màn kết quả |
| `mobile_app/src/components/GameResultModal.tsx` | Shared core. Prop và slot result action |
| `mobile_app/src/components/BottomControls.tsx` | Shared core. Prop decisionReview và accessible group từ work What-if trước đó. Giữ để review, không gộp thành thay đổi engine |
| `mobile_app/src/components/WhatIfModal.tsx` | What-if repair legacy, copy và presentation |
| `mobile_app/src/components/what-if.css` | CSS What-if repair legacy |
| `scripts/diagnostics/what-if-browser.mjs` | QA legacy, cấu hình output và entry mới |
| `scripts/diagnostics/what-if-replays.ts` | Fixture/replay diagnostic legacy |
| `src/game/what-if.ts` | Helper/DTO What-if repair legacy. Review riêng với engine transition |

Shared dependencies đã có ở HEAD gồm `src/game/engine.ts`, `state.ts`, `types.ts`, `saved-game.ts`, `log.ts`, các data/economics, `mobile_app/src/game/session.ts`, core UI và package/lock/config hiện có. Giữ baseline khi clone. Chúng không trở thành file cần stage chỉ vì nằm trong dependency closure.

Companion/P5 và Universal AI có source ở `src/ai/companion/**`, `api/ai-companion*.ts`, `mobile_app/src/game/universal-ai*.ts`, context/slots gameplay. What-if server chỉ import body reader và limiter đã có. Không gom source Companion vào commit What-if.

Semantic P4 không có tracked diff riêng trong snapshot này. Các tài liệu trước ghi checkout P4 riêng chưa được cung cấp. Không có bằng chứng để quy ownership P4 cho một file untracked hoặc xác nhận tương thích với dirty work ở máy Phát. Phát cần đối chiếu branch/working tree của mình trước khi hợp nhất các seam shared. FinancialTerm/glossary thuộc core và phần thuật ngữ, tách riêng khỏi commit What-if.

## 4. Allowlist source/test cần bảo toàn

**127 file dưới đây đang untracked**, được đối chiếu bằng import closure và inventory source hiện tại. Danh sách bao gồm runtime, 24 test, 3 generator fixture, diagnostic Bank, launcher và các entry legacy. Cộng với 10 tracked diff đã review ở mục 3 để giữ toàn bộ thế hệ What-if đang có trong App. Đây là danh sách ứng viên, staging hiện vẫn trống.

```text
mobile_app/src/components/BankExplanation.tsx
mobile_app/src/components/BankHistoricalReview.tsx
mobile_app/src/components/GoldHistoricalReview.tsx
mobile_app/src/components/bank-explanation.css
mobile_app/src/components/bank-historical-review.css
mobile_app/src/components/endgame-what-if/EndgameWhatIfEntry.tsx
mobile_app/src/components/endgame-what-if/EndgameWhatIfPanel.tsx
mobile_app/src/components/endgame-what-if/FlexibleChoices.tsx
mobile_app/src/components/endgame-what-if/InGameAiEntry.tsx
mobile_app/src/components/endgame-what-if/endgame-what-if.css
mobile_app/src/components/endgame-what-if/in-game-ai.css
mobile_app/src/components/gold-historical-presentation.ts
mobile_app/src/components/gold-historical-review.css
mobile_app/src/components/what-if-copy.ts
mobile_app/src/dev/EndgameWhatIfDev.tsx
mobile_app/src/dev/bank-opportunity-entry.tsx
mobile_app/src/dev/bank-opportunity-page.tsx
mobile_app/src/dev/bank-opportunity.css
mobile_app/src/dev/bank-opportunity.ts
mobile_app/src/dev/what-if-ai-entry.tsx
mobile_app/src/dev/what-if-ai-page.tsx
mobile_app/src/dev/what-if-ai.css
mobile_app/src/game/bank-explanation-binding.ts
mobile_app/src/game/bank-historical-contract.ts
mobile_app/src/game/bank-historical-integrity.ts
mobile_app/src/game/bank-historical-review.ts
mobile_app/src/game/bank-historical-what-if.ts
mobile_app/src/game/bank-historical-worker-contract.ts
mobile_app/src/game/bank-historical-worker-job.ts
mobile_app/src/game/bank-historical-worker.ts
mobile_app/src/game/bank-historical.worker.ts
mobile_app/src/game/endgame-analysis-app-binding-safety.test.ts
mobile_app/src/game/endgame-analysis-app-binding.test.ts
mobile_app/src/game/endgame-analysis-app-binding.ts
mobile_app/src/game/endgame-analysis-binding.test.ts
mobile_app/src/game/endgame-analysis-binding.ts
mobile_app/src/game/endgame-analysis-feature.ts
mobile_app/src/game/endgame-analysis-protocol.ts
mobile_app/src/game/endgame-analysis-source.test.ts
mobile_app/src/game/endgame-analysis-source.ts
mobile_app/src/game/endgame-analysis-worker-client.ts
mobile_app/src/game/endgame-analysis-worker-job.ts
mobile_app/src/game/endgame-analysis-worker.test.ts
mobile_app/src/game/endgame-analysis.worker.ts
mobile_app/src/game/endgame-whatif-comparison.ts
mobile_app/src/game/endgame-whatif-continuation.ts
mobile_app/src/game/endgame-whatif-contract.ts
mobile_app/src/game/endgame-whatif-course-basic.ts
mobile_app/src/game/endgame-whatif-eg1a.test.ts
mobile_app/src/game/endgame-whatif-eg1b-contract.ts
mobile_app/src/game/endgame-whatif-eg1b.test.ts
mobile_app/src/game/endgame-whatif-fairness.ts
mobile_app/src/game/endgame-whatif-followup.ts
mobile_app/src/game/endgame-whatif-gold-c1-safety.test.ts
mobile_app/src/game/endgame-whatif-gold-c1.test.ts
mobile_app/src/game/endgame-whatif-gold-comparison.ts
mobile_app/src/game/endgame-whatif-gold-contract.ts
mobile_app/src/game/endgame-whatif-gold-followup.ts
mobile_app/src/game/endgame-whatif-gold-fork.ts
mobile_app/src/game/endgame-whatif-gold-identity.ts
mobile_app/src/game/endgame-whatif-gold-reconcile.ts
mobile_app/src/game/endgame-whatif-gold-resume.ts
mobile_app/src/game/endgame-whatif-gold-transcript.ts
mobile_app/src/game/endgame-whatif-identity.ts
mobile_app/src/game/endgame-whatif-integrity.ts
mobile_app/src/game/endgame-whatif-paired.ts
mobile_app/src/game/endgame-whatif-reconcile.ts
mobile_app/src/game/endgame-whatif-replay.ts
mobile_app/src/game/endgame-whatif-resume.ts
mobile_app/src/game/endgame-whatif-transcript.ts
mobile_app/src/game/endgame-whatif-ui-controller.test.ts
mobile_app/src/game/endgame-whatif-ui-controller.ts
mobile_app/src/game/gold-historical-contract.ts
mobile_app/src/game/gold-historical-integrity.ts
mobile_app/src/game/gold-historical-replay.ts
mobile_app/src/game/gold-historical-review.ts
mobile_app/src/game/gold-historical-what-if.ts
mobile_app/src/game/gold-historical-worker-contract.ts
mobile_app/src/game/gold-historical-worker-job.ts
mobile_app/src/game/gold-historical-worker.ts
mobile_app/src/game/gold-historical.worker.ts
mobile_app/src/game/what-if-ai/bank-replay.ts
mobile_app/src/game/what-if-ai/bank.ts
mobile_app/src/game/what-if-ai/bank.worker.ts
mobile_app/src/game/what-if-ai/decision-adapters.ts
mobile_app/src/game/what-if-ai/decision-client.ts
mobile_app/src/game/what-if-ai/decision-replay.test.ts
mobile_app/src/game/what-if-ai/decision-replay.ts
mobile_app/src/game/what-if-ai/decision.worker.ts
mobile_app/src/game/what-if-ai/flexible-catalog.ts
mobile_app/src/game/what-if-ai/flexible.test.ts
mobile_app/src/game/what-if-ai/gold.ts
mobile_app/src/game/what-if-ai/grounded-explanation.test.ts
mobile_app/src/game/what-if-ai/grounded-explanation.ts
mobile_app/src/game/what-if-ai/http-provider.ts
mobile_app/src/game/what-if-ai/in-game-controller.test.ts
mobile_app/src/game/what-if-ai/in-game-controller.ts
mobile_app/src/game/what-if-ai/mock-gemini.ts
mobile_app/src/game/what-if-ai/multi-asset.test.ts
mobile_app/src/game/what-if-ai/native-worker.test.ts
mobile_app/src/game/what-if-ai/natural-language.test.ts
mobile_app/src/game/what-if-ai/natural-language.ts
mobile_app/src/game/what-if-ai/orchestrator.test.ts
mobile_app/src/game/what-if-ai/orchestrator.ts
mobile_app/src/game/what-if-ai/paired-replay.test.ts
mobile_app/src/game/what-if-ai/reliability.test.ts
mobile_app/what-if-ai.html
mobile_app/whatif-opportunity.html
scripts/diagnostics/what-if-bank-historical.test.ts
scripts/diagnostics/what-if-bank-historical.ts
scripts/diagnostics/what-if-flexible-fixtures.ts
scripts/diagnostics/what-if-multi-asset-fixtures.ts
scripts/diagnostics/what-if-reliability-fixtures.ts
scripts/what-if-ai-dev.ts
src/ai/what-if/contracts.ts
src/ai/what-if/gemini.ts
src/ai/what-if/mock-server-provider.ts
src/ai/what-if/model-provider.ts
src/ai/what-if/server.ts
src/ai/what-if/transport.test.ts
src/game/what-if-analysis.ts
src/what-if-explanation/catalog.ts
src/what-if-explanation/claims.ts
src/what-if-explanation/contracts.ts
src/what-if-explanation/mock.ts
tests/what-if-analysis.test.ts
tests/what-if-copy.test.ts
```

## 5. Fixtures và công cụ tái tạo

### Fixtures bắt buộc

Danh sách chính xác dưới đây gồm 18 file. Sáu archive đầu tiên đã tracked ở HEAD. Mười hai file còn lại đang untracked và cần bảo toàn rõ ràng nếu muốn tái chạy test/Chromium. Các archive và JSON này là dữ liệu kiểm thử lịch sử game, tách khỏi runtime App thông thường.

Đặc biệt `public-resume-proof.json` và `positive-320-T-1.json` được test đọc/import trực tiếp. Chúng là fixture cần thiết dù tên thư mục có dạng evidence QA. Không bỏ chúng khi lọc thư mục playtests.

| Path | Git hiện tại |
| --- | --- |
| `docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz` | tracked |
| `docs/playtests/core-mvp-b18-multi-course/browser-320-basic-first.json.gz` | tracked |
| `docs/playtests/core-mvp-b18-multi-course/frozen-shortlist-novice.json.gz` | tracked |
| `docs/playtests/core-mvp-b18-multi-course/frozen-screen-cash-roi.json.gz` | tracked |
| `docs/playtests/core-mvp-b18-multi-course/frozen-holdout-diversified-roi.json.gz` | tracked |
| `docs/playtests/b18-beginner-ux/after/browser-desktop-defeat.json.gz` | tracked |
| `docs/playtests/whatif-endgame/2026-11-07/eg1b-01/scripted-attempt2-actual.json.gz` | untracked |
| `docs/playtests/whatif-endgame/2026-11-07/eg1b-c1-01/public-resume-proof.json` | untracked |
| `docs/playtests/whatif-endgame/2026-11-07/eg2a-2-05/browser-attempt-07/positive-320-T-1.json` | untracked |
| `docs/playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/fixtures.json` | untracked |
| `docs/playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/stocks.json.gz` | untracked |
| `docs/playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/stockAgain.json.gz` | untracked |
| `docs/playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/sale.json.gz` | untracked |
| `docs/playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/bank.json.gz` | untracked |
| `docs/playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/bonds.json.gz` | untracked |
| `docs/playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/course.json.gz` | untracked |
| `docs/playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/business.json.gz` | untracked |
| `docs/playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/gold.json.gz` | untracked |

### Công cụ cần giữ

Tám script dưới thư mục EG3-AI-10 được liệt kê chính xác ở phụ lục B. Regression runner đọc thêm `docs/playtests/whatif-endgame/2026-11-10/eg3-ai-09-01/regression-full.tap` để đối chiếu 305 tên test.

Chromium runner đọc tám archive và `fixtures.json` của EG3-AI-05. Các file `*.packed.gz` ở EG3-AI-06 là cache tùy chọn cho runner chính và có thể tạo lại. Riêng `eg3-ai-06-01/bonds.packed.gz` cần giữ nếu muốn dùng nguyên script tái hiện tooltip core. Các generator fixture `what-if-multi-asset-fixtures.ts`, `what-if-flexible-fixtures.ts`, `what-if-reliability-fixtures.ts` nằm trong source allowlist.

### Evidence và tài liệu cần giữ riêng

Bảo toàn các report EG3-AI-02 đến EG3-AI-10, tài liệu này, source reports/specs What-if đời trước và application record EG2C. Phụ lục B xác định tập evidence tối thiểu để tái tạo lệnh và truy nguyên nghiệm thu. Có thể giữ toàn bộ lịch sử QA trong kho lưu trữ riêng được Owner kiểm soát, kèm paths và hashes, rồi review phần evidence được đưa vào Git.

Trong 4.640 untracked ban đầu có 2.755 file dưới `docs/playtests/whatif-endgame`, 1.460 file dưới `docs/playtests/whatif-v3` và 158 diagnostic chưa thuộc tập tối thiểu. Các thư mục chứa ảnh, cache packed save, trace, copy source before/candidate, thử nghiệm thất bại và patch đề xuất nhiều đời. Không dùng wildcard toàn bộ `docs/` hoặc `scripts/diagnostics/` làm danh sách stage. Các file QA vẫn ở nguyên workspace.

## 6. Kiểm tra secrets và dữ liệu QA

Đã quét dấu hiệu private key, Google/GitHub/AWS token, credential gắn trong URL và literal credential dài trên **141 file source/package ứng viên và 39 file text evidence/tool/report được chọn**. Không phát hiện mẫu credential thực theo các rule này. Test sentinel như `test-only` và tên field credential trong adapter là dữ liệu giả hoặc contract, không phải cấu hình live.

Inventory tên tracked/untracked không có file dạng private key, service account hay credential container. Ở root/mobile/api chỉ ghi nhận tên `.env.example` khi kiểm tra container theo tên. Không đọc nội dung file secret container, cấu hình credential cá nhân, API key hoặc giá trị môi trường. Kiểm tra này có phạm vi source và tập evidence chọn, không phải chứng nhận nội dung toàn bộ archive/ảnh trong repository.

Loại khỏi commit ứng viên các thư mục dependency/cache/build như `node_modules/**`, `mobile_app/node_modules/**`, `.tmp`, `.vite`, `dist`, `.vercel`, file log tạm, trace/profiles lớn, copy `App-before`/`App-PROPOSED`, và secrets/credential cá nhân. Một số file ignored đã tracked từ trước thuộc baseline, nên không xóa chúng trong lượt này. Các fixture ở mục 5 là ngoại lệ đã xác định, giữ đúng từng path.

Các patch có tên `PROPOSED`, `unapplied` và `NOT-APPLIED` là bằng chứng/đề xuất. Chúng không phải lệnh tự áp dụng khi onboarding.

## 7. Clone và chạy App DEV

### Điều kiện nhận bản clone

Owner hoàn tất review, tạo commit bàn giao có source, tests, fixtures và công cụ bắt buộc, sau đó mới push theo quyền của Owner. Ghi SHA commit bàn giao vào biên bản. SHA `759a6fe...` hiện tại chỉ là baseline Git của WIP, không chứa toàn bộ source untracked.

Các lệnh sau dành cho người nhận **sau khi commit bàn giao đã được cung cấp**. Thay URL bằng địa chỉ repo được cấp quyền, không nhúng token vào URL. Trong workspace hiện tại bỏ qua bước clone.

```powershell
git clone --branch feat/b18-whatif-deep-analysis-v2 --single-branch <URL_REPO_DUOC_CAP_QUYEN> EXE-whatif-handoff
Set-Location EXE-whatif-handoff
git rev-parse HEAD
node --version
npm ci
npm --prefix mobile_app ci
```

Node đã kiểm chứng là **22.14.0**, dependency lấy từ cả hai `package-lock.json`. So sánh HEAD clone với SHA bàn giao Owner cung cấp. Git hiện tại dùng `core.autocrlf=true`. Hai file Gold resume/test có EOL hỗn hợp, các file freeze khác chủ yếu LF. Staging/checkout có thể normalize EOL làm SHA byte khác. Owner cần review EOL và đối chiếu staged diff, bảo toàn snapshot/hash cũ để truy nguyên. Không cập nhật manifest cũ chỉ để che sự khác biệt.

### App thật với mock HTTP

Từ repository root chạy launcher chuyên biệt.

```powershell
node --experimental-strip-types scripts/what-if-ai-dev.ts
```

Mở Chrome/Chromium tại `http://127.0.0.1:5196/?endgameWhatIf=1&whatIfAi=1`. Chơi hoặc khôi phục qua UI một ván B18 bốn vòng, đến màn kết quả rồi chọn **Hỏi AI về lựa chọn khác**. Luồng gồm hỏi tiếng Việt, làm rõ quyết định/tham số, proposal, xác nhận, follow-up tường minh và comparison đã xác minh. Có thể chọn catalog thủ công nếu provider lỗi.

Launcher chọn `mockServerProvider` và mount `/api/what-if-provider` cùng origin. UI ghi nhãn mock. Lệnh `npm --prefix mobile_app run dev` riêng chỉ khởi động Vite và proxy hiện có, chưa thay thế launcher HTTP What-if.

Trang fixture độc lập của EG3-AI-01/02 có thể mở bằng lệnh Vite mobile rồi vào `http://127.0.0.1:5174/what-if-ai.html`. Trang này có fixture Gold/Bank/Course và khác entry in-game của App. Để xem đủ bảy nhóm, dùng in-game với catalog của lịch sử thực tế.

## 8. Chạy regression và kiểm tra lại khi cần

Các lệnh dưới đây là hướng dẫn, chưa chạy trong lượt bàn giao. Chọn tên lượt mới vì các script bảo vệ bằng chế độ tạo file mới.

```powershell
node docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/regression.mjs handoff-check-01 plain
node docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/checks.mjs handoff-checks-01
node docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/build.mjs handoff-build-01
```

Regression chạy 22 test files, 305 tests, `--test-concurrency=2`, đối chiếu chính xác tên với EG3-AI-09. `npm test` ở root chỉ chọn `tests/*.test.ts` và không thay thế bộ EG3 này. Mode `trace` của runner import loader chẩn đoán và ghi stage, CPU, reason, remaining wall-clock/steps. Với phiên nghiệm thu thông thường nên chạy một bộ đầy đủ tại một thời điểm.

Build helper dùng Vite production trong bộ nhớ và kiểm tra endpoint mock không có trong bundle. Không cần build hoặc deploy để dùng App DEV. `freeze.mjs` là verifier của baseline lịch sử và có assert HEAD cố định. Sau commit bàn giao, giữ manifest lịch sử để đối chiếu source, không dùng fail HEAD của script này để kết luận runtime bị regression.

### Chromium tự động khi có nhu cầu kiểm chứng mới

Runner hiện tại yêu cầu Playwright tại `node_modules/.tmp/whatif-v3-qa/node_modules/playwright` và executable `C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe`. QA package đang có ghi version **1.64.1**, nhưng browser mặc định trong package metadata là revision **1248**. Cài lại package không tự tái tạo executable 1228 mà harness đang chọn.

Người nhận cần chuẩn bị Playwright/Chromium bằng quyền truy cập hợp lệ, rồi điều chỉnh **bản copy QA của harness** sang module/executable thực có trên máy. Ghi version và diff QA đó cùng kết quả mới. Giữ source runtime và evidence freeze để đối chiếu. Đây là hạn chế tính di động của QA harness cần xử lý trước khi hứa tái chạy nguyên lệnh trên máy khác.

Khi đúng môi trường đã ghi nhận, lệnh runner là

```powershell
node --experimental-strip-types docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/browser.mjs handoff-browser-01 baseline 5231
node --experimental-strip-types docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/browser.mjs handoff-browser-02 reliability- 5232
```

Đây là 50 ca App và 9 ca reliability. Runner yêu cầu socket loopback, tạo context Chromium riêng với fixture QA, và chặn request ngoài allowlist. Không tự chạy stress chỉ để chuẩn bị bàn giao khi source/freeze hiện tại hợp lệ.

## 9. Những phần đã PASS và giới hạn

| Bằng chứng hiện có | Trạng thái nghiệm thu |
| --- | --- |
| EG3-AI-09 | 305/305 ở lượt đầy đủ và 64/64 Chromium. Lượt đồng thời cũ có một Gold `limited`, được điều tra ở EG3-AI-10 |
| EG3-AI-10 | Hai bộ regression đồng thời đều 305/305, trùng danh sách test. Chromium 50 + 9 = 59/59 |
| Gold C1 | +104.006 VND ở tiền mặt, tài sản ròng và tiền có thể thu về, explicit follow-up lần bán, independent Alternative proof |
| Bank | +200.000 VND trên fixture đã nghiệm thu |
| Bảy nhóm | Gold, Bank, Course Basic, Advanced, Stocks, Bonds, Business có adapters và replay native trong phạm vi catalog hợp lệ |
| Luồng UI | Câu hỏi mock HTTP, làm rõ, params, proposal, follow-up, manual fallback, đổi phương án |
| Safety | Exact membership, independent replay, guard số liệu, cancellation, timeout, stale response, Worker cleanup, packed-save/official result immutability |
| Gold reliability | Tải ghim CPU trước sửa trả `time-budget` 5/5. Sau sửa hoàn tất 5/5 trong ngân sách cũ 20 giây / 5.000 bước |
| Gemini live | `LIVE_NOT_RUN` |
| FinancialTerm core 320px | `OWNER_APPROVAL_REQUIRED`, patch `NOT_APPLIED` |

Giới hạn tài nguyên vẫn có hiệu lực. Thiết bị chậm hoặc CPU/RAM bị chia sẻ nặng có thể trả `limited/time-budget`. Nguyên nhân chính xác của chính lượt lỗi EG3-AI-09 vẫn `ROOT_CAUSE_UNCONFIRMED` do log cũ thiếu reason, dù phép tái hiện có kiểm soát đã xác định được bottleneck và bản sửa có bằng chứng.

Funding, insolvency, RNG/exogenous divergence, invalid continuation và history không chứng minh được vẫn fail closed. Mock có grammar hữu hạn. Không tự tạo multi-fork hoặc tự chọn follow-up. Trạng thái DEV/mock hiện tại không chứng nhận khả năng vận hành production hoặc chất lượng model live.

## 10. Bàn giao FinancialTerm 320px cho Phát

**Trạng thái `OWNER_APPROVAL_REQUIRED / NOT_APPLIED`.** Patch có thể forward-check thành công trên source hiện tại. Source `src/components/FinancialTerm.tsx` vẫn chứa selector cũ `.button`, chưa có selector đề xuất.

Reproduction có sẵn từ `eg3-ai-06-01/core-repro.mjs` và `bonds.packed.gz`. Dùng Chrome viewport 320×844, context QA với tutorial đã đánh dấu, fixture Bonds ở sát tổng kết vòng 4. Đi qua màn bắt đầu và Chương 1. Ở **Khép lại vòng 4**, mở tooltip **Lãi trái phiếu định kỳ**, sau đó tap nút **Xem kết quả hành trình →** khi tooltip đang mở.

Bằng chứng ghi nhận CTA ở khoảng y=686,6–740,6, tooltip cao 133px và danh sách `oldActions` trống do các nút gamified không có class `.button`. Tooltip có thể nằm trên CTA và chặn pointer/touch. Đóng tooltip bằng tap bên ngoài cho phép đi tiếp. Mức ảnh hưởng là cản trở entry từ core tới kết quả ở cấu hình 320px này. Các ca What-if 320px dùng Enter qua core rồi mới kiểm touch trong panel, nên không chứng minh toàn hành trình core bằng touch đã PASS.

Exact proposed diff chỉ đổi selector của protected FinancialTerm

```diff
-const actions = [...root.querySelectorAll<HTMLButtonElement>('.button')].filter(...)
+const actions = [...root.querySelectorAll<HTMLButtonElement>('.button, .gamified-modal-card button:not(.financial-term-trigger)')].filter(...)
```

Dòng trên rút gọn phần filter để đọc. Exact patch đầy đủ vẫn tại [core-tooltip-proposed-NOT-APPLIED.patch](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-tooltip-proposed-NOT-APPLIED.patch). [Geometry và kết quả](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-verified-repro.json) · [Ảnh 320px](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-verified-320-step0.png)

Phát/Owner review phạm vi selector và hành vi popover trên các modal khác, duyệt exact diff riêng, rồi kiểm pointer/touch thực ở 320px, 390px và desktop, cùng keyboard/focus/scroll. Giữ patch ở trạng thái NOT_APPLIED cho tới khi có phê duyệt và bằng chứng mới. File này không thuộc allowlist source commit What-if.

## 11. Điều kiện trước khi dùng AI provider thật

Provider interface hiện có ba operation `interpret`, `propose`, `explain`. `model-provider.ts` nhận transport phía server và validate JSON thô. `interpret` cần thông tin có căn cứ trong câu hỏi, `propose` chọn exact pair từ catalog đã probe, `explain` chỉ chọn claim có trong engine facts. App tiếp tục dựng số liệu và lời giải thích từ replay được xác minh.

Owner cần chọn provider, quyền truy cập và điều khoản phù hợp, transport server được phê duyệt, chính sách auth/quota/chi phí, cấu hình bí mật phía server, kiểm thử wire schema, cancellation và chất lượng tiếng Việt bằng dịch vụ thực. Adapter Gemini riêng hiện có chỉ có `propose/explain`, chưa có đường `interpret` live. Khi chọn Gemini cần nối transport vào contract ba operation và nghiệm thu lại với quyền hợp lệ. Launcher DEV vẫn dùng mock.

Không có yêu cầu cung cấp credential trong lượt bàn giao. API key không thuộc frontend, fixture hoặc commit. Chưa có kết quả live để đánh PASS.

## 12. Kế hoạch commit/push cho Owner

1. Giữ workspace hiện tại và chuẩn bị bản sao bảo toàn được kiểm soát của allowlist cùng evidence cần thiết, bao gồm byte/EOL gốc. Ghi SHA, branch và file hashes. Đối chiếu source P4/Phát ở checkout của nhóm trước khi hợp nhất.
2. Phát review 5 shared paths trong bảng tracked gồm App, main, GamePhase, GameResultModal và BottomControls theo từng hunk. Review riêng legacy repair và helper `src/game/what-if.ts`. Chốt phần nào cùng commit What-if, phần nào thuộc workstream khác. Danh sách 10 file hiện tại không có cơ sở để gán toàn bộ nội dung cho một người.
3. Chuẩn bị một commit What-if nguyên tử chứa 127 source/test/tooling, các hunk tracked đã được xác nhận, 12 fixture untracked bắt buộc, 8 script EG3-AI-10 và TAP baseline EG3-AI-09 mà runner đọc. Giữ các dependency đã tracked ở baseline. Review sự thay đổi EOL trước khi stage. Chỉ stage theo path/hunk được duyệt, không dùng `git add -A`, `git add .` hoặc wildcard toàn bộ docs.
4. Evidence/report có thể là commit riêng kế tiếp trên cùng lịch sử bàn giao. Giữ các dependency fixture QA của tests trong commit code để commit đó tự chạy được. Tách rõ log lỗi lịch sử, patch chưa áp dụng và ảnh/profile tùy chọn khỏi source runtime.
5. Trước khi Owner commit, xem staged diff/name/status, quét secret trên tập staged và đối chiếu allowlist. Nếu source hoặc EOL thay đổi, đánh giá lại hash và kiểm chứng phù hợp. Chạy regression đầy đủ từ một bản clone/checkout bàn giao sạch sau khi commit để xác nhận đã đủ file, thay vì dùng WIP hiện tại làm bằng chứng duy nhất cho tính đầy đủ của commit.
6. Owner quyết định commit/push khi review xong, ghi SHA mới và chia sẻ URL/branch được cấp quyền cho người nhận. Giữ freeze cũ như evidence của WIP, thêm record của commit mới. Không tự merge, beta, deploy hoặc bật live theo bước bàn giao source.

Tất cả bước Git ghi ở trên là kế hoạch cho Owner. Lượt này chỉ thêm tài liệu bàn giao, staging tiếp tục trống.

## Phụ lục A. Hash freeze đang khớp

| File | SHA-256 |
| --- | --- |
| `mobile_app/src/game/endgame-whatif-paired.ts` | `f67089bad63618514b0a9407b8279291917714edb645ae7384d04df0ba911c25` |
| `mobile_app/src/game/endgame-whatif-gold-identity.ts` | `0891188b11829deaad1f1e65e02ae351471d7ffe89656de0e3c31caf5569f104` |
| `mobile_app/src/game/endgame-whatif-gold-resume.ts` | `2198bd586fbb39ad083fb30b4de05ae2eff88b82b26dbe9c689deec663655708` |
| `mobile_app/src/game/endgame-whatif-gold-c1.test.ts` | `0c84189418c6d0f31e2e2fa661296f2461aa9332c223163c9f8c35c7b110036c` |
| `mobile_app/src/game/endgame-whatif-contract.ts` | `1390eac66599fee998780ced52c243214211a3ed17276c4ef5268f4da35c764b` |

## Phụ lục B. Allowlist công cụ và evidence tối thiểu

Các path này hiện tồn tại. Mục nào đã là fixture ở mục 5 không cần tính hai lần khi lập commit.

```text
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/regression.mjs
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/register-gold-trace.mjs
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/gold-trace-loader.mjs
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/gold-contention.mjs
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/checks.mjs
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/build.mjs
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/browser.mjs
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/freeze.mjs
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/freeze-manifest.json
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/final-regression-a-summary.json
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/final-regression-b-summary.json
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/final-regression-a.tap
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/final-regression-b.tap
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/baseline-final-results.json
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/reliability-final-results.json
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/checks-corrected.json
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/build-final.json
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/environment.json
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/before-pinned-summary.json
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/after-pinned-summary.json
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/trial-pinned-summary.json
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/isolated-before.tap
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/isolated-witness-before.tap
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-09-01/regression-full.tap
docs/playtests/whatif-endgame/2026-11-08/eg2c-fast-track-01/resume-2026-11-10/application.json
docs/playtests/whatif-endgame/2026-11-08/eg2c-fast-track-01/protected-beta-activation-proposed.patch
docs/playtests/whatif-endgame/2026-11-08/eg2c-fast-track-01/attempt-02-beta-wiring-unapplied.patch
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-tooltip-proposed-NOT-APPLIED.patch
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-verified-repro.json
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-verified-320-step0.png
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-repro.mjs
docs/playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/bonds.packed.gz
docs/EXE_WHATIF_EG3_AI_02_REPORT.md
docs/EXE_WHATIF_EG3_AI_03_REPORT.md
docs/EXE_WHATIF_EG3_AI_04_REPORT.md
docs/EXE_WHATIF_EG3_AI_05_REPORT.md
docs/EXE_WHATIF_EG3_AI_06_REPORT.md
docs/EXE_WHATIF_EG3_AI_07_REPORT.md
docs/EXE_WHATIF_EG3_AI_08_REPORT.md
docs/EXE_WHATIF_EG3_AI_09_REPORT.md
docs/EXE_WHATIF_EG3_AI_10_REPORT.md
```
