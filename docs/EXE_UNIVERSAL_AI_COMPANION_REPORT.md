# EXE — Universal contextual B18 Companion: implementation & review report

Ngày review cuối: 2026-10-31. Owner đã duyệt đúng một local commit khi các gate PASS. Báo cáo ghi lại source/QA trước commit; SHA sau commit được cung cấp trong kết quả Git. Chỉ làm trong worktree universal; production AI OFF.

## Git checkpoint và phạm vi

Sync checkpoint đã được phép đóng và đã tạo đúng một merge commit: `4738c284d499c6cbd1a86511b190301ab20429e2` (`merge: sync approved B18 AI with Map UI`). Hai parents theo đúng thứ tự:

1. UI `f63a4354be7a26118b01d82e9563c11467170b3a`.
2. AI integration `aeaae9521254d184ff1fdaffdf0d4062d0eca2dd`.

Sync worktree sạch trước khi tạo worktree mới. Universal branch `feat/b18-universal-ai-companion`, worktree `E:/Fall25_Ki8/EXE-boardgame/_exe-workstreams/b18-universal-ai-companion`, Pre-commit HEAD là checkpoint trên; không có MERGE_HEAD và index ban đầu rỗng. Commit được duyệt là một child commit của checkpoint, không phải merge/rebase. Không push, deploy, sửa refs cũ hay working directory gốc của Phát. Remote UI HEAD đã được kiểm tra lại bằng ls-remote ngày 2026-10-31 và vẫn là f63a4354be7a26118b01d82e9563c11467170b3a. Bản này khớp UI remote tại thời điểm review; mọi thay đổi UI về sau cần sync/review riêng.

## Kết quả thực tế và giới hạn

Đã có entry/context/câu hỏi/câu trả lời cho 13 domain ở cả các rendering paths riêng: bank, stocks, bonds, gold, business, course, personal, macro, funding, summary, rebalancing, forecast và overview khi rolling. Bao phủ 9 loại ô thực tế của B18. Finished giữ nguyên Coach cuối ván.

Đây là hỗ trợ có kiểm soát theo domain và câu hỏi đã kiểm chứng. Không tuyên bố hiểu mọi câu hỏi B18 hay mọi bản nháp giao dịch. Chưa hỗ trợ tính báo giá theo số tiền/mã/lot đang gõ trong form: context chỉ chứa snapshot đã áp dụng, và báo giá toàn phần tài sản đang có. Các đoạn giải thích nói rõ chưa chọn tham số và chưa thực hiện giao dịch. Câu hỏi số tiền tùy ý, tối ưu danh mục, dự báo, nhiều ý hoặc wording mới sẽ fallback.

## Coverage trước/sau theo board thực tế

Index là zero-based. Board được lấy từ `boardFor`, không dùng C20 hoặc First Job. B18 core và multi-course đều có 18 ô; khác nhau tại index 15.

| Tile type / index | Trước | Sau / dữ kiện và quyết định |
| --- | --- | --- |
| START / 0 | Chưa có Companion | Summary thực tế, funding giữa quyết toán, rebalancing; giữ lương/chi phí/nợ/nghĩa vụ tách riêng |
| macro / 1 | Chưa có | Cả 3 cú sốc; giá trước/sau và thay đổi đã xảy ra từ bản ghi công khai; không dự báo |
| bonds / 2,9,15 multi | Chưa có | Giá/status/coupon hai issuer, outstanding/loss của lô, quote lô bán được; mua/bán/bỏ qua theo quyền |
| personal / 3 | Chỉ repair | repair, medical, family; chi ngay, khoản hẹn, tổng chưa gồm huy động, cash-after hoặc thiếu hụt |
| course / 4,7,12,15 core | Chưa có | Học phí, sở hữu, tăng lương, thu nhập danh nghĩa có điều kiện; đúng single/multi-course; core không gọi action upgrade là nâng cấp quán |
| gold / 5,16 | Chưa có | Giá công khai, tài sản đang giữ, spread/phí/net quote, cơ chế và rủi ro |
| bank / 6,17 | Chưa có | Kỳ hạn/lãi suất thật của B18, gốc/đáo hạn/lãi/lãi mất của khoản đang hoạt động |
| business / 8,11,14 | Chưa có | Vốn, thu nhập hiện tại, thu hồi, chi phí nâng cấp, mức tăng theo chuyên môn đang phù hợp; quyền mua/nâng/bán |
| stocks / 10,13 | Chưa có | Giá 6 mã VN trong game, tài sản đang giữ, quote bán toàn phần và phí; mua/bán/bỏ qua |

