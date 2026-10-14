> **CURRENT** — Điểm vào repository; nguồn mô tả sản phẩm chuẩn là [CURRENT_MVP.md](docs/CURRENT_MVP.md), cập nhật 13/10/2026.

# Xoay Vòng Tiến Lui

Game tài chính tiếng Việt một người chơi, React/TypeScript/Vite. Hai ứng dụng **root Web** và **illustrated Mobile** dùng chung engine V2.4; state ở bộ nhớ trình duyệt, chưa có autosave/import UI/multiplayer. AI Coach là backend tùy chọn sau ván, không quyết định tài chính.

## Bắt đầu

Dùng Node 22.14 trở lên trong dòng 22.x (CI đã qua ở 22.23.3). Từ repository root:

```sh
npm ci
npm ci --prefix mobile_app
npm run dev --prefix mobile_app
```

Mở Mobile tại http://localhost:5174 hoặc URL Vite in ra. Web/API dev: chạy `npm run dev` ở terminal root khác, mặc định http://localhost:5173. Mobile proxy API cố định tới 5173; Vite static preview không tự chạy Function. Không cần AI key để chơi. Khi cần AI local, key chỉ đặt trong root `.env.local` bị ignore; xem [AI handoff](AI_COACH_HANDOFF.md). Dừng Vite trước `npm ci` nếu Windows giữ native binding.

## Sản phẩm và hosting hiện tại

Entry point hai UI dùng Experimental B, C20, 20 ô/4 vòng, vốn 50 triệu, lương 14 triệu/START, mục tiêu mua 80 triệu còn 10 triệu dự phòng. Luật đầy đủ về business, savings, đầu tư, funding, catalog thật với giá giả lập, crypto seed và replay nằm ở [CURRENT_MVP.md](docs/CURRENT_MVP.md); không dùng đặc tả V2 cũ làm mặc định hiện tại.

| Ứng dụng | URL | Phạm vi xác minh |
| --- | --- | --- |
| Root Web — `boardgame-exe` | https://boardgame-exe.vercel.app | Project/output Web gốc giữ riêng; không bị thay bởi Mobile |
| Illustrated Mobile — `boardgame-exe-mobile-preview` | https://boardgame-exe-mobile-preview.vercel.app | User xác minh setup/board/HUD/3D/dice; audit đọc HTTP 200 và GET API 405 JSON |

Deployment Mobile hiện được gắn **Production trong project Mobile riêng**, dù tên có “preview”; điều này không có nghĩa Web production bị thay hoặc PR đã merge. Chưa xác minh full online game, real AI response hoặc điện thoại Android/iOS thật. [PR #8](https://github.com/Tig0nn/boardgame_EXE/pull/8) trên `feat/mobile-v2-4-engine-integration` vẫn mở, chưa merge.

## Kiểm tra

```sh
npm test
node --experimental-strip-types --test scripts/diagnostics/*.test.ts
npm run lint
npm run build
npm run build --prefix mobile_app
```

[CI run 38421516083](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38421516083) tại `13c9c7c`: **186 product tests + 21 diagnostics**, hai clean install, lint và hai build qua trên Linux/Node 22.23.3. Đây là mốc kiểm chứng trước audit tài liệu, không phải kết quả được gán cho SHA mới. Workflow [PR checks](.github/workflows/pr-checks.yml) chạy PR nhắm main, không cần AI keys. Không chạy simulation để kiểm tra docs; runner lịch sử có thể ghi đè artifacts.

## Tài liệu và mã nguồn

- [Nguồn chuẩn MVP](docs/CURRENT_MVP.md), [chỉ mục đầy đủ](docs/README.md), [inventory và ma trận mâu thuẫn](docs/DOCUMENTATION_AUDIT.md).
- [Mobile handoff](MOBILE_APP_HANDOFF.md), [AI handoff](AI_COACH_HANDOFF.md), [PR8 review và follow-up deployment](docs/PR8_FINAL_REVIEW.md).
- [Roadmap hiện tại](tasks/current.md): online playthrough, thiết bị thật, icon C20 Mobile, provider AI thật và quyết định merge.
- Engine/data: [src/game/engine.ts](src/game/engine.ts), [src/data/config.ts](src/data/config.ts), [src/data/modes.ts](src/data/modes.ts). UI: [Web App](src/App.tsx), [Mobile App](mobile_app/src/App.tsx).

Báo cáo V2–V2.4 trong docs được đánh dấu HISTORICAL/SUPERSEDED theo phạm vi; giữ nguyên số liệu, seeds và phương pháp. “Mobile” trong báo cáo responsive root Web không đồng nghĩa ứng dụng `mobile_app/`. Kết quả heuristic offline không phải đo lường production/người chơi.
