> **CURRENT** — Chỉ mục tài liệu, cập nhật 15/10/2026. Chỉ [CURRENT_MVP.md](CURRENT_MVP.md) là nguồn mô tả MVP chuẩn; các báo cáo là bằng chứng theo mốc.

# Chỉ mục tài liệu

## Tài liệu đang duy trì

| Tài liệu | Vai trò |
| --- | --- |
| [CURRENT_MVP.md](CURRENT_MVP.md) | Cơ chế V2.4 từ code, hai UI, AI, CI, deployment và giới hạn hiện tại |
| [MOBILE_UI_FINAL_REPORT.md](MOBILE_UI_FINAL_REPORT.md) | Candidate UI tổng hợp 14/10; ma trận giữ/bỏ/thích ứng, ảnh, model 3D và replay local |
| [ECONOMIC_NEWS_V1_REPORT.md](ECONOMIC_NEWS_V1_REPORT.md) | Bản tin, giá thực tế theo vòng, cú sốc, ảnh responsive và replay local 15/10 |
| [ATOMIC_INVESTMENT_ENCOUNTERS_REPORT.md](ATOMIC_INVESTMENT_ENCOUNTERS_REPORT.md) | Policy mua một lần/ghé ô cho phiên mới; compatibility, ảnh và replay local |
| [BOND_V2_5_DESIGN_SPEC.md](BOND_V2_5_DESIGN_SPEC.md) | Đặc tả tín dụng trước engine; tham số thử nghiệm, lifecycle, accounting và phiên lịch sử |
| [BOND_V2_5_IMPLEMENTATION_REPORT.md](BOND_V2_5_IMPLEMENTATION_REPORT.md) | Triển khai, năm ván browser, funding fixture, replay và screenshots |
| [BOND_V2_5_BALANCE_REPORT.md](BOND_V2_5_BALANCE_REPORT.md) | Prototype và 12.000 ván/sáu chiến thuật; uncertainty, tail loss và giới hạn |
| [README repository](../README.md) | Quick start và điều hướng |
| [Mobile handoff](../MOBILE_APP_HANDOFF.md) | File thật, shared engine, assets, build/proxy và bằng chứng Mobile |
| [AI handoff](../AI_COACH_HANDOFF.md) | Mobile integration, backend contract, key server, grounding và giới hạn |
| [PR8 review](PR8_FINAL_REVIEW.md) | Chronology trước deploy và follow-up 13/10/2026 sau Mobile smoke verification |
| [tasks/current.md](../tasks/current.md) | Roadmap đang hoạt động và điều kiện xác nhận từng việc |
| [DOCUMENTATION_AUDIT.md](DOCUMENTATION_AUDIT.md) | Inventory 32 Markdown sau Bond V2.5 candidate; ma trận audit lịch sử, checker link/path và bảo toàn |

**CURRENT** là tài liệu được duy trì. **HISTORICAL** ghi lại implementation/experiment/verification theo phiên bản và mốc cũ. **SUPERSEDED** là spec/prompt/guide/plan đã được thay thế cho việc sử dụng hiện tại; vẫn giữ để tra lịch sử. Không lấy một câu “mặc định”, “chưa deploy”, “PASS” hoặc “chờ phê duyệt” trong tài liệu lịch sử làm trạng thái hiện tại.

## Báo cáo phiên bản và UX lịch sử

