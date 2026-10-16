# Tái lập Risk & Allocation Study

Node 22.14.0, `--experimental-strip-types`, không cần cài thêm thư viện. Chạy ở root repo. Mọi cấu hình dùng bản sao engine tạm do adapter tạo và xóa có kiểm tra đường dẫn. Không import cấu hình research vào production.

```powershell
node --experimental-strip-types --test scripts/research/risk-allocation/*.test.mjs
$evidenceRoot = (Resolve-Path 'docs/research/risk-allocation').Path
$env:RISK_STUDY_OUT = 'docs/research/risk-allocation-reproduction'
node --experimental-strip-types scripts/research/risk-allocation/run.mjs audit 120
node --experimental-strip-types scripts/analyze-core-mvp-risk-allocation.mjs audit
Copy-Item -LiteralPath "$evidenceRoot/screen-freeze.json" -Destination "$env:RISK_STUDY_OUT/screen-freeze.json"
node --experimental-strip-types scripts/research/risk-allocation/run.mjs screen 120
node --experimental-strip-types scripts/analyze-core-mvp-risk-allocation.mjs screen
node --experimental-strip-types scripts/research/risk-allocation/run.mjs reserve 120
node --experimental-strip-types scripts/analyze-core-mvp-risk-allocation.mjs reserve
node --experimental-strip-types scripts/research/risk-allocation/run.mjs course-control 120
node --experimental-strip-types scripts/analyze-core-mvp-risk-allocation.mjs course-control
node --experimental-strip-types scripts/research/risk-allocation/run.mjs reserve-variant 120
node --experimental-strip-types scripts/analyze-core-mvp-risk-allocation.mjs reserve-variant
Copy-Item -LiteralPath "$evidenceRoot/holdout-freeze.json" -Destination "$env:RISK_STUDY_OUT/holdout-freeze.json"
Copy-Item -LiteralPath "$evidenceRoot/analysis-correction.json" -Destination "$env:RISK_STUDY_OUT/analysis-correction.json"
node --experimental-strip-types scripts/research/risk-allocation/run.mjs holdout 400
node --experimental-strip-types scripts/analyze-core-mvp-risk-allocation.mjs holdout
node --experimental-strip-types scripts/report-core-mvp-risk-allocation.mjs
node --experimental-strip-types scripts/verify-core-mvp-risk-allocation.mjs
```

Không ghi đè phase cũ: runner từ chối nếu manifest tồn tại. Reserve dùng cùng 120 seed SCREEN; r10 đọc từ screening, không chạy lại. Audit có seed khác screen. Holdout có ba bàn × 11 strategy × 400 seed, cộng hai policy reserve trên savings/D biến thể × 400 = 14.000 ván. Danh sách/cấu hình được đóng băng trước khi chạy; source guard từ chối simulator thay đổi. Diagnostic course-control chỉ có cash-course, không đưa vào trọng số 9 strategy.

Khi tái lập đúng evidence đã bàn giao, dùng freezes/correction gốc như các lệnh trên; không gọi freeze script để ra quyết định mới. Freeze script lưu lại cách shortlist đã được tạo trong lần nghiên cứu đầu. Phương án khác: chạy đúng bundle của từng phase. Nếu tái lập bằng HEAD hiện tại, checksum sourceSha/test/run có thể khác các checkpoint trước; phải so nội dung/hash bundle và raw kết quả, không so timestamp/elapsed. Verifier kiểm tra simulation bằng policy/metrics đúng bundle từng phase, adapter/engine inputs không đổi. Analyzer được sửa lỗi ghép cặp auxiliaries trước khi đọc kết quả holdout, lưu `analysis-correction.json`; không thay simulator, strategy, candidate hay seed. Không ghi đè original manifest. Report generator khi có RISK_STUDY_OUT chỉ ghi REPORT.md vào output mới, không ghi report gốc trong docs.

Sau full verification, `node --experimental-strip-types scripts/verify-core-mvp-risk-allocation.mjs --seal-only` chỉ đóng lại manifest/source bundle khi chỉnh tài liệu; kiểm tra simulator frozen và hashes dữ liệu cũ trước, không chạy lại mô phỏng hoặc replay. Không dùng thao tác này để thay verification đã thất bại.

