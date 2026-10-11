import { readFileSync, writeFileSync } from 'node:fs'
import type { aggregate, paired } from './game-length-statistics.ts'
import type { distribution } from './game-length-model.ts'

type Summary = ReturnType<typeof aggregate>
type Pair = ReturnType<typeof paired>
type Dist = NonNullable<ReturnType<typeof distribution>>
const data = JSON.parse(readFileSync('docs/simulations/v2-game-length-results.json', 'utf8')) as {
  games: number
  results: Record<string, Record<string, Summary>>
  controls: Record<string, { cashCourse: Summary; savingsNoCourse: Summary; exitWindow?: Summary; businessVsCashCourse: Pair }>
  fourLapGoalExperiments: Record<string, Record<string, { wins: number; winRate: number; shortfall: Dist }>>
  verification: { pairedPathsChecked: number; crossHorizonPathsChecked: number; protectedFileCount: number }
}
const names: Record<string, string> = { 'cash-heavy': 'Tiền mặt', 'saving-heavy': 'Tiết kiệm', 'stock-heavy': 'Cổ phiếu', 'business-heavy': 'Kinh doanh', diversified: 'Kết hợp' }
const money = (n: number | undefined) => n === undefined ? '—' : (n / 1_000_000).toFixed(2).replace('.', ',')
const number = (n: number | undefined | null, digits = 2) => n === undefined || n === null ? '—' : n.toFixed(digits).replace('.', ',')
const percent = (n: number | null | undefined) => n === null || n === undefined ? '—' : `${number(n * 100)}%`
const row = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`
const table = (headers: string[], rows: (string | number)[][]) => [row(headers), row(headers.map(() => '---')), ...rows.map(row)].join('\n')
const primary = [3, 4, 5, 6].flatMap(h => Object.entries(data.results[h]).map(([strategy, r]) => ({ h, strategy, r })))
const comparison = table(['Vòng', 'Chiến lược', 'Thắng', 'p10 (M)', 'Median (M)', 'p90 (M)', 'Median thiếu (M)'],
  primary.map(({ h, strategy, r }) => [h, names[strategy], percent(r.winRate), money(r.metrics.funds.p10), money(r.metrics.funds.median), money(r.metrics.funds.p90), money(r.metrics.shortfall.median)]))
const exposure = table(['Vòng', 'Roll TB', 'Sinh hoạt: lần / M', 'Biến cố cá nhân TB', 'Macro TB', 'Chi phí bất thường TB (M)', 'Dialog ô TB'],
  [3, 4, 5, 6, 8, 12].map(h => { const m = data.results[h]['cash-heavy'].metrics; return [h, number(m.rolls.mean), `${number(m.livingCount.mean)} / ${money(m.livingPaid.mean)}`, number(m.financialShocks.mean), number(m.macroShocks.mean), money(m.extraordinaryPaid.mean), number(m.eventDecisions.mean)] }))
const decisions = table(['Vòng', 'Chiến lược', 'Tổng thao tác tài chính TB', 'Thao tác đổi tiền TB', 'Lần có >1 option TB', 'Giao dịch tự chọn TB'],
  primary.map(({ h, strategy, r }) => [h, names[strategy], number(r.metrics.financialDecisions.mean), number(r.metrics.monetaryDecisions.mean), number(r.metrics.alternativeChoices.mean), number(r.metrics.voluntaryActions.mean)]))
const business = primary.filter(item => ['business-heavy', 'diversified'].includes(item.strategy))
const access = table(['Vòng', 'Chiến lược', 'Mở cơ sở / tất cả', 'Lap mua TB', 'Quay lại / người mua', 'Nâng cấp / người mua', 'Số tầng TB / người mua', 'Bán / người mua', 'Khóa / người mua'],
  business.map(({ h, strategy, r }) => { const b = r.business; return [h, names[strategy], percent(b.buyRate), number(b.purchaseLap?.mean), percent(b.returnAfterPurchaseRate), percent(b.upgradeRateGivenBought), number(b.upgradesGivenBought?.mean), percent(b.saleRateGivenBought), percent(b.lockedRateGivenBought)] }))
const businessEconomy = table(['Vòng', 'Chiến lược', 'Thu KD TB / người mua (M)', 'Giá bán median / đã bán (M)', 'Lãi thực p10 / median / p90, đã bán (M)', 'Thắng / người mua'],
  business.map(({ h, strategy, r }) => { const b = r.business; return [h, names[strategy], money(b.incomeGivenBought?.mean), money(b.resaleGivenSold?.median), `${money(b.realizedProfitGivenSold?.p10)} / ${money(b.realizedProfitGivenSold?.median)} / ${money(b.realizedProfitGivenSold?.p90)}`, percent(b.buyerCohort.winRate)] }))
const businessRisk = table(['Vòng', 'Không gặp ô trước vòng cuối / tất cả', 'Đã bán nhưng lỗ / người bán', 'Lãi ghi sổ nhưng khóa / người còn khóa', 'Chênh tiền TB so tiền mặt + học (M)', 'Chênh thắng (điểm %)'],
  [3, 4, 5, 6].map(h => { const b = data.results[h]['business-heavy'].business; const p = data.controls[h].businessVsCashCourse; return [h, percent(b.noEligibleTileRate), percent(1 - b.realizedProfitPositiveRateGivenSold!), percent(b.profitableButLockedRateGivenLocked), money(p.fundsDifference?.mean), number(p.meanWinRateDifference * 100)] }))
const exitWindow = table(['Vòng', 'Thắng bán vòng cuối', 'Thắng cửa sổ 2 vòng', 'Khóa/người mua: cuối / cửa sổ', 'Mở cơ sở: cuối / cửa sổ'],
  [3, 4, 5, 6].map(h => { const b = data.results[h]['business-heavy']; const x = data.controls[h].exitWindow!; return [h, percent(b.winRate), percent(x.winRate), `${percent(b.business.lockedRateGivenBought)} / ${percent(x.business.lockedRateGivenBought)}`, `${percent(b.business.buyRate)} / ${percent(x.business.buyRate)}`] }))
const lowRisk = table(['Vòng', 'Chỉ tiền mặt', 'Tiền mặt + học', 'Chỉ gửi, không học', 'Gửi + học', 'Cổ phiếu'],
  [3, 4, 5, 6, 8, 12].map(h => [h, percent(data.results[h]['cash-heavy'].winRate), percent(data.controls[h].cashCourse.winRate), percent(data.controls[h].savingsNoCourse.winRate), percent(data.results[h]['saving-heavy'].winRate), data.results[h]['stock-heavy'] ? percent(data.results[h]['stock-heavy'].winRate) : 'Không chạy']))
const income = table(['Vòng', 'Chính sách', 'Lương TB (M)', 'Sinh hoạt TB (M)', 'Bất thường TB (M)', 'Thưởng TB (M)', 'Học phí TB (M)', 'Lãi đầu tư tài chính TB (M)', 'Huy động cuối TB (M)'],
  [3, 4, 5, 6, 8, 12].flatMap(h => ['cash-heavy', 'saving-heavy'].map(strategy => { const m = data.results[h][strategy].metrics; return [h, names[strategy], money(m.salary.mean), money(m.livingPaid.mean), money(m.extraordinaryPaid.mean), money(m.bonus.mean), money(m.courseCost.mean), money(m.investmentProfit.mean), money(m.funds.mean)] })))
const goals = table(['Tổng cần (M)', 'Giá món đồ (M)', 'Tiền mặt', 'Tiết kiệm', 'Cổ phiếu', 'Kinh doanh', 'Kết hợp'],
  Object.entries(data.fourLapGoalExperiments).map(([requirement, group]) => [money(Number(requirement)), money(Number(requirement) - 10_000_000), ...Object.keys(names).map(strategy => percent(group[strategy].winRate))]))
const long = table(['Vòng', 'Chiến lược', 'Thắng', 'p10 / median / p90 huy động (M)', 'Median vòng chạm 90M tại START / người đã chạm', 'Chưa từng chạm tại START'],
  [8, 12].flatMap(h => Object.entries(data.results[h]).map(([strategy, r]) => [h, names[strategy], percent(r.winRate), `${money(r.metrics.funds.p10)} / ${money(r.metrics.funds.median)} / ${money(r.metrics.funds.p90)}`, r.first90.postSettlement.reachedLap?.median ?? '—', percent(r.first90.postSettlement.neverRate)])))
const duration = table(['Vòng', 'Roll TB / màn', 'Roll TB / vòng', 'Thao tác tài chính TB / vòng, 5 chính sách', 'Dialog ô TB + forecast/summary/checkpoint', 'Ước tính phút, chính sách kết hợp'],
  [3, 4, 5, 6].map(h => {
    const cash = data.results[h]['cash-heavy']; const m = data.results[h].diversified.metrics
    const all = Object.values(data.results[h]).map(r => r.metrics.financialDecisions.mean / h)
    const low = (m.rolls.mean * 6 + m.financialDecisions.mean * 10 + h * 3 * 8) / 60
    const high = (m.rolls.mean * 10 + m.financialDecisions.mean * 20 + h * 3 * 15) / 60
    return [h, number(cash.metrics.rolls.mean), number(cash.metrics.rolls.mean / h), `${number(Math.min(...all))}–${number(Math.max(...all))}`, `${number(cash.metrics.eventDecisions.mean)} + ${h * 3}`, `${number(low, 1)}–${number(high, 1)}`]
  }))

writeFileSync('docs/V2_GAME_LENGTH_ANALYSIS.md', `# Phân tích độ dài màn chơi V2

