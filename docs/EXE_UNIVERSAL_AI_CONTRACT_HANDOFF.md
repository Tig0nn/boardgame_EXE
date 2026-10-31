# B18 universal Companion — contract / UI handoff

Trạng thái review 2026-10-31: Owner duyệt một local commit sau QA; production/deploy vẫn OFF. Branch `feat/b18-universal-ai-companion`, Parent checkpoint `4738c284d499c6cbd1a86511b190301ab20429e2`. Workspace duy nhất `E:/Fall25_Ki8/EXE-boardgame/_exe-workstreams/b18-universal-ai-companion`.

## Local acceptance

Dùng dev server với query `?universalAi=1`. Mặc định OFF; production build bỏ qua query. Không cần Gemini/key hoặc HTTP endpoint mới. Không chạy cấu hình production/provider để nghiệm thu. Vite/browser diagnostic có cấu hình không load env trong `scripts/diagnostics/universal-ai-browser.mjs`.

`?repairAi=1` riêng vẫn dùng P3.5 cũ. Nếu cả hai opt-in có mặt, universal UI được ưu tiên; tắt universal không tự bật lại repair UI. Không đổi API1, old repair contracts hoặc golden để tích hợp.

## Browser entry và pipeline

`src/ai/companion/universal-index.ts` xuất:

- `projectGameplayContext(game, {sessionEpoch, revision})`, `gameplayEligible(game)`, `gameplayContextReady(validatedContext)`.
- `parseGameplayContext`, `createGameplayRequest(context, exactQuestion, requestId)`, `parseGameplayRequest`.
- `answerGameplay(request)`, `validateGameplayResponse(raw, request)`.
- `suggestions(domain, profile?, context?)`, `classifyGameplay(question, domain, eventId?)`, fact presentation helpers/types.

Entry không import backend/Node. Closed schemas từ chối extra keys, fact sai domain/profile/subject, quan sát bắt buộc bị thiếu, delta/quote không nhất quán và invalid shapes. Context phải là DTO mới; không gửi raw game/session/log. Đây là local, client-unverified contract, không phải bằng chứng xác thực trạng thái trên máy chủ. Parse thành công chưa đồng nghĩa UI ready: macro thiếu published impact record có contextReady=false và không hiện AI tab. Public request thiếu record vẫn nhận fallback rõ ràng.

## Exact request/context/response shape

`GameplayContext`:

- `version: 'b18-gameplay-context.v1'`.
- `profile`: core B18 hoặc multi-course B18 đã pin; `domain`, `phase`, `eventId` hiện tại.
- `sessionEpoch`, `revision`, `lap`, `totalLaps:4`, `turn`.
- `facts: {code, subject, value}[]`: bounded integer amounts / basis points / enum states. Labels do catalog cố định cung cấp.
- `actions: string[]`: quyền hiện tại, không phải lệnh hoặc hành động đã thực hiện.
- `resources: string[]`: nguồn huy động hiện có nếu thiếu tiền bắt buộc.
- `entries: {label, amount}[]`: chỉ các dòng START đã ghi nhận ở summary hoặc funding pause.

`GameplayRequest`:

```ts
{
 version: 1,
 policy: 'b18-gameplay-question.v1',
 requestId, sessionEpoch, revision,
 context, contextDigest,
 question, questionDigest
}
```

Question tối đa 400 UTF-16 units, không control/unpaired-surrogate; digest SHA256 của raw question đúng từng ký tự (không trim/normalize trước hash). Normalization chỉ dùng routing. Context digest SHA256 của canonical validated DTO. Request epoch/revision phải khớp context. Checksum không xác thực giá thị trường/ownership.

`GameplayResponse` có cùng version/policy/request/session/revision/contextDigest/questionDigest; source deterministic; integrity client-state-unverified; `status: answered|fallback`, `reason`, `intent`, `conclusion`, `explanation`, selected `facts`, `entries`, `actions`, `resources`, `reflection|null`, đầy đủ `limitations`.

Response được parse schema bounded rồi so exact canonical reconstruction từ request. Không nhận financial prose do provider tự sinh. Fallback không có financial facts, entries, actions/resources hay reflection; error được tách khỏi fallback và không lộ lỗi/provider string.

## Session và UI binding

`mobile_app/src/game/universal-ai.ts` nhận session chỉ có `getSnapshot/subscribe`. Binding không nhận dispatch, engine command hoặc transaction callback. GamePhase provider nối session thật; mọi GamePhase modal dùng slots bên trong GamifiedModal. EventModal bank/course/macro/trading không bị bỏ sót.

`createGameplayBinding` chỉ subscribe ở React commit. Epoch được tạo mới theo lifecycle subscription/session; revision tăng khi immutable snapshot đổi. Request giữ exact question, snapshot reference, generation, UUID và AbortSignal. Invalidations: edit, close, session/snapshot change cùng hoặc khác phase, feature OFF, unmount, restart/import. Abort detach/token/closing guards chống synchronous reentrancy. Render phải kiểm `isCurrent()` ngay tại thời điểm chọn response/error để hiển thị.

Truyền context đã validate vào suggestions để không quảng bá quote bán khi thiếu holdings. Cơ chế spread vàng vẫn giải thích được mà không cần holdings. Fact labels phân biệt Khoản tiết kiệm và Lô trái phiếu dù cùng số ordinal. Mọi answer nói rõ không đọc draft form inputs.

Chuyển tab không gửi câu hỏi, không close binding và không thay game state. Giữ Decision subtree mounted để giữ form draft. Context đổi đưa view về Decision và clear answer ngay cả khi tab đang ẩn. Đóng AI/modal thực sự gọi close hoặc unmount; không dùng tab switch thay cho close.

Dùng fixed slots cho tabs/cash/footer và một scroll body. Không mở modal AI thứ hai. Không đưa universal provider vào Coach hoặc các modal Sổ tay/settings ngoài GamePhase. `data-gameplay-cash` chỉ giúp ẩn badge lặp trong universal Decision; không được thay số tiền hoặc nút thanh toán. Rolling overview nằm trên bottom dock; nghiệm thu cả roll/Túi Đồ/Sổ Tay ở từng thiết bị.

## Boundaries cho integration tiếp theo

Model, universal HTTP endpoint và production flag vẫn OFF/chưa mount. Không sửa policy cũ thành tổng quát. Nếu sau này thêm server transport, phải kiểm raw ingress/size/authenticated session/current revision/deadline/limiter, đáp ứng cùng canonical validation và OFF guard; cần approval riêng.

Không lấy draft amount/symbol/lot từ DOM/text để suy diễn quote. Contract hiện giải thích snapshot và whole-holding quotes. Draft-aware migration phải có selector quote từ tham số đã validate, draft identity/digest và invalidation khi draft đổi. Thiếu dữ kiện phải fallback.

Owner/Phát review 13 domain và wording; giữ 25 repair phrasings được kiểm riêng. 13 unfamiliar paraphrases trong evaluation chưa được hiểu (fallback); không quảng bá open-ended financial assistant. Không dùng output này như khuyến nghị đầu tư thật.

Bằng chứng, coverage, exact path inventory và kế hoạch nghiệm thu: [EXE_UNIVERSAL_AI_COMPANION_REPORT.md](EXE_UNIVERSAL_AI_COMPANION_REPORT.md). Một local commit được Owner duyệt cho task final review; push/merge/deploy cần approval riêng.