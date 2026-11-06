# EXE AI Companion V3 — Release Hardening Patch 2

2026-11-06 · checkpoint **`3817b7eb18d32a2909ec3648ccd79d10dd9e178f`** · nhánh làm việc **`feat/b18-ai-companion-release-hardening-patch2`**.

**Patch 2 hoàn thành để Owner review diff/manifest; RELEASE HOLD vẫn giữ.** Zod high đã được xử lý, standard replay 139/139 PASS trên cả checkout Windows lẫn committed bytes, và static Beta không còn legacy Coach UI/request. Còn **10 moderate thuộc dev tooling**, cần Owner quyết định trước release. Không stage/commit/push/merge, tạo repo/project hoặc deploy; Production không đổi.

## 1. Frozen checkpoint và phạm vi

HEAD và nhánh Beta gốc vẫn trỏ `3817b7e...`, parent duy nhất `e4045125684a9fd3da30a911fd91cb6687c5c586`. Nhánh Patch 2 được tạo trực tiếp từ checkpoint, không rebase/reset/amend. [Preservation](qa/release-hardening-patch2/preservation.json) xác minh:

- Clean export cũ **768/768 files nguyên hash**, ZIP vẫn `f28ab6422821b5e51612856524a8e97af88b409ec7b0248522de12fe716c6809`.
- **54 artifacts** trong checksum handoff clean export cũ không đổi; không xóa evidence cũ.
- **139 gameplay log files nguyên hash** so inventory trước Patch 2. Không thay engine, RNG, replay semantics, scenarios, What-if, P4/P5 hoặc 39 câu.
- Chỉ **4 tracked files** đổi; không có tracked file UI/API/server của Phát hoặc root/mobile Vite config đổi. Có thêm 7 source/test/tool files riêng cho Patch 2.
- Index rỗng; chưa có commit mới. Không tạo clean export mới; bản portable replay probe chỉ là workspace QA tạm.

## 2. Exact changed files và manifest dự thảo

**11 source/build/test/tool changes:**

| File | Trạng thái / mục đích |
| --- | --- |
| `package-lock.json` | Sửa: cập nhật riêng Zod; npm bổ sung peer metadata |
| `release/beta/vite.config.ts` | Sửa: chỉ cài plugin isolation vào Beta config |
| `release/beta/legacy-ai-isolation.ts` | Thêm: transform/graph guard và route refusal riêng Beta |
| `scripts/diagnostics/readiness-patch1-replays.ts` | Sửa: xác minh exact bytes/known checkout và ghi evidence vào thư mục Patch 2 |
| `scripts/diagnostics/replay-input-integrity.ts` | Thêm: integrity verifier không sửa log |
| `tests/fixtures/ai-companion/release-historical-replays.json` | Sửa metadata 4 hashes, thêm 4 known-CRLF hashes và mô tả byte policy |
| `tests/ai-release-patch2-replay.test.ts` | Thêm: committed hashes, known checkout và tamper rejection |
| `tests/ai-release-patch2-isolation.test.ts` | Thêm: Beta SSR/bundle, baseline preservation, fail-closed transform, route probes |
| `scripts/diagnostics/patch2-browser-preview.mjs` | Thêm: compiled Preview/Production, offline và actual Preview route probes |
| `scripts/diagnostics/patch2-browser-session.mjs` | Thêm: Settings restart + pending restart/import/resume |
| `scripts/diagnostics/patch2-legacy-browser.mjs` | Thêm: finished-result browser host, legacy absence/network checks |

Thêm **9 docs/metadata artifacts** trong proposal: báo cáo này và tám file dưới `docs/qa/release-hardening-patch2/`: `patch2-files.txt`, `source-files.json`, `sanitized-qa-summary.json`, `preservation.json`, `dependency-advisories.json`, `replay-hash-changes.json`, `release-manifest.json`, `release-manifest.sha256`.

**Tổng proposal: 20 paths**, chưa stage. [Exact list](qa/release-hardening-patch2/patch2-files.txt), [source hashes](qa/release-hardening-patch2/source-files.json), [manifest dự thảo](qa/release-hardening-patch2/release-manifest.json), [checksum](qa/release-hardening-patch2/release-manifest.sha256).