Ngày phân tích: **11/10/2026**. Đây là chẩn đoán trên cấu hình THỬ NGHIỆM, không phải thay đổi gameplay hay phê duyệt cân bằng.

## Khuyến nghị trước

**Ưu tiên đưa 4 vòng với mục tiêu hiện tại 90M vào playtest làm ứng viên chế độ chuẩn; giữ 3 vòng cho trải nghiệm giới thiệu ngắn. Chưa đổi mặc định chính thức.** Bốn vòng tăng thời gian sử dụng tài sản và cơ hội quay lại ô, trong khi chiến lược chỉ tiền mặt vẫn chỉ thắng ${percent(data.results['4']['cash-heavy'].winRate)}. Tiết kiệm thắng ${percent(data.results['4']['saving-heavy'].winRate)}; quyết định đầu tư và dự phòng vẫn tạo khác biệt đáng kể trong bộ chính sách này. Cần người dùng phê duyệt riêng trước khi sửa gameplay.

Không khuyến nghị 5/6 vòng làm mặc định với nguyên mục tiêu 90M: đây là lựa chọn dễ hơn/dài hơn, đặc biệt 6 vòng cho gửi tiết kiệm không học thắng ${percent(data.controls['6'].savingsNoCourse.winRate)} và gửi có học thắng ${percent(data.results['6']['saving-heavy'].winRate)}. Thắng ít rủi ro không tự thân là xấu; điều cần quyết định là mức thử thách quản lý hạn chót mong muốn.

