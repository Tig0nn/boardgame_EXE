# Risk & Allocation Learning Study — research only

Owner: mục tiêu phân bổ tài chính và quản lý rủi ro. Không chọn winner, không Final QA, merge hoặc deploy.

Nguồn được bảo toàn: `45b0c4d` (balance, đã push), `33de1229e36fb5fb8a0df63cf4cf6899720cd3f4` (trading, local branch ref đã kiểm tra). Không sửa file đã tồn tại ở 33de122; không đụng thư mục untracked `xoay-vong-tien-lui/`.

## Trình tự và tiêu chí

1. Audit B/D nguyên cấu hình và heuristic trading disciplined hiện có: 120 seed mới × 10 strategy × 2 bàn. Chỉ bổ sung quan sát, chưa thay luật/policy.
2. Đọc audit trước khi cố định vị trí course→personal. Chọn đúng một ô course có lượt ghé sau mua thường gặp; không đổi economy.
3. Screening: 120 seed chung mới, B/D gốc và hai biến thể, 11 strategy. Common economy: D dùng economy B nhưng giữ 5 START và 20 ô; B là đối chiếu đã chạy. Reserve 0/5/10/15M trên savings/stocks/diversified; r10 tái sử dụng screening. Ticket, điều kiện khóa học, exit, funding và noise giữ chung; đầu tư chỉ phần cash vượt reserve. Đây là gói phân bổ–dự phòng, không phải tác động tiền mặt độc lập với mức đầu tư.
4. Tăng seed chỉ trên tối đa ba ứng viên có khả năng thay đổi quyết định giáo dục (chênh tiếp xúc personal ≥10 điểm %, hoặc thiếu hụt ≥5 điểm %, hoặc trade-off tail ≥2M). Đóng băng shortlist, policy, tiêu chí và 400 seed holdout riêng trước khi chạy. Không tinh chỉnh sau holdout.
5. Báo cáo VN tách thực nghiệm/giả thuyết/khuyến nghị; CSV/JSON, raw gzip, recorded-action replays, bundles nguồn, hashes, manifest. Hướng dẫn người thật xác nhận kiến thức và đo phút thực tế.

## Định nghĩa phải công bố

- Quyết định thực chất: trạng thái có ≥2 hành động khả thi, tính riêng encounter/START/funding; popup acknowledge không tính. Đây là proxy menu, chưa đo chất lượng suy nghĩ.
- Drawdown thô và drawdown cộng lại sinh hoạt **đã phát sinh** (cash trả + pending mới), không cộng trùng funding. Bản điều chỉnh vẫn gồm personal/course/fees/business/credit; không gọi là drawdown thị trường thuần.
- Cơ hội exit cấu trúc (đã tiếp cận ô, sau đó có START/ô thích hợp) khác cơ hội bán thực thi khi thật sự giữ tài sản; savings chỉ rút trước hạn khi funding, không tự bán tại START.
- Biến thể thay loại encounter làm RNG engine/path có thể phân kỳ; paired seed chỉ giảm nhiễu, không bảo đảm common random numbers sau phân kỳ.
- Không dùng full-grid, không chạy lại 400.800 ván hay 31.800 ván cũ. Không suy từ heuristic sang người chơi.

## Checklist

- [x] Xác minh commit nguồn và tạo `codex/core-mvp-risk-allocation` từ 33de122.
- [ ] Audit, metrics và kiểm thử.
- [ ] Screening có kiểm soát, freeze trước holdout.
- [ ] Holdout, báo cáo, playtest protocol, verification, commit nghiên cứu.
