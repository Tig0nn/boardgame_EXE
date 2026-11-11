# EXE EG3-AI-10 | Gold Replay Reliability Fix & DEV Freeze

Workspace `C:\Users\Admin\EXE-whatif-demo`, branch `feat/b18-whatif-deep-analysis-v2`, HEAD `759a6fe1879816a716e21e38cc91eecd3fe5f50a`.

**`DEV_MOCK_STABLE`** trong phạm vi thiết bị, ngân sách và các lượt kiểm chứng bên dưới. Không ghi nhận P0/P1 thuộc phạm vi feature-owned hoặc flaky test sau sửa trong hai bộ regression đầy đủ và năm ca ghim CPU. Trạng thái này giới hạn theo bằng chứng đã chạy.

## Điều tra và giới hạn kết luận

Đã tái hiện Gold C1 trả `limited` và ghi được lý do **`time-budget`**. Năm tiến trình chạy đúng ca `public pending rejects invalid inputs, preserves head, then valid retry commits once`, mỗi tiến trình dùng `--test-concurrency=2`, cùng được ghim vào một CPU logic bằng affinity của PowerShell cha. Trước sửa, cả năm resume hết ngân sách 20.000 ms khi mới dùng 109–143 trong 5.000 bước. CPU tiêu thụ trong mỗi resume chỉ khoảng 3,0–5,5 giây, còn wall-clock vượt 20 giây. Thử nghiệm này đo được tác động của việc các tiến trình cạnh tranh CPU. [Trace trước sửa](playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/before-pinned-summary.json)

Hai bộ regression trước sửa đã được chạy đồng thời, mỗi bộ dùng concurrency 2, cùng Chromium tạo tải. Ca Gold mục tiêu trong cả hai bộ hoàn tất với 195 bước và còn khoảng 11,8 giây. Vì log lỗi EG3-AI-09 thiếu reason và trace từng giai đoạn, nguyên nhân chính xác của chính lượt lịch sử đó vẫn là **`ROOT_CAUSE_UNCONFIRMED`**. Phép tái hiện có kiểm soát ở trên chứng minh một nguyên nhân gây cùng triệu chứng và xác định được phần việc cần giảm. Các trace đo trong Node test process. Ca này gọi replay trực tiếp, nên số đo của ca này không phải thời gian chờ Worker.

Máy kiểm thử dùng Windows, Node 22.14.0, Intel i7-1260P, 16 CPU logic và khoảng 16,9 GB RAM. Snapshot khi đang chạy nhiều bộ kiểm thử ghi nhận khoảng 0,97 GB RAM trống. Không có phép đo riêng để quy toàn bộ chênh lệch scheduling cho CPU, GC hoặc paging. [Thông tin môi trường](playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/environment.json)

## Bản sửa feature-owned

1. Trong `endgame-whatif-paired.ts`, mỗi lệnh thành công trước đây phải canonicalize toàn bộ state cùng log chỉ để chuẩn bị kiểm tra mutation khi bị từ chối. Trace đo 38 lần chụp witness, tiêu thụ khoảng 2,4 giây CPU trong một resume. Hiện chụp bằng `JSON.stringify`, rồi chỉ normalize và so sánh dữ liệu đầy đủ khi native action bị từ chối. Việc kiểm tra mutation tiếp tục bao phủ toàn bộ snapshot. Các hash tài chính và transcript vẫn dùng canonical hiện có.
2. `identifyGoldWithSource` trả lại source đã parse dưới cùng phép xác minh identity. `reconstruct` sử dụng source đó trong cùng operation, giảm một lần parse và xác minh đồ thị trùng lặp. Mỗi operation vẫn đọc lại source riêng. API `identifyGold`, `prepareGoldRequest` và `goldSource` tiếp tục có cùng contract.
3. Assertion trong test Gold C1 bổ sung reason vào thông báo lỗi, giúp lần thất bại sau có bằng chứng trực tiếp.

Ngân sách wall-clock 20.000 ms và 5.000 bước tiếp tục áp dụng. Actual replay, paired continuation, independent Alternative replay và kiểm tra source vẫn là các điều kiện công bố số liệu.

Thử thay witness riêng trước khi bỏ parse lặp cho kết quả 1/5 thành công dưới tải ghim CPU. Sau cả hai sửa đổi, **5/5 hoàn tất**, mỗi resume dùng 195 bước, tốn 15,96–16,52 giây wall-clock và còn 3,48–4,03 giây ngân sách. [Thử witness riêng](playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/trial-pinned-summary.json) · [Trace sau sửa](playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/after-pinned-summary.json)

Ví dụ dưới đây lấy tiến trình số 1 của từng lượt ghim CPU. Mỗi ô ghi wall-clock / CPU / ngân sách ms còn lại sau giai đoạn. Trace JSON đi kèm lưu đủ cả năm tiến trình và số bước còn lại. Giai đoạn identify bao gồm xác minh identity và transcript.

