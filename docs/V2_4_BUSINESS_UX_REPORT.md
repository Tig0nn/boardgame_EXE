> **HISTORICAL** — Bằng chứng Business V2.4 trên root Web trước tích hợp illustrated Mobile; cơ chế hiện hành được tổng hợp riêng. Nguồn chuẩn hiện tại: [CURRENT_MVP.md](CURRENT_MVP.md). Các phương pháp, kết quả và nội dung gốc bên dưới được giữ nguyên; lệnh lịch sử không được thực thi lại trong audit này.

# Business V2.4 — Luồng mua và sở thích khách hàng

Nhánh `codex/business-v2-4-customer-preferences`, tạo từ `origin/main` mới nhất `661bcf6` (đã merge V2.3). Không merge hoặc deploy.

## Commit A — `8362ce1`: mua cơ sở kết thúc encounter

- Mua thành công 20M được ghi một transaction `buy-business`, đồng thời chuyển `rolling` và xóa `eventId`. Không gọi Skip, không thêm RNG, giữ giá thu hồi ban đầu 14M.
- Version encounter mới `v2.4-business-purchase-complete` giữ giới hạn Bank một khoản/nâng cấp một lần. Chặn bán/nâng cấp ở lượt vừa mua, kể cả gọi engine trực tiếp sau khi mở lại encounter hoặc tiếp tục JSON. Lượt Business sau vẫn nâng cấp rồi bán được.
- Board thông báo mua thành công và chuyển focus về nút gieo. UI trước mua không hiện nút bán/nâng cấp; submit lock và cập nhật state nguyên tử chặn double-tap.
- Không sửa luật `v2.3-single-action` hay fallback `legacy-multi-action`: các log mua rồi bán cùng encounter vẫn replay được. Mã transaction không đổi, version và snapshot xác định transition đúng khi replay.
- Các suite regression cũ dùng factory V2.3 tường minh qua `tests/helpers/v2_3.ts`; không đổi assertion để khớp hành vi mới. Diagnostic lịch sử vẫn chạy policy scenario V2.3. Tests mới dùng factory hiện tại.
- Kiểm chứng: **143/143 tests, 19/19 diagnostics hành vi**, ESLint, TypeScript app/harness, build pass. Chrome 320/390/430/1440px: double-tap trừ đúng 20M một lần, tự đóng panel, focus/nút gieo hoạt động; không lỗi console/tràn ngang. [Bằng chứng A](playtests/business-v2_4/purchase-flow/verification.json).

## Commit B — sở thích khách hàng và Business UX

Game mới dùng `businessRulesVersion: v2.4-customer-preferences`, độc lập với version encounter của commit A. Không đổi tên hoặc ánh xạ các khóa `growth/uncertain/recovery`.

| ID mới | Nhãn tiếng Việt | Ví dụ nâng cấp quán đồ uống |
|---|---|---|
| `checkin` | Không gian check-in | Trang trí, không khí quán, góc chụp ảnh |
| `budget` | Giá cả hợp lý | Combo tiết kiệm, giá dễ tiếp cận, hiệu quả chi phí |
| `taste` | Chất lượng đồ uống | Công thức, nguyên liệu và chất lượng |

- `CustomerPreferenceId` là union riêng; action V2.4 dùng `customerPreferenceId`, action legacy giữ `trend`. Engine kiểm tra chuyên môn đúng phiên bản và từ chối khóa kinh tế trong action V2.4. Các tầng đã mua được giữ đến khi bán cơ sở theo luật cũ.
- Sở thích được sinh bằng nguồn FNV-1a/Mulberry32 riêng có namespace `customer-preferences-v2.4`, từ **seed + lap**; không đọc/ghi `GameState.rng`. Thứ tự ba lựa chọn/thuật toán được cố định cho version này và có test vector. Các vòng có thể trùng sở thích; không ép phải đổi mỗi vòng.
- `customerPreferenceId` lưu trong state, snapshot và log; seed/lap/version đủ tái lập nguồn. Chỉ cập nhật khi bắt đầu vòng mới. START, macro shocks, funding pause và JSON continuation giữ nguyên sở thích của vòng đang quyết toán. Không lấy sở thích từ `scenarioId`.
- Thu nhập khi sở hữu: **3M + 700k × tổng tầng + 1M × tầng trùng sở thích hiện tại**. Một tầng trùng = **4,7M**, một tầng không trùng = **3,7M**. Đổi sở thích chỉ đổi bonus điều kiện, không mất tầng hay lợi ích 700k.
- Giữ giá mua 20M, nâng 5M, tối đa sáu tầng, một nâng cấp/encounter, giới hạn mua/bán, khấu hao, công thức thu hồi và tác động kinh tế lên giá bán. Không bán business khi funding; vốn chưa bán không tính vào lawful proceeds.

### Giao diện

Trước mua: tóm tắt 20M/3M/14M và hạn chế bán; nút mua và Skip, không có controls nâng cấp/bán. Mua xong về board với thông báo thành công. Encounter sau: sở thích hiện tại ở đầu panel, ba lựa chọn radio có ví dụ và số tầng đang có; chi phí/700k cố định/1M điều kiện và preview thu nhập từ selector. Nút nâng khóa sau một lần, bán vẫn được phép. Giải thích vốn và rủi ro trong disclosure.