Manifest mới mô tả **delta trên checkpoint 3817b7e**, không phải inventory full clean export mới. 18 hashed members + manifest/sidecar envelope = đúng 20 paths; không nhúng self-hash. Manifest Patch 1 và package 157-file cũ giữ nguyên như historical checkpoint; verifier Patch 1 không được dùng để khẳng định patched worktree vẫn nguyên package cũ. Patch 2 có hashes/approval state riêng, chưa được Owner duyệt. Khi được cho phép stage sau này, phải bảo toàn exact bytes, tránh Git tự chuyển LF/CRLF như đã phát hiện ở bước export trước.

## 3. Dependency security trước/sau

[Phân tích đầy đủ](qa/release-hardening-patch2/dependency-advisories.json), [lock resolver diff](qa/release-hardening-patch2/lock-resolver-diff.json), [npm checks](qa/release-hardening-patch2/dependency-checks.json).

| Phạm vi | Trước | Sau, xác minh lại trên registry |
| --- | --- | --- |
| Root full audit | 1 high + 10 moderate | **0 high, 10 moderate, 0 critical**, exit 1 |
| Root `--omit=dev` | Chưa tách riêng ở audit cũ | **0 findings**, exit 0 |
| Mobile full audit | 0 findings | **0 findings**, exit 0 |
| Mobile `--omit=dev` | Chưa tách riêng ở audit cũ | **0 findings**, exit 0 |

High finding là [Zod oversized collection memory exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). Dependency chain: **root devDependency `eslint-plugin-react-hooks@7.1.1` → `zod@4.6.5`**, range `^3.25.0 || ^4.0.0`. Đây là transitive **dev/tooling dependency**, không phải schema validator runtime của Companion V3 và không được ship trong client graph Beta.

Đã chạy targeted resolver update:

```text
npm update zod --package-lock-only --ignore-scripts --no-audit --fund=false
```

Kết quả **Zod 4.6.5 → 4.6.7**, tương thích range của parent. Không thêm direct dependency/override, không đổi `package.json`, không chạy `npm audit fix` hoặc `--force`. **Không dependency nào khác đổi version, resolved URL hoặc integrity**. npm 11.6.2 thêm `peer:true` cho 12 entries khác khi tái sinh lock metadata; giữ output resolver thay vì chỉnh lock thủ công. Root/mobile `npm ci --ignore-scripts` PASS, lockfiles không đổi sau install/audit. Mobile package và lockfile nguyên trạng.