Nguồn: `src/game`, `src/data` ở `33de122` (production giống các đợt trước), adapter/policy/metrics/replay của core-mvp và trading-ab được tái sử dụng không sửa. `*-source.json.gz` lưu **nội dung** LF của từng module và `*-manifest.json` lưu SHA256, config đầy đủ, seed, source checkpoint và Node version. SHA của checkpoint không tự mô tả những file mới chưa commit lúc chạy; bundle/hash là nguồn chính xác của phase. Các bundle có cả module hỗ trợ nguyên gốc. Frozen config đầu vào ở `docs/research/core-mvp/frozen-configs.json`; config thực chạy nằm trong manifest và `phase/*.config.json`.

`*.rows.json.gz`: một row/ván, không phải log lịch sử schema5. `*.examples.json.gz`: một recorded-action replay/strategy/job, kèm config và state/log đầy đủ. Không sửa/chuyển đổi replay lịch sử. `*.summary.json` là mô tả từng strategy, không xem các strategy dùng cùng seed là mẫu độc lập.

Các tỷ lệ nằm trong [0,1], tiền VND; báo cáo dùng M = triệu VND. Proceeds = tiền huy động hợp lệ sau nợ/nghĩa vụ/pending, không cộng Business chưa bán; savings cuối có principal rút theo xét mục tiêu, không cộng lãi chưa nhận. P10 là lower-order quantile; worst-decile là trung bình 10% proceeds thấp nhất. Mean chiến lược có mục đích là trọng số bằng nhau, không đại diện quần thể người chơi.

Raw drawdown dùng totalWorth; living-adjusted cộng lại chi phí sinh hoạt đã ghi nhận ở schedule (kể cả phần thiếu mới), không cộng lại funding. Vẫn chứa học phí/personal/fees/credit/Business; hai drawdown không được trừ nhau để suy ra “tổn thất do sinh hoạt” vì thời điểm peak khác nhau. Locked-time proxy = savings principal còn active + Business capital ban đầu + principal bond default không bán được, trung bình ở trạng thái trước roll; không gồm chi phí nâng cấp Business, có thể thấp hơn vốn đã đầu tư. LockedBusiness cuối là marked value không đưa vào proceeds. Đây là các proxy được định nghĩa hẹp, không phải VaR.

Reserve policy thử0/5/10/15M là ngân sách tùy chọn; mục tiêu80M +10M cuối ván giữ nguyên. Không đòi cash luôn ≥reserve sau chi bắt buộc. `personalCommittedCost` là cost+obligation đã chọn, không phải loss thị trường; premium là phần đắt hơn lựa chọn tổng chi phí rẻ nhất. Rút savings mất lãi ghi riêng, không cộng vào expense lần hai. Thời gian chạy/test có thể gồm máy host tạm ngưng; không dùng elapsed của công cụ làm thời lượng ván hay benchmark.

`financialAccess` = có ít nhất một menu mua/gửi khả thi theo tiền mặt thực tế, không đòi heuristic chọn mua. `accessThenSale` = menu đó rồi có checkpoint START/encounter bán phù hợp; với bank chỉ có checkpoint kỳ hạn, không khẳng định rút tùy ý. `ownedSaleOpportunity` = đã sở hữu và có sale quote thực thi tại START/ô; bank ghi việc đáo hạn/rút funding thực tế. Business open→upgrade→exit path đòi sau menu mua khả thi có thêm hai encounter Business, chưa chứng minh đủ tiền hoặc đã làm cả chuỗi.

DecisionSteps đếm trạng thái trước hành động có ≥2 lựa chọn khả thi (encounter, START, funding). DecisionEncounters đếm mỗi turn một lần; course sau mua và macro acknowledge không tính. Không đo người chơi có hiểu/quan tâm lựa chọn. Coupon/default chỉ mô phỏng tín dụng giả lập. Novice là noise tổng hợp, không phải hành vi người mới được quan sát.
