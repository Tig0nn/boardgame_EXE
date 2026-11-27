# B18 MVP — Release Readiness QA

Ngày: **20/10/2026**, Asia/Bangkok. Nhánh QA: `codex/mvp-b18-release-qa`.

**Kết luận: NO-GO — còn P0 mất tiến trình trên Desktop khi reload.** Các kiểm tra tài chính, replay và phần lớn luồng UI đạt; chúng không thay thế release gate về bảo toàn dữ liệu. Chỉ Owner phê duyệt phát hành. Không sửa sản phẩm trong nhánh QA này.

## 1. Candidate và môi trường

Repository `Tig0nn/boardgame_EXE`; base chính xác `codex/mvp-b18-language-cleanup`, **`927e53e2189bd6d901ed494791d9dc7e912358a6`**.

| Preview được kiểm trực tiếp | Deployment | Trạng thái / SHA |
|---|---|---|
| [Mobile](https://boardgame-exe-mobile-preview-7y72c042b-tris-projects-2888207c.vercel.app) | `dpl_DtQYn1xSUpSamKqJLjx6wbPYeQgY` | READY, đúng base SHA |
| [Desktop](https://boardgame-r8ukc7g79-tris-projects-2888207c.vercel.app) | `dpl_DmJw97ahvKXwMvjcWPaSHJg2zVXS` | READY, đúng base SHA |

Vercel connector trả 403 theo scope; fallback CLI dùng credential hiện có của cùng team đã xác minh READY và `gitSource.sha`/`githubCommitSha`. Không đổi quyền bảo vệ. Native inspect xác định target Preview; API có `target:null` cho deployment không phải production. Chứng cứ: `playtests/b18-release-qa/{mobile,desktop}-{deployment,provenance}.json`.

Windows, Node 22.14.0; Playwright headless, **Chromium 149.0.7827.55, Firefox 153.0, WebKit 26.5**. Firefox/WebKit được cài bằng runtime QA, không sửa dependency/lockfile sản phẩm. Cả 6 cặp browser × URL trả HTTP 200, load UI, 0 page error; probe cuối ghi 0 console error và 0 request thất bại. Các ván/ma trận đều truy cập đúng hai URL trên, không dùng localhost thay thế.

## 2. Phát hiện còn tồn tại

### RQA-01 — P0: Reload Desktop làm mất ván đang chơi

**FAIL; chặn phát hành chung hai giao diện.** Phân loại P0 theo tiêu chí Owner “mất dữ liệu”. Đây là hành vi đã có trong candidate, không kết luận lỗi do đợt language cleanup gây ra.

Tái hiện bằng UI thật trên Desktop Preview, Chromium 1440×844, seed `LANG-0`:

1. Setup tiền mặt 50M, tiết kiệm 0; bắt đầu vòng 1.
2. Gieo ra 6, dừng Ngân hàng ô 7. Gửi 6M thành công.
3. Trước reload: tiền mặt 44M, tiết kiệm 6M; giao dịch nằm trong nhật ký.
4. Reload trang: quay lại Setup 50M/0M. Không có Continue, import hoặc save cục bộ để phục hồi ván tại Desktop.

Nguồn: `src/App.tsx` chỉ giữ `game` bằng React state; `Setup.tsx` của Desktop chưa có đường restore/import. Thông báo “Ván chơi được giữ trong bộ nhớ của trang” xuất hiện khi chủ động Chơi mới, không bảo vệ được thao tác reload.

| Bằng chứng | Tệp |
|---|---|
| Sau giao dịch, trước reload | [Ảnh](playtests/b18-release-qa/storage/desktop-transaction-before-reload.png) |
| Sau reload | [Ảnh](playtests/b18-release-qa/storage/desktop-after-reload.png) |
| Trace thao tác thực tế | [Playwright trace](playtests/b18-release-qa/storage/desktop-reload-trace.zip) |
| Log tải qua UI trước reload | [JSON gzip](playtests/b18-release-qa/storage/desktop-before-reload.json.gz) |
| Kết quả kiểm và tái hiện | [Storage results](playtests/b18-release-qa/storage/results.json) |

**Đề xuất sửa để Owner duyệt:** tái sử dụng boundary save/load/import hiện có cho Desktop; lưu sau hành động thành công, resume đúng trạng thái, có cảnh báo khi lưu lỗi và phương án export. Bổ sung regression gửi tiền → reload → Continue → đối chiếu toàn state/log; quay Setup, import schema cũ, quota/read-denied và ván đã kết thúc. Không cần đổi engine/economics/schema. Sau sửa phải có candidate SHA/Preview mới và chạy lại các gate liên quan.

Biện pháp tạm thời cho phiên thử nội bộ: tải JSON trước khi rời Desktop, rồi **chủ động** import tệp đó vào Mobile. Đã kiểm chứng chuyển thủ công giữ giao dịch. Đây không phải lý do chuyển NO-GO thành GO; Desktop chưa có phục hồi trực tiếp sau khi tiến trình đã mất mà không có bản xuất.

| Mức | Số phát hiện sản phẩm còn mở |
|---|---:|
| P0 | **1 — RQA-01** |
| P1 | 0 phát hiện thêm trong phạm vi đã kiểm |
| P2 | 0 phát hiện xác nhận cần sửa trong đợt này |
| P3 | 0 ticket phát sinh; giới hạn kiểm chứng ghi riêng bên dưới |

Không tự sửa P0/P1 hoặc mở rộng gameplay. Diff nhánh chỉ có script QA, báo cáo và bằng chứng.

## 3. Luồng và kết quả

| Luồng | Kết quả và phạm vi |
|---|---|
| Setup vốn 50M, onboarding | **PASS**: đọc cả 6 bước trên 320px ở 3 browser; phân bổ qua control thật. |
| Bàn B18, xúc xắc, Xuất phát | **PASS**: 18 ô, kiểm 9 loại ô; mỗi roll trong log mới khớp `(vị trí trước + xúc xắc) % 18`; đủ 4 quyết toán và 4 lần nhận lương ở các ván hoàn chỉnh. |
| Khóa 6M/+2M và 10M/+4M | **PASS**: hai thứ tự qua UI, học phí/tăng lương/thu nhập thêm khớp log; trường hợp không đủ tiền xuất hiện trong ván all-savings. |
| Gửi kỳ hạn 1/2/3 | **PASS**: kỳ 1 ở Setup, kỳ 2 tại Bank trong ván savings; kỳ 3 ở Setup các ván funding và Desktop all-savings. Mốc tuyệt đối/rate từ log giữ nguyên. Không khẳng định cả ba kỳ đều được gửi mới tại Bank trong một ván. |
| Stocks/Bonds/Gold: mua, bán, bỏ qua | **PASS**: ván trades mua 1/3/2 và bán 1/2/2 tương ứng; bỏ qua trong các ván course/cash. Có bán tại ô Gold/Bonds và quyền bán tại Xuất phát. Bán ngay tại ô Stocks được kiểm riêng bằng checkpoint replay hợp lệ, không tính thêm ván từ đầu. |
| Business mua/nâng/bán | **PASS**: 1 lần mở, 1 nâng cấp, 1 bán trong ván UI business. |
| Sự kiện và Biến cố cá nhân | **PASS**: cú sốc tự nhiên và sửa xe qua UI; medical/funding có fixture lịch sử đã import. Không tạo thêm biến cố hoặc đổi số tiền. |
| Thiếu tiền/rút tiết kiệm/vay/bán để funding | **PASS**: rút toàn khoản 1 lần, vay 1 lần trong hai ván UI riêng; ván asset-funding bán trái phiếu 3 lần để trả thiếu. |
| Thắng/thua, mục tiêu 90M | **PASS**: Mobile và Desktop đều có kết quả thắng/thua tự nhiên đủ 4 vòng; 13 ván hoàn chỉnh được replay độc lập. |
| Mobile reload/resume | **PASS**: reload sau giao dịch, Continue ở Setup giữ nguyên save; không mất giao dịch đã hoàn tất. |
| Mobile về Setup sau kết thúc | **PASS**: hiện “Xem lại ván … đã kết thúc”, không nhận nhầm thành Continue ván đang chơi. Không có nút về Setup trực tiếp giữa ván; đường giữa ván được kiểm qua reload → Setup → Continue. |
| Desktop reload/resume | **FAIL — RQA-01**. Desktop export JSON hoạt động; restore/import ở Desktop chưa có. |
| Import B18 cũ/Multi-Course/C20 | **PASS tại Mobile**: schema 4/5/6/7, phase/portfolio/log length đúng, reload giữ nguyên; checkpoint tín dụng chậm trả/vỡ nợ giữ phiên bản. **BLOCKED tại Desktop** do không có UI import. |
| JSON hỏng/schema không hỗ trợ | **PASS tại Mobile**: báo lỗi tiếng Việt, không tạo game hoặc crash. |
| localStorage hỏng/read-denied/quota | **PASS tại Mobile**: không false-resume hoặc crash; quota có cảnh báo và export thủ công vẫn dùng được. Đây là fault injection Storage API, không chèn game state. |
| Chuyển domain | **PASS** với export Desktop → chọn tệp import Mobile thủ công, không tự đọc/chuyển save giữa origin. |

### Các ván hoàn chỉnh tự nhiên

Tất cả bắt đầu tại Setup rồi ra quyết định qua UI; không gán state vào localStorage hay gọi engine trong trang. Đơn vị nguồn tiền: đồng.

| Browser / giao diện / case | Seed | Kết quả | Nguồn tiền hợp lệ |
|---|---|---|---:|
| Chromium Mobile · cơ bản trước, 320px | `TRADING-AB-MAIN-0` | Thắng | 94.000.000 |
| Chromium Mobile · nâng cao trước, 390px | `TRADING-AB-MAIN-0` | Thắng | 94.000.000 |
| Chromium Mobile · trades, 390px | `B18-UI-TRADES` | Thua | 84.635.118 |
| Chromium Mobile · business, 768px | `TRADING-AB-MAIN-0` | Thua | 85.500.000 |
| Chromium Mobile · savings, 390px | `TRADING-AB-MAIN-0` | Thắng | 95.000.000 |
| Chromium Mobile · rút tiết kiệm, 390px | `B18-MULTICOURSE-SCREEN-0` | Thua | 78.000.000 |
| Chromium Mobile · vay, 390px | `B18-MULTICOURSE-SCREEN-0` | Thua | 89.329.927 |
| Chromium Mobile · bán để funding, 390px | `RELEASE-ASSET-FUND-3` | Thua | 74.925.307 |
| Chromium Desktop · học hai khóa, 1440px | `TRADING-AB-MAIN-0` | Thắng | 94.000.000 |
| Chromium Desktop · tiền mặt, không học, 1440px | `TRADING-AB-MAIN-0` | Thua | 86.000.000 |
| Chromium Desktop · tiết kiệm 50M/kỳ 3, 1440px | `TRADING-AB-MAIN-0` | Thắng | 95.000.000 |
| Firefox Mobile · cơ bản trước, 320px | `TRADING-AB-MAIN-0` | Thắng | 94.000.000 |
| WebKit Mobile · nâng cao trước, 390px | `TRADING-AB-MAIN-0` | Thắng | 94.000.000 |

[CSV kết quả](playtests/b18-release-qa/natural-game-results.csv) tách tiền mặt, gốc savings, giá bán ròng từng tài sản, nợ/nghĩa vụ, vốn quán loại khỏi đích, phí/spread. [JSON kiểm chứng](playtests/b18-release-qa/new-game-verification.json) chứa hash log và số hành động. 13 ván từ đầu + 3 log bán phần (Desktop trước reload, quota export, Stocks fixture sau bán) = **16 log xuất qua UI**, đều replay đúng.

Một số thử nghiệm ban đầu chỉ là lỗi/giả định của harness: selector Desktop thiếu nút “Đã xem tác động”, đã sửa và chơi lại; kịch bản all-savings dự kiến thua thực tế thắng 95M, đã đổi tên bằng chứng và chơi thêm cash/no-course để có ván Desktop thua thật. Giữ kết quả thực tế, không chỉnh luật/golden để ép outcome. `gameplay/results.json` lưu lần thử đầu có hai lỗi selector; kết quả Desktop chạy lại nằm ở các `results-desktop-*.json` và log xuất cuối.

Để phủ nhánh funding còn thiếu, script lập kịch bản giới hạn tối đa 12 seed tìm được seed thứ 4 bằng command engine hợp lệ. Sau đó seed được chơi độc lập đầy đủ trên Preview. Dữ liệu lập kịch bản được ghi rõ **không phải bằng chứng UI**, không phải nghiên cứu cân bằng. Stocks checkpoint là tiền tố replay chính xác của fixture parity tự nhiên `frozen-shortlist-diversified-roi`; không chèn tài sản/phase, không tính như ván mới từ đầu.

## 4. Giao diện, ngôn ngữ và tài chính

**268 kiểm tra bề mặt, 0 finding/0 page error**, trên 24 cặp browser × giao diện × viewport. Mỗi browser kiểm cả Mobile và Desktop ở 320/390/768/1440px: Setup, tooltip, Tab/Enter/Escape giữ modal cha, cuộn tới nút mua, màn trái phiếu, đổi viewport ngang và chiều cao ngắn.

- Tooltip mở bằng chạm ở 320/390, hover ở màn lớn; bàn phím được Tab tới trigger, Enter mở, Escape đóng tooltip mà không đóng modal cha. Không phát hiện tooltip che CTA trong các điểm đo.
- Trial click của Playwright kiểm tra nút mua có thể cuộn tới và hit-test; thao tác mua/bán thật được thực hiện trong các ván gameplay riêng.
- Quét text thực tế không thấy `deposit-*`, `bond-*`, `lot-*` hoặc START làm tên ô trong các màn được mở. Giữ câu glossary giải thích START là tên kỹ thuật, AI Coach, JSON, tên thương hiệu/doanh nghiệp, mã cổ phiếu/xếp hạng và dữ liệu kỹ thuật nguyên bản.
- 16 log mới replay khớp toàn state. Phí/spread được tính lại từ báo giá trước giao dịch và đối chiếu tiền thực nhận; ví dụ ván trades: phí **124.517đ**, spread **129.790đ**, tổng **254.307đ**, đúng phản hồi kết quả.
- Nguồn tiền được kiểm bằng tiền mặt + gốc tiết kiệm active + báo giá bán ròng tài sản tài chính − nợ/nghĩa vụ. Không cộng quán hoặc khoản tín dụng chưa thực nhận thêm một lần.
- Fixture tự nhiên `frozen-holdout-novice` có giá trị quán **17.802.817đ** nhưng nguồn về đích chỉ **77.104.109đ**, kết quả thua; đã xem kết quả và giải thích loại vốn khóa qua import. Delayed/defaulted checkpoints được mở phần chi tiết và reload nguyên trạng. Không biến giả thuyết nguyên nhân thắng/thua thành nhận xét thực nghiệm.

Ảnh tiêu biểu:

| Nội dung | Bằng chứng |
|---|---|
| Chromium 320 · tooltip chạm | [Ảnh](playtests/b18-release-qa/surfaces/chromium-mobile-320-tooltip-touch.png) |
| Firefox 390 · modal trái phiếu | [Ảnh](playtests/b18-release-qa/surfaces/firefox-mobile-390-bond-dialog.png) |
| WebKit 390 · modal trái phiếu | [Ảnh](playtests/b18-release-qa/surfaces/webkit-mobile-390-bond-dialog.png) |
| Desktop 1440 · kết quả thua | [Ảnh](playtests/b18-release-qa/gameplay/desktop-defeat-result.png) |
| Mobile · kết quả trades | [Ảnh](playtests/b18-release-qa/gameplay/mobile-trades-result.png) |
| Bán ngay tại ô Stocks | [Ảnh](playtests/b18-release-qa/stock-resale/stock-sale-preview.png) |
| Quán chưa bán không tính vào đích | [Ảnh](playtests/b18-release-qa/storage/unsold-business-excluded-from-goal.png) |
| Quota lưu lỗi | [Ảnh](playtests/b18-release-qa/storage/quota-warning.png) |

## 5. Regression và integrity

| Gate | Kết quả |
|---|---|
| Product | **349/349 PASS**, đúng baseline |
| SSR/UI | **46/46 PASS**, đúng baseline, 12 test cấp cao gồm subtest |
| Historical replay | **81/81 PASS**, dùng danh sách đóng băng từ base; hash không đổi |
| Research parity | **13 ván / 2.306 before-after snapshot PASS**, 3 phase; không ghi lại fixture |
| Ván/log QA mới | **16/16 replay PASS**, gồm 13 ván hoàn chỉnh |
| Lint | **PASS**, root ESLint bao phủ Desktop/Mobile và TS diagnostic |
| Build Desktop/Mobile | **PASS**, đúng asset hash candidate; không deploy |
| Base evidence integrity | **PASS**: 48 source hash, 90 artifact language cleanup + 381 artifact các đợt trước; không đổi golden |
| Preview/runtime | **PASS**: READY/đúng SHA, 6 probe HTTP 200, không ghi nhận JS nghiêm trọng |
| Save/resume toàn sản phẩm | **FAIL**: Desktop RQA-01 |

Log và JSON từng gate nằm riêng trong `playtests/b18-release-qa/`; không ghi đè báo cáo/replay lịch sử. Manifest QA lưu hash source và raw artifact. Các trace của ván thành công được bỏ khỏi gói để tránh hàng trăm MB/frame 3D; giữ JSON xuất, screenshot và run log. Trace tái hiện lỗi Desktop được giữ. Không chỉnh ảnh để che lỗi.

## 6. Giới hạn chưa kiểm chứng

- **Safari/iOS thật, Android/iPhone/iPad vật lý: CHƯA KIỂM CHỨNG.** WebKit Windows của Playwright không phải Safari trên iOS.
- Xoay màn hình là đổi kích thước viewport; bàn phím ảo là mô phỏng giảm chiều cao. Không báo PASS cho bàn phím hệ điều hành thật. Zoom 200% dùng CSS trên Chromium, không phải native browser zoom/pinch hay accessibility zoom.
- Full game trên Firefox/WebKit chỉ phủ Mobile một thứ tự học mỗi browser; Desktop trên hai browser đó được kiểm tới giao dịch đầu và toàn ma trận bố cục, chưa chơi hết ván.
- Không chạy Human Playtest, đánh giá người chơi đã học được kiến thức, screen reader đầy đủ, thiết bị yếu, nhiều tab đồng thời, mất điện giữa thao tác, hay quota thật do đầy đĩa. Fault injection chỉ kiểm đường xử lý lỗi trình duyệt.
- Các trạng thái ngoài seed, fixture và nhánh UI đã ghi không được mặc định PASS. Ván đang chơi trên Desktop không có resume/import vẫn là thiếu hụt xác nhận, không phải giới hạn môi trường.

## 7. Tái lập và bàn giao

```powershell
npm test
node --experimental-strip-types --test --test-concurrency=1 scripts/diagnostics/*ui.test.ts
node --experimental-strip-types scripts/diagnostics/verify-release-replays.ts
node --experimental-strip-types scripts/verify-multi-course-parity.ts
npm run lint
npm run build
npm --prefix mobile_app run build
node scripts/verify-b18-language-cleanup-evidence.mjs --check
node scripts/diagnostics/release-qa-probe.mjs
node scripts/diagnostics/release-qa-surfaces.mjs
node scripts/diagnostics/release-qa-gameplay.mjs
node scripts/diagnostics/release-qa-storage.mjs
node --experimental-strip-types scripts/diagnostics/release-stock-checkpoint.ts
node scripts/diagnostics/release-stock-resale.mjs
node --experimental-strip-types scripts/diagnostics/verify-release-gameplay.ts
node scripts/verify-b18-release-qa-evidence.mjs --check
```

Các script browser truy cập trực tiếp URL candidate đã khóa trong mã. Runtime Playwright/Chromium có thể chọn qua `PLAYWRIGHT_MODULE`/`BROWSER_PATH` ở script gameplay/probe. Muốn chạy riêng: `RELEASE_QA_ONLY=desktop-defeat` hoặc `desktop-savings-victory`; full Mobile Firefox/WebKit dùng `RELEASE_QA_BROWSER` tương ứng và `RELEASE_QA_ONLY=mobile-basic-first`/`mobile-advanced-first`. Chạy lại trong thư mục chứng cứ mới hoặc bản sao checkout để tránh đè gói đã hash. Lệnh `--check` chỉ kiểm integrity, không rerun UI.

Nhánh QA không merge, không tạo deployment thủ công, không đổi domain/alias, không promote production. Sau khi Owner duyệt sửa RQA-01 và có candidate mới, cần kiểm lại gate bảo toàn dữ liệu và các regression trước khi đề nghị phát hành.
