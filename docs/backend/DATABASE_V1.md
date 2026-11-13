# PostgreSQL V1

Compose chạy PostgreSQL 17, bind cổng host vào `127.0.0.1`, kiểm tra bằng `pg_isready` qua TCP và giữ dữ liệu trong named volume `postgres_data`. `apps/api/.env` chứa thông tin đăng nhập local. [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/)

| Bảng | Khóa, liên kết và ràng buộc |
| --- | --- |
| `profiles` | PK `user_id` là UUID từ Supabase JWT. Lưu thời điểm tạo. |
| `scenario_versions` | PK `(scenario_id, version)`. Lưu gameplay profile, phiên bản engine, phiên bản kết quả và kích thước bàn hợp lệ. |
| `game_sessions` | UUID PK, FK đến profile và cặp khóa scenario. Unique `(user_id, creation_key)`. Seed hex 128 bit, số tiền gửi ban đầu và kỳ hạn, trạng thái enum, state version không âm, hai timestamp UTC. Index phục vụ danh sách của owner và tra theo scenario. |
| `game_actions` | FK session, PK `(session_id, sequence)` với sequence dương, unique `(session_id, idempotency_key)`. Lưu action type, payload JSONB dạng object và phiên bản engine/kết quả. |
| `game_snapshots` | FK session, PK `(session_id, state_version)`. Lưu chuỗi từ serializer canonical, giữ thứ tự khóa JSON khi đọc lại. PostgreSQL kiểm tra payload là object có schema version khớp cột. |
| `game_results` | PK session, FK ghép đến final snapshot cùng session. State version dương, outcome enum, lawful proceeds dạng `bigint` VND có dấu trong miền số nguyên an toàn của engine và phiên bản engine/kết quả. |
| `admin_audit_logs` | UUID PK, FK đến profile của actor, thông tin target và details JSONB dạng object. Index theo actor/thời điểm và target/thời điểm. |

Các bảng quan hệ dùng timestamp với múi giờ. API trả thời điểm dưới dạng ISO 8601 UTC. Tiền trong snapshot dùng số nguyên VND theo engine. Khi thêm ghi kết quả ở Phase 2, kiểm tra số nguyên an toàn trước khi chuyển sang `bigint`.

`0000_foundation.sql` tạo bảy bảng. `0001_seed_b18.sql` đăng ký B18 multi-course từ checkpoint `e30bbd0`. `0002_signed_result_proceeds.sql` cho phép lưu giá trị âm khi nợ và nghĩa vụ vượt số tiền thanh lý. `0003_b18_session_setup.sql` thêm `initial_savings` và `savings_term` vào session với ràng buộc 0–50.000.000 VND và 1–3 kỳ. Session cũ nhận mặc định 0 VND và 1 kỳ. Drizzle ghi lịch sử vào `drizzle.__drizzle_migrations`. `db:generate` sinh SQL và metadata từ TypeScript schema, `db:migrate` áp dụng migration, `db:check` xác nhận kết nối. Với thay đổi gameplay sau này, đăng ký scenario version mới để session đã lưu tiếp tục trỏ đến cấu hình ban đầu. [Drizzle Kit generate](https://orm.drizzle.team/docs/drizzle-kit-generate)

V1 ghi dữ liệu vào `profiles`, `game_sessions` và `game_snapshots`. Ba bảng action, result và audit dành cho các luồng ghi sau. Backend lọc dữ liệu theo owner trong truy vấn. Database local phục vụ riêng backend, ở loopback.

Bộ integration dùng `TEMPLATE template0` để kiểm tra migration trên database mới hoàn toàn. Suite chỉ xóa database có tên ngẫu nhiên mà chính lần chạy vừa tạo. Xem [hướng dẫn Windows](../../apps/api/README.md) để đổi sang volume trống mà vẫn giữ bản cũ.

## Ghi action ở Phase 2A

Phase 2A sử dụng ba migration hiện có. `game_actions.sequence` là state version sau action, nên expected version của lệnh đã commit bằng `sequence - 1`. Cặp `(session_id, idempotency_key)` tra được lệnh gốc. Snapshot có cùng version dùng để trả lại response lịch sử. Seed, genesis, chuỗi lệnh có thứ tự và metadata engine/result đủ để kiểm tra replay theo checkpoint.

Khi engine kết thúc, cùng transaction cập nhật session thành `completed` và thêm đúng một dòng `game_results` tham chiếu final snapshot. [Thiết kế Phase 2A](./ACTIONS_V2A.md)

Phase 2B lưu thêm payload funding/event bằng cùng schema và tra snapshot/kết quả hiện tại theo cặp session/version. [Thiết kế Phase 2B](./ACTIONS_V2B.md)
