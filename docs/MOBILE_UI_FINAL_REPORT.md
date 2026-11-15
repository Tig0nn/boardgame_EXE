> **CURRENT** — Candidate `codex/mobile-ui-final`, 14/10/2026. Nguồn luật: [CURRENT_MVP.md](CURRENT_MVP.md). Chỉ kiểm chứng local; chưa deploy hoặc merge candidate.

# Mobile MVP tổng hợp — quyết định và bằng chứng

## Nền tảng và phạm vi

Nhánh mới bắt đầu từ `codex/mobile-onboarding` tại `13faa2154fda7fa5219c55f924ca92641a14ed49`. Đã fetch và so sánh với `feat/mobile-v2-4-engine-integration` tại `277d2dc3c2400c4f67d52a5c9acd64277fe1150d`; baseline chung `d0e66263485b5be4d041cdfbe348dbf0bdaee811`. Không merge/cherry-pick toàn bộ commit Phát, không đổi hai nhánh gốc.

Giữ onboarding sáu bước, Skip, marker an toàn, overlay giữ game/input, focus, các guard giao dịch và engine V2.4 của Codex. Chỉ thích ứng các visual có ích từ Phát. Source tài chính, board chính thức, RNG, victory, replay, session dispatcher, lockfile và asset artwork/GLB/audio không đổi. Character3D chỉ thêm observer `load/error` để xuất trạng thái native ra DOM phục vụ xác minh, không đổi camera/animation/model.

## Ma trận giữ / bỏ / thích ứng

| Thành phần Phát | Quyết định | Bản cuối và lý do |
| --- | --- | --- |
| Goal card trong Setup | Thích ứng | Hai cột vốn/đích, ngắn và rõ; vẫn lấy RULES |
| Preset 10/20/30 triệu | Thích ứng | Nút native ≥44px, aria-pressed, giữ MoneyInput nhập tùy ý |
| Thẻ kỳ hạn | Thích ứng và sửa | Radio native dùng profile chính thức; ghi START, rate mỗi START và tổng lãi đơn cuối kỳ |
| Transaction cards / grouping | Thích ứng qua CSS | Nhóm giá, thu nhập và cash-after thành card; tái dùng TradingPanel/BusinessPanel và selector hiện có |
| MobileTradingPanel 431 dòng | Bỏ | Trùng logic giao dịch; Stocks thiếu completeEncounter, offer bán sai vị trí, thiếu hậu quả cần thiết |
| Business visual | Thích ứng grouping | Giữ guard mua atomically, nâng từ encounter sau tối đa một lần, chặn bán cùng lượt mua |
| Result score/progress | Thích ứng và sửa | Native progress clamp 0–100, gap tới đích; ghi nguồn tiền hợp lệ thay vì tiền đã thực thu; insolvent không nhận badge hoàn tất 4 vòng |
| Lap summary signed colors | Thích ứng | Màu thu/chi cùng số có dấu, không dùng màu làm tín hiệu duy nhất |
| Rulebook 6 tab / nội dung viết cứng | Bỏ | Giữ tutorial/overlay Codex; thêm danh sách 20 ô lấy từ C20_BOARD, sửa claim auto-liquidation và AI chắc chắn |
| RebalanceModal riêng | Bỏ | Dùng shared RebalanceDialog; báo giá/phí/lãi trước CTA, chỉ bán tại START hoặc funding |
| HUD nhiều chỉ số, nút 36px | Bỏ | Giữ HUD Codex gọn: cash, lawful-goal progress, debt khi có; touch targets 44px |
| 923 dòng CSS bổ sung | Bỏ việc nhận nguyên khối | Thích ứng 30 dòng CSS theo palette/card hiện có; không thêm thư viện UI |

