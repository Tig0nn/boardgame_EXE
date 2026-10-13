> **CURRENT** — Inventory và kết quả audit tài liệu ngày 13/10/2026. Nguồn mô tả MVP chuẩn: [CURRENT_MVP.md](CURRENT_MVP.md).

# Audit tài liệu và đồng bộ MVP

## Baseline, phạm vi và phương pháp

Repository `Tig0nn/boardgame_EXE`, nhánh `feat/mobile-v2-4-engine-integration`, baseline **13c9c7c5fa932e50a3ba23da4b316e1dff4cdda9**. Working tree đầu audit sạch; [PR #8](https://github.com/Tig0nn/boardgame_EXE/pull/8) được đọc API là open, merged=false, head đúng baseline, base main `406d36b`. Commit baseline chỉ kích hoạt Mobile preview, không đổi nội dung file so với `e4dfef1`.

Đã kiểm kê/đọc các tài liệu root, docs và tasks; quét toàn bộ nội dung Markdown, headings, claims/version/test counts, links và paths; đối chiếu các mô tả đang có hiệu lực với source, tests, Git history, CI log và deployment chỉ đọc. Có **22 Markdown tracked ban đầu**, thêm 4 tài liệu = **26 Markdown trong delivery**. Không mở rộng audit sang Markdown trong dependency, attachment hoặc thư mục nội bộ ignored.

Không tái thực hiện nghiên cứu tài chính hoặc suy dữ liệu hiện tại từ simulation cũ. Đã đọc log [CI run 38421516083](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38421516083), job [verify](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38421516083/job/115379765365): **186 product tests + 21 diagnostics**, 0 fail, hai clean install/lint/hai build qua, Node 22.23.3/Ubuntu. Đây là run ở SHA baseline; commit docs sau đó cần đọc run của chính HEAD mới, không được tự gán kết quả cũ.

Trong audit, HTTP Mobile `/` trả 200/title Mobile; GET `/api/ai-coach` trả 405 JSON. CLI xác nhận project Mobile riêng, Ready/Production, Function tồn tại, và cấu hình build/output của hai project khác nhau. User đã xác minh hình ảnh setup/board/HUD/3D/dice. Không chơi online đủ ván, gọi AI provider, đọc secret, thử điện thoại thật hoặc chạy lệnh deploy/merge.

Follow-up sau commit docs `5c91a8c`: PR head đã khớp và working tree sạch; offline docs check qua lại. Actions API cho SHA đó trả **0 workflow runs** tại lúc đọc, trong khi hai status Vercel tự động success. Vì vậy latest verified Actions vẫn ở `13c9c7c` (cùng code sản phẩm), không phải một run mới trên HEAD docs. Nguyên nhân thiếu run chưa xác định; không tự sửa CI/dispatch rerun. Ghi rõ khoảng trống này cho final PR review thay vì tuyên bố CI HEAD mới đã xanh. Ghi chú này được commit riêng, vẫn chỉ Markdown.

## Inventory đầy đủ và phân loại

CURRENT = đang duy trì; HISTORICAL = bản ghi implementation/research/verification ở mốc cũ; SUPERSEDED = spec/prompt/guide/task đã được thay cho việc sử dụng hiện tại, vẫn giữ lịch sử. Một report V2.4 vẫn có thể HISTORICAL vì số test, deployment và phạm vi test chỉ đúng ở thời điểm ghi.

| Tệp Markdown (đường dẫn repository) | Phân loại | Quyết định và phạm vi |
| --- | --- | --- |
| [README.md](../README.md) | CURRENT | Quick start hai app, status code/CI/deploy đúng phạm vi, trỏ canonical |
| [MOBILE_APP_HANDOFF.md](../MOBILE_APP_HANDOFF.md) | CURRENT | Kiến trúc shared engine, file/assets thật, actual Mobile hosting và limits |
| [AI_COACH_HANDOFF.md](../AI_COACH_HANDOFF.md) | CURRENT | Panel nằm ở Mobile, schema/ID grounding không tuyệt đối, key chỉ server |
| [CODEX_PROMPT_IMPLEMENT_V2.md](../CODEX_PROMPT_IMPLEMENT_V2.md) | SUPERSEDED | Prompt triển khai V2, không phải chỉ dẫn tác vụ đang hoạt động |
| [docs/CURRENT_MVP.md](CURRENT_MVP.md) | CURRENT | Nguồn mô tả MVP chuẩn, technical facts từ code |
| [docs/README.md](README.md) | CURRENT | Index current/historical/evidence/limits |
| [docs/DOCUMENTATION_AUDIT.md](DOCUMENTATION_AUDIT.md) | CURRENT | Inventory, contradiction matrix, validation và preservation |
| [docs/PR8_FINAL_REVIEW.md](PR8_FINAL_REVIEW.md) | CURRENT | Giữ chronology gốc; follow-up dated cập nhật deployment/CI/limits |
| [docs/XVTL_GAME_SPEC_V2.md](XVTL_GAME_SPEC_V2.md) | SUPERSEDED | Spec V2 10/10/2026; current mode/catalog/AI đã thay đổi |
| [docs/V2_IMPLEMENTATION_REPORT.md](V2_IMPLEMENTATION_REPORT.md) | HISTORICAL | Triển khai V2 10–11/10/2026, 81 tests và browser ba vòng ở mốc cũ |
| [docs/V2_BALANCE_REPORT.md](V2_BALANCE_REPORT.md) | HISTORICAL | 55.000 ván heuristic V2, không phải V2.4 production measurement |
| [docs/V2_BOARD_BALANCE_ANALYSIS.md](V2_BOARD_BALANCE_ANALYSIS.md) | HISTORICAL | Thí nghiệm bố trí/khuyến nghị C20; bảng/seed/CI giữ nguyên |
| [docs/V2_GAME_LENGTH_ANALYSIS.md](V2_GAME_LENGTH_ANALYSIS.md) | HISTORICAL | Horizon thử nghiệm; không tự thêm 5/6/8/12 vòng vào UI |
| [docs/V2_1_PLAYTEST_READINESS.md](V2_1_PLAYTEST_READINESS.md) | HISTORICAL | Mặc định Original và lựa chọn ba mode ở thời điểm V2.1 |
| [docs/V2_2_MECHANICS_REVIEW.md](V2_2_MECHANICS_REVIEW.md) | HISTORICAL | Research trước phê duyệt + ghi chú phê duyệt; không đổi câu/bảng cũ |
| [docs/V2_2_IMPLEMENTATION_REPORT.md](V2_2_IMPLEMENTATION_REPORT.md) | HISTORICAL | Profile savings đã duyệt, 109 + 19 tests theo mốc V2.2 |
| [docs/V2_2_SOLO_TEST_GUIDE.md](V2_2_SOLO_TEST_GUIDE.md) | SUPERSEDED | Sáu ván/seed/luật V2.2; không dùng làm default guide V2.4 |
| [docs/MVP_MOBILE_UI_REPORT.md](MVP_MOBILE_UI_REPORT.md) | HISTORICAL | Responsive root Web V2.2, không phải illustrated Mobile app |
| [docs/MVP_UX_AUDIT_AND_FIXES.md](MVP_UX_AUDIT_AND_FIXES.md) | HISTORICAL | Atomic stocks/input root Web trước giới hạn Bank/Business mới |
| [docs/GD_ARTWORK_INTEGRATION_REPORT.md](GD_ARTWORK_INTEGRATION_REPORT.md) | HISTORICAL | Root Web artwork/SVG/pawn, không chứng minh icon Mobile C20 đúng |
| [docs/V2_3_BUSINESS_IMPLEMENTATION_REPORT.md](V2_3_BUSINESS_IMPLEMENTATION_REPORT.md) | HISTORICAL | Matching theo scenario và follow-up giới hạn encounter V2.3 |
| [docs/V2_4_BUSINESS_UX_REPORT.md](V2_4_BUSINESS_UX_REPORT.md) | HISTORICAL | V2.4 business trên root Web, 155 + 19 tests trước Mobile integration |
| [docs/MOBILE_V2_4_FINANCIAL_INTEGRATION_REPORT.md](MOBILE_V2_4_FINANCIAL_INTEGRATION_REPORT.md) | HISTORICAL | Local Mobile parity/replay, 180.000 ván, audit artwork; hosting/CI có follow-up sau |
| [tasks/plan.md](../tasks/plan.md) | SUPERSEDED | Kế hoạch V2.2 đã hoàn tất, giữ nguyên checklist lịch sử |
| [tasks/todo.md](../tasks/todo.md) | SUPERSEDED | Todo V2.2 đã hoàn tất; không là roadmap hiện tại |
| [tasks/current.md](../tasks/current.md) | CURRENT | Việc còn lại, điều kiện xác nhận và merge decision |

Tổng: **8 CURRENT / 13 HISTORICAL / 5 SUPERSEDED**. Toàn bộ 18 tài liệu archive chỉ được thêm header phân loại/link canonical. Ba entry point root được viết lại để bỏ claim sai; bản trước vẫn có tại [Git baseline README](https://github.com/Tig0nn/boardgame_EXE/blob/13c9c7c5fa932e50a3ba23da4b316e1dff4cdda9/README.md), [Mobile handoff cũ](https://github.com/Tig0nn/boardgame_EXE/blob/13c9c7c5fa932e50a3ba23da4b316e1dff4cdda9/MOBILE_APP_HANDOFF.md), [AI handoff cũ](https://github.com/Tig0nn/boardgame_EXE/blob/13c9c7c5fa932e50a3ba23da4b316e1dff4cdda9/AI_COACH_HANDOFF.md). PR8 giữ toàn bộ bản review gốc bên trong file rồi thêm follow-up, không sửa JSON evidence cũ.

## Contradiction matrix

| Claim/cách hiểu trước đây | Nguồn có thẩm quyền | Đồng bộ và cách giữ lịch sử |
| --- | --- | --- |
| README dẫn đặc tả V2 như nguồn luật hiện hành | [player factory](../src/game/new-game.ts), [modes](../src/data/modes.ts), [business](../src/game/business.ts) | Canonical mô tả V2.4; spec/prompt V2 gắn SUPERSEDED |
| Original 3/A20 là default UI; hướng dẫn chọn lại B mỗi ván | [Web Setup](../src/components/Setup.tsx), [Mobile session](../mobile_app/src/game/session.ts) | UI mới dùng B/C20/4; `createGame` và `RULES.laps` còn legacy/internal, không bị sửa |
| 6/7/8% hoặc savings 4/5/6 còn chờ duyệt | [savings.ts](../src/game/savings.ts) | B có profile 4/5/6; fallback A20/lịch sử 6/7/8; proposal/approval chronology V2.2 giữ nguyên |
| Kinh doanh V2 dùng trend/shock; V2.3 matching scenario | [business.ts](../src/game/business.ts), [customer preferences](../src/game/customer-preferences.ts) | V2.4 base 3M + 700k/tầng + 1M/tầng khớp preference; version cũ giữ cho replay |
| Bank nhiều deposit hoặc business nhiều upgrade trong một encounter (UX report cũ) | [encounters](../src/game/encounters.ts), [transactions](../src/game/transactions.ts) | Current: một deposit/upgrade mỗi encounter; nhiều lot qua nhiều encounter vẫn hợp lệ; lịch sử không bị sửa |
| Mua business xong vẫn nâng/bán hoặc cần Skip | [transactions](../src/game/transactions.ts) | V2.4 mua atomically về rolling, chặn sale/upgrade cùng lượt mua; encounter sau nâng rồi bán được |
| Đủ net worth hoặc cash HUD đồng nghĩa thắng | [selectors](../src/game/selectors.ts) | Dùng lawful proceeds ≥90M sau net quotes/debt/obligations/pending payment; loại business chưa bán và lãi chưa trả |
| Sáu công ty hư cấu là catalog của ván mới | [stock catalog](../src/data/stock-catalog.ts), [new-game factory](../src/game/new-game.ts) | `vn-v1` identity FPT/CMG/VCB/TCB/HPG/BMP, giá giả lập; `fictional-v1` giữ cho log cũ |
| “Không backend/real AI” vẫn là trạng thái repository | [Function](../api/ai-coach.ts), [server handler](../src/ai/server/handler.ts), [Mobile result](../mobile_app/src/components/GameResultModal.tsx) | Có backend/Coach tích hợp Mobile; successful provider chưa xác minh, không biến thành claim đã dùng AI thật |
| Root Web result đã có AI chỉ vì tồn tại handoff/component | [GameDialogs](../src/components/GameDialogs.tsx) | Root result chưa gắn panel; Mobile đã gắn; harness khác production result |
| AI bảo đảm 100% grounding/chống hallucination | [schema](../src/ai/schema.ts) | Kiểm shape và evidence IDs không phải kiểm ngữ nghĩa mọi câu; thay claim tuyệt đối bằng giới hạn rõ |
| Key ignore/model fallback “không bao giờ lộ” hoặc “ổn định cao” | [.env example](../.env.example), [handler](../src/ai/server/handler.ts), [panel](../src/ai/AICoachPanel.tsx) | Hướng dẫn key server-only; không suy ignore/fallback là bằng chứng không lộ hay provider thành công |
| Handoff Mobile nói economy JSON riêng/BottomBar/PortfolioModal/HistoryModal/Toast | [Mobile App](../mobile_app/src/App.tsx), [session](../mobile_app/src/game/session.ts), [components](../mobile_app/src/components/) | Bỏ cây file lỗi thời khỏi current handoff; chỉ link tên file thật; không tạo file để khớp tài liệu |
| HUD Mobile hiện cash/lương như bàn giao ban đầu | [TopHud](../mobile_app/src/components/TopHud.tsx) | Mô tả cash/debt/net worth và tiến độ lấy lawful proceeds, không tự gán số mới |
| Responsive Web/GD artwork chứng minh illustrated Mobile board/character | [Web Board](../src/components/Board.tsx), [Mobile BoardView](../mobile_app/src/components/BoardView.tsx) | Tách root Web `city-background.webp`/SVG khỏi Mobile playboard/model; icon Mobile còn lệch C20 |
| 81/109/155/168 hoặc 19 diagnostics là số current | [CI log 13c9c7c](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38421516083/job/115379765365) | Current mốc audit: 186 + 21; số cũ là lịch sử và không thay trong report gốc |
| PR8 BLOCKED vì chưa có URL Mobile/Function | HTTP 200/title Mobile, GET 405 JSON; [deployment](https://vercel.com/tris-projects-2888207c/boardgame-exe-mobile-preview/4Z5uiiuPHa9YdGT2RGyVMGvp7nnd), user visual evidence | Thêm follow-up dated; blocker thiếu URL đã được gỡ ở mức smoke, JSON review cũ giữ nguyên |
| Tên project có preview nên environment là Preview | CLI inspect deployment `dpl_4Z5uiiuPHa9YdGT2RGyVMGvp7nnd` | Current target Production của project Mobile riêng; không suy Web bị thay hoặc PR đã merge |
| Deploy Ready/GET API rejection chứng minh full online game/real AI/phone | User chỉ báo setup/board/HUD/3D/dice và GET; không có additional evidence | Roadmap giữ full online game, Android/iOS và provider test chưa hoàn tất |
| “Sẵn sàng mở PR/chưa push” của integration report là trạng thái hiện tại | [PR #8](https://github.com/Tig0nn/boardgame_EXE/pull/8), Git history | Report integration HISTORICAL; current PR đã mở/push, chưa merge |
| V2.2 plan/todo là việc đang làm | [current roadmap](../tasks/current.md), lịch sử V2.2 | Plan/todo SUPERSEDED, giữ completed checkboxes và phương pháp |
| Simulation win rates/180.000 ván là production telemetry | [V2 JSON](simulations/v2-results.json), [V2.4 JSON](simulations/v2_4-savings-lot-comparison.json) | Label heuristic offline theo snapshot/policy; không rerun, không rewrite kết quả, không áp Policy B |
| Lệnh simulation trong quick start là safe documentation check | [simulate runner](../scripts/simulate-v2.ts), các report lịch sử | Gỡ khỏi current quick start; runner có thể ghi đè evidence; docs check offline riêng |

## Validation và bảo toàn

Khi bắt đầu, **137 relative Markdown links** được kiểm tra, **0 target bị thiếu**. Vấn đề chính là semantics/version/context và các tên file trong cây handoff cũ, không phải hàng loạt Markdown link hỏng.

Các path code/asset hiện hành được kiểm theo repository root hoặc link relative tới tài liệu; filenames có case đúng cho Linux. Những cây file/tên module cũ, generated `dist`/cache và lệnh snapshot trong tài liệu archive được giữ như chứng cứ theo mốc, không được coi là file/command hiện hành cần “sửa” bằng cách tạo lại source. Link trong 18 header dẫn canonical hiện tại.

Kết quả checker đã chạy ở cả chế độ mặc định và audit: **26/26 Markdown có phân loại và inventory**, **367 relative link targets + 1 local anchor hợp lệ**, **0 link hỏng**, hai literal source paths còn lại trong current text có target đúng case; các source paths được viết dạng Markdown link đã nằm trong 367 targets. Bảy required CI commands khớp workflow, npm script names tồn tại. **18/18 archive giữ nguyên body** sau chuẩn hóa line ending; **toàn bộ PR8 review gốc vẫn nguyên** trong file có follow-up. Diff chỉ Markdown, không đổi source/config/workflow/test/assets/JSON/GZ/simulation/evidence; `git diff --check` không báo lỗi whitespace.

Generated paths (dist/cache), placeholder `.env.local`, cây file/tham số snapshot cũ và đoạn mô tả claim đã bị thay thế không được giả vờ là source tracked hiện tại. Checker không tải/đánh giá external links qua mạng; GitHub Actions/deployment URLs quan trọng được đọc riêng như nêu ở trên. Các lệnh dev/build/test được đối chiếu package/workflow và CI thực tế, không chạy lại trong audit docs. Checker chỉ đọc file/Git, không gọi provider, cài dependency, chạy simulation hoặc ghi evidence.

## Check nhẹ có thể dùng trong CI

Để giữ delivery chỉ Markdown, mã kiểm tra nằm trong code fence này; **chưa thêm workflow/job/script runtime vào repository**. Chạy từ root bằng Node có sẵn trong CI, không cần network credentials:

```sh
node -e "const fs=require('node:fs'); const text=fs.readFileSync('docs/DOCUMENTATION_AUDIT.md','utf8').replace(/\r\n/g,'\n'); const code=text.split('\n// DOC_CHECK_BEGIN\n')[1].split('\n// DOC_CHECK_END')[0]; eval(code)"
```

Checker kiểm inventory/classification, relative Markdown link targets/case, current literal source paths, command contracts, current labels/test counts, preservation và docs-only diff từ baseline. External URLs, provider availability và browser/gameplay không được chứng minh bởi checker này. Nếu baseline/contract thay đổi, cập nhật có review; không xóa guard để che thay đổi ngoài phạm vi.

```js
// DOC_CHECK_BEGIN
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = process.cwd();
const baseline = '13c9c7c5fa932e50a3ba23da4b316e1dff4cdda9';
const git = (...args) => cp.execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const split0 = text => text.split('\0').filter(Boolean);
const files = [...new Set(split0(git('ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.md')))];
const repoFiles = new Set(split0(git('ls-files', '-z', '--cached', '--others', '--exclude-standard')));
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const noFences = text => text.replace(/```[^\n]*\n[\s\S]*?```/g, '');
const audit = read('docs/DOCUMENTATION_AUDIT.md');
const inventory = new Map([...audit.matchAll(/^\| \[([^\]]+)\]\(([^)]+)\) \| (CURRENT|HISTORICAL|SUPERSEDED) \|/gm)]
  .map(m => [m[1], m[3]]));
assert.equal(inventory.size, files.length, 'Inventory must cover every Markdown file');
const counts = { CURRENT: 0, HISTORICAL: 0, SUPERSEDED: 0 };
for (const file of files) {
  const status = read(file).match(/^> \*\*(CURRENT|HISTORICAL|SUPERSEDED)\*\*/)?.[1];
  assert.ok(status, `Missing classification: ${file}`);
  assert.equal(inventory.get(file), status, `Inventory status mismatch: ${file}`);
  counts[status]++;
}
assert.deepEqual(counts, { CURRENT: 8, HISTORICAL: 13, SUPERSEDED: 5 });

function knownTarget(absolute) {
  const relative = path.relative(root, absolute).replaceAll('\\', '/');
  assert.ok(!relative.startsWith('../') && !path.isAbsolute(relative), `Path escapes repository: ${relative}`);
  assert.ok(fs.existsSync(absolute), `Missing target: ${relative}`);
  const known = fs.statSync(absolute).isDirectory()
    ? [...repoFiles].some(file => file.startsWith(relative.replace(/\/$/, '') + '/'))
    : repoFiles.has(relative);
  assert.ok(known, `Target must be tracked with exact Linux case: ${relative}`);
}
function headingIds(file) {
  return noFences(read(file)).split('\n').filter(line => /^#{1,6}\s/.test(line)).map(line => line
    .replace(/^#{1,6}\s+/, '').toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-'));
}
let relativeLinks = 0;
let localAnchors = 0;
for (const file of files) {
  for (const match of noFences(read(file)).matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    const href = match[1].trim().replace(/^<|>$/g, '');
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue;
    const [pathname, anchor] = href.split('#');
    const target = pathname ? path.resolve(path.dirname(file), decodeURIComponent(pathname)) : path.resolve(file);
    if (pathname) { knownTarget(target); relativeLinks++; }
    if (anchor) {
      assert.ok(headingIds(target).includes(decodeURIComponent(anchor)), `Missing anchor: ${file} -> ${href}`);
      localAnchors++;
    }
  }
}
const current = files.filter(file => inventory.get(file) === 'CURRENT' && file !== 'docs/DOCUMENTATION_AUDIT.md');
const currentText = file => file === 'docs/PR8_FINAL_REVIEW.md'
  ? read(file).split('## Follow-up 2026-10-13')[1] : read(file);
let sourcePaths = 0;
for (const file of current) {
  const text = noFences(currentText(file));
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    const token = match[1];
    if (/^(?:src|mobile_app|api|tests|scripts|public|\.github|docs|tasks)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|json|mjs|css|html|md|png|PNG|webp|glb|yml)$/.test(token)) {
      knownTarget(path.resolve(token)); sourcePaths++;
    }
  }
}
const rootPackage = JSON.parse(read('package.json'));
const mobilePackage = JSON.parse(read('mobile_app/package.json'));
for (const file of current) {
  for (const match of currentText(file).matchAll(/npm run ([\w:-]+)(?: --prefix ([\w/]+))?/g)) {
    const pkg = match[2] === 'mobile_app' ? mobilePackage : rootPackage;
    assert.ok(pkg.scripts[match[1]], `Unknown npm script in ${file}: ${match[0]}`);
  }
  assert.match(currentText(file), /186[\s\S]*?21/, `Current CI counts missing in ${file}`);
}
assert.ok(fs.existsSync('package-lock.json') && fs.existsSync('mobile_app/package-lock.json'));
const commands = ['npm ci', 'npm ci --prefix mobile_app', 'npm test',
  'node --experimental-strip-types --test scripts/diagnostics/*.test.ts',
  'npm run lint', 'npm run build', 'npm run build --prefix mobile_app'];
const workflow = read('.github/workflows/pr-checks.yml');
for (const command of commands) assert.ok(workflow.includes('- run: ' + command), `CI command missing: ${command}`);
const canonical = read('docs/CURRENT_MVP.md');
for (const text of ['C20', 'V2.4', '50.000.000', '14.000.000', '80.000.000', '10.000.000', '4% / 5% / 6%', 'vn-v1', 'Production', 'chưa merge']) {
  assert.ok(canonical.includes(text), `Canonical fact/limit missing: ${text}`);
}
assert.match(read('src/data/config.ts'), /startingCapital:\s*50_000_000,\s*recurringIncome:\s*14_000_000/);
assert.match(read('src/data/modes.ts'), /id:'experimental-b'[^\n]*boardLayout:'C20',\s*totalLaps:4/);
assert.match(read('src/game/savings.ts'), /id === 'v2\.2-c20'[^\n]*1: \.04, 2: \.05, 3: \.06/);

let preservedArchives = null;
let preservedPr8 = null;
if (process.env.DOCS_AUDIT_SCOPE === '1') {
  preservedArchives = 0;
  for (const file of files.filter(file => inventory.get(file) !== 'CURRENT')) {
    const original = git('show', `${baseline}:${file}`).replace(/\r\n/g, '\n');
    const text = read(file);
    assert.ok(text.startsWith('> **') && text.slice(text.indexOf('\n\n') + 2) === original,
      `Historical body changed: ${file}`);
    preservedArchives++;
  }
  const originalPr8 = git('show', `${baseline}:docs/PR8_FINAL_REVIEW.md`).replace(/\r\n/g, '\n');
  assert.ok(read('docs/PR8_FINAL_REVIEW.md').includes(originalPr8), 'Original PR8 chronology changed');
  preservedPr8 = true;
  const changed = new Set([...split0(git('diff', '--name-only', '-z', baseline)),
    ...split0(git('ls-files', '-z', '--others', '--exclude-standard'))]);
  assert.deepEqual([...changed].filter(file => !file.endsWith('.md')), [], 'Delivery must change Markdown only');
}
console.log(JSON.stringify({ markdownFiles: files.length, classifications: counts,
  relativeLinks, localAnchors, sourcePaths, requiredCommands: commands.length,
  brokenLinks: 0, preservedArchives, preservedPr8, auditScope: process.env.DOCS_AUDIT_SCOPE === '1' }, null, 2));
// DOC_CHECK_END
```

Mặc định checker có thể chạy trong CI shallow checkout với các file hiện có. Chế độ audit có thêm Git preservation/docs-only guard; cần baseline commit trong local history (hoặc checkout history đầy đủ), không cần tải khóa:

```sh
node -e "process.env.DOCS_AUDIT_SCOPE='1'; const fs=require('node:fs'); const text=fs.readFileSync('docs/DOCUMENTATION_AUDIT.md','utf8').replace(/\r\n/g,'\n'); const code=text.split('\n// DOC_CHECK_BEGIN\n')[1].split('\n// DOC_CHECK_END')[0]; eval(code)"
```