Không có ô `living`/`obligation` trong board B18 này. `living`, `bills`, `contract`, `bonus` còn trong catalog legacy nhưng không phải event tự nhiên của board này; không gắn UI AI hoặc tuyên bố hỗ trợ chúng. Sinh hoạt định kỳ B18 được giải thích tại START/funding.

| Event variant thực tế | Context/answer | UI path đã chạy browser |
| --- | --- | --- |
| stocks, bonds, gold, business | PASS từng domain | EventModal + TradingPanel |
| bank | PASS | EventModal + MobileBankPanel |
| course | PASS | EventModal + MobileCourseChoices; core dùng catalog single-course |
| repair, medical, family | PASS cả 3 | EventModal generic decisions |
| credit-tightening, demand-boom, supply-recovery | PASS cả 3 | EconomicEventModal riêng |

| Phase | Sau tích hợp | Invalidation / ghi chú |
| --- | --- | --- |
| forecast | Hai tab trong RoundChallengeModal | Bản tin công khai, không dự báo kết quả |
| rolling | Tổng quan hai tab dạng aside, đặt trên bottom dock | Hit-test thật roll/Túi Đồ/Sổ Tay ở 320/375/390; không có backdrop |
| event | Hai tab ở từng modal path nêu trên | Chỉ khi context hợp lệ, đủ dữ kiện và opt-in |
| funding | MobileFundingDialog | Khoản còn thiếu, nguồn hợp lệ; dòng START tạm dừng không được hiểu là đã trả xong |
| summary | MobileLapSummaryModal | Dòng START thực tế, không dựng tương lai |
| rebalancing | MobileRebalanceModal | Quote bán, quyền trả nợ/tiếp tục; không mua mới tại START |
| finished | Không thêm universal AI | Legacy Coach được giữ nguyên |

| Action / tình huống | Phạm vi hỗ trợ |
| --- | --- |
| Mua stocks/bonds/gold | Cơ chế, giá công khai, tiền mặt, điều kiện; không gợi ý mã/số tiền tối ưu |
| Bán stocks/gold; bán bond lot | Quote selector toàn phần khả dụng, gross/spread/fee/net; thiếu holdings/quote thì fallback |
| Gửi bank / rút sớm | Kỳ hạn và lãi suất, khoản đang có; rút toàn khoản chỉ khi thiếu tiền bắt buộc và mất lãi |
| Mua/nâng cấp/bán business | Vốn/thu hồi/thu nhập hiện tại, quyền đúng lượt; chưa có quán thì nêu rõ chưa nâng cấp được |
| Mua khóa học | Tiền mặt, owned, quyền mua, tăng lương từ START kế tiếp; không bảo đảm đi đủ START |
| Pay/defer/full/temporary | Chi ngay vs khoản hẹn và tổng; nghĩa vụ chỉ ghi nhận sau khi hoàn tất thanh toán ban đầu |
| Funding savings/stocks/bonds/gold/debt | Chỉ nguồn selector cho phép; quán không là nguồn huy động bắt buộc |
| Trả nợ tại START | Cơ chế/khả năng và quyền hiện tại; chưa báo giá số tiền draft hoặc chọn thay người chơi |
| Skip/acknowledge/continue | Không thay đổi handler hoặc transition hiện có |

## Contract và grounding