Nguồn visual đã review: [commit Phát](https://github.com/Tig0nn/boardgame_EXE/commit/277d2dc3c2400c4f67d52a5c9acd64277fe1150d). Mã cuối tập trung ở [GameSetup](../mobile_app/src/components/GameSetup.tsx), [SavingsTerms](../src/components/SavingsTerms.tsx), [TradingPanel](../src/components/TradingPanel.tsx), [Tutorial](../mobile_app/src/components/Tutorial.tsx), [Result](../mobile_app/src/components/GameResultModal.tsx) và [CSS](../mobile_app/src/engine-ui.css).

## Trước / sau

“Trước” là bản Codex `13faa21`, bằng chứng cũ giữ nguyên. Đánh giá Phát dựa trên diff/source của đúng SHA; không giả vờ các ảnh cũ là ảnh chạy nhánh Phát.

| Màn | Trước | Sau | Thay đổi |
| --- | --- | --- | --- |
| Setup 430 | [Ảnh cũ](playtests/mobile-onboarding/430-setup.jpg) | [Ảnh mới](playtests/mobile-ui-final/430-setup.jpg) | Preset, goal card, thẻ kỳ hạn và cash cạnh CTA |
| Bank 390 | [Ảnh cũ](playtests/mobile-onboarding/390-bank.jpg) | [Ảnh mới](playtests/mobile-ui-final/390-bank.jpg) | Thẻ rate/total, preview tiền mặt có nhóm rõ |
| Stocks 390 | [Ảnh cũ](playtests/mobile-onboarding/390-stocks.jpg) | [Ảnh mới](playtests/mobile-ui-final/390-stocks.jpg) | Giá và cash-after thành card; giữ phí và atomic buy |
| Business 390 | [Ảnh cũ](playtests/mobile-onboarding/390-business.jpg) | [Ảnh mới](playtests/mobile-ui-final/390-business.jpg) | Nhóm vốn/thu nhập/giá thu hồi, giữ đúng quyền nâng/bán |
| Result 390 | [Ảnh cũ](playtests/mobile-onboarding/390-result.jpg) | [Ảnh mới](playtests/mobile-ui-final/390-result.jpg) | Progress 77%, gap 20.628.533 ₫; không claim thanh lý |
| Board 390 | [Ảnh cũ](playtests/mobile-onboarding/390-game-board.jpg) | [Ảnh mới](playtests/mobile-ui-final/390-board.jpg) | Giữ focus board/character/dice và HUD gọn |

## Luật và thông tin tài chính được bảo vệ

- Sổ tay render đủ 20 ô từ C20_BOARD: Bank 2/13, Stocks 3/12, Business 9/14/16, Bonds 7/20, Gold 10/19. Không sửa engine hoặc artwork để khớp rulebook sai.
- Không offer bán Stocks/Bonds/Gold tại ô mua, kể cả khi đã nắm giữ. Bán tài sản tài chính tại START hoặc funding bắt buộc.
- Stocks giữ `completeEncounter: true`; Bank một khoản mới/encounter, nhiều khoản độc lập qua encounter khác nhau.
- Business mua xong về bàn ngay, không nâng/bán cùng lượt mua; encounter sau nâng tối đa một lần, sau đó vẫn có thể bán tại đúng ô.
- Kỳ hạn 1/2/3 START: 4%/5%/6% mỗi START; tổng lãi đơn 4%/10%/18% cuối kỳ. Số tiền lãi/maturity/cash-after vẫn lấy selector/profile chính thức.
- Phí bán, mất lãi rút sớm và lãi vay không bị giấu khỏi xác nhận. Funding giữ tóm tắt chi phí cạnh CTA khi cuộn.
- Result chỉ tính lawful liquidatable proceeds; không tạo transaction thanh lý tự động. Business chưa bán và lãi tiết kiệm chưa trả không tính vào đích.
- Giá hư cấu được giải thích trong Sổ tay/Details. AI Coach tùy chọn, có thể lỗi hoặc nhận xét sai; không bảo đảm kết quả.

## Validation thực tế

| Kiểm tra local | Kết quả / bằng chứng |
| --- | --- |
| Root clean install | PASS, 0 vulnerabilities — [output](playtests/mobile-ui-final/install-root.txt) |
| Mobile clean install | PASS, 0 vulnerabilities — [output](playtests/mobile-ui-final/install-mobile.txt) |
| Product tests | **189/189 PASS** — [output](playtests/mobile-ui-final/tests.txt) |
| Diagnostics | **29/29 PASS** (22 top-level và 7 subtests) — [output](playtests/mobile-ui-final/diagnostics.txt) |
| Lint | PASS — [output](playtests/mobile-ui-final/lint.txt) |
| Web build | PASS — [output](playtests/mobile-ui-final/web-build.txt) |
| Mobile production build | PASS — [output](playtests/mobile-ui-final/mobile-build.txt) |
| Docs consistency | Default checker PASS; inventory thêm report CURRENT này; không chạy lại full audit hoặc docs-only scope cho một thay đổi code |

[Regression UI mới](../scripts/diagnostics/mobile-final-ui.test.ts) render component thật qua Vite/React SSR, kiểm first/returning player, term rates/totals, không offer sale tại ô mua, lawful result không mutate game, C20 guide, stock/Bank atomicity và Business restrictions. Các [test onboarding](../tests/mobile-onboarding.test.ts) bảo vệ safe storage fallback. Overlay input/focus được kiểm thêm trong browser.

CI lịch sử tại `13c9c7c`: **186 product tests + 21 diagnostics** — [run đã xác minh](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38421516083). Không gán run cũ cho candidate mới. Workflow chỉ chạy pull request tới main; task này không tạo/merge PR hoặc claim Actions mới đã chạy.

### Browser và replay

Ván thật chạy **Mobile production build trên localhost:5184**, không inject fixture: seed `mobile-browser-v24`, savings ban đầu 10 triệu/1 START; Bank lần đầu gửi 5 triệu/2 START. Chơi đủ **4 vòng / 26 rolls / 107 entries**, nguồn tiền cuối **69.371.467 ₫**, chưa đạt đích; [JSON gzip](playtests/mobile-ui-final/browser-game-log.json.gz) replay khớp **toàn bộ state** — [verification](playtests/mobile-ui-final/replay-verification.json).

[Browser evidence](playtests/mobile-ui-final/browser-verification.json) ghi viewport, overlay giữ savings/term, Enter/Escape/focus, Skip/completion persistence, restart, stock/Bank completion và model qua các lượt. Console error của ván production và các fixture: 0. Những fixture sau dùng dev harness hiện có ở localhost:5174, được phân biệt với ván thật:

Browser verification lượt này dùng CUA trực tiếp. [Runner Playwright](../scripts/verify-mobile-engine.mjs) đã cập nhật folder bằng chứng và kiểm tra overlay kỳ hạn, `node --check` PASS; không tuyên bố đã chạy toàn bộ runner này.

- Funding double tap chỉ rút lot 3 triệu một lần, mất lãi 540.000 ₫; vàng thực nhận 1.920.600 ₫, vay 79.400 ₫ trả đủ.
- Gold rapid double tap chỉ mua một lần; bấm hợp lệ sau đó vẫn mua được (cash 47 → 41 → 35 triệu).
- Business double tap nâng tối đa một tầng; thu nhập 4.700.000 ₫/START.
- Bank double tap tạo đúng một lot mới; lot 3 triệu và 10 triệu cùng tồn tại, không thay kỳ hạn lot cũ.

### Nhân vật 3D: gỡ bằng chứng false trước đây

[GLB network check](playtests/mobile-ui-final/model-network.json): HTTP **200**, MIME `model/gltf-binary`, **1.313.296 byte**, glTF v2; bytes/hash khớp asset repository. SHA-256 `c83e385ce254479aa4d539db57025a15cad10ad61125016cf32ba1de253b8aa9`.

Observer native trên model-viewer ghi `data-model-status=ready` và `data-model-loaded=true` từ sự kiện load/getter thật. **27 phép kiểm trong ván** đều ready/true, có shadow canvas và rect nằm trong viewport; ảnh board cho thấy nhân vật. DOM sandbox không expose getter JavaScript tùy biến `element.loaded`, nên phép ép `!!element.loaded` trước đây có thể trả false dù model đã render. Đây là giới hạn phép đo cũ, không phải bằng chứng GLB tải hỏng; không đổi asset hoặc renderer để làm đẹp số liệu.

## Ảnh theo chiều rộng

| Màn | 320 × 640 | 390 × 844 | 430 × 932 |
| --- | --- | --- | --- |
| Tutorial | [320](playtests/mobile-ui-final/320-tutorial.jpg) | [390](playtests/mobile-ui-final/390-tutorial.jpg) | [430](playtests/mobile-ui-final/430-tutorial.jpg) |
| Setup | [320](playtests/mobile-ui-final/320-setup.jpg) | [390](playtests/mobile-ui-final/390-setup.jpg) | [430](playtests/mobile-ui-final/430-setup.jpg) |
| Board | [320](playtests/mobile-ui-final/320-board.jpg) | [390](playtests/mobile-ui-final/390-board.jpg) | [430](playtests/mobile-ui-final/430-board.jpg) |
| Bank | [320](playtests/mobile-ui-final/320-bank.jpg) | [390](playtests/mobile-ui-final/390-bank.jpg) | [430](playtests/mobile-ui-final/430-bank.jpg) |
| Stocks | [320](playtests/mobile-ui-final/320-stocks.jpg) | [390](playtests/mobile-ui-final/390-stocks.jpg) | [430](playtests/mobile-ui-final/430-stocks.jpg) |
| Business | [320](playtests/mobile-ui-final/320-business.jpg) | [390](playtests/mobile-ui-final/390-business.jpg) | [430](playtests/mobile-ui-final/430-business.jpg) |
| Funding (dev fixture) | [320](playtests/mobile-ui-final/320-funding.jpg) | [390](playtests/mobile-ui-final/390-funding.jpg) | [430](playtests/mobile-ui-final/430-funding.jpg) |
| Result | [320](playtests/mobile-ui-final/320-result.jpg) | [390](playtests/mobile-ui-final/390-result.jpg) | [430](playtests/mobile-ui-final/430-result.jpg) |

Có thêm ba ảnh Business sau upgrade. Không tràn ngang; sheet dài cuộn trong viewport ở 320×640. Số tiền và phí vẫn được xem trước; footer funding giữ cost/CTA hiện trong khi cuộn. Ảnh cũ không bị ghi đè.

[Danh sách tệp thay đổi](playtests/mobile-ui-final/changed-files.txt) bao gồm source, tests, tài liệu và bằng chứng mới; [kích thước ảnh thực](playtests/mobile-ui-final/screenshot-dimensions.json) đối chiếu đủ 27 JPG.

## Giới hạn và chạy app

Chưa thử Android/iPhone vật lý, chưa gọi AI provider thực, chưa xác minh full game trên Vercel cho candidate. Preview local tĩnh không phục vụ Function. Icon baked trong artwork Mobile vẫn có phần lệch C20; Sổ tay/engine dùng đúng dữ liệu, cần designer sửa ảnh trong phạm vi riêng. Không chạy lại mô phỏng 180.000 ván. [Roadmap](../tasks/current.md) giữ các mục này mở.

Chạy từ root: `npm ci`, `npm ci --prefix mobile_app`, `npm run dev --prefix mobile_app` rồi mở http://localhost:5174. Production local: `npm run build --prefix mobile_app`, `npm run preview --prefix mobile_app`. Chơi cơ bản không cần AI key; local API tùy chọn chạy root dev ở 5173, key chỉ ở server. Nhánh candidate sẵn sàng owner review, chưa phải xác nhận production release.