**10 moderate còn lại đều là dev tooling** do [minimatch globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249), bản locked **10.2.6**. Direct affected packages: `@eslint/js`, `eslint`, `typescript-eslint`. Transitive: `@eslint/config-array`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree`, `@typescript-eslint/utils`, `minimatch`. Đây là affected-package counts lan qua dependency graph, không phải 10 root-cause vulnerabilities độc lập.

Các parent hiện yêu cầu minimatch `^10.2.4`, `^10.2.2`, `^10.2.5`; bản sửa ngoài affected range cần **>=11.0.1**, không nằm trong các range đó. Không ép override major, downgrade cả lint stack hoặc nâng cấp hàng loạt. Rủi ro còn lại là DoS/resource exhaustion khi tooling/CI xử lý glob/input không tin cậy; người dùng static Beta không chạy lint stack này. Runtime audits bằng 0 **không thay thế quyết định risk acceptance**. Owner cần duyệt residual risk hoặc task dependency riêng tương thích trước release; không tuyên bố vulnerability-free.

## 4. Replay reproducibility

Các SHA-256 trước/sau:

| JSON replay | Trước: CRLF worktree hash | Sau: exact committed LF blob hash |
| --- | --- | --- |
| `docs/playtests/a-log.json` | `c2dcab0ad2da86ddd65702e624fd4ccfefaeffee70e0c41450fc7ad31f764ef7` | `9c211e051c0ba3cdd4a27e6febb4f49d7b67a27cb4a50854e518da04212bf0c5` |
| `docs/playtests/b-log.json` | `2714eb509508656e941d6da00cea1d4b32dff39de410421c349407d3396eb266` | `422d69f21e0e28a0d8574ef263591cc987c1421ba476b0779e1926e79e9df477` |
| `docs/playtests/original-log.json` | `9952dc58cb48841c227440cf08721b3f419f32fdc6f65ba658d7dd560826dd00` | `fe80ab162036a77b6aeb11cb193753aca92dc485d75f464d5b59beac6d2dff02` |
| `docs/playtests/v2_2-b-log.json` | `a1f5626ee6557418d9a6c3aba4fe654d4d50f2dbc6e3723972f19f1986c117d9` | `def4500c782dd0f7cf175f396e7d7d2f3e4fa9ecaf044d740cffae56bda586fe` |

Metadata `sha256` nay chỉ exact committed bytes. Bốn hash cũ được giữ dưới `crlfCheckoutSha256`. Verifier chỉ chấp nhận exact canonical hash; hoặc **đúng known CRLF hash đã pin**, rồi xác minh LF bytes của chính representation đó phải tái tạo canonical hash. Nó không chấp nhận arbitrary/mixed EOL/content thay đổi, không ghi file và không cần Git ở runtime. Gzip vẫn hash nguyên compressed bytes. Replay engine đọc bytes thực tế như trước; không đổi semantics hoặc 139 paths/scenarios.

Standard command giữ nguyên:

```text
node --experimental-strip-types scripts/diagnostics/readiness-patch1-replays.ts
```

**PASS 139/139** trên worktree: 135 exact + 4 verified known-CRLF. Cũng **PASS 139/139** bằng chính standard command trong QA fixture workspace lấy exact committed bytes từ frozen export: **139 exact, 0 checkout compatibility**. Đây không phải direct semantic probe thay thế standard gate. [Worktree report](qa/release-hardening-patch2/replays.json), [portable standard report](qa/release-hardening-patch2/portable-standard-replays.json), [hash changes](qa/release-hardening-patch2/replay-hash-changes.json).

Script nay ghi report dưới thư mục Patch 2, không overwrite `release-readiness-patch1/replays.json`. TDD đã ghi RED cho canonical hash mismatch, rồi GREEN cho exact/known checkout và content tamper rejection.

## 5. Beta-only legacy AI isolation

Đã audit `api/ai-coach.ts`, server handler, root Vite middleware, `GameResultModal.tsx`, `AICoachPanel` và `/api/ai-coach`. **Không file nào trong các baseline UI/API/server/root/mobile config đó bị sửa**.

Plugin riêng `release/beta/legacy-ai-isolation.ts` chỉ được cài bởi Beta config sau build gate:

1. Vite pre-transform đọc AST TSX của đúng `GameResultModal.tsx`, bỏ **một legacy accordion chứa AICoachPanel và import tương ứng** trong code gửi tới compiler. Không ghi lại source UI. Nếu cấu trúc không còn đúng một import/panel/accordion thì build fail closed để yêu cầu review.
2. Chặn các module legacy Coach/server/API đi vào graph Beta, kể cả case variants và query suffix trên Windows. Actual emitted Beta JS không có `/api/ai-coach`, Gemini endpoint/key reference hoặc legacy trigger code.
3. Middleware riêng dev **và Preview** trả 404 JSON cho legacy route, kể cả encoded path/trailing slash. Không proxy hoặc gọi provider.

Cơ chế dựa trên [Vite plugin API](https://vite.dev/guide/api-plugin) và [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API); TypeScript đã là devDependency sẵn có, không thêm SDK hay dependency runtime. Plugin chỉ ảnh hưởng artifact Beta; ordinary Mobile/Production config không cài nó.

Outcome tests dùng real SSR component và actual Beta bundle đã RED trước fix và GREEN sau fix. Ordinary Mobile vẫn render Coach cũ và financial facts; Beta không còn heading/CTA gây nhầm lẫn. Main JS/CSS của ordinary Mobile production build còn **nguyên hash so clean-export build trước đó**: [comparison](qa/release-hardening-patch2/ordinary-mobile-bundle-comparison.json).

Browser 320/390 kiểm real finished component với đúng Beta plugin và app styles: không có legacy accordion/CTA, financial facts còn nguyên; UI không phát request AI. Actual Preview và dev host đều từ chối ba route probes với 404. [Legacy browser result](qa/release-hardening-patch2/browser-legacy.json), [320](qa/release-hardening-patch2/legacy-isolated-320.png), [390](qa/release-hardening-patch2/legacy-isolated-390.png).

**Giới hạn phạm vi:** legacy implementation vẫn tồn tại trong baseline repository để không sửa Production/source của Phát; nó bị loại khỏi Beta graph, không phải bị xóa khỏi toàn repository. Root dev API cũ giữ hành vi trước đó. Static Beta không có server functions; future deployment vẫn phải chọn đúng `release/beta` root/config và project gate. Chưa kiểm navigation hoàn chỉnh từ đầu game tới end-game trên hosted origin; finished UI được kiểm trong QA-only component host và emitted bundle.

## 6. Validation trên Node 22.x

Đã tải **Node 22.23.4** từ Node.js official distribution và khớp SHASUMS256; npm **11.6.2**. Tất cả QA chính sau fix dùng Node 22, tương ứng dòng runtime release config. [Checks](qa/release-hardening-patch2/checks.json), [final checks](qa/release-hardening-patch2/final-checks.json), [summary đã lọc](qa/release-hardening-patch2/sanitized-qa-summary.json).

| Gate | Kết quả |
| --- | --- |
| Product regression, gồm P4/P5 acceptance/consistency/hardening/refinement/safety | **1.050/1.050 PASS** = 1.044 cũ + 6 tests Patch 2; fail/cancelled/skipped = 0 |
| Diagnostics | **85/85 PASS** trong một lượt đầy đủ; có bootstrap `node_modules/.tmp` |
| 39 accepted outputs deep equality | **39/39 PASS**, presenter/catalog/AFTER nguyên hash, fetch bị chặn, 0 network attempts |
| Standard historical replays | **139/139 PASS** trên checkout và **139/139 exact committed inputs** ở portable QA |
| Product lint | **PASS**; không sửa eslint config gốc |
| Root/mobile/strict release-config typecheck | **PASS / PASS / PASS** |
| Root/mobile/isolated Preview builds | **PASS / PASS / PASS**, mobile chunk-size warning cũ còn |
| Production Beta build | **REFUSE**, exit 1 đúng kỳ vọng |
| Compiled Preview ON / Production OFF | **4 cases PASS** (2 questions × 320/390), offline answer, no API, query attack OFF, save/origin isolation |
| Session safety | **13 records PASS**: real main-app Settings restart + 12 pending restart/import/resume qua actual components/save loader |
| Legacy browser/network | **2 viewports PASS**, no CTA, no API/provider request; 3 Preview + 3 dev route probes đều 404 |
| npm audit | Root 0 high/10 moderate dev; root runtime/mobile bằng 0, VERIFIED |

Một lượt lint `eslint .` ban đầu quét cả npm CLI vendor được tải vào evidence local và báo lỗi từ vendor đó. Lint product đã chạy lại thành công, chỉ exclude ba cây artifact/tooling: `docs/qa/clean-export/npm-tool/**`, `docs/qa/release-hardening-patch2/node22-runtime/**`, `artifacts/clean-export/**`; không exclude product source/tests.

Session browser lần đầu chỉ đạt Settings restart vì component host dựa vào DEV flag, trong khi việc tạo Preview server đã đặt Node environment thành production. Đã sửa **QA host** để dùng Preview defines từ cùng build policy và cùng isolation plugin, rồi PASS đủ 13 records; không đổi application logic. Giữ [first attempt](qa/release-hardening-patch2/browser-session-first-attempt.json) và [final run](qa/release-hardening-patch2/browser-session.json). Import/resume pending vẫn là QA component host, không được ghi thành full main-app import navigation coverage. External fonts bị chặn; không có external AI request. Hosted URLs, real project IDs và physical devices chưa chạy.

## 7. Điều kiện Owner duyệt trước clean export mới

Owner cần nghiệm thu **20-path proposal và manifest/checksum mới**, cơ chế build-time Beta isolation, replay byte policy và residual **10 dev moderate**. Nếu chưa risk-accept thì cần task dependency tương thích riêng; không tự ép minimatch major hoặc đổi cả toolchain.

Sau nghiệm thu, vẫn cần phê duyệt riêng cho stage/commit Patch 2. Chỉ sau commit được duyệt mới tạo clean export mới từ exact committed tree với bytes được bảo toàn, audit full tree và rerun reproducibility checks. Clean export cũ không được thay thế âm thầm. Việc tạo GitHub Private, push, tạo Vercel Beta project, exact project-ID provisioning và Hosted Preview là các bước riêng, chưa có quyền thực hiện.

**Đã dừng ở diff + draft manifest + QA evidence. Không stage/commit/push/merge hoặc deploy; Production OFF.**
