**EG3-AI-05 PASS trong phạm vi What-if App DEV và mock HTTP. Gemini LIVE_NOT_RUN.**

Luồng mới: chọn nhóm và quyết định lịch sử → nhập tham số → native Worker xác minh legality tại prefix → chọn phương án hoặc hỏi mock HTTP trên catalog đã xác minh → xác nhận → paired replay → từng follow-up tường minh → independent replay → comparison. Nút “Đổi phương án trên ván gốc” hủy capture/Worker cũ, lấy lại ván gốc và mở catalog mới. Official result và packed save không được ghi bởi What-if.

| Nhóm | Lựa chọn linh hoạt |
|---|---|
| Stocks | Sáu symbol native FPT, CMG, VCB, TCB, HPG, BMP; ngân sách nguyên VND do người chơi nhập; bán một phần theo symbol và amount nếu native chấp nhận; bỏ recorded trade |
| Bonds | An Tâm/Bứt Phá đang performing; ngân sách do người chơi nhập; từng lot có executable quote, bán một phần theo amount; bỏ recorded trade. Native quote và guard purchase provenance giữ nguyên |
| Bank | Số tiền gửi do người chơi nhập, kỳ hạn 1/2/3 START; chọn skip lịch sử hoặc recorded deposit; chỉ phương án qua probe mới được xác nhận |
| Business | Mua/bán toàn cơ sở, nâng cấp theo budget/taste/checkin hoặc bỏ recorded action khi native cho phép. Giá vốn và giá nâng cấp do engine quy định |
| Course / Advanced | Chọn lịch sử Course, thử skip/Basic/Advanced khi native cho phép; khóa đã sở hữu bị loại bởi engine, hành động học sau bị trùng cần xác nhận follow-up |
| Gold | Giữ C1 và xác nhận riêng lần bán. Không thêm phép tính hay replay Gold mới |

Giới hạn 5 triệu và first symbol đã được loại khỏi **luồng UI/catalog phân trang mới**. Trước khi người chơi nhập và probe tham số, luồng này không tự đưa lựa chọn mua mặc định cho Stocks/Bonds/Bank vào catalog gửi AI. Helper `listDecisionChoices` và caller legacy giữ palette cũ để tương thích baseline; đây không phải giới hạn của form mới.

Catalog lịch sử/phương án mặc định 8 mục/trang, tối đa 16. Tham số là bộ lọc chính xác, mỗi probe chỉ sinh một tuple; không dựng tích Descartes symbol × ngân sách × kỳ hạn. Slice được thực hiện trước probe. Giữ cap nguồn 20 triệu ký tự/500 log entries, budget replay tối đa 30 giây/5.000 bước mặc định, deadline Worker 35 giây, tối đa 8 follow-up và các giới hạn HTTP hiện có. Tổng của trang phương án là số candidate trước legality filtering; trang có thể trống nhưng vẫn còn trang tiếp.

Provider nhận ID/loại quyết định/lap/turn và các scalar `operation`, `amount`, `symbolId`, `issuerId`, `lotId`, `term` khi có. ID custom được suy ra theo canonical tuple và kiểm tra lại cùng tham số. AI vẫn chỉ trả hai ID hoặc unsupported/ambiguous. Client kiểm tra exact membership, Worker chỉ nhận lựa chọn ở trang/probe mới nhất và reconstruct lại bằng engine trước khi replay. Đổi tham số hoặc probe lỗi thu hồi lựa chọn cũ. Không gửi raw save, state, lịch sử, số dư hay thông tin cá nhân lên provider.

Mock chỉ khớp số tiền/target/kỳ hạn người chơi đã chọn, không sinh giá trị số. Câu hỏi thiếu tham số hoặc thiếu quyết định giữa các tuple trùng nhau yêu cầu chọn rõ. Form có nút điền câu hỏi theo bộ tham số đã xác minh. Guard thông tin cá nhân chỉ miễn literal tiền trong mệnh đề “số tiền …” khớp chính xác catalog; số điện thoại khác trong câu vẫn bị từ chối. Gemini adapter có cùng catalog và hướng dẫn không đoán tham số, nhưng chưa kích hoạt và không có traffic live.