Contract mới riêng: `b18-gameplay-context.v1` / `b18-gameplay-question.v1`. API1, `b18-advice.v1`, `b18-repair.v1`, `b18-repair-question.v1`, browser entries cũ và golden cũ không đổi.

Pipeline: exact question → controlled intent → validated context → exact fact selection → deterministic domain lesson → closed response schema và canonical reconstruction → generation/render guard.

DTO allowlist chỉ lấy số liệu công khai từ selectors/rule-derived facts và các dòng START/cú sốc đã xảy ra. Không serialize GameState, market object, seed, RNG, jitter/defaultLap, toàn bộ log hay hidden future. Projector không gọi transition. Khóa phiên bản B18 bond/business/encounter/catalog/savings để không áp lesson mới lên luật legacy. Tên savings profile `v2.2-c20` là metadata mà factory B18 thực sự dùng với lãi 4/5/6%; board vẫn được kiểm tra là B18 18 ô.

Runtime schema từ chối extra keys, fact code/subject/action sai domain/profile, thiếu quan sát bắt buộc, delta giá không nhất quán, duplicate facts, dữ liệu quá giới hạn, sai session/revision/digest, phí/spread/net hoặc personal/course/rate facts không khớp luật. Giá thị trường, sở hữu và lịch sử cục bộ không được coi là server-authenticated: `client-state-unverified` được giữ rõ. Không có endpoint universal được mount và không có model transport thật.

## UI/lifecycle

GamePhase cung cấp read-only session binding cho modal hiện có. GamifiedModal chỉ dùng slots; Decision subtree giữ mounted khi chuyển tab để giữ input giao dịch. Tab AI không dispatch game action, không tự hỏi; question được gửi khi người chơi bấm gửi. Câu hỏi mẫu thay theo domain và context; không gợi ý bán tại START hoặc cổ phiếu khi chưa có quote. Hỏi cơ chế spread của vàng vẫn được giải thích dù chưa sở hữu vàng; yêu cầu quote bán cụ thể sẽ fallback nếu thiếu holdings. Macro thiếu bản ghi tác động không hiện AI entry; public API vẫn từ chối rõ nếu caller gửi request thiếu dữ kiện. Cash/tabs/footer ghim, chỉ body cuộn; badge tiền mặt cũ chỉ ẩn trong universal Decision để tránh lặp. Original repair/off view vẫn giữ nguyên.

Binding có epoch mới theo vòng subscribe/session; revision tăng trên snapshot identity mới, kể cả cùng phase; exact question/digest, UUID và generation. Abort detach trước callback và token/closing guards bảo vệ reentrancy. Edit, close, snapshot, unmount, new session và OFF xóa/cancel; kết quả chỉ render khi `isCurrent()`. Chuyển tab đơn thuần giữ câu hỏi/answer hợp lệ. StrictMode không tự tạo request hoặc nhân đôi request.

Production mặc định OFF. Chỉ local DEV với `?universalAi=1`; query không bật được production. Opt-in universal ưu tiên UI mới; nút tắt không làm bật lại repair UI dù URL chứa cả hai opt-in. `?repairAi=1` riêng vẫn giữ UI và API sửa xe cũ.

## Checkpoints, review và fixes

A: 8/8 browser, 8 bài kiểm thử ban đầu PASS. B: 8/8 browser, bộ context tích lũy 14/14 PASS. C: 7/7 browser, bộ context tích lũy 19/19 PASS. Các con số này là checkpoints trước khi bổ sung toàn bộ regression, không cộng vào tổng product tests.

Review checkpoint implementation ngày 30 đã xử lý hai lỗi: synchronous abort reentrancy và lesson trái phiếu có thể áp lên rule variant không được hỗ trợ. Bổ sung regression cho cả hai. Review nội dung thêm kết luận cụ thể theo domain, missing-data đúng tình huống và reflection phù hợp. Reuse router P3 cũ riêng cho repair, kiểm đủ 25 phrase mà không sửa source cũ.

