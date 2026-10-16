# Hướng dẫn playtest — Phân bổ tài chính và quản lý rủi ro

Research only. Owner duyệt ứng viên trước khi chuyển luật vào bản playtest. Simulator chưa chứng minh người chơi học được kiến thức. Chưa đo thời lượng bằng phút.

## Thiết kế buổi thử đề xuất

- Tuyển 12–18 người ở vòng định tính đầu: có/không có kinh nghiệm tài chính; ghi kinh nghiệm chơi boardgame. Đây là đề xuất cỡ mẫu khám phá, không phải power analysis hay kết quả đã chạy.
- Mỗi người chơi hai ứng viên được Owner duyệt; cân bằng thứ tự B→D và D→B, chia đều seed/kịch bản. Không để cùng một người chơi lại cùng seed vì nhớ trước kết quả. Không dùng seed holdout để chỉnh simulator.
- Ghi riêng phút hướng dẫn, phút chơi đến kết thúc, phút đọc báo giá, phút quyết định và phút debrief; số lần cần trợ giúp. Dự trù lịch 60–75 phút/người gồm hai ván và phỏng vấn, **không coi đây là ước lượng thời lượng ván**. Nếu chưa xong trong lịch, ghi censored và lý do.
- Giữ ngôn từ hướng dẫn, vốn, luật và mức trợ giúp giống nhau. Cho xem quyền mua/bán/bỏ qua, một giao dịch thành công/encounter, quyền bán START/funding; Business chỉ bán tại Business. Không gợi ý phải đa dạng hóa hay reserve bao nhiêu.
- Thu quyết định, ảnh trạng thái/log, tiền mặt, savings, danh mục, nợ/nghĩa vụ và sự kiện trước/sau. Xin đồng ý ghi âm nếu cần. Chỉ ghi dữ liệu cần thiết, dùng mã người tham gia.

## Trước ván: elicitation không dạy đáp án

Cho người chơi phân bổ 50M giả định và giải thích ngắn: “Bạn giữ bao nhiêu tiền có thể dùng ngay? Điều gì có thể khiến bạn đổi phân bổ?” Hỏi sự khác nhau giữa lãi suất/coupon, tăng giá, và tiền bán thực nhận. Ghi nguyên văn, chưa sửa đáp án; đây là baseline nhận thức.

## Trong ván: câu hỏi theo thời điểm

Hỏi tối đa ba lần và ghi thời gian bị gián đoạn. Không đọc gợi ý trước khi họ chọn.

| Thời điểm | Câu hỏi trung tính | Bằng chứng cần quan sát |
|---|---|---|
| Quyết định đầu tư đầu | “Vì sao bạn chọn số tiền này? Sau đó tiền nào có thể dùng ngay?” | Liên hệ reserve, số START còn lại, kỳ hạn và nhu cầu tiền; biết trade-off lợi nhuận/thanh khoản |
| Trước quyết định personal | “Bạn có những nguồn nào để trả? Mỗi nguồn có hậu quả gì?” | Phân biệt cash, rút savings mất lãi, bán net sau phí/spread, vay có lãi/hạn mức; Business không bán khẩn cấp |
| Sau shock khi giữ tài sản | “Điều gì vừa thay đổi? Bạn có cần thay đổi kế hoạch không?” | Phân biệt biến động giá và tiền mặt, coupon chưa chắc trả, credit có delay/default, không xem forecast là bảo đảm |

Nếu seed không có personal hoặc shock khi giữ tài sản, đánh dấu **không được tiếp xúc**, không chấm 0 kiến thức. Sau ván dùng vignette riêng, giữ nguyên ba tình huống và luật; đánh dấu đây là bài kiểm tra bổ sung, không phải trải nghiệm bàn cờ tự nhiên.

## Sau ván: giải thích và chuyển giao

1. Đề nghị người chơi giải thích thắng/thua bằng ít nhất hai quyết định của mình và một yếu tố ngẫu nhiên. Đối chiếu log; không thưởng chỉ vì thắng hoặc có proceeds cao.
2. Cho một báo giá mua/bán khác: tính tiền bán sau spread và fee; hỏi tại sao lời trên giá có thể thành lỗ thực nhận.
3. Đặt hóa đơn y tế 5M khi tiền mặt 2M, có savings và gold; yêu cầu so sánh funding hợp lệ, mất lãi/phí/nợ. Hỏi liệu Business có thể bán ngay ở đây không.
4. Cho lựa chọn coupon A/B hiện hành với trạng thái credit khác nhau; hỏi “coupon cao có chắc tiền thực nhận cao hơn không?” và lý do.
5. Cho một kỳ hạn savings vượt thời gian còn lại; hỏi vốn nào dùng được và lúc nào. Không đánh đồng savings với tài sản có thể tự bán ở START.
6. Yêu cầu phân bổ lại 50M trong một tình huống mới, giải thích reserve và điều kiện sẽ đổi ý. Không yêu cầu diversified hoặc reserve 10M là đáp án duy nhất.

## Rubric chấm trước khi xem kết quả

Mỗi khía cạnh 0/1/2: 0 = giải thích sai, 1 = nhắc đúng khái niệm nhưng chưa liên hệ quyết định, 2 = áp dụng đúng và giải thích trade-off/hậu quả. Khía cạnh: phân bổ; dự phòng; rủi ro giá; spread/fee; credit; kỳ hạn/thanh khoản; giải thích kết quả có yếu tố may rủi. Tách “không tiếp xúc”, “không nhớ luật”, “không hiểu khái niệm”. Hai người chấm độc lập một phần mẫu, giải quyết bất đồng và lưu ví dụ.

Báo cáo pre/post và vignette riêng; nêu phản ứng/hành vi, phân phối phút thực tế, tỷ lệ bỏ cuộc/trợ giúp và lỗi hiểu luật. Không suy kết quả học dài hạn từ một buổi; nếu cần retention, đề xuất khảo sát sau 3–7 ngày có Owner duyệt. Không dùng win rate làm điểm kiến thức.

## Điều kiện để Owner cân nhắc cấu hình

So sánh ứng viên theo tỷ lệ thật sự có tình huống giải thích reserve, mức quyết định có thể giải thích, khóa vốn/exit, tải đọc và thời lượng đo được. Xem kỹ người thắng nhờ lương nhưng không hiểu risk và người thua dù lý luận hợp lý. Nếu funding/credit hiếm, kết luận hạn chế của bàn hiện tại trước khi đề xuất một nghiên cứu luật mới; không tự tăng rủi ro để ép bài học.
