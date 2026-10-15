> **CURRENT** — Atomic Investment Purchases V2.4, 15/10/2026. Nguồn luật: [CURRENT_MVP.md](CURRENT_MVP.md). Candidate local; chưa merge/deploy hoặc xác minh Actions mới.

# Mua đầu tư một lần mỗi lượt ghé ô

Nhánh [codex/atomic-investment-encounters](https://github.com/Tig0nn/boardgame_EXE/tree/codex/atomic-investment-encounters), nền `codex/economic-news-v1` tại `d990244`. Đây là thay đổi policy gameplay đã được phê duyệt, không phải thay đổi công thức tài chính.

## Policy chính xác và tương thích

| Encounter version đã lưu | Stocks | Gold/Bonds | Bank / Business |
| --- | --- | --- | --- |
| `legacy-multi-action` hoặc metadata vắng | Completion khi action stock yêu cầu; các flow cũ giữ nguyên | Mua nhiều lần cùng encounter | Giữ hành vi lịch sử; luật thu nhập business có version riêng |
| `v2.3-single-action` | Completion stock khi action yêu cầu | Mua nhiều lần cùng encounter | Bank một lot; Business một upgrade/lần ghé sau mua |
| `v2.4-business-purchase-complete` | Completion stock khi action yêu cầu | Mua nhiều lần cùng encounter | Thêm mua quán atomic và cấm bán/nâng ngay lượt mua |
| **`v2.4-atomic-investments`** | **Một lần mua/ghé, tự về bàn** | **Một lần mua/ghé, tự về bàn** | **Kế thừa toàn bộ flow Bank/Business V2.4** |

[Player factory](../src/game/new-game.ts) dùng version mới cho phiên mới ở cả Web và Mobile. API [createGame](../src/game/engine.ts) vẫn giữ mặc định cũ; [Mobile session](../mobile_app/src/game/session.ts) không migrate initial state. Replay đọc version đã lưu, không suy version từ branch hiện tại. Restart tạo phiên mới; mở tin/Sổ tay hoặc tiếp tục state cũ không đổi policy.

[encounters](../src/game/encounters.ts) dùng transaction log theo `turn` để phát hiện đã mua tài sản tài chính. [transact](../src/game/transactions.ts) kiểm quyền đúng ô, hạn mức một lần, số tiền/mã hợp lệ; chỉ sau khi hợp lệ mới trừ cash, ghi units/lot, sync valuation, chuyển `phase='rolling'`, xóa eventId và ghi **một** transaction. Không thêm action skip để đóng encounter. Đổi symbol, đổi tài sản/ô khi mở lại thủ công hoặc JSON continuation cùng turn đều không vượt giới hạn.

`completeEncounter` được hỗ trợ cho cả ba tài sản theo version mới. Bỏ flag hoặc truyền false cũng không tắt quy tắc atomic. Policy lịch sử giữ stock-only explicit completion; flag Gold/Bonds không được diễn giải lại cho các log cũ. Giao dịch lỗi không mutate input, không ghi log, không dùng cơ hội; skip chỉ kết thúc ô, không mua. Turn sau có thể mua lại.

[Replay adapter](../scripts/diagnostics/replay-game-log.ts) đọc `buy-stocks-complete`, `buy-gold-complete`, `buy-bonds-complete`; engine vẫn kiểm version khi áp action. [Serializer](../src/game/log.ts) đếm cả ID cũ và ID completion của từng tài sản. Schema 5, business rules version, snapshots cũ và dữ liệu đã lưu không bị rewrite.

## UI và phạm vi bảo vệ

[TradingPanel](../src/components/TradingPanel.tsx), [Mobile EventModal](../mobile_app/src/components/EventModal.tsx) và [Web PhaseDialog](../src/components/GameDialogs.tsx) dùng policy trong game để thống nhất một nút mua + một nút “Bỏ qua cơ hội”. Không còn bước Hoàn tất sau mua Gold/Bonds mới. Form biến mất khi engine về rolling; feedback dùng cash HUD/floating money sẵn có. Encounter mở lại cùng turn đã mua chỉ hiện thông báo ngắn và nút về bàn, engine vẫn chặn độc lập.

Giữ báo giá, mã cổ phiếu, số tiền mua, cash-after, phí/spread, coupon/kỳ hạn và “Xem tín hiệu thị trường”. Sổ tay giữ input và context mở; tutorial đã sửa câu Gold/Bonds được mua nhiều lần. UI của phiên Gold/Bonds lịch sử vẫn cho form mua tiếp và Hoàn tất theo policy gốc.

Không đổi pricing/rounding, fees, Gold spread, Bond coupon/principal/maturity, savings, Business Customer Preferences/thu nhập/nâng/bán, START settlement, victory, RNG/dice/seed, Economic News selectors, AI Coach hoặc artwork/GLB/animation/audio. Không thêm dependency hoặc đổi lockfile. Không chạy lại mô phỏng 180.000 ván, không sửa archive/evidence cũ.

## Kiểm chứng

| Kiểm tra | Kết quả / evidence |
| --- | --- |
| Product tests | **224/224 PASS** — [output](playtests/atomic-investments-v24/tests.txt) |
| Regression atomic mới | **21/21 PASS** — [test](../tests/atomic-investments.test.ts), [output](playtests/atomic-investments-v24/atomic-tests.txt) |
| Diagnostics | **39/39 PASS** (24 top-level + 15 subtests) — [output](playtests/atomic-investments-v24/diagnostics.txt) |
| UI regression | [5 checks](../scripts/diagnostics/atomic-investments-ui.test.ts): CTA đơn, fees/news, đóng modal, reopened form, historical UI |
| Lint | PASS — [output](playtests/atomic-investments-v24/lint.txt) |
| Web/Mobile builds | PASS — [Web](playtests/atomic-investments-v24/web-build.txt), [Mobile](playtests/atomic-investments-v24/mobile-build.txt) |
| Docs checker | PASS mặc định — [output](playtests/atomic-investments-v24/documentation-check.txt) |
| Browser | 320×640, 390×844, 430×932; [evidence](playtests/atomic-investments-v24/browser-verification.json) |
| Full-state replay / compatibility | PASS — [verification](playtests/atomic-investments-v24/replay-verification.json) |

Tests bao phủ tự đóng từng tài sản, rapid/stale calls, artificial reopen/đổi mã/đổi tài sản, invalid, skip, later visit, START restrictions, finance/RNG parity, Bank/Business và news read-only. Log mới đủ bốn vòng được kiểm metrics và full-state replay. Existing V2.3/V2.4 tests vẫn PASS.

CI lịch sử `13c9c7c` có **186 product tests + 21 diagnostics** — [run lịch sử](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38421516083). Không gán kết quả này cho branch mới. Toàn bộ kiểm chứng task này là local; không khẳng định GitHub Actions mới đã chạy.

### Tương thích lịch sử

Đã đóng băng [fixture multi-purchase V2.4](playtests/atomic-investments-v24/historical-multi-purchase.json.gz) từ source `d990244` **trước khi sửa engine**: 4 vòng / 23 rolls / 111 entries, **2 lượt Gold và 5 lượt Bonds bổ sung** trong các encounter đã mua trước đó cùng turn. Đây là fixture Node để regression, không phải browser playtest. [Provenance](playtests/atomic-investments-v24/historical-fixture-generation.json) lưu SHA-256 `c57fd98b7f9500129b0a174840c15357eab31372cd0dbfd8802f77a0a4755b59` của JSON; verifier kiểm hash không đổi và replay exact, regression test kiểm thêm re-export/replay.

Đồng thời replay exact [browser log V2.3](playtests/encounter-limits-v2_3/browser-game-log.json.gz) và [browser log Economic News V1](playtests/economic-news-v1/browser-game-log.json.gz). Không giả vờ hai log browser này có multi-Gold/Bonds nếu chúng không có. Metadata/state của cả ba giữ version gốc; không migrate sang atomic.

### Ván Mobile production thật

Chạy build Mobile trên `http://127.0.0.1:5187`; seed `atomic-history-fixture`, tiết kiệm đầu ván 0, cash 50 triệu. Mọi action qua UI, không inject fixture hoặc rút ngắn animation. Chơi đủ **4 vòng / 23 rolls / 97 entries**, mua **Stocks 2 / Gold 2 / Bonds 4**; mỗi lần mua 1 triệu bằng double tap đều chỉ có một transaction, cash giảm đúng một lần, modal đóng ngay. Lượt 5 bỏ qua Bonds không đổi cash; lượt 11 và 18/22 mua Bonds trở lại hợp lệ.

Kết quả: cash **84.704.864 ₫**, lawful proceeds **90.107.737 ₫**, **won=true**. [JSON export gzip](playtests/atomic-investments-v24/browser-game-log.json.gz) replay khớp toàn bộ state. [Verifier](../scripts/verify-atomic-investments-log.ts) kiểm metadata, turn duy nhất, không có skip bổ sung sau mua, đơn vị/giá/vốn Bond, RNG/market trước-sau giao dịch, metrics và ba log cũ.

Input 0 làm CTA disabled nhưng không rời encounter; nhập hợp lệ sau đó mua được. Cả ba panel giữ amount/symbol/expanded signal khi mở và đóng Help bằng bàn phím. News và Dự báo vs. Thực tế vẫn hiện đủ bốn vòng. Console errors: **0**. Không tràn ngang ở ba chiều rộng; panel dài cuộn trong modal. Bằng chứng dùng CUA trực tiếp. [Runner hiện có](../scripts/verify-mobile-engine.mjs) đã cập nhật assertions atomic/fixture, default evidence folder mới; `node --check` PASS, không tuyên bố đã chạy toàn bộ Playwright runner.

## Screenshots

| Màn | 320px | 390px | 430px |
| --- | --- | --- | --- |
| Stocks trước mua | [320](playtests/atomic-investments-v24/320-stocks-before.jpg) | [390](playtests/atomic-investments-v24/390-stocks-before.jpg) | [430](playtests/atomic-investments-v24/430-stocks-before.jpg) |
| Stocks signal | [320](playtests/atomic-investments-v24/320-stocks-signals.jpg) | [390](playtests/atomic-investments-v24/390-stocks-signals.jpg) | [430](playtests/atomic-investments-v24/430-stocks-signals.jpg) |
| Stocks sau mua | [320](playtests/atomic-investments-v24/320-stocks-after.jpg) | [390](playtests/atomic-investments-v24/390-stocks-after.jpg) | [430](playtests/atomic-investments-v24/430-stocks-after.jpg) |
| Gold trước mua | [320](playtests/atomic-investments-v24/320-gold-before.jpg) | [390](playtests/atomic-investments-v24/390-gold-before.jpg) | [430](playtests/atomic-investments-v24/430-gold-before.jpg) |
| Gold signal | [320](playtests/atomic-investments-v24/320-gold-signals.jpg) | [390](playtests/atomic-investments-v24/390-gold-signals.jpg) | [430](playtests/atomic-investments-v24/430-gold-signals.jpg) |
| Gold sau mua | [320](playtests/atomic-investments-v24/320-gold-after.jpg) | [390](playtests/atomic-investments-v24/390-gold-after.jpg) | [430](playtests/atomic-investments-v24/430-gold-after.jpg) |
| Bonds trước mua | [320](playtests/atomic-investments-v24/320-bonds-before.jpg) | [390](playtests/atomic-investments-v24/390-bonds-before.jpg) | [430](playtests/atomic-investments-v24/430-bonds-before.jpg) |
| Bonds signal | [320](playtests/atomic-investments-v24/320-bonds-signals.jpg) | [390](playtests/atomic-investments-v24/390-bonds-signals.jpg) | [430](playtests/atomic-investments-v24/430-bonds-signals.jpg) |
| Bonds sau mua | [320](playtests/atomic-investments-v24/320-bonds-after.jpg) | [390](playtests/atomic-investments-v24/390-bonds-after.jpg) | [430](playtests/atomic-investments-v24/430-bonds-after.jpg) |
| Bản tin | [320](playtests/atomic-investments-v24/320-bulletin.jpg) | [390](playtests/atomic-investments-v24/390-bulletin.jpg) | [430](playtests/atomic-investments-v24/430-bulletin.jpg) |
| START summary | [320](playtests/atomic-investments-v24/320-summary.jpg) | [390](playtests/atomic-investments-v24/390-summary.jpg) | [430](playtests/atomic-investments-v24/430-summary.jpg) |
| Result | [320](playtests/atomic-investments-v24/320-result.jpg) | [390](playtests/atomic-investments-v24/390-result.jpg) | [430](playtests/atomic-investments-v24/430-result.jpg) |

[Kích thước thực 36 JPG](playtests/atomic-investments-v24/screenshot-dimensions.json) và [danh sách tệp thay đổi](playtests/atomic-investments-v24/changed-files.txt). Các ảnh đều thuộc ván production export này, không trộn dev fixture.

## Chạy app và giới hạn

Từ root: `npm ci`, `npm ci --prefix mobile_app`, `npm run dev --prefix mobile_app`, mở http://localhost:5174. Tái kiểm export: `node --experimental-strip-types scripts/verify-atomic-investments-log.ts docs/playtests/atomic-investments-v24/browser-game-log.json.gz`.

Chưa thử điện thoại vật lý, AI provider thực hoặc candidate Vercel; không đổi cấu hình hosting. Luật mới chưa có dữ liệu cân bằng diện rộng, ván thắng trên chỉ là một playtest. Artwork icon lệch C20 là giới hạn đã ghi ở task trước, không sửa trong task này. **Sẵn sàng owner review**, chưa merge/deploy.