Visual/browser review tìm và sửa badge tiền mặt lặp và overview chặn bottom controls. Hit-test actual App sau Map roundtrip xác nhận nút Lắc Xúc Xắc, Túi Đồ và Sổ Tay không bị panel che ở cả 3 widths. Không sửa nguồn BottomControls hoặc animation; kiểm pointer hit thay cho Playwright stability gate trên nút đang có animation thở.

## Final review và commit gate (2026-10-31)

Preflight khớp branch, HEAD, toàn bộ hash của đúng 30 paths đã duyệt và index ban đầu rỗng. Bản source đầu vào đúng checkpoint 812/33/18/81; evidence cũ được giữ tại QA folder ngày 30, không ghi đè để che lỗi.

Các finding Required đã được tái hiện bằng regression RED trước khi sửa:

- Bank context nhận được courseCost/basic/1 hoặc facts sai domain/subject; canonical reconstruction vẫn hiển thị. Đã thêm allowlist fact theo domain/profile/subject, quan sát bắt buộc và kiểm tra delta giá/quote bundle. Request sai bị từ chối trước hash/answer. Giá thị trường và ownership vẫn là client-state-unverified, không tuyên bố xác thực máy chủ.
- Câu hỏi mẫu cơ chế spread vàng bị từ chối khi không có holdings; câu hỏi bán tại START lại trả answered khi không có quote. Đã phân biệt cơ chế với quote cụ thể và dùng sample có thể trả lời trong context hiện tại.
- Thiếu bản ghi macro vẫn quảng bá AI dù không thể trả lời; nay UI không hiện tab trong context đó. Từ chối future giữ ưu tiên khi record bị thiếu.
- Khoản tiết kiệm và lô trái phiếu cùng ordinal có label Khoản 1 gây nhầm nguồn. Nay nhãn định danh rõ Khoản tiết kiệm / Lô trái phiếu theo loại fact.
- Text nay nói rõ không đọc giá trị đang nhập trong form; không khẳng định người chơi chưa nhập form và không giả phân tích draft.

Không còn Critical/Required finding sau các sửa chữa và verification. Không sửa engine, Coach, API1, repair contracts hoặc golden. Chỉ chỉnh các paths vốn nằm trong allowlist 30 paths; thêm 10 regression tests và 2 browser scenarios, không nới test cũ hay sửa evaluation fixture để ép PASS.

Coverage review bổ sung thực thi **209 câu hỏi trên 27 contexts**: toàn bộ phrase bank qua snapshot bình thường, biến thể sự kiện, tiền mặt bằng không và holdings thực tế; **192 answered, 17 fallback đúng điều kiện**. Đây là kiểm tra deterministic behavior, không phải điểm hiểu ngôn ngữ ngoài phrase bank. Mua rồi ghé lại tự nhiên và bán stocks/gold/bonds cho cash delta khớp net quote của AI ở cả 3 tài sản. Credit status performing/delayed/defaulted/resolved được kiểm riêng bằng controlled public snapshots; không coi fixture trạng thái đó là dự báo.

Commit message được duyệt: feat(ai): extend grounded Companion across B18 gameplay domains. Exact 30 paths nằm trong inventory cuối báo cáo. Trước commit phải kiểm staged path set, blob hashes, staged diff và secrets; sau commit xác minh một parent đúng checkpoint, scope 30 paths và working tree/index sạch.

## QA thực tế