Fixtures mới dùng transition native và có actual replay, alternative replay độc lập, source hash và alternative export hash. Ba cột dưới là delta cash / totalWorth / liquidatableFunds, không phải các con số do AI tạo:

| Fixture App | Fork đã xác nhận | Delta VND |
|---|---|---|
| Stocks | stocks:10, mua CMG 1.234.567 | −1.234.567 / +2.321 / −10.048 |
| Stocks đổi lại trên ván gốc | stocks:10, mua FPT 7.250.000 | −7.250.000 / +776.403 / +696.139 |
| Stocks partial sale | stocks:51, bán FPT 1.000.000 | +990.000 / +66.054 / +75.294 |
| Bank | bank:36, gửi 1.000.000 kỳ hạn 3 START | +180.000 / +180.000 / +180.000 |
| Bonds hai lot | bonds:23, thay partial sale bond-1 bằng bán bond-2 750.000 | +434.687 / +434.687 / +434.687 |
| Course | course:7 → Advanced; xác nhận skip lần học 51 | +8.000.000 / +8.000.000 / +8.000.000 |
| Business | business:48 → upgrade budget | −2.600.000 / +1.221.443 / −2.600.000 |
| Gold C1 | gold:4 → skip; xác nhận bỏ sale25 | +104.006 / +104.006 / +104.006 |

Test matrix còn kiểm chứng sáu symbol với ngân sách 1.234.567 hoặc 7.250.000; Bank 1 triệu ở cả ba kỳ hạn và 7,25 triệu kỳ hạn 2; thay recorded deposit; cả hai issuer ở ngân sách 1 triệu/7,25 triệu; partial sale 750.000 trên từng bond-1/bond-2; cùng native skip/basic/advanced và Business palette. Không suy rộng kết quả fixture sang mọi tổ hợp lịch sử.

**Regression: 275/275 PASS**, gồm đủ 263 tên test baseline và 12 test mới, không skip/cancel. Gold C1 +104.006 và Bank cũ +200.000 giữ nguyên. Các guard funding, insolvency, RNG/exogenous divergence, invalid recorded continuation, partial Gold sale trong lịch sử Bank, lot provenance, cancellation, deadline, stale ID, Worker cleanup và official/save immutability vẫn PASS. Test mới kiểm tra schema, params/ID tamper, overfunding, unowned symbol, nonexistent lot, paging, stale catalog sau đổi amount/probe lỗi và mock không đoán số.

TypeScript root/mobile và ESLint trên source/test thay đổi PASS. Production build trong bộ nhớ PASS, không ghi dist; endpoint DEV What-if không xuất hiện trong bundle production.

**Chromium App: 14/14 PASS** trên desktop 1280×900 và viewport nhỏ 320×844. Bao gồm CMG → xác nhận → Worker → comparison, restart cùng ván gốc rồi FPT 7,25 triệu, partial stock sale, Bank term3, bán bond-2 ở fixture hai lot, Business upgrade, Course Advanced với follow-up và Gold C1 với follow-up. Các ca âm gồm ID giả, ambiguous, provider timeout, sửa input làm mất hiệu lực catalog, sale khi không có holdings, đóng khi provider/Worker/probe đang chạy. Có 19 HTTP request đúng schema, page errors và request không được phép đều bằng 0; font Google có sẵn của App bị chặn bằng CSS rỗng. Mỗi ca đối chiếu packed save byte-for-byte, official result text, Worker termination và delta với oracle native.

Giới hạn Chromium cần phân biệt: màn Rebalance core trước khi mở What-if có lỗi pointer overlap tại 320px khi nội dung trái phiếu dài che nút xem kết quả. Lượt test nhỏ dùng focus + Enter trên nút thật để vào result, không force-click và không sửa core UI. Panel What-if được thao tác và kiểm tra tràn ngang ở đúng 320px. Đây là lỗi core ngoài phạm vi; không có protected change cần áp dụng để hoàn thành What-if, và chưa chứng minh hành trình core hoàn toàn bằng pointer ở 320px.