`BusinessPanel.tsx` dùng style hiện tại, không thay thiết kế bàn. `businessOverview` cung cấp số liệu/preview; component không tạo công thức thu nhập mới. Radio hỗ trợ Tab/phím mũi tên. Market Forecast giữ nguyên ba hàng Stocks/Bonds/Gold, không thêm sở thích khách hàng. Fixture được chỉnh dùng cùng wrapper portfolio với ứng dụng chính để kiểm tra tablet chính xác.

### Replay và tương thích

- Schema vẫn **5**. V2.4 lưu ID sở thích; replay kiểm tra metadata và dựng action bằng chuyên môn mới. Snapshot/copy/serialized continuation giữ đủ trạng thái.
- `v2.3-fixed-income` vẫn tính matching theo `scenarioId`; `v2.2-trend-shock` vẫn giữ công thức xu hướng/cú sốc. Vắng version business vẫn fallback legacy, không tự chuyển game cũ sang V2.4.
- Các version encounter cũ tiếp tục cho phép mua rồi bán ngay trong một encounter. Test thực hiện luồng này từ seed thật rồi replay toàn bộ log; không ghi đè fixture lịch sử.
- Replay log V2.1 original/A/B, V2.2, atomic-stock và cả hai bản log V2.3 trước/sau giới hạn encounter. Tám artifact lịch sử giữ nguyên; 12 file được bảo vệ (config/board/RNG/market/settlement/savings/Forecast/dependencies…) không đổi. [Audit nguồn](playtests/business-v2_4/source-audit.json).

### Kiểm chứng bản cuối

- **155/155 product tests, 19/19 diagnostics hành vi**, ESLint, TypeScript app/harness và production build pass. Tổng 16 tests mới so với main: bốn cho purchase-flow và 12 cho V2.4; giữ nguyên assertion trong các suite regression cũ với factory V2.3 tường minh.
- Tests bao phủ ghi transaction một lần, atomic completion, chặn sale/upgrade/double submit ở purchase encounter; lượt sau nâng một lần rồi bán; nguồn sở thích độc lập; vector seed/lap; matching/nonmatching; giới hạn sáu tầng; macro/normal recovery; paused START/JSON; legacy và V2.4 replay; Bank/stock protection.
- Chrome **320/390/430/768/1024/1440px**: không tràn ngang/console errors; kiểm tra cả ba chuyên môn và preview, keyboard radio, double-tap mua/nâng, Skip, bán sau nâng, forecast chỉ ba tài sản. [Evidence V2.4](playtests/business-v2_4/preferences/verification.json).
- Ván C20 thật `XVTL-V2-0`: **4 START, 25 lượt**, 1 mua quán, 1 nâng cấp, 1 bán, 3 atomic-stock; kết quả **85.128.031 ₫**, chưa đạt 90M. Sở thích lần lượt `budget → budget → checkin → budget`; tầng budget giữ nguyên khi vòng 3 không trùng. RNG/xúc xắc/vị trí khớp ván tham chiếu V2.3 ở mọi lượt. Không có Skip sau mua quán/stock/gửi Bank. [Log tải từ browser](playtests/business-v2_4/preferences/browser-game-log.json.gz) replay khớp toàn bộ state.
- Hồi quy rộng trên bốn viewport: ván `XVTL-V2-6` **4 vòng, 26 lượt**, **103.921.205 ₫**, nhiều khoản Bank qua các encounter khác nhau, 2 atomic-stock, mọi panel/funding/START/results pass. [Hồi quy](playtests/business-v2_4/preferences/regression-verification.json). 121 ảnh hồi quy lưu tạm; 38 ảnh tập trung V2.4 lưu trong repo.
- Artifact verifier V2.2 vẫn fail checksum `GameDialogs.tsx` theo manifest UI cũ (giới hạn đã có từ baseline). Manifest và dữ liệu mô phỏng không bị tái sinh để che lỗi; đây là check artifact lịch sử riêng, không phải failure của 19 diagnostics hành vi.

Ảnh: [mua 320px](playtests/business-v2_4/preferences/320-purchase.png), [sở thích 390px](playtests/business-v2_4/preferences/390-preference.png), [chọn nâng cấp](playtests/business-v2_4/preferences/390-upgrade-choice.png), [khóa lần hai](playtests/business-v2_4/preferences/390-upgrade-used.png), [kết quả](playtests/business-v2_4/preferences/390-result.png).

### Giới hạn

Kiểm tra bằng Chrome viewport, chưa trên thiết bị thật. Encounter có cơ sở vẫn cần cuộn dọc ở màn nhỏ để hiển thị đủ ba lựa chọn và phần rủi ro; không có asset đồ họa mới hay dependency mới. Các script browser V2.3 lưu lịch sử phục vụ checkout tương ứng; kiểm tra V2.4 dùng `scripts/verify-business-v2_4.mjs`, regression dùng script mobile đã cập nhật. Không chạy lại Monte Carlo, merge, push hoặc deploy.