| Check | Kết quả |
| --- | --- |
| Full product/Companion/Coach regression + diagnostics | **822/822 PASS**, 0 fail/skip/cancel |
| Phần mới trong suite | 112 tests: context/domain/lifecycle/content/evaluation + ESM; đã gồm trong 822 |
| Labeled evaluation | **56/56** đúng routing/fallback expectations; không phải điểm chất lượng Gemini |
| Lifecycle universal | **13/13 PASS**, gồm ignored abort, reentrancy, OFF, session và render-time invalidation |
| Repair vocabulary qua universal | **25/25 phrase** trong content regression; non-repair không nhận aliases |
| Universal browser ALL | **35/35 PASS**, 0 page error, 0 API/provider requests |
| Flow bổ sung | **3/3 PASS** (có overlap với ALL), actual App/Map và bottom-control hit-tests |
| Approved repair browser suite | **18/18 PASS** với opt-in repair riêng |
| Root/mobile/strict typecheck | PASS cả 3 |
| ESLint | PASS |
| Universal emitted native ESM | **44 files**, 0 backend/Node imports, 6 examples PASS |
| Legacy API/question ESM/wire | PASS, frozen fixtures giữ nguyên |
| Historical replay/hash corpus | **81/81 PASS**, read-only |
| Production build + actual production browser | PASS; cả `repairAi=1&universalAi=1` không hiện AI |
| Build warning | Một entry JS 652491 bytes, gzip 185984 bytes; không đổi threshold để che warning |
| Onboarding từng fail ở baseline cũ | Assertion fresh/returning và parent test đều PASS với UI checkpoint hiện tại; không sửa test |

Bundle measurement có 161 modules trong một entry eager. ReactDOM client là module lớn nhất theo renderedLength của bundler (529567 bytes trước minify cuối); các màn hình guide/management/tutorial, engine và các imports Companion cùng được tải trong entry. RenderedLength không phải tỷ trọng minified và không cộng trực tiếp thành kích thước bundle. Nguồn có khả năng của warning là entry tổng hợp này; feature OFF không loại bỏ mọi static import khỏi bundle. Tác động là tăng lượng JS tải/parse và startup trên máy yếu/mạng chậm, không phải lỗi build hoặc bật provider. Không đổi chunk limit, cấu hình split hay refactor bundling ngoài phạm vi. Dữ liệu đo: bundle-review.json trong QA folder final review.

Build dùng `configFile:false`, envDir không tồn tại, không load `.env`; provider key variables được blank trong test runner. QA/browser không gọi Gemini thật. Screenshot, output và build chỉ ở ignored `node_modules/.tmp`, không đưa vào source commit.

43 preservation records được đối chiếu: 38 records hiện có trong Git checkpoint giữ đúng hash (working checkout có thể chỉ khác CRLF); 5 historical docs vốn chưa có trong sync baseline được xác minh vẫn nguyên hash tại AI worktree cũ. Không copy 5 tài liệu lịch sử này sang branch mới. Toàn bộ source engine/rules, save schema, Coach và old AI contracts/goldens giữ nguyên. Exact inventory/hash: `../node_modules/.tmp/b18-universal-20261030/preservation-and-scope.json`.

## Natural-language scope và ví dụ đã chạy

Phrase bank có 94 entries theo 13 domain (10/9/9/9/8/7/8/6/7/6/5/5/5). Repair nhận lại 25 phrasing P3 bằng router cũ, trong đó 2 trùng phrase bank mới. Đây là controlled whole-utterance routing, có normalization dấu/case/punctuation, không phải semantic NLP rộng.

Evaluation có 19 answered và 37 fallback. **13/13 unfamiliar paraphrases đều fallback, semantic recall trên nhóm này là 0/13.** Tính an toàn của fallback PASS không được hiểu là AI đã hiểu câu hỏi. Có ambiguous, multi-intent, false-premise, outside-game, hidden-future, action request và missing-data cases. Không có Gemini experiment hoặc mock model-quality results.

Các câu dưới lấy từ execution thật trong `examples.json`, không phải mô phỏng output model:

| Domain / input | Output và dữ kiện chính |
| --- | --- |
| Bank: “Gửi tiết kiệm kỳ hạn nào khác nhau thế nào?” | “Kỳ hạn dài có lãi suất cao hơn, nhưng khóa tiền lâu hơn.” Kỳ hạn/lãi 4/5/6% từ profile; chưa chọn khoản gửi mới |
| Stocks: “Vì sao mua cổ phiếu có thể lỗ?” | “Giá có thể giảm; bán cổ phiếu còn chịu phí giao dịch.” Giá hiện tại và holding công khai |
| Bonds: “Nếu trái phiếu bị chậm trả thì sao?” | “Coupon là cam kết, không bảo đảm tiền sẽ về đúng hạn.” Phân biệt claim và tiền đã nhận |
| Gold: “Vì sao mua xong bán ngay có thể mất tiền?” | “Mua rồi bán ngay có thể mất tiền vì spread và phí.” Không dựng holding hoặc khoản bán |
| Business: “Nâng cấp có đáng cân nhắc không?” | Snapshot chưa có quán được nói rõ chưa thể nâng cấp; vẫn giải thích chi phí/quyền/thu nhập có điều kiện |
| Course: “Học phí ảnh hưởng tiền mặt thế nào?” | Học phí basic/advanced 6/10 triệu, tăng lương 2/4 triệu từ START kế tiếp; owned và điều kiện mua tách riêng |
| Repair: “Thanh toán ngay hay trả sau khác nhau thế nào?” | Sửa ngay 4 triệu; sửa tạm 1 triệu ngay +4 triệu tại START, tổng 5 triệu chưa gồm funding; ghi nhận nghĩa vụ sau khi trả xong chi phí đầu |
| Macro: “Tin kinh tế này có nghĩa gì?” | Cú sốc đã áp dụng; giá trước/sau và thay đổi từ encounter hiện tại; không tái áp cú sốc |
| Funding: “Tôi còn thiếu bao nhiêu tiền?” | “Còn thiếu 2.000.000 đ cho khoản thanh toán bắt buộc.” Số tiền là exact remaining fact của fixture tự nhiên |
| Summary: “Thu nhập và chi phí vòng này là gì?” | Dòng START thực tế, tách nghĩa vụ/thu chi; không dựng tổng lợi nhuận |
| Rebalancing: “Tại START tôi được làm gì?” | Bán tài sản tài chính/trả nợ/tiếp tục theo quyền; không mua mới tại START |
| Forecast: “Dự báo có chắc chắn không?” | Nêu thông tin công khai chỉ định hướng, không bảo đảm giá hay RNG |
| Overview: “Tiền mặt hiện có là bao nhiêu?” | “Tiền mặt hiện có: 50.000.000 đ.” Exact cash fact |
| Gold: “Giá vàng tương lai là bao nhiêu?” | Fallback, không có financial cards, actions hoặc reflection |
| Bank: “Khi nào tiết kiệm đáo hạn?” khi không có khoản active | Fallback nêu rõ thiếu khoản gửi, không giả trả lời |

## Evidence và screenshot

QA ban đầu giữ nguyên tại node_modules/.tmp/b18-universal-20261030. Final review/commit evidence: `E:/Fall25_Ki8/EXE-boardgame/_exe-workstreams/b18-universal-ai-companion/node_modules/.tmp/b18-universal-commit-20261031`. Các path evidence dưới đây thuộc final folder trừ khi ghi riêng.

- `qa-exits.json`, `full-tests.txt`, `historical-replays.json`, `production-build-result.json`, `production-result.json`.
- Final ALL-browser-results.json có 35 scenarios; A/B/C/FLOW checkpoint cũ giữ tại folder ngày 30.
- `domain-question-review.json`, `bundle-review.json`, `precommit-verification.json`, `postcommit-verification.json`; examples.json/board-coverage.json cũ tại folder ngày 30. Preservation records được xác minh lại trong precommit/postcommit evidence.
- `320/375/390-decision.png`, `-ai.png`, `-answered.png`, `-fallback.png`, `-keyboard-viewport.png`.
- `ALL-bank/stocks/bonds/gold/business/course/repair/medical/family/credit-tightening/demand-boom/supply-recovery/forecast/rolling/funding/summary/rebalancing-answered.png`.
- `actual-app-answer.png`, `actual-app-map.png`, `actual-app-rolling-320/375/390.png`, `production-off-390.png`.
- Unchanged repair suite evidence tại sibling ignored folder `node_modules/.tmp/b18-ai-sync-20261030/browser-results.json`.

