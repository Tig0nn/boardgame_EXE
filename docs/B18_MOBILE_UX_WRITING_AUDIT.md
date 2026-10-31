# Audit câu chữ Mobile B18

Ngày 20/10/2026. Nhánh `codex/b18-mobile-ux-writing-audit`, nền tài liệu `f0bb612`; mã sản phẩm khớp candidate `927e53e2189bd6d901ed494791d9dc7e912358a6` (diff src/mobile_app/tests rỗng trước sửa). Bảng này được lập trước triển khai. Không thay engine, dữ liệu, schema, nhật ký hoặc bằng chứng QA cũ.

| File / component | Trước | Vấn đề | Dự kiến sau | Lý do / kiểm chứng ý nghĩa |
|---|---|---|---|---|
| EconomicEventModal | Thị trường vừa phản ứng | Không nói điều gì thay đổi | Giá thay đổi sau sự kiện | So sánh snapshot ngay trước/sau cùng cú sốc, không thêm dự báo |
| EconomicEventModal | Bình quân đều các mã | Dễ nhầm lãi danh mục | Mức thay đổi trung bình của tất cả cổ phiếu; mỗi mã tính như nhau | Selector hiện lấy trung bình không trọng số của tỷ lệ biến động từng mã |
| EconomicEventModal | Áp lực trả nợ 0/2 → 0/2 | Nhầm nợ người chơi; thiếu diễn giải | Áp lực tài chính tăng/giảm/không thay đổi; của bên phát hành | So sánh stressBefore/stressAfter; thang kỹ thuật giữ trong chi tiết, 0 không bảo đảm trả nợ |
| EconomicEventModal | Thay đổi định giá chưa thực hiện (ẩn) | Quá chuyên môn; tác động cá nhân khó thấy | Giá trị tài sản bạn đang giữ tăng/giảm, chưa phải tiền đã nhận | Chỉ dùng portfolioImpact đã kiểm tra số lượng không đổi; thiếu snapshot không suy diễn là không sở hữu |
| BondCreditPanel | Áp lực X/2 | Chỉ số trần, không rõ chủ thể | Rủi ro chậm trả/mất vốn ngay thẻ; thang áp lực trong chi tiết | Giữ tình trạng issuer, hạng và toàn bộ tham số; không gọi AA/0 là an toàn |
| BondCreditPanel | Tín dụng, kỳ hạn & cách rút vốn | Tên khó hiểu; nơi bán chưa đầy đủ | Khả năng trả nợ và cách lấy lại tiền | Nội dung theo rules profile: tại ô Trái phiếu nếu cho phép, Xuất phát và funding; không hứa bán được khi default |
| TradingPanel / MarketDetails | Giá vốn / Chênh lệch | Cần hiểu tiền đã chi và tiền bán nhận | Số tiền đã bỏ ra mua; Chênh lệch giá mua và bán | Không thay cost basis/quote; nêu đơn vị bình quân khi đang chia theo units |
| TradingPanel | Giá có thể giảm chỉ ở !compact | Mobile thiếu cảnh báo trước mua | Giữ cảnh báo giảm giá cả bản compact | Không thay phí hoặc giao dịch |
| GameResultModal / FinancialReview | Huy động hợp lệ / vốn quán chưa bán | Khó hiểu; dễ nhầm tiền mặt và tổng tài sản | Nguồn tiền về đích, kèm tiền bán sau phí/trừ nợ; tiền còn nằm trong quán | Dùng nguyên goalProgress và recorded facts, không tạo nguyên nhân thắng thua |
| LapSummaryModal | Giữ nguyên từ bản ghi; chỉ Việt hóa nhãn | Lộ chi tiết triển khai | Tiền đã nhận/chi khác khoản đang chờ hoặc mất | Không thay giá trị và thứ tự settlement |
| MarketNews / Forecast | Tín dụng / biến động giá | Dễ nhầm khả năng trả nợ với giá và lãi cá nhân | Khả năng trả nợ; giá trung bình không phải lãi của bạn | Giữ dự báo và số liệu selector; thêm phạm vi trung bình ở lớp chính |
| FundingDialog / RebalanceDialog | Thực nhận; Phí & chênh lệch | Thiếu chủ thể tiền mặt/loại chênh lệch | Tiền nhận sau phí; phí và chênh lệch giá | Không sửa saleQuote; không cộng gốc/lãi chưa nhận |
| Glossary | Coupon / Default / Liquidity / Maturity | Dịch bằng thuật ngữ khác vẫn khó | Tiền lãi trái phiếu định kỳ; Không trả được nợ; Khả năng có tiền khi cần; giải thích mốc đến hạn | Giữ alias cũ, ID và thuật ngữ kỹ thuật ở lớp giải thích |
| Setup / Save | Mã hành trình, JSON, phiên bản | Có ích nhưng cần biết để làm gì | Giữ nhãn, giải thích tệp xuất từ trò chơi và không di chuyển save qua domain | Không thay import/export/storage hoặc validator |
| Tutorial / Rulebook / board | thanh khoản / nghĩa vụ / quyết toán | Nhiều khái niệm trước trải nghiệm | tiền có thể dùng khi cần / khoản phải trả / tổng kết thu chi | Giữ 9 loại ô, quy tắc riêng của ván cũ và giá trị số |
| Business / Course / Personal | Đã có chi phí, tiền sau mua, kỳ nhận và lựa chọn | Không cần thay mọi chuỗi | Chỉ làm rõ vốn chưa thu hồi và thời điểm khoản hẹn | Đối chiếu businessOverview/courseChoices/eventsForGame; không thêm gợi ý tối ưu |

Phạm vi rà soát gồm tất cả component Mobile và component dùng chung mà Mobile nhập: Setup, 9 ô, khóa học, đầu tư, Ví, sự kiện, thanh toán, tổng kết vòng, kết quả, bản tin, sổ tay, import/resume và AI Coach tùy chọn. Không sửa tệp Desktop riêng. Những chỗ đã rõ được giữ, không thay từ hàng loạt trong dữ liệu lịch sử.