Bằng chứng Chromium: [14-case results, request payloads và keyboard-entry log](playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/browser-keyboard-entry-results.json), [runner](playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/browser.mjs), [desktop parameters](playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/stocks-parameters-desktop.png), [Bank 320px](playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/bank-parameters-small.png), [Bonds lot2 320px](playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/bonds-parameters-small.png), [Gold C1 320px](playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/gold-app.png). Runner: `node --experimental-strip-types docs/playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/browser.mjs browser-keyboard-entry`. Các lượt đầu bị gián đoạn bởi HMR và core pointer overlap được giữ lại; chỉ lượt `browser-keyboard-entry` là verdict cuối.

Các giới hạn còn lại:

- Native legality tại fork chưa đảm bảo continuation cuối ván: funding, insolvency, RNG divergence, lot sai nguồn gốc hoặc ending không chứng minh được đều dừng trước comparison. Không tự giảm sale amount hoặc chuyển sang lot khác.
- Follow-up chỉ cho omission đã hỗ trợ ở cùng native event/checkpoint; không cho AI sửa chuỗi action hoặc tự chọn thay người chơi. Các continuation ngoài phạm vi đó bị chặn.
- Course học lại khi đã sở hữu, Bank withdrawal, Gold tham số tùy ý, fractional/multi-fork và Business mua/bán một phần không được thêm vào milestone này.
- UI hiện là App DEV qua slot What-if hiện có. AI dùng mock HTTP với grammar giới hạn; người chơi chọn/probe tham số trước. Hội thoại tự do trích xuất tham số ngoài catalog, production wiring và Gemini live vẫn thuộc bước tiếp theo.

Source thêm/sửa trong milestone:

- `mobile_app/src/game/what-if-ai/flexible-catalog.ts` — query/page, native-prefix controls, canonical parameter actions.
- `mobile_app/src/game/what-if-ai/decision-replay.ts` — paged probe và reconstruct lựa chọn động.
- `mobile_app/src/game/what-if-ai/decision-adapters.ts` — nhận diện recorded Bank deposits, hỗ trợ fork checkpoint deposit.
- `mobile_app/src/game/what-if-ai/decision.worker.ts`, `decision-client.ts` — catalog page feature-owned, revoke/membership và response bounds; shared Gold Worker protocol giữ nguyên.
- `mobile_app/src/game/what-if-ai/orchestrator.ts`, `mock-gemini.ts` — tuple/label/question và đề xuất có tham số, lời giải thích Bank/Course phù hợp luồng mới.
- `mobile_app/src/game/what-if-ai/in-game-controller.ts` — lựa chọn lịch sử, probe, proposal, restart/cancellation.
- `mobile_app/src/components/endgame-what-if/FlexibleChoices.tsx`, `InGameAiEntry.tsx`, `in-game-ai.css` — form, paging, xác nhận và đổi phương án.
- `src/ai/what-if/contracts.ts`, `gemini.ts` — schema scalar và hướng dẫn provider, không đổi endpoint/Companion.
- `scripts/diagnostics/what-if-flexible-fixtures.ts` — fixture hai purchase/two lots/partial START sale qua native engine.
- `mobile_app/src/game/what-if-ai/flexible.test.ts`, `native-worker.test.ts`, `src/ai/what-if/transport.test.ts` — 12 test mới.
- Report và harness/fixtures/evidence tại `docs/playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/`.

Bằng chứng: [regression đầy đủ](playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/regression-full.tap), [baseline name comparison](playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/regression-full-summary.json), [type/lint](playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/checks.json), [build](playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/build.json), [native fixture outcomes](playtests/whatif-endgame/2026-11-10/eg3-ai-05-01/fixtures.json). Lượt regression đầu chạy 264 test không lỗi nhưng thiếu file 11 test Bank lịch sử; runner phát hiện đủ tên bị thiếu và lượt `regression-full` đã sửa danh sách. Các bản ghi thử nghiệm ban đầu được giữ lại để truy vết.

Chạy App DEV: `node --experimental-strip-types scripts/what-if-ai-dev.ts`, mở `http://127.0.0.1:5196/?endgameWhatIf=1&whatIfAi=1`. Không beta/deploy. Branch/HEAD giữ nguyên, staging trống; tracked diff vẫn là 10 file baseline. Hai patch EG2C qua reverse check đủ 10 hunk. Không sửa protected engine/economics/save schema/core UI.