Unlimited chỉ nên được xem xét sau này như **Sandbox riêng**, không thay màn hữu hạn. Chưa triển khai chế độ này. 8/12 vòng cho thấy tích lũy lương làm mục tiêu cố định mất dần sức ép, nhưng không chứng minh hành vi của trò chơi vô hạn.

### Trả lời trực tiếp Q1–Q6

1. **3 vòng có quá ngắn cho kinh doanh có ý nghĩa?** Ngắn nếu muốn kinh doanh hoàn vốn chủ yếu từ vận hành và có thời gian sửa quyết định. Không phải mọi cơ sở đều lỗ: nhóm bán được có lãi median ${money(data.results['3']['business-heavy'].business.realizedProfitGivenSold?.median)}M. Tuy nhiên, ${percent(data.results['3']['business-heavy'].business.lockedRateGivenBought)} người mua còn khóa vốn và chỉ ${percent(data.results['3']['business-heavy'].business.buyRate)} toàn bộ ván mở được cơ sở. Đây là hạn chế đáng kể cho màn ưu tiên kinh doanh.
2. **4 vòng có tốt hơn làm mặc định?** Có, là ứng viên đáng playtest nhất trong bốn độ dài, không phải kết luận đã xác nhận bằng người chơi. Lợi nhuận kinh doanh tăng, nhưng riêng thêm vòng không giải quyết việc chỉ có một vòng để tìm ô bán.
3. **5/6 vòng có quá dễ?** 5 vòng đã khá dễ với tiết kiệm (${percent(data.results['5']['saving-heavy'].winRate)}), nhưng chỉ tiền mặt vẫn có thể thua hơn nửa số ván. 6 vòng giảm mạnh áp lực mục tiêu: tiết kiệm ${percent(data.results['6']['saving-heavy'].winRate)}, các chiến lược cổ phiếu/kinh doanh/kết hợp khoảng 86–90%. Có thể hợp chế độ nhẹ nhàng; không nên tự gọi là thiết kế kém.
4. **Ít rủi ro chiếm ưu thế từ khi nào?** Theo tỷ lệ thắng của năm heuristic, tiết kiệm đã đứng đầu ở 3 vòng. Nếu định nghĩa “gần chắc đạt” là >=90% trong mẫu, gửi không học và gửi có học cùng vượt ngưỡng ở 6 vòng; chỉ tiền mặt không học vượt ở 8 vòng. Đây không phải chứng minh dominance toán học hay chiến lược tối ưu.
5. **Unlimited có nên là Sandbox tương lai?** Có thể, tách riêng với mục tiêu học cách thử hệ thống. Chưa nên triển khai hay thay màn chuẩn; cần kiểm tra tăng trưởng giá, hiệu năng log và mục tiêu học tập riêng.
6. **Đánh đổi tốt nhất giữa chiều sâu, cơ hội và thời lượng?** 4 vòng là khuyến nghị tạm thời. 3 vòng hợp hướng dẫn ngắn; 5/6 hợp chơi dài hoặc dễ hơn. Việc “chiều sâu hơn” là suy luận từ khả năng tiếp cận và kết quả chính sách, chưa đo bằng playtest.

## Phạm vi và phương pháp

Đã đọc báo cáo triển khai, báo cáo cân bằng, JSON baseline, engine/config/board/settlement/business và script mô phỏng cũ. Không sửa source sản phẩm, board, test hiện có, package hoặc bất kỳ thông số tài chính nào. Không deploy Vercel. Chỉ thêm script thử nghiệm và tài liệu/kết quả.

