**EG3-AI-04 PASS trong phạm vi palette đã kiểm chứng. Gemini LIVE_NOT_RUN.**

Stocks, Bonds, Business và Advanced đã được nối vào catalog, native Worker, mock HTTP và slot What-if của App DEV hiện có. Shared paired replay và independent replay tiếp tục làm nguồn xác minh comparison. Những module engine/economics/save schema và core UI giữ vai trò phụ thuộc được đọc qua API hiện có.

| Nhóm | Khả năng đã triển khai |
|---|---|
| Stocks | Bỏ mua/bán đã ghi nhận, thử mua theo mã đầu danh sách đang mở với ngân sách 5.000.000 VND, thử bán toàn bộ cổ phiếu. Probe native quyết định legality ở từng prefix. Bán tại START có thể được bỏ qua |
| Bonds | Bỏ mua/bán, thử mua An Tâm hoặc Bứt Phá với ngân sách 5.000.000 VND, thử bán toàn bộ từng lot có quote executable, gồm START. Engine kiểm tra issuer, default/delay, trạng thái lot, giá trị bán và phí. Guard bổ sung bảo vệ provenance của lot ID |
| Business | Mua cơ sở theo ECONOMY.business.cost, bán toàn bộ, nâng cấp theo ba customer preferences hiện có, bỏ mua/bán/nâng cấp đã ghi nhận. Engine kiểm tra sở hữu, tiền mặt, thời điểm mua, giới hạn và một nâng cấp mỗi encounter |
| Advanced | Skip/Basic → Advanced, Advanced → skip/Basic khi prefix cho phép. Lần học sau bị trùng cần follow-up xác nhận |

Mỗi nhóm có seed độc lập cố định và lịch sử được tạo hoàn toàn bằng transition native. Policy trade mua ở encounter đầu, bán ở encounter sau còn hợp lệ, Business nâng cấp trước bán, Advanced bỏ lần học đầu rồi mua ở lần gặp Course kế tiếp. Các policy hold/skip dùng cùng seed để kiểm chứng thêm lựa chọn mua, bán và nâng cấp từ quyết định đã bỏ qua. Không tìm seed theo lợi nhuận.

| Fixture chính | Initial fork và follow-up tường minh | Delta cash / totalWorth / liquidatableFunds cuối vòng 4 |
|---|---|---|
| EG3-AI-04-STOCKS | Skip buy10, xác nhận skip sale51 | −931.189 / −931.189 / −931.189 VND |
| EG3-AI-04-BONDS | Skip buy7, xác nhận skip sale30 | −108.679 / −108.679 / −108.679 VND |
| EG3-AI-04-BUSINESS | Skip buy28, xác nhận skip upgrade48 và sale49 | +2.956.855 / +2.956.855 / +2.956.855 VND |
| EG3-AI-04-ADVANCED | Học Advanced tại skip7, xác nhận skip Advanced51 | +8.000.000 / +8.000.000 / +8.000.000 VND |

Các số trên đến từ engine và được pin ở test. Runtime không chứa các kết quả này. [fixtures.json](playtests/whatif-endgame/2026-11-10/eg3-ai-04-01/fixtures.json) lưu SHA-256 nguồn, selection, follow-up, metrics và hash independent replay. Bốn history gzip ở cùng thư mục có thể tái tạo từ `scripts/diagnostics/what-if-multi-asset-fixtures.ts`.

Khi giao dịch tại event đã đóng encounter, bỏ giao dịch dùng native decide(skip). Khi bỏ một sale tại START hoặc một nâng cấp vẫn giữ encounter mở, nhánh thay thế giữ nguyên native pre-state và bỏ lệnh đó khỏi log. Paired replay cho phép đổi riêng ordinal của command Alternative, còn kind, turn, lap, tile, event, decision và action vẫn phải khớp recorded command. Independent replay từ genesis xác minh log mới. Gold tiếp tục dùng policy cũ.

Với giao dịch Business chèn vào một historical skip, native trade chạy trước rồi historical skip được giữ lại để kết thúc encounter đã chọn. Đây là fork ban đầu được người chơi xác nhận. Các lệnh sau fork bị bất hợp lệ đều dừng tại needs-followup trước khi có comparison. Người chơi chỉ có thể xác nhận bỏ lệnh ở cùng event/checkpoint hợp lệ. Hệ thống không tự giảm số tiền bán hoặc chuyển sang một lot khác.

Lot trái phiếu được đối chiếu theo purchase encounter gốc. Cùng lot ID nhưng được tạo tại turn/lap/tile khác sẽ bị chặn bằng bond-lot-origin-mismatch. Thay issuer tại cùng purchase encounter vẫn dùng native contract của lựa chọn được xác nhận. Test riêng dựng lịch sử native có hai purchase và một sale tại START, chứng minh bỏ purchase đầu không thể khiến sale chạy nhầm trên lot tái sử dụng ID.

