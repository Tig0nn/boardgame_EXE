> **CURRENT** — Bàn giao kỹ thuật illustrated Mobile, cập nhật 13/10/2026. Nguồn mô tả MVP chuẩn: [CURRENT_MVP.md](docs/CURRENT_MVP.md).

# Mobile App — bàn giao V2.4

Candidate mới ngày 14/10: `codex/mobile-ui-final` giữ foundation `13faa21`, thích ứng visual chọn lọc từ `277d2dc`. [Báo cáo tổng hợp](docs/MOBILE_UI_FINAL_REPORT.md) và [roadmap](tasks/current.md) tách kiểm chứng local mới khỏi các mốc hosting/CI lịch sử bên dưới. Chưa deploy candidate.

Nhánh đang làm việc `feat/mobile-v2-4-engine-integration`, [PR #8](https://github.com/Tig0nn/boardgame_EXE/pull/8) chưa merge. URL: https://boardgame-exe-mobile-preview.vercel.app. Đây là ứng dụng trong `mobile_app/`, khác root Web responsive/SVG. Canvas thiết kế 940 × 1672 được co theo viewport; không phải chứng nhận đã thử trên điện thoại thật.

## Kiến trúc và các file có thật

| File/thư mục (từ root) | Vai trò |
| --- | --- |
| [mobile_app/src/App.tsx](mobile_app/src/App.tsx) | Setup/session, subscribe snapshot, animation hiển thị; không tái tính tài chính |
| [mobile_app/src/game/session.ts](mobile_app/src/game/session.ts) | Thin dispatcher tới engine root, kiểm snapshot identity, ánh xạ phase |
| [src/game/new-game.ts](src/game/new-game.ts) | Factory người chơi: B/C20, V2.4, `vn-v1`, crypto seed khi trường seed trống |
| [mobile_app/src/components/GamePhase.tsx](mobile_app/src/components/GamePhase.tsx) | Render phase/panel theo engine |
| [mobile_app/src/components/BoardView.tsx](mobile_app/src/components/BoardView.tsx), [Character3D.tsx](mobile_app/src/components/Character3D.tsx), [Dice3D.tsx](mobile_app/src/components/Dice3D.tsx) | Bàn minh họa, model/animation, xúc xắc hiển thị giá trị engine |
| [BottomControls.tsx](mobile_app/src/components/BottomControls.tsx), [TopHud.tsx](mobile_app/src/components/TopHud.tsx), [PortfolioDrawer.tsx](mobile_app/src/components/PortfolioDrawer.tsx) | Điều khiển; HUD cash, debt khi có, tiến độ lawful proceeds; net worth ở Ví |
| [GameResultModal.tsx](mobile_app/src/components/GameResultModal.tsx) | Result theo selector, export/restart, gắn shared AI Coach |
| [mobile_app/src/data/tiles.json](mobile_app/src/data/tiles.json) | Tọa độ artwork; loại/nhãn/thứ tự dùng C20 chính thức từ root |
| [mobile_app/src/utils/audio.ts](mobile_app/src/utils/audio.ts) | Procedural audio/BGM; khả năng unlock/WebGL/touch cần test thiết bị thật |

Financial panels tái dùng code `src/components/` và selectors/transactions root. Không còn economy/events JSON riêng của Mobile. Các tên `BottomBar`, `PortfolioModal`, `HistoryModal`, `Toast` trong bàn giao ban đầu không phải file implementation hiện tại. Lịch sử bản cũ vẫn ở [Git trước audit](https://github.com/Tig0nn/boardgame_EXE/blob/13c9c7c5fa932e50a3ba23da4b316e1dff4cdda9/MOBILE_APP_HANDOFF.md).

Assets giữ nguyên: [main-background.png](mobile_app/public/assets/main-background.png), [playboard.PNG](mobile_app/public/assets/playboard.PNG), [sectionplay.PNG](mobile_app/public/assets/sectionplay.PNG), [character.glb](mobile_app/public/assets/character.glb), [xucxac.PNG](mobile_app/public/assets/xucxac.PNG), [model-viewer.min.js](mobile_app/public/model-viewer.min.js). Root Web dùng [city-background.webp](public/art/city-background.webp), không phải playboard Mobile. Icon ghép trong playboard còn lệch C20; danh sách chính xác ở [báo cáo tích hợp lịch sử](docs/MOBILE_V2_4_FINANCIAL_INTEGRATION_REPORT.md).

## Chạy/build và backend

Từ root, cài **cả hai** lockfile trước khi chạy:

```sh
npm ci
npm ci --prefix mobile_app
npm run dev --prefix mobile_app
```

Mobile mặc định http://localhost:5174. Chạy thêm `npm run dev` ở root terminal khác nếu cần local API tại 5173. [Vite config](mobile_app/vite.config.ts) proxy `/api` tới 5173 và dedupe React/React DOM; bỏ dedupe làm component root dùng React instance khác và gây trắng trang ở production bundle.

```sh
npm run build --prefix mobile_app
npm run preview --prefix mobile_app
```

Output `mobile_app/dist`; static preview không chạy Function. [Vercel Mobile riêng](https://boardgame-exe-mobile-preview.vercel.app) dùng repository root `.`, install `npm ci && npm ci --prefix mobile_app`, build `npm run build --prefix mobile_app`, output `mobile_app/dist`; giữ root shared source và API. Deployment hiện gắn **Production của project Mobile**, không phải Web production và không phải bằng chứng PR đã merge. Không đổi output project Web gốc để chuyển sang Mobile.

Key AI chỉ ở backend/project environment đúng mục đích; không đưa vào frontend hoặc `VITE_*`. Xem [AI handoff](AI_COACH_HANDOFF.md). Không khẳng định key/provider đã hoạt động vì GET route qua.

## Kiểm chứng và việc còn lại

- [CI tại 13c9c7c](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38421516083): 186 product tests, 21 diagnostics, lint, hai build và hai `npm ci` qua. Số 168 của bàn giao cũ là lịch sử, không phải số test hiện tại.
- [Browser evidence local](docs/playtests/mobile-v2-4/browser-verification.json): full game, state parity/replay, funding, nhiều lot, recovery sau rapid trade tap; AI lỗi 503 được mock. Giữ nguyên bằng chứng, không chuyển thành kết quả online.
- Online: user đã nhìn thấy setup/board/HUD/3D/dice; audit xác nhận HTTP 200/title Mobile và GET API 405 JSON. Chưa có full online game tới Result/export/replay, successful provider response hoặc physical-phone playtest.
- Không cam kết “100% mọi đường gameplay/thiết bị/animation đã đúng”. Regression bảo vệ các đường đã có bằng chứng; model/audio/touch cần thử Android/iOS thật.

[Roadmap hiện tại](tasks/current.md) theo dõi full online gameplay, Android/iOS, icon C20, AI provider thật và final merge decision. [PR8 follow-up](docs/PR8_FINAL_REVIEW.md) giữ chronology triển khai và giới hạn mới nhất. Audit này không đổi source, rule, assets hoặc simulation.