- **${data.games.toLocaleString('en-US')} ván**: 3/4/5/6 vòng × 5 chiến lược × 5.000 =100.000; 8/12 vòng × 3 chiến lược × 5.000 =30.000; đối chứng tiền mặt có học và gửi không học cho sáu độ dài =60.000; cửa sổ bán kinh doanh cho bốn độ dài =20.000.
- Mỗi nhóm dùng cùng seed \`XVTL-V2-0\`…\`XVTL-V2-4999\`. Tái lập **chính xác toàn bộ các trường baseline 3 vòng**, không chỉ tỷ lệ thắng hay số làm tròn.
- Chỉ thay \`RULES.laps\` trong tiến trình Node riêng, theo \`try/finally\`, phục hồi cả khi lỗi. Engine thật xử lý terminal, lãi nợ cuối và pending landing; không mở lại state đã kết thúc, không thay thứ tự quyết toán.
- Giữ 50M ban đầu, 14M/START, khóa học 6M/+3M, mục tiêu món đồ 80M + dự phòng 10M; giữ mọi phí, lãi, shock, coupon, vốn kinh doanh và phân bố ô. Các thử mục tiêu ở mục riêng chỉ phân loại lại trajectory, không sửa cấu hình.
- Quantile dùng phần tử thứ floor((n−1)×p) của dãy tăng, giống baseline. Median thiếu lấy từ phân phối max(0,90M−huy động); với số mẫu chẵn không nhất thiết bằng 90M trừ median huy động.
- JSON có khoảng Wilson 95% cho tỷ lệ thắng và khoảng gần đúng 95% cho chênh lệch thắng ghép seed. Đây là độ bất định lấy mẫu dưới bộ seed giả ngẫu nhiên, không bao quát sai số mô hình hoặc người chơi, không điều chỉnh so sánh nhiều lần.

### Chính sách, thay đổi và đối chứng

Giữ nguyên policy đã công bố: mua tự chọn bằng Cash; ngân sách giao dịch là phần vượt 10M dự phòng; trả chi phí theo option trả ngay đầu tiên. Funding rút toàn khoản gửi → bán stock → bond → gold → vay giới hạn. Khóa học chỉ cần đủ 6M, có thể làm Cash xuống dưới 10M, đúng policy baseline.

- **Tiền mặt:** không học, không đầu tư; đo lương đơn thuần.
- **Tiết kiệm:** gửi đầu 40M kỳ hạn 3 cho tất cả độ dài; tại bank gửi 85% phần Cash vượt dự phòng, kỳ hạn min(3, số START còn lại).
- **Cổ phiếu:** mua tối đa 25M mỗi ô cổ phiếu; chọn mã bằng turn modulo 6, không nhìn tương lai.
- **Kinh doanh:** mua sớm nhất khi tới đúng ô, đủ ngân sách và còn >=2 START; nâng tối đa một tầng mỗi lần gặp trước vòng cuối, khớp trend đang biết. Chỉ tìm cách bán ở ô kinh doanh trong vòng cuối.
- **Kết hợp:** gửi đầu 15M kỳ hạn 1; stock 5M, bond 5M, gold 3M, gửi 25% phần dư và kinh doanh khi đủ vốn; cùng cửa sổ kinh doanh trên.
- Ngoài tiền mặt, học nếu còn >=2 START; tại H=3 đúng policy cũ lap<=2. Với H dài hơn, khóa học và cửa sổ mua/bán phụ thuộc số vòng còn lại, được báo rõ, không bí mật tối ưu RNG.
- **Tiền mặt + học:** cùng quy tắc khóa học, không đầu tư khác. **Gửi không học:** giữ policy tiết kiệm, bỏ khóa học. Đây là hai đối chứng riêng, không thay năm chiến lược chính.
- **Cửa sổ bán hai vòng:** mua/nâng trước vòng áp chót; bán nếu gặp ô kinh doanh trong hai vòng cuối; không mua lại trong cửa sổ này. Đây là thay đổi policy cả mua/nâng/bán, không phải chỉ tăng quyền bán hoặc đổi luật.

Giao dịch không tiêu thụ RNG. Đã so ${data.verification.pairedPathsChecked.toLocaleString('en-US')} đường đi ghép giữa policy và ${data.verification.crossHorizonPathsChecked.toLocaleString('en-US')} tiền tố đường đi giữa độ dài. Các forecast, die và vị trí chung khớp; không policy nào đọc giá tương lai. Không có insolvency làm cắt ngắn đường đi trong mẫu.

## So sánh cố định mục tiêu 90M: 3/4/5/6 vòng

Đơn vị M = triệu đồng. Nguồn huy động đã trừ phí/spread, nợ và nghĩa vụ; không tính business chưa bán hoặc lãi gửi chưa nhận.

${comparison}

Tăng từ 3 lên 4 vòng không phải “thêm miễn phí 14M”: còn chi phí/sự kiện, lần gửi mới và quyết định theo hạn chót mới. Từ 5 lên 6, khác biệt policy vẫn còn, nhưng hầu hết người chơi theo các policy này đã vượt mục tiêu. Không tự kết luận tiền mặt phải bị phạt hay tiết kiệm phải giảm lãi.

### Mức tiếp xúc chi phí, cú sốc và lượt chơi

Các con số sau **giống nhau ở mọi chiến lược trong cùng độ dài** vì đường đi ghép giống nhau, luôn trả ngay, và không có ván bị cắt sớm. Vì vậy bảng này áp dụng cho từng dòng chiến lược ở trên. “Biến cố tài chính” ở đây là ô cá nhân; macro tách riêng. Chi phí bất thường gồm y tế/sửa xe/gia đình/hóa đơn/phí hợp đồng, không gồm sinh hoạt, học phí hay đầu tư.

${exposure}

**Nợ/insolvency:** trong cả 42 nhóm, 210.000 ván, tỷ lệ từng vay, còn nợ cuối và insolvency đều **0%**; nợ p10/median/p90 =0. Đây là quan sát dưới policy dự phòng, không chứng minh hệ thống không thể vỡ nợ. Các tình huống nợ sau lap 3 và insolvency được test riêng, không giả nhận đã xuất hiện trong mô phỏng.

### Số quyết định tài chính

“Tổng thao tác” đếm mọi lựa chọn/acknowledge/bỏ qua ô + giao dịch/gửi/nâng cấp + funding. “Thao tác đổi tiền” bỏ acknowledgment không đổi tiền. “>1 option” chỉ là event có nhiều option bật, chưa bao gồm tự chọn quy mô/mã/kỳ hạn trong form giao dịch. Các cột là chỉ báo tương tác, không đồng nghĩa số quyết định chiến thuật có chiều sâu.

${decisions}

## Kinh doanh: hiệu quả và thanh khoản

### Tiếp cận và nâng cấp

“Quay lại” là gặp ô kinh doanh **sau khi đã mua**, không phải chỉ đếm >=2 lần gặp bất kỳ. Các tỷ lệ ghi “/ người mua” dùng đúng cohort đã mở cơ sở; tỷ lệ mở dùng toàn bộ 5.000 ván. Histogram lap mua, số lần nâng, tỷ lệ nâng/bán/khóa trên toàn bộ seed và các cohort có trong JSON.

${access}

Ở policy kinh doanh, 2.452/5.000 seed mua ngay vòng 1 ở mọi độ dài; số còn lại cần tới ô đủ sớm. Lap mua trung bình tăng khi cho phép các seed mua muộn tham gia, không có nghĩa từng seed chủ động trì hoãn đầu tư. Thêm vòng tăng khả năng từng quay lại, nhưng việc chỉ bán trong vòng cuối giữ xác suất khóa quanh 50% ngay cả 12 vòng.

### Dòng tiền và lợi nhuận đã thực hiện

Lãi thực đã bán = tổng thu nhập vận hành nhận được + giá bán − vốn đầu − tất cả nâng cấp. Với business chưa bán, **không gán lãi thực của vòng sở hữu đã kết thúc**; báo riêng cash đã thu trừ vốn, giá trị khóa và lợi nhuận ghi sổ có cộng quote giả định. Quote bị khóa không được cộng vào điều kiện thắng.

${businessEconomy}

${businessRisk}

- **A — Không có lãi:** vẫn tồn tại ván đã bán mà lỗ. Tỷ lệ trong nhóm người bán giảm từ ${percent(1 - data.results['3']['business-heavy'].business.realizedProfitPositiveRateGivenSold!)} ở 3 vòng xuống ${percent(1 - data.results['6']['business-heavy'].business.realizedProfitPositiveRateGivenSold!)} ở 6 vòng; không thể nói kinh doanh luôn lỗ hoặc luôn lời.
- **B — Có lãi ghi sổ nhưng thiếu thanh khoản:** ngay ở 3 vòng, ${percent(data.results['3']['business-heavy'].business.profitableButLockedRateGivenLocked)} nhóm còn khóa có tổng income + quote − vốn >0; ở 4 vòng là ${percent(data.results['4']['business-heavy'].business.profitableButLockedRateGivenLocked)}. Đây là lãi giả định nếu bán được, không phải tiền huy động hợp lệ.
- **C — Không tiếp cận được do xúc xắc:** 3 vòng có ${percent(data.results['3']['business-heavy'].business.noEligibleTileRate)} seed không gặp ô kinh doanh trước vòng cuối; 4 vòng còn ${percent(data.results['4']['business-heavy'].business.noEligibleTileRate)}. Không gặp và gặp nhưng thiếu vốn là hai trường hợp khác nhau; các nhóm này không được ép mua trong script.
- **D — Cần hạn dài hơn:** dòng tiền cơ sở 20M/(3M×trend) có thời gian hoàn vốn đơn giản 5,33–8,89 START trước nâng cấp/shock/resale; dài hơn màn 3 hoặc 4 vòng. Lãi thực khi bán tăng rõ theo độ dài. 8 vòng có thu nhập KD TB ${money(data.results['8']['business-heavy'].business.incomeGivenBought?.mean)}M so chi vốn/nâng TB ${money(data.results['8']['business-heavy'].business.costsGivenBought?.mean)}M ở người mua; đây là so sánh trung bình, không khẳng định từng cơ sở đã hoàn vốn.

So với tiền mặt có cùng quy tắc học, business-heavy 4 vòng có chênh lệch thắng ${number(data.controls['4'].businessVsCashCourse.meanWinRateDifference * 100)} điểm %, và chênh huy động TB ${money(data.controls['4'].businessVsCashCourse.fundsDifference?.mean)}M. Lợi nhuận kinh doanh tốt hơn chưa đảm bảo tỷ lệ thắng tốt hơn, vì vốn khóa và chi phí cơ hội. Cùng quy tắc học không bảo đảm mua học cùng thời điểm: cash khác nhau có thể đổi khả năng chi trả. Đây là đối chứng toàn policy, không phải tác động nhân quả thuần của tài sản.

### Độ nhạy chính sách thoát vốn

${exitWindow}

Cửa sổ hai vòng gần giảm một nửa tỷ lệ khóa, nhưng cũng bỏ cơ hội mở/nâng muộn và mất một phần thu nhập sau bán. Ở 3 vòng tỷ lệ thắng không cải thiện; ở 4 vòng tăng từ ${percent(data.results['4']['business-heavy'].winRate)} lên ${percent(data.controls['4'].exitWindow!.winRate)}. Kết quả chứng minh policy hạn chót quan trọng, không đề nghị đổi quyền bán hoặc tăng lợi tức kinh doanh.

## Thêm thời gian có làm chiến thắng chủ yếu nhờ lương?

### Thắng không cần stock/bond/gold/business

${lowRisk}

Tiết kiệm và khóa học trong mô hình không có biến động giá thị trường như cổ phiếu, nhưng vẫn có rủi ro thiếu Cash, mất lãi rút sớm và bỏ lỡ ô. Không gọi đây là không có rủi ro tuyệt đối. Tiết kiệm đã dẫn đầu tỷ lệ thắng ở 3 vòng; đến 6 vòng, thắng trở nên rất phổ biến ngay cả không học. Mục tiêu của chế độ dài nên được xác định trước khi đánh giá việc đó là tốt hay xấu.

### Phân rã nguồn tăng tài sản

Các cột là **trung bình**, không phải median; lãi đầu tư tài chính gồm lãi gửi/coupon/maturity/giá bán ròng và giá trị thanh lý cuối trừ vốn mua, không đếm tiền vay hay hoàn gốc thành lợi nhuận. Ở hai policy dưới, lợi nhuận tài chính chỉ là lãi gửi. Với policy khác, JSON và CSV báo riêng lợi nhuận tài chính và cash contribution kinh doanh.

${income}

Công thức đối chiếu từng ván: huy động cuối =50M + lương + thưởng − sinh hoạt đến hạn − bất thường đến hạn − học phí − lãi nợ + lãi đầu tư tài chính + cash contribution kinh doanh. Dư nợ gốc tự triệt với tiền vay đã nhận trong công thức; khoản phải trả chưa trả vẫn bị trừ. **Sai số đối chiếu bằng 0đ trên mọi ván.**

Lương tiền mặt không học là 42/56/70/84/112/168M ứng với 3/4/5/6/8/12 START. 12 vòng chỉ Cash tạo huy động TB ${money(data.results['12']['cash-heavy'].metrics.funds.mean)}M dù lợi nhuận đầu tư =0; chênh so 50M ban đầu là ${money(data.results['12']['cash-heavy'].metrics.funds.mean - 50_000_000)}M. Đây là bằng chứng định lượng vai trò lớn của thu nhập định kỳ, không phải lợi nhuận đầu tư ngầm.

### Lần đầu đạt 90M

JSON và CSV ghi riêng lần đầu ở ranh giới action và lần đầu tại summary sau quyết toán START; không đo thời điểm tạm nhận lương trước khi trả nghĩa vụ trong cùng settlement. Việc đã chạm rồi giảm xuống dưới 90M vẫn có thể thua cuối màn.

Trong trajectory 12 vòng: Cash lần đầu đạt tại START median vòng ${data.results['12']['cash-heavy'].first90.postSettlement.reachedLap!.median} ở nhóm đã đạt, tiết kiệm vòng ${data.results['12']['saving-heavy'].first90.postSettlement.reachedLap!.median}, kinh doanh vòng ${data.results['12']['business-heavy'].first90.postSettlement.reachedLap!.median}. Cash có ${percent(data.results['12']['cash-heavy'].first90.postSettlement.neverRate)} chưa từng chạm tại START và ${percent(data.results['12']['cash-heavy'].first90.postSettlement.reachedThenLostRate)} toàn bộ mẫu đã chạm nhưng thua cuối màn. Histogram đầy đủ nằm trong JSON. Các policy thích nghi theo horizon nên mốc này không thay cho tỷ lệ thắng ở màn ngắn tương ứng.

## Thử mục tiêu riêng cho 4 vòng

Giữ dự phòng **10M**, chỉ thay giá món đồ giả định khi phân loại kết quả; không sửa goal, không chạy policy nhìn trước hoặc mua khác theo mục tiêu. Đây là phân tích độ khó trên cùng trajectory, không phải mức cân bằng mới được chốt.

${goals}

100M tổng (món đồ 90M + dự phòng 10M) là ứng viên thử riêng nếu muốn tăng độ khó 4 vòng: Cash ${percent(data.fourLapGoalExperiments['100000000']['cash-heavy'].winRate)}, tiết kiệm ${percent(data.fourLapGoalExperiments['100000000']['saving-heavy'].winRate)}, business ${percent(data.fourLapGoalExperiments['100000000']['business-heavy'].winRate)}. Không tự áp dụng. Từ 110M tổng, Cash không thắng seed nào trong mẫu; từ 130M tiết kiệm cũng không thắng. Đẩy mục tiêu quá cao có thể làm đường thắng phụ thuộc đuôi may mắn thị trường, cần thảo luận mục tiêu học tập chứ không chỉ chọn tỷ lệ thắng thấp.

## Khảo sát 8 và 12 vòng; tính khả thi unlimited

Chỉ chạy ba policy chính đại diện (Cash, tiết kiệm, kinh doanh) cùng hai đối chứng ít rủi ro. Không suy rộng đây là benchmark dài cho stock/bond/gold hay mọi người chơi.

${long}

Median vòng chạm chỉ tính nhóm đã chạm: Cash là vòng 5 ở horizon 8 và vòng 6 ở horizon 12 vì cohort 12 vòng bổ sung các seed chạm muộn. Không có nghĩa những seed cũ bị chậm lại khi tăng hạn chót.

- 8 vòng Cash đã thắng ${percent(data.results['8']['cash-heavy'].winRate)}; 12 vòng thắng ${percent(data.results['12']['cash-heavy'].winRate)}, vẫn có 20/5.000 seed thua. Tiết kiệm và kinh doanh thắng 5.000/5.000 ở 12 vòng; không thể suy ra xác suất tổng thể là 100%, hoặc chiến thắng toán học tất yếu với thời gian vô hạn.
- Tiết kiệm 12 vòng nhận lãi TB ${money(data.results['12']['saving-heavy'].metrics.savingsInterest.mean)}M; các khoản đáo hạn được gửi lại khi tới bank. Đây là tái đầu tư hợp luật, không phải nhân đôi lãi/tiền vô cớ. Terminal savings principal =0 với policy này vì kỳ hạn được chặn theo số vòng còn lại; không có nghĩa trò chơi không từng giữ nhiều khoản khóa.
- Business 12 vòng có lãi thực median ${money(data.results['12']['business-heavy'].business.realizedProfitGivenSold?.median)}M trong nhóm bán được và thu vận hành TB ${money(data.results['12']['business-heavy'].business.incomeGivenBought?.mean)}M ở nhóm người mua. ${percent(data.results['12']['business-heavy'].business.lockedRateGivenBought)} người mua vẫn chưa bán, nhưng 100% cohort còn khóa vẫn thắng nhờ các dòng tiền khác và vận hành. Hạn chót ít còn chi phối mục tiêu 90M.
- Số macro TB tăng từ ${number(data.results['3']['cash-heavy'].metrics.macroShocks.mean)} ở 3 vòng lên ${number(data.results['12']['cash-heavy'].metrics.macroShocks.mean)} ở 12 vòng. Giá sau shock tiếp tục là nền normal, không áp lặp shock; tích lũy rủi ro vẫn tồn tại, không được đồng nhất “nhiều vòng” với “không còn bất định”.
- 12 vòng có ${number(data.results['12']['cash-heavy'].metrics.rolls.mean)} roll và ${number(data.results['12']['cash-heavy'].metrics.eventDecisions.mean)} dialog ô TB, cộng 36 forecast/summary/checkpoint. So với khoảng 25 dialog ô/checkpoint ở 3 vòng, độ lặp và chi phí tương tác tăng rõ. Mệt mỏi thực tế chưa đo bằng người chơi.

**Giới hạn mô hình dài và khai thác cần xem xét (suy luận từ code, chưa sửa):**

1. Lương dương liên tục và goal cố định tạo đường tích lũy dễ dần; chưa có mục tiêu mới sau khi đã đạt. Một Sandbox cần giá trị học tập khác với deadline.
2. Business recoverable capital compounding không có trần; multiplier thu nhập có trần nhưng giá vốn thu hồi vẫn có thể tăng nhiều. Resale dài có thể lấn át bài học dòng tiền; không chứng minh vô hạn sẽ overflow từ khảo sát 12 vòng.
3. Giá bond toàn thị trường tăng/giảm qua normal/shock, trong khi maturity trả mệnh giá cố định. Mua premium muộn có thể cho coupon + hoàn gốc kém giá mua; không giả định bond luôn tốt hơn khi kéo dài. Các policy dài ở đây không mua bond, nên đây là cảnh báo cấu trúc, chưa phải số đo lợi nhuận bond 12 vòng.
4. Rút/gửi/tái đầu tư, mua giá sau shock và nhận mệnh giá bond theo config không tự là exploit. Không phát hiện duplicated salary/settlement, nợ biến mất, lượng sở hữu âm hoặc dòng tiền không đối chiếu trong các run đã kiểm tra; chưa audit mọi chuỗi action đối kháng.
5. Log giữ snapshot cùng lịch sử giá tăng dần; bản 12 vòng chạy được offline không chứng minh bộ nhớ/DOM/export của browser chịu được vô hạn. Giới hạn tầng nâng cấp 6 cũng giảm quyết định mới về cuối.

**Chọn B — Sandbox riêng trong tương lai**, với phạm vi/QA và mục tiêu riêng nếu người dùng muốn; không chọn A thay màn chuẩn, chưa có cơ sở cần loại bỏ ý tưởng vĩnh viễn như C. Không triển khai unlimited trong nhiệm vụ này.

## Thời lượng và người chơi lần đầu

${duration}

Roll/vòng khoảng 5,8; tổng roll tăng gần tuyến tính. Forecast/summary/checkpoint tạo 3 dialog mỗi vòng ngoài dialog ô; setup và Result chưa tính vào công thức. “Ước tính phút” **không phải thời gian chơi đo thực tế**: giả định 6–10 giây mỗi roll/di chuyển, 10–20 giây mỗi thao tác tài chính (kể cả acknowledge/skip), 8–15 giây mỗi forecast/summary/checkpoint; các khoản thời gian được cộng riêng. Không tính nghỉ, suy nghĩ dài, đọc luật, mở chart nhiều lần hoặc thao tác sai; người mới có thể lâu hơn.

Đề nghị người lần đầu thử 3 vòng hướng dẫn, khoảng ${number((data.results['3'].diversified.metrics.rolls.mean * 6 + data.results['3'].diversified.metrics.financialDecisions.mean * 10 + 9 * 8) / 60, 1)}–${number((data.results['3'].diversified.metrics.rolls.mean * 10 + data.results['3'].diversified.metrics.financialDecisions.mean * 20 + 9 * 15) / 60, 1)} phút theo giả định trên, rồi đánh giá 4 vòng cho màn chuẩn. Thêm vòng không tạo loại quyết định mới; nó tạo thêm cơ hội dùng cơ chế hiện có, đồng thời lặp thêm dialog.

## Công bằng, giả định và giới hạn kết luận

- Các policy là heuristic, không phải tối ưu; stock không chọn theo phân tích giá, business chỉ nâng một lần mỗi lần gặp. Chưa đo độ khó của người chơi thật, learning curve, mức thích thú hay tỷ lệ bỏ cuộc.
- Giữ cùng vốn và mọi giá trị kinh tế để so horizon; giữ khoản đầu tiết kiệm term3 để không trộn thay đổi initial allocation. Điều đó không làm policy tối ưu cho mọi horizon.
- Buyer/seller cohorts có selection bias: gặp ô, đủ vốn và bán được liên quan đường đi. Không diễn giải thắng/người mua là tác động nhân quả của business. Đối chứng ghép seed giảm nhiễu đường đi, không loại mọi tương tác policy.
- Policy horizon-aware có thể khác trước vòng 3; cùng seed không có nghĩa action giống nhau. 3 vòng tái lập baseline chính xác; các độ dài khác so toàn bộ trải nghiệm với hạn chót đã biết.
- Kết quả mô tả cả may mắn đường đi, macro và thị trường. Chưa phân rã phương sai nhân quả từng stream; không khẳng định đã chứng minh tối ưu cân bằng kỹ năng/may mắn.
- “Chi phí đã trả” lấy từ decision/funding log vì các policy luôn chọn trả ngay. Không dùng extractor này để kết luận về policy trì hoãn nghĩa vụ chưa được thử. Accounting dùng chi phí đến hạn để vẫn trừ khoản chưa trả.
- Tỷ lệ thắng 100% mẫu và không có insolvency tự nhiên không chứng minh mọi seed/action đều an toàn. 8/12 vòng không đại diện hoàn hảo cho vô hạn.
- Không có browser mode dài để playthrough; không sửa UI hoặc thử người chơi. Khuyến nghị thời lượng/mệt mỏi/chiều sâu là giả định hoặc suy luận được ghi rõ, không phải kết quả manual browser mới.
- Repository không có .git; xác nhận không đổi sản phẩm bằng SHA-256 của ${data.verification.protectedFileCount} file bảo vệ (toàn bộ src, test cũ, package/lock, script/baseline/báo cáo V2 cũ).

## Chất lượng, tái lập và file kết quả

Đã thực thi:

| Kiểm tra | Kết quả |
| --- | --- |
| \`npm test\` | **81/81 pass**, 0 fail/skipped; test cũ giữ nguyên |
| Diagnostic test riêng | **10/10 pass**; không thêm vào suite production |
| \`npm run build\` | Exit 0; TypeScript/Vite thành công, cùng JS/CSS artifact như trước |
| \`npm run lint\` | Exit 0 |
| Typecheck riêng script diagnostic | Exit 0 với strict và Node types |
| Monte Carlo | Exit 0; 42 nhóm ×5.000 =210.000 ván; baseline 3 vòng khớp toàn bộ trường |
| Invariant từng ván | Lương/normal/summary đúng một lần mỗi lap hoàn tất; không lặp shock, sở hữu không âm; đối chiếu nguồn huy động sai số 0đ |
| Targeted edge cases | Gửi/bond mua ở lap4 đáo hạn lap5 một lần; trend/upgrade sau lap3; deterministic replay/shock; lãi nợ lap6 đúng một lần; vượt START cuối bỏ đích, lap trước giữ đích |
| Kiểm tra kết quả độc lập | Đọc lại CSV gzip theo seed, khớp số lượng, phân phối, lãi business đã bán, goal variants và hash đường đi với JSON |
| Giữ nguyên source | Tất cả ${data.verification.protectedFileCount} hash bảo vệ khớp; \`RULES.laps\` trả về 3 |

Node 22.14.0 phát cảnh báo experimental TypeScript stripping; không phải lỗi gameplay. Không có dependencies mới hoặc deployment.

Lệnh tái lập từ thư mục gốc repository:

\`\`\`sh
node --experimental-strip-types --test scripts/diagnostics/game-length.test.ts
node --experimental-strip-types scripts/analyze-game-length.ts 5000
node --experimental-strip-types scripts/diagnostics/verify-game-length-results.ts
node --experimental-strip-types scripts/diagnostics/render-game-length-report.ts
node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --target es2023 --module nodenext --types node --allowImportingTsExtensions --skipLibCheck --strict scripts/analyze-game-length.ts scripts/diagnostics/game-length.test.ts scripts/diagnostics/verify-game-length-results.ts scripts/diagnostics/render-game-length-report.ts
npm test
npm run build
npm run lint
\`\`\`

Smoke test nhanh, không ghi đè kết quả: \`node --experimental-strip-types scripts/analyze-game-length.ts 25 --smoke\`. Script chính chạy đồng bộ, tuần tự trong process riêng; không chạy các horizon đồng thời trong cùng process vì chúng chia sẻ RULES object. Verifier chính nhắm bộ 5.000 seed nêu trên. Manifest lưu hash trạng thái trước nghiên cứu; nếu repository thay đổi có chủ đích trong tương lai, cần lập baseline/manifest mới trước khi suy kết luận mới, không xóa guard để cho qua khác biệt.

File:

- [Kết quả tổng hợp JSON](simulations/v2-game-length-results.json): snapshot cấu hình, policy, nguồn script hash, phân phối/cohort/histogram, độ nhạy mục tiêu, đối chứng ghép seed.
- [CSV theo từng seed, gzip](simulations/v2-game-length-runs.csv.gz): 210.000 dòng, financial flows, business outcomes, first90, checkpoint funds và hash đường đi. Ô trống ở lap mua/lãi business là chưa mua/chưa bán, không phải 0đ; first90 trống nghĩa là chưa từng chạm ngưỡng ở loại mốc đó.
- [Manifest bảo vệ source](simulations/v2-length-source-manifest.json).
- Script chính: \`scripts/analyze-game-length.ts\`; model/statistics/tests/verifier/report generator nằm trong \`scripts/diagnostics/\`.

**Chưa cần sửa gameplay để hoàn thành chẩn đoán. Đề xuất 4 vòng, mục tiêu thử riêng hoặc Sandbox chỉ được triển khai sau phê duyệt rõ ràng của người dùng.**
`)
console.log('Wrote docs/V2_GAME_LENGTH_ANALYSIS.md')