263/263 test PASS, gồm baseline 240 và 23 test mới. Các test mới gồm bốn fixture end-to-end, native Worker cleanup, dữ liệu giả/tamper, native insufficient-cash/defaulted-issuer/business-lock/duplicate-course, mua/bán/nâng cấp từ skip, omission tại START và lot provenance. Các test cancellation, timeout, stale response, funding, insolvency, RNG divergence, Gold C1 +104.006 VND, Bank +200.000 VND và Course vẫn PASS. Snapshot và packed save được đối chiếu byte trước/sau từng fixture chính.

Chromium App DEV PASS 4/4 nhóm mới qua mock HTTP. Test yêu cầu xác nhận proposal, chưa có số liệu lúc chờ follow-up, xác nhận từng follow-up, so delta với oracle native, kiểm tra double-click, Worker cleanup, save và official result. Page errors và request không được phép đều trống. Harness tiếp tục chặn font Google có sẵn của App bằng CSS rỗng. TypeScript mobile/root, ESLint trên source thay đổi và production build trong bộ nhớ PASS.

Các giới hạn còn lại

- Palette mua mới Stocks dùng mã đầu danh sách đang mở và ngân sách cố định 5 triệu. Chọn tùy ý symbol, số tiền hoặc kích thước sale mới cần contract đầu vào tiếp theo. Recorded partial sales vẫn chạy theo exact action và có thể được bỏ qua ở initial fork.
- Bonds có hai issuer hiện tại và bán toàn bộ từng lot executable. Giá trị bán tùy ý và tái ánh xạ lot giữa các nhánh chưa được đề xuất. Lot sai provenance, funding, insolvency, RNG/exogenous divergence và ending không cùng mốc đều fail closed trước numeric publication.
- Business áp dụng giá vốn, toàn bộ cơ sở và ba chuyên môn của native B18 hiện tại. Các lịch sử cấu hình engine khác phải qua genesis/config verification trước khi có catalog.
- Catalog vẫn giới hạn 16 candidate entries và 16 lựa chọn, tối đa 8 follow-up, budget replay tối đa 30 giây và Worker deadline 35 giây. Lịch sử vượt giới hạn bị từ chối an toàn.
- Mock vẫn dùng grammar giới hạn và cần số quyết định khi câu hỏi mơ hồ. Toàn bộ bảy nhóm đã có đường in-game DEV → mock HTTP → engine. Live credential, điều kiện truy cập và production wiring thuộc bước sau.

Source/test thêm hoặc sửa

- `mobile_app/src/game/what-if-ai/decision-adapters.ts`
- `mobile_app/src/game/what-if-ai/decision-replay.ts`
- `mobile_app/src/game/endgame-whatif-paired.ts`
- `mobile_app/src/game/what-if-ai/orchestrator.ts`
- `mobile_app/src/game/what-if-ai/mock-gemini.ts`
- `mobile_app/src/game/what-if-ai/in-game-controller.ts`
- `mobile_app/src/components/endgame-what-if/InGameAiEntry.tsx`
- `src/ai/what-if/contracts.ts`
- `scripts/diagnostics/what-if-multi-asset-fixtures.ts`
- `mobile_app/src/game/what-if-ai/multi-asset.test.ts`
- `mobile_app/src/game/what-if-ai/native-worker.test.ts`
- `src/ai/what-if/transport.test.ts`

Bằng chứng tại [regression.tap](playtests/whatif-endgame/2026-11-10/eg3-ai-04-01/regression.tap), [Chromium results và HTTP payloads](playtests/whatif-endgame/2026-11-10/eg3-ai-04-01/browser-results.json), [runner](playtests/whatif-endgame/2026-11-10/eg3-ai-04-01/browser.mjs), [Stocks](playtests/whatif-endgame/2026-11-10/eg3-ai-04-01/stocks-app.png), [Bonds](playtests/whatif-endgame/2026-11-10/eg3-ai-04-01/bonds-app.png), [Business](playtests/whatif-endgame/2026-11-10/eg3-ai-04-01/business-app.png) và [Advanced](playtests/whatif-endgame/2026-11-10/eg3-ai-04-01/advanced-app.png).

App DEV tiếp tục chạy bằng `node --experimental-strip-types scripts/what-if-ai-dev.ts`, mở `http://127.0.0.1:5196/?endgameWhatIf=1&whatIfAi=1`. Runner bốn nhóm dùng `node --experimental-strip-types docs/playtests/whatif-endgame/2026-11-10/eg3-ai-04-01/browser.mjs` từ repo root với quyền Chromium và loopback.

Branch `feat/b18-whatif-deep-analysis-v2`, HEAD `759a6fe1879816a716e21e38cc91eecd3fe5f50a`, staging trống và tracked diff vẫn là 10 file baseline. Đủ 10 hunk EG2C qua reverse check. Phạm vi này hoàn thành bằng feature-owned code và không có protected diff đang chờ Owner duyệt.
