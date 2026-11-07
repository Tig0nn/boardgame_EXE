# Phụ lục — Mobile-only Release Readiness, MVP v1.0

Ngày 20/10/2026, Asia/Bangkok. Căn cứ quyết định mới của Product Owner: **chỉ phát hành Mobile Web (`mobile_app`)**. Desktop App chưa nằm trong bản phát hành này.

**Đánh giá: CONDITIONAL GO cho Mobile Web.** Không có P0/P1 Mobile được xác nhận trong phạm vi bằng chứng đã thu. Các luồng Mobile đã kiểm đạt; còn giới hạn thiết bị thật và kiểm tra trên domain chính thức. Đây là đánh giá có điều kiện, **chưa phải phê duyệt hoặc thao tác phát hành**.

[Báo cáo QA gốc](B18_MVP_RELEASE_READINESS_REPORT.md), manifest, ảnh, trace và log RQA-01 được giữ nguyên tại commit QA `6cebf7df0b07f1de15601444066f388c949dc280`. Kết luận NO-GO trong báo cáo đó vẫn mô tả đúng phạm vi cũ gồm cả hai giao diện; phụ lục này áp dụng riêng cho phạm vi Mobile đã được Owner chốt.

## 1. Candidate và ranh giới phát hành

| Hạng mục | Giá trị đã khóa |
|---|---|
| Repository | `Tig0nn/boardgame_EXE` |
| Candidate source SHA | **`927e53e2189bd6d901ed494791d9dc7e912358a6`** |
| Nhánh source tương ứng | `codex/mvp-b18-language-cleanup` |
| Mobile Preview đã QA | [Mở Preview](https://boardgame-exe-mobile-preview-7y72c042b-tris-projects-2888207c.vercel.app) |
| Deployment đã QA | `dpl_DtQYn1xSUpSamKqJLjx6wbPYeQgY` |
| Vercel project duy nhất được phát hành | **`boardgame-exe-mobile-preview`** |
| Project ID tương ứng | **`prj_mNqBP0UOsodb1WifpfNuFfKLmUpG`** |
| Team hiện có của deployment | `tris-projects-2888207c` |
| Domain chính thức | Chưa được chỉ định trong yêu cầu này; cần ghi origin HTTPS cụ thể trong phiếu phát hành trước thao tác |

READY, project identity và SHA lấy từ [deployment](playtests/b18-release-qa/mobile-deployment.json) / [provenance](playtests/b18-release-qa/mobile-provenance.json) đã lưu trong QA. Đây là kết quả của lần kiểm trước; không tuyên bố vừa kiểm lại trạng thái live.

Commit chứa báo cáo/phụ lục hoặc deployment tự sinh từ push tài liệu **không thay thế candidate source SHA**. Khi chuẩn bị phát hành phải đối chiếu chính SHA trên, không chọn HEAD/latest vì tên nhánh gần giống.

**Mọi thao tác phát hành/rollback/domain chỉ được thực hiện trong project Mobile có cả tên và ID ở bảng. Tuyệt đối không promote dự án Desktop** (`prj_UAVbzlwGCgjcXuLLKbu6l8cRehRt`), không trỏ domain Mobile sang deployment Desktop. Nếu project/team/deployment không khớp, dừng bước vận hành và kiểm lại target.

## 2. RQA-01 sau quyết định đổi phạm vi

| Thuộc tính | Trạng thái trong MVP v1.0 Mobile-only |
|---|---|
| Lỗi | Desktop mất ván đang chơi khi reload |
| Severity kỹ thuật | **P0, giữ nguyên** |
| Release disposition | **`OUT OF RELEASE SCOPE / DEFERRED`** |
| Đã sửa? | **Chưa sửa — không phải FIXED** |
| Có chặn phạm vi Mobile-only? | Không, vì lỗi thuộc giao diện Desktop không phát hành |
| Khi nào đánh giá lại? | Trước bất kỳ đề xuất phát hành Desktop hoặc mở rộng phạm vi trở lại |

Không xóa hoặc sửa trạng thái FAIL/P0 trong [storage results gốc](playtests/b18-release-qa/storage/results.json). [Ảnh trước reload](playtests/b18-release-qa/storage/desktop-transaction-before-reload.png), [ảnh sau reload](playtests/b18-release-qa/storage/desktop-after-reload.png) và [trace](playtests/b18-release-qa/storage/desktop-reload-trace.zip) tiếp tục là bằng chứng lỗi còn tồn tại. Đổi phạm vi không chứng minh lỗi đã được khắc phục.

## 3. Bằng chứng riêng cho Mobile và điều kiện kết luận

Các số dưới đây được lọc từ dữ liệu QA có sẵn, không chạy lại gameplay hoặc toàn bộ QA:

| Gate | Bằng chứng / đánh giá Mobile |
|---|---|
| Preview runtime | **PASS đã ghi nhận**: 3 browser mở đúng Mobile Preview, HTTP 200; không page error, console error hoặc request thất bại trong probe |
| Gameplay từ đầu đến cuối | **10 ván Mobile hoàn chỉnh**, gồm 8 Chromium, 1 Firefox, 1 WebKit; có thắng/thua, hai thứ tự học, đầu tư, tiết kiệm, business và funding; replay khớp |
| Bố cục/tooltip/thao tác | **170 kiểm tra Mobile** lọc từ tổng 268; 3 browser × 320/390/768/1440px; không finding hoặc page error được ghi nhận |
| Save/reload/resume | **PASS tại Preview** sau giao dịch; giữ seed/state/log, phân biệt Continue với xem lại ván kết thúc |
| Import/export | **PASS tại Mobile**: B18 cũ, Multi-Course, C20 schema 4/5/6/7; JSON hỏng/schema không hỗ trợ được từ chối; quota có cảnh báo và vẫn export được |
| Tài chính/ngôn ngữ | **PASS trong các đường đã kiểm**: tiền về đích, phí/spread/học phí khớp log; vốn quán chưa bán và tiền chưa thực nhận không bị cộng thêm; mã nội bộ không lộ ở nhãn đã rà |
| Regression dùng chung | **349 product, 46 SSR, 81 historical replay, parity 13 ván/2.306 snapshot**, lint và build Mobile đạt trong QA trước; đây không phải toàn bộ test chỉ dành riêng Mobile |
| Domain chính thức | **PENDING — chưa phát hành/chưa smoke trên origin chính thức** |
| Safari/iOS thật | **CHƯA KIỂM CHỨNG** |
| Android thiết bị vật lý | **CHƯA KIỂM CHỨNG** |

Nguồn: [log verification](playtests/b18-release-qa/new-game-verification.json), [CSV](playtests/b18-release-qa/natural-game-results.csv), [surface results](playtests/b18-release-qa/surfaces/results.json), [storage checks](playtests/b18-release-qa/storage/results.json), [browser probe](playtests/b18-release-qa/browser-probe.json). Số 170 chỉ gồm record có nhãn `-mobile-`; không cộng 98 record Desktop vào độ phủ Mobile. Fixtures import và checkpoint replay không được tính thành ván chơi từ đầu.

CONDITIONAL GO có ba điều kiện vận hành:

1. Owner duyệt phát hành **đúng Mobile project, candidate và domain**; ghi rõ quyết định về giới hạn Safari/iOS và Android vật lý: kiểm smoke mục tiêu trước khi mở rộng tiếp cận, hoặc chấp thuận giới hạn còn chưa kiểm chứng. Không tự báo PASS thiết bị thật từ kết quả giả lập.
2. Xác minh deployment phục vụ production có đúng source SHA, cấu hình Mobile và môi trường mong muốn; smoke save/resume trên domain chính thức đạt trước khi công bố rộng.
3. Ghi sẵn target rollback Mobile hợp lệ, tương thích save đang dùng, hoặc phương án dừng phát hành đầu tiên đã được Owner duyệt nếu chưa có bản production cũ phù hợp.

Nếu phát hiện P0/P1 Mobile ở các bước mục tiêu này, chuyển Mobile về NO-GO và lưu bằng chứng. Không cần chạy lại toàn bộ QA chỉ vì đổi phạm vi; chỉ mở rộng kiểm tra khi source, cấu hình build, môi trường hoặc phát hiện mới tạo rủi ro liên quan.

## 4. Checklist phát hành Mobile — chưa thực hiện

Các ô trống là công việc của bước phát hành sau khi được duyệt, không phải kết quả QA mới.

- [ ] Ghi Owner approval, candidate SHA trên, project name + ID, team, domain HTTPS chính thức, người thực hiện và thời điểm.
- [ ] Kiểm tra root/build/output phục vụ `mobile_app`; kiểm tra project đang chọn bằng name + ID, không dựa vào link `.vercel` của thư mục Desktop hoặc project mặc định CLI.
- [ ] Inspect lại deployment được chọn: đúng source SHA, project Mobile và READY. Không dùng commit tài liệu QA làm candidate thay thế.
- [ ] Ghi deployment/SHA đang phục vụ domain Mobile trước thay đổi và các domain liên quan để rollback; nếu đây là lần phát hành đầu, ghi rõ chưa có target production cũ.
- [ ] Đối chiếu cấu hình Preview/Production cần cho ứng dụng, chỉ ghi tên/cấu hình cần thiết, không đưa giá trị bí mật vào báo cáo. Không giả định build production giống byte-for-byte Preview.
- [ ] Chọn quy trình phát hành Mobile đã được Owner duyệt. Preview → Production có thể tạo build production mới; ghi ID mới và xác minh SHA/READY, rồi thực hiện smoke mục tiêu phù hợp. Nếu dùng staged production build, kiểm trên URL staged trước khi gán domain. [Vercel: Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment).
- [ ] Kiểm tra danh sách domain sẽ chịu tác động; chỉ domain của Mobile trong phiếu duyệt. Không promote/rollback Desktop hoặc tự mở rộng thay đổi alias.
- [ ] Thực hiện checklist origin/save bên dưới, kiểm load asset, nút chính và lỗi JS trên origin chính thức. Ghi bằng chứng PASS/FAIL; chưa đạt thì chưa công bố rộng.
- [ ] Ghi quyết định còn thiếu về Safari/iOS và Android vật lý, trạng thái hỗ trợ đã xác minh và giới hạn chưa kiểm. WebKit Windows không đại diện Safari trên iPhone/iPad.
- [ ] Bàn giao URL chính thức, source SHA, deployment ID, kết quả smoke, target rollback và người theo dõi lỗi. Chỉ Owner chốt phát hành.

Phụ lục này không thực thi merge, tạo deployment, promote, rollback hoặc thay alias.

## 5. Kiểm tra save/resume trên domain chính thức

Dùng browser/profile QA riêng, không xóa hoặc ghi đè save thật của người chơi. Mỗi dòng phải ghi browser/thiết bị, origin, deployment/SHA, seed và PASS/FAIL.

| Bước | Hành động mục tiêu | Kết quả phải kiểm |
|---|---|---|
| Origin | Mở domain HTTPS đã duyệt và kiểm redirect/canonical host trước khi chơi | Đúng Mobile deployment; không đổi host/scheme giữa chừng |
| Save mới | Seed `LANG-0`, gửi 10M kỳ 3 ở Setup; bắt đầu, gieo tới Bank và gửi 6M kỳ 2 | Tiền mặt 34M, hai khoản 10M/6M; ở vòng 1 có mốc đáo hạn lần qua Xuất phát 3/2; xuất JSON làm mốc |
| Reload | Reload sau giao dịch hoàn tất → Setup → Continue | Seed/vòng/lượt, tiền, tài sản, quyền hành động và log giữ nguyên; không mất hoặc lặp giao dịch |
| Mở lại | Đóng/mở tab cùng origin và browser/profile, rồi Continue | Save còn đọc được; không tự tạo ván mới hoặc reset số dư |
| Phiên bản cũ | Import thủ công fixture tự nhiên B18 cũ/Multi-Course/C20 vào profile QA; reload | Giữ profile/schema hợp lệ, số tiền, mốc đáo hạn và log; không tự chuyển luật |
| Ván kết thúc | Import fixture kết thúc đã QA, xem kết quả → Chơi hành trình mới → Setup | “Xem lại ván … đã kết thúc”, không gọi là Continue ván đang chơi |
| Chuyển Preview → chính thức | Người kiểm chủ động export ở Preview rồi chọn file import trên origin chính thức | State/log/phiên bản giữ đúng; không hứa tự xuất hiện Continue chỉ vì dùng cùng thiết bị |
| Lưu lỗi | Kiểm đường cảnh báo/khả năng export trong context QA bị hạn chế storage nếu có kiểm thử mục tiêu | Không báo lưu thành công giả, không crash; người dùng có cách xuất ván trước khi rời trang |

`localStorage` tách theo origin; save ở Preview không tự trở thành save của domain chính thức. Giữ canonical origin ổn định, và chuyển dữ liệu bằng export/import do người dùng chủ động. Không dùng `localStorage.clear()` để “sửa” resume. [MDN: localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

Kết quả Preview hiện có chưa thay thế kiểm tra bảng này trên domain thật. Candidate Mobile hiện không có nút về Setup giữa ván; đường giữa ván được kiểm là reload → Setup → Continue. Không yêu cầu thêm tính năng để thực hiện checklist.

## 6. Checklist rollback Mobile — chuẩn bị trước, chỉ làm khi được phép

- [ ] Trước cutover, ghi chính xác deployment ID/SHA Mobile đã từng phục vụ production, domain gắn với nó và kiểm tra khả năng đọc save schema 4/5/6/7 có liên quan. Không chọn “bản trước” theo trí nhớ hoặc tên nhánh.
- [ ] Định nghĩa trigger: mất save/không resume, giao dịch hoặc mục tiêu sai, không load/chơi được, hoặc lỗi thao tác chính trên thiết bị mục tiêu. Giữ bằng chứng và dừng công bố/mở rộng phát hành khi gặp lỗi chặn.
- [ ] Khi kích hoạt rollback trong phạm vi được duyệt, xác nhận lại **`boardgame-exe-mobile-preview` / `prj_mNqBP0UOsodb1WifpfNuFfKLmUpG`**, domain Mobile và target tương thích. Tuyệt đối không dùng deployment Desktop làm target dự phòng.
- [ ] Nếu có target production Mobile phù hợp, dùng quy trình rollback đã duyệt của project đó; kiểm lại domain đang phục vụ đúng deployment. Instant Rollback đổi deployment phục vụ domain, không rebuild môi trường. [Vercel: Instant Rollback](https://vercel.com/docs/instant-rollback).
- [ ] Nếu chưa có target Mobile phù hợp cho lần phát hành đầu, dùng phương án tạm dừng tiếp cận đã được Owner duyệt; không tự lùi sang bản cũ không đọc được save mới.
- [ ] Giữ origin chính thức, giữ nguyên storage. Export ván lỗi trước nếu còn làm được; rollback code không khôi phục một save đã bị ghi đè/mất và không chuyển dữ liệu giữa origin.
- [ ] Smoke lại load, import bản sao save, Continue, một giao dịch và reload trên cùng origin; kiểm ván kết thúc không bị nhận nhầm. Không xóa save người dùng để đạt PASS.
- [ ] Ghi thời điểm, lý do, deployment trước/sau, kết quả smoke và vấn đề còn lại. Kiểm tra trạng thái tự gán domain cho lần phát hành tiếp theo; không tự resume/promote ngoài phạm vi duyệt.

## 7. Bảo toàn và bàn giao phụ lục

Thay đổi chỉ bổ sung tài liệu và bản ghi đánh giá Mobile; báo cáo QA gốc và toàn bộ bằng chứng đã khóa giữ nguyên. Không chạy lại toàn bộ QA, không sửa gameplay/engine/economics/schema/source sản phẩm. Chỉ kiểm integrity và tổng hợp lại đúng tập Mobile.

[Assessment máy đọc](playtests/b18-mobile-only-readiness/assessment.json) ghi candidate/project, disposition RQA-01, kết luận có điều kiện và các việc còn chờ. Manifest phụ lục nối hash đến báo cáo/manifest QA gốc, để việc đổi phạm vi không bị hiểu nhầm là sửa kết quả hoặc sửa lỗi.

Đã chạy lại duy nhất `node scripts/verify-b18-release-qa-evidence.mjs --check` để kiểm hash. Verifier cũ vẫn in `NO-GO / openP0:1` vì xác minh bản QA hai giao diện đã khóa; đây không phải đánh giá Mobile-only mới. Kết luận riêng Mobile nằm trong phụ lục và `assessment.json` này.