| Nhóm | Tài liệu |
| --- | --- |
| V2 spec/prompt — SUPERSEDED | [Đặc tả V2](XVTL_GAME_SPEC_V2.md), [implementation prompt](../CODEX_PROMPT_IMPLEMENT_V2.md) |
| V2 implementation/research — HISTORICAL | [Implementation](V2_IMPLEMENTATION_REPORT.md), [balance](V2_BALANCE_REPORT.md), [board analysis](V2_BOARD_BALANCE_ANALYSIS.md), [game length](V2_GAME_LENGTH_ANALYSIS.md) |
| V2.1 — HISTORICAL | [Playtest readiness](V2_1_PLAYTEST_READINESS.md) |
| V2.2 — HISTORICAL | [Mechanics research](V2_2_MECHANICS_REVIEW.md), [savings profile implementation](V2_2_IMPLEMENTATION_REPORT.md) |
| V2.2 guide/roadmap — SUPERSEDED | [Solo guide](V2_2_SOLO_TEST_GUIDE.md), [plan](../tasks/plan.md), [todo](../tasks/todo.md) |
| Root Web UX/artwork — HISTORICAL | [Responsive mobile Web](MVP_MOBILE_UI_REPORT.md), [transaction UX](MVP_UX_AUDIT_AND_FIXES.md), [GD artwork root Web](GD_ARTWORK_INTEGRATION_REPORT.md) |
| V2.3–V2.4 business — HISTORICAL | [Business V2.3](V2_3_BUSINESS_IMPLEMENTATION_REPORT.md), [Business V2.4](V2_4_BUSINESS_UX_REPORT.md) |
| Illustrated Mobile integration — HISTORICAL | [V2.4 integration and savings research](MOBILE_V2_4_FINANCIAL_INTEGRATION_REPORT.md) |

“Mobile” trong responsive Web/GD reports là viewport của root Web. Illustrated Mobile dùng `mobile_app/public/assets/playboard.PNG` và `character.glb`; root Web dùng `public/art/city-background.webp` và SVG board/pawn. Báo cáo GD không xác nhận icon C20 Mobile đã đúng.

## Simulation và test evidence

| Bằng chứng giữ nguyên | Cách đọc |
| --- | --- |
| [V2 simulation JSON](simulations/v2-results.json) | 55.000 ván heuristic snapshot V2; không phải cân bằng/telemetry V2.4 |
| [Board experiment JSON](simulations/v2-board-balance-results.json) | Thí nghiệm bố trí bàn/horizon/policy theo báo cáo board; không tự áp vào gameplay |
| [Game length JSON](simulations/v2-game-length-results.json) | Các horizon nghiên cứu, không phải tất cả đều là mode UI hiện hành |
| [Savings V2.4 JSON](simulations/v2_4-savings-lot-comparison.json) | 180.000 ván offline, paired seeds, A/B nghiên cứu; giữ Policy A, không tái sinh trong audit |
| [Mobile browser verification](playtests/mobile-v2-4/browser-verification.json), [full game log](playtests/mobile-v2-4/browser-game-log.json.gz) | Local browser/parity/replay và AI mock 503; không phải full online/real AI |
| [Root artwork verification](playtests/gd-artwork/production-verification.json) | Local production build của root Web, không chứng nhận hosting/character Mobile |
| [PR8 review JSON](playtests/pr8-final/verification.json) | Snapshot review trước Mobile deployment mới; đọc thêm follow-up trong PR8 report |
| [CI tại code 13c9c7c](https://github.com/Tig0nn/boardgame_EXE/actions/runs/38421516083) | 186 product tests + 21 diagnostics, hai install, lint và hai build qua |

Mỗi report liên kết bảng, seeds, intervals và manifests gốc. Không cập nhật checksum verifier lịch sử để làm một snapshot cũ trông như đã pass code mới. Simulation runner có thể ghi đè report/artifact; chỉ tái lập có chủ đích trên snapshot phù hợp, không chạy từ quick start.

## Giới hạn đang mở và kiểm tra docs

[Roadmap](../tasks/current.md) theo dõi full online game, Android/iOS thật, icon C20, provider AI thật và merge decision. [Mobile URL](https://boardgame-exe-mobile-preview.vercel.app) đã qua smoke/GET API, deployment đang gắn Production trong project riêng; không tự coi đây là release sign-off.

[Offline documentation check](DOCUMENTATION_AUDIT.md) dùng Node standard library và Git, kiểm tra inventory/classification, link/path/case, preservation và docs-only diff. Có thể dùng lệnh đó trong CI mà không cần network credentials; audit này không đổi workflow hoặc thêm runtime code. Xem kết quả thực tế trong audit report.