![Quyết định 320px](../node_modules/.tmp/b18-universal-commit-20261031/320-decision.png)
![Hỏi AI 320px](../node_modules/.tmp/b18-universal-commit-20261031/320-answered.png)

Không tuyên bố PASS bàn phím vật lý/IME, iOS Safari hoặc screen reader: chưa có thiết bị. Keyboard trong browser, Arrow/Home/End/Escape, focus, scroll và viewport 360px mô phỏng bàn phím đã kiểm. Screenshot host của từng modal không phải bằng chứng board đằng sau; actual App/Map/rolling có ảnh và scenarios riêng.

## Nghiệm thu và phần còn thiếu

Owner/Phát cần review text tài chính, vị trí overview trên bàn, layout/màu của các paths riêng, Sổ tay và giao dịch thật, focus/IME trên thiết bị, Safari/screen reader. Chạy local với query opt-in; không chỉnh production flags.

MVP có đủ domain entry cho board B18 hiện tại. Phạm vi còn thiếu: semantic paraphrases ngoài phrase bank, cross-domain tối ưu/so sánh nhiều ý, draft-specific amount/symbol/lot quotes và forecast-specific numerical attribution ngoài dữ kiện hiện có. Đây là fallback/giới hạn công bố, không giấu bằng câu trả lời generic. Nếu muốn draft-aware context, cần handoff versioned identity cho draft và selector quote hợp lệ; không lấy số từ text hoặc sửa engine để ép hỗ trợ.

Không có universal HTTP endpoint/model semantic routing; local deterministic path dùng được độc lập. Production rollout/deployment cần approval riêng; backend mới không cần cho nghiệm thu local này. Owner đã cho phép một local commit sau final review/QA; push, merge và deploy vẫn cần duyệt riêng. Handoff: [EXE_UNIVERSAL_AI_CONTRACT_HANDOFF.md](EXE_UNIVERSAL_AI_CONTRACT_HANDOFF.md).

## Exact changed-path inventory

Inventory pre-commit: đúng 30 paths, 3 tracked modifications và 27 additions. Index ban đầu rỗng; stage bằng literal allowlist, không dùng git add . hoặc git add -A. Đây cũng là exact scope để đối chiếu commit sau khi tạo.

- `docs/EXE_UNIVERSAL_AI_COMPANION_REPORT.md`
- `docs/EXE_UNIVERSAL_AI_CONTRACT_HANDOFF.md`
- `docs/EXE_UNIVERSAL_AI_IMPLEMENTATION_PLAN.md`
- `mobile_app/src/components/EventModal.tsx`
- `mobile_app/src/components/GamePhase.tsx`
- `mobile_app/src/components/GameplayAi.tsx`
- `mobile_app/src/components/GamifiedModal.tsx`
- `mobile_app/src/components/gameplay-ai-context.ts`
- `mobile_app/src/components/universal-ai.css`
- `mobile_app/src/components/use-gameplay-ai-slots.tsx`
- `mobile_app/src/game/universal-ai-feature.ts`
- `mobile_app/src/game/universal-ai.ts`
- `scripts/diagnostics/universal-ai-browser.mjs`
- `scripts/diagnostics/universal-ai-esm.test.ts`
- `src/ai/companion/universal-index.ts`
- `src/ai/companion/universal/answer.ts`
- `src/ai/companion/universal/contract.ts`
- `src/ai/companion/universal/copy.ts`
- `src/ai/companion/universal/facts.ts`
- `src/ai/companion/universal/grounding.ts`
- `src/ai/companion/universal/projector.ts`
- `src/ai/companion/universal/questions.ts`
- `src/ai/companion/universal/types.ts`
- `tests/ai-universal-content.test.ts`
- `tests/ai-universal-domains.test.ts`
- `tests/ai-universal-evaluation.test.ts`
- `tests/ai-universal-lifecycle.test.ts`
- `tests/ai-universal.test.ts`
- `tests/fixtures/ai-companion/universal-evaluation-v1.json`
- `tests/helpers/universal.ts`