| Giai đoạn resume | Trước sửa, ms | Sau sửa, ms |
| --- | --- | --- |
| Identify | 5.166 / 798 / 14.818 | 2.140 / 469 / 17.859 |
| Parse source lặp | 4.121 / 609 / 10.712 | Đã dùng source từ identify |
| Actual replay | 3.479 / 610 / 7.233 | 2.302 / 344 / 15.557 |
| Paired replay | 7.295 / 1.390 / -62 | 5.498 / 1.063 / 10.059 |
| Independent verification | Chưa tới giai đoạn này | 5.602 / 890 / 4.457 |
| Final proof | Chưa tới giai đoạn này | 975 / 172 / 3.482 |

## Kiểm chứng

- **Hai lượt regression đầy đủ chạy đồng thời đều PASS 305/305**, mỗi bộ concurrency 2, đối chiếu chính xác toàn bộ tên test EG3-AI-09. Bộ test tiếp tục chứng minh Gold C1 +104.006 VND ở ba chỉ số và hash Alternative đã nghiệm thu, Bank +200.000 VND, cả bảy nhóm quyết định, độc lập replay, cancellation, stale response và Worker cleanup. Ca Gold mục tiêu còn 13.072 ms và 13.267 ms ngân sách khi hoàn tất trong hai lượt này. [Lượt A](playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/final-regression-a-summary.json) · [Lượt B](playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/final-regression-b-summary.json)
- **Chromium stress 9/9 PASS**, gồm lịch sử khác fixture cũ của cả bảy nhóm, throttle và chạy lặp trên cùng ván. Ca stress ghi 3 lần replay hoàn tất, 8 lần hủy nhanh, 16 Worker được tạo và 0 Worker còn hoạt động khi đóng. Save và official result được đối chiếu sau từng ca. [Chromium stress](playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/reliability-final-results.json)
- **Chromium App baseline 50/50 PASS**, tổng cộng **59/59 ca Chromium** trong lượt này trên desktop, 390px và 320px. Có Gold C1 qua mock HTTP, explicit follow-up và native Worker, cùng kiểm tra +104.006 VND ở ba chỉ số. Các ca đóng panel trong lúc provider, probe và Worker đang chạy đều PASS. Mỗi ca đối chiếu packed save và official result, đồng thời đợi toàn bộ Worker đóng. Cả hai nhóm Chromium ghi 0 page error và 0 request ngoài allowlist. [Chromium App baseline](playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/baseline-final-results.json)

TypeScript mobile/root, ESLint theo phạm vi và build production trong bộ nhớ PASS. Một lượt TypeScript ban đầu phát hiện kiểu `string | undefined` của thông báo assertion. Đã sửa và chạy lại thành công. [TypeScript và ESLint](playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/checks-corrected.json) · [Build](playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/build-final.json)

## Giới hạn và trạng thái freeze

CPU bị chia sẻ nặng hơn hoặc thiết bị chậm hơn vẫn có thể chạm ngân sách. `limited/time-budget` cần tiếp tục fail closed và cho người chơi thử lại khi tải giảm. Khi nghiệm thu trên máy này, nên chạy một bộ regression đầy đủ tại một thời điểm và dùng các lượt đồng thời riêng để đo stress.

Gemini live **`LIVE_NOT_RUN`**. FinancialTerm core 320px vẫn **`OWNER_APPROVAL_REQUIRED`**. Chromium 320px dùng Enter qua bước core, rồi kiểm tra touch trong panel What-if. [Diff core đang chờ](playtests/whatif-endgame/2026-11-10/eg3-ai-06-01/core-tooltip-proposed-NOT-APPLIED.patch)

Source của lượt này gồm `mobile_app/src/game/endgame-whatif-paired.ts`, `endgame-whatif-gold-identity.ts`, `endgame-whatif-gold-resume.ts` và `endgame-whatif-gold-c1.test.ts`. Các script chẩn đoán, trace và bằng chứng nằm trong `docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01`.

Freeze manifest ghi SHA-256 của bốn file trên cùng module ngân sách, HEAD, branch và staging trống. Manifest chỉ được tạo sau khi hai lượt 305/305 và 59 ca Chromium thành công. Đây là điểm dừng của lượt sửa reliability. [Freeze manifest](playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/freeze-manifest.json)

Để tái chạy, dùng `node docs/playtests/whatif-endgame/2026-11-10/eg3-ai-10-01/regression.mjs <tên-lượt-mới> trace`. Mode `plain` chạy trực tiếp cùng danh sách test. Script ghi file bằng chế độ tạo mới. `register-gold-trace.mjs` chỉ được import bởi lệnh test chẩn đoán và thêm quan sát trong bộ nhớ. Các artifact `concurrent-a/b` là lỗi khởi động loader do đường dẫn Windows và đã được sửa. Các log `repro-a/b` trước sửa không có kết quả cuối bộ test, nên chỉ dùng các đoạn trace ca Gold, không tính là một lượt regression PASS.
