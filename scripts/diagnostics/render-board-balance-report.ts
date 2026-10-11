import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { BOARD } from '../../src/data/board.ts'
import { strategies } from './game-length-model.ts'
import type { Strategy } from './game-length-model.ts'
import type { Layout } from './board-balance-model.ts'
import type { BoardSummary, movementExpectation } from './board-balance-statistics.ts'
import type { paired } from './game-length-statistics.ts'

type Data = { games: number; experimentGames: number; countPerGroup: number;
  verification: { protectedFileCount: number; pairedPathsChecked: number };
  layouts: (Layout & { theoreticalMovement: ReturnType<typeof movementExpectation> })[];
  results: Record<string,Record<Strategy,BoardSummary>>;
  boardEffects: Record<string,Record<Strategy,ReturnType<typeof paired>>>;
  policyEffects: Record<string,ReturnType<typeof paired>> }
const data = JSON.parse(readFileSync('docs/simulations/v2-board-balance-results.json','utf8')) as Data
const categoryAudit = JSON.parse(readFileSync('docs/simulations/v2-board-category-audit.json','utf8')) as {
  results: Record<string,Record<Strategy,Record<string,{visits: {mean: number};neverRate: number}>>> }
const names: Record<Strategy,string> = { 'cash-heavy':'Tiền mặt','saving-heavy':'Tiết kiệm','stock-heavy':'Cổ phiếu',
  'business-heavy':'Kinh doanh: bán vòng 4','diversified':'Kết hợp','business-exit-window':'Kinh doanh: bán vòng 3–4',
  'cash-course':'Tiền mặt + học','saving-no-course':'Tiết kiệm không học' }
const labels = Object.fromEntries(BOARD.map(tile => [tile.type,tile.label]))
const f = (n: number | null | undefined, decimals = 2) => n === null || n === undefined ? '—' : n.toLocaleString('vi-VN',{minimumFractionDigits: decimals,maximumFractionDigits: decimals})
const pct = (n: number | null | undefined) => n === null || n === undefined ? '—' : `${f(n*100)}%`
const m = (n: number | null | undefined) => n === null || n === undefined ? '—' : f(n/1_000_000)
const table = (head: string[],rows: (string|number)[][]) => [
  '| '+head.join(' | ')+' |','| '+head.map(() => '---').join(' | ')+' |',
  ...rows.map(row => '| '+row.join(' | ')+' |'),'' ].join('\n')
const allPolicies: Strategy[] = [...strategies,'business-exit-window']
const group = (id: string,strategy: Strategy='cash-heavy') => data.results[id][strategy]
const a = group('A20'); const c = group('C20'); const ac = group('A20','business-heavy'); const cc = group('C20','business-heavy')
const code = String.fromCharCode(96)
const parts: string[] = []
parts.push(`# Phân tích cân bằng bàn cờ V2

Ngày phân tích: **11/10/2026**. Chẩn đoán offline trên **4 vòng, mục tiêu huy động hợp lệ 90M**; không phải thay đổi luật đã phê duyệt.

## Khuyến nghị trước

**Giữ 20 ô. Ưu tiên playtest C20: 3 ô kinh doanh, 1 macro, giữ 2 khóa học và mọi số lượng khác như hiện tại.** Đây là phương án thay duy nhất macro ô 14 thành kinh doanh, chưa sửa bàn sản phẩm. Không tối ưu để đạt tỷ lệ thắng 50% hay ép các tài sản ngang nhau. C20 ưu tiên thêm cơ hội mua/nâng/bán kinh doanh và giữ khả năng tiếp cận khóa học cho người mới; vẫn còn biến động thị trường thường và một ô macro.

Cần xem quyết định này như **khuyến nghị từ các heuristic và mô hình**, chưa có bằng chứng playtest người thật về mức dễ hiểu, mệt mỏi hay niềm vui. Kích thước 20 hợp lý hơn việc kéo dài bàn chỉ để thêm lượt. Bàn 16 có thể dùng để nghiên cứu trải nghiệm ngắn, bàn 24 chưa cho thấy lý do đủ mạnh để ưu tiên làm mặc định.

**Phân bổ khuyến nghị C20:** START×1, Ngân hàng×2, Cổ phiếu×2, Trái phiếu×2, Vàng×2, Kinh doanh×3, Khóa học×2, Sinh hoạt×2, Biến cố cá nhân×2, Macro×1, Dòng tiền×1. Vị trí tính từ 1, chiều di chuyển hiện tại; dãy chính xác ở mục bố trí.

## Phạm vi, dữ liệu và chính sách

Đã đọc ba báo cáo triển khai/cân bằng/độ dài; kiểm tra board, config, engine, transactions, market và mô hình chẩn đoán trước. Giữ nguyên 50M vốn đầu, 14M/START, học 6M/+3M, mục tiêu 80M +10M dự phòng, giá/lãi/phí, d6, luật qua START và thứ tự settlement. Bản chính thức vẫn **3 vòng, 20 ô**. Chỉ ghi script và báo cáo/kết quả mới; không deploy Vercel.

- **${data.games.toLocaleString('vi-VN')} ván đã hoàn tất:** 25.000 tái lập baseline 3 vòng; ${data.experimentGames.toLocaleString('vi-VN')} ván thử nghiệm =7 bàn ×6 chính sách ×5.000 seed. Seed chung ${code}XVTL-V2-0${code}…${code}XVTL-V2-4999${code}.
- Tái lập toàn bộ trường baseline 3 vòng và cả 6 nhóm đối chứng 4 vòng từ báo cáo độ dài. So sánh biểu diễn JSON chính xác; chỉ chuẩn hóa số 0 có dấu từ tổng dòng tiền rỗng, không làm tròn kết quả để cho qua sai khác.
- Dùng engine thật và policy cũ; chỉ thay BOARD/RULES.tiles/RULES.laps trong tiến trình thử nghiệm riêng, đồng bộ và phục hồi bằng finally. Không ghi cấu hình thử vào source; kiểm tra hash ${data.verification.protectedFileCount} file trước/sau từng bố trí.
- **Cùng 20 ô:** xác nhận đường xúc xắc, vị trí và forecast khớp theo seed; mọi ô non-START đều rút một RNG khi encounter, macro không rút RNG phụ. **16/24:** chỉ ghép cùng seed, không có đường đi vật lý giống hệt; số lượt và thời điểm event/normal thay stream tiêu thụ. Chênh lệch gồm cả kích thước, phân bổ và vị trí.
- Tiền mặt không học/đầu tư. Tiết kiệm gửi đầu 40M kỳ hạn 3, gửi thêm 85% phần vượt dự phòng tại bank. Cổ phiếu mua tối đa 25M, mã theo turn modulo 6. Kết hợp gửi đầu 15M kỳ hạn 1, các ticket stock/bond/gold 5/5/3M, bank 25% phần dư. Không nhìn giá tương lai hoặc RNG tương lai.
- Trừ tiền mặt, học khi đủ Cash và còn ≥2 START. Mua/nâng kinh doanh ở vòng 1–3, bán tại đúng ô trong vòng 4; heuristic chỉ thực hiện một giao dịch kinh doanh mỗi visit. **Engine cho phép nhiều giao dịch trong cùng event**, có thể mua rồi nâng ngay nếu đủ Cash; heuristic không tận dụng điều đó. Đối chứng bán vòng 3–4 **đồng thời dừng mua/nâng từ vòng 3**, không mở lại sau bán: giữ nguyên policy của nghiên cứu độ dài. Đây là khác biệt policy, không sửa quyền bán của engine; chỉ so với policy vòng cuối trong cùng bàn rồi so cùng policy giữa các bàn. Đối chứng hai vòng chạy riêng cho business-heavy; chưa chạy cho diversified.
- Mua tự chọn dùng Cash sau dự phòng 10M; ticket tối thiểu policy 1M với tài sản tài chính. Funding giữ thứ tự rút toàn khoản gửi → stock → bond → gold → nợ giới hạn. Không bán tự chọn tại START trong heuristic này.

### Định nghĩa để tránh nhầm số lần dừng và giao dịch

“Lần gặp” là event non-START thực sự được xử lý, kể cả đích pending ở vòng kế. Raw landing bao gồm vị trí dư sau lượt cuối; đích non-START đó bị engine bỏ qua, không tạo cơ hội mua hoặc chi phí. START trong bảng kiểm kê chỉ là **dừng chính xác ở START**, không phải số lần lĩnh lương; cả qua START lẫn dừng chính xác đều settlement một lần, tổng 4 lần/ván hoàn tất.

“Thời điểm quyết định có lựa chọn” là một encounter có thể giao dịch hợp lệ, mua khóa học chưa sở hữu, hoặc có nhiều phương án thanh toán; không đếm macro acknowledge, sinh hoạt bắt buộc hay khóa học đã mua. Điều kiện engine cho tài sản tài chính là Cash≥1đ, business20M, nâng5M, học6M. Đây là đếm lựa chọn khả thi, chưa chứng minh giá trị giáo dục từng lựa chọn. Giao dịch thực tế được đếm riêng; không tính gửi đầu ván là lần ghé bank.

“Không khả dụng do Cash” là visit đúng tài sản policy nhắm đến nhưng thiếu ngân sách theo dự phòng/ticket nêu trên. Việc policy không muốn mua muộn và đạt trần nâng cấp được ghi riêng; không coi chúng là cấm giao dịch của engine. Số cơ hội pháp lý tại business có thể là bán tài sản đang giữ, nên khả năng mua/nâng/bán còn có trường riêng. Lãi business đã bán =thu nhập đã nhận +tiền bán −giá mua −nâng cấp; chưa bán có P/L chu kỳ là null, không phải 0.

Các tỷ lệ là trên toàn bộ 5.000 ván trừ khi ghi “trong người mua”. Quantile lấy floor((n−1)×p), đơn vị **M = triệu đồng**. JSON có Wilson95% và CI ghép seed cho chênh lệch thắng; độ bất định chỉ phản ánh mẫu seed dưới mô hình, không phản ánh sai số policy/người chơi hoặc hiệu chỉnh nhiều so sánh.
`)
parts.push('## Phân bổ và vị trí chính xác\n')
parts.push(table(['Loại ô',...data.layouts.map(layout => layout.id)],Object.keys(data.layouts[0].theoreticalMovement.allocation).map(type =>
  [labels[type],...data.layouts.map(layout => layout.theoreticalMovement.allocation[type])])) )
for (const layout of data.layouts) parts.push(`### ${layout.id} — ${layout.types.length} ô

${layout.rationale}

${layout.types.map((type,i) => `${i+1}. ${type}`).join(' → ')}

`)
parts.push(`Mã loại: course =Đầu tư bản thân/khóa học; personal =Biến cố cá nhân, không phải đầu tư bản thân. B/C giữ các vị trí khác đúng A; D chỉ đổi vị trí, giữ mọi số lượng; E có cùng phân bổ với B nhưng giãn kinh doanh 7/7/6 ô và đưa khóa học lên đầu. F/G là phương án kích thước kèm phân bổ, không phải thí nghiệm nhân quả chỉ thay chiều dài. Row/col/UI của bàn thay thế chưa được thiết kế; mô phỏng chỉ dùng thứ tự logic.\n`)
parts.push('## Kiểm kê bàn hiện tại A20\n\nMọi chiến lược có cùng đường đi và event exposure ở A20 trong mẫu; dùng tiền mặt để tránh lẫn quyết định đầu tư. Cột không gặp dựa trên event đã xử lý; START dùng raw landing riêng.\n')
parts.push(table(['Ô','Loại','Category','Raw/ván','Event/ván','Không gặp','V1','V2','V3','V4'],a.tiles.map(tile => [tile.position,labels[tile.type],BOARD.find(t=>t.type===tile.type)!.category,
  f(tile.rawLandings!.mean),tile.type==='start'?'—':f(tile.resolvedEvents!.mean),
  pct(tile.type==='start'?a.summary.meanStopsByTile[0].noStopRate:tile.noResolvedEventRate),...tile.resolvedByLap.map(n => tile.type==='start'?'—':f(n))])))
parts.push(table(['Nhóm','Lần gặp TB','Không gặp cả ván','V1','V2','V3','V4','Không gặp V1–3'],Object.entries(a.byType).map(([type,item]) =>
  [labels[type],f(item.metrics.visits.mean),pct(item.neverRate),...item.byLap.map(lap => f(lap.mean)),pct(item.noEarlyVisitRate)])))
parts.push('Bốn category rộng của engine: trung bình encounter/ván và xác suất không gặp (đặt trong ngoặc). Income chỉ đếm khóa học; bốn lần nhận lương tại START được báo riêng, không trộn vào cơ hội học.\n')
parts.push(table(['Category',...data.layouts.map(layout=>layout.id)],['investment','income','shock','obligation'].map(category=>
  [category,...data.layouts.map(layout=>{ const g=categoryAudit.results[layout.id]['cash-heavy'][category];return `${f(g.visits.mean)} (${pct(g.neverRate)})` })])))
parts.push(`Không nên coi mọi ô có xác suất giống nhau trong màn hữu hạn: ô đầu sau START thiếu một lần tiếp cận từ vị trí dư ban đầu và đích dư cuối bị bỏ. Ví dụ ô 2 nhận ${f(a.tiles[1].resolvedEvents!.mean)} encounter/ván, ô 7 nhận ${f(a.tiles[6].resolvedEvents!.mean)}. Trong trạng thái dài hạn, xấp xỉ mỗi ô non-START được dừng **1/3,5 lần mỗi vòng**, thay vì số ô của loại đó chia kích thước bàn rồi coi đó là số gặp/vòng. Tính renewal chính xác bên dưới đã tính đầu màn và kết thúc hữu hạn.\n`)
parts.push('## So sánh truy cập giữa các bàn\n\nSố lần gặp trung bình, không phải số lần mua. START vẫn có định nghĩa riêng.\n')
parts.push(table(['Loại',...data.layouts.map(layout => layout.id)],Object.keys(a.byType).map(type =>
  [labels[type],...data.layouts.map(layout => f(group(layout.id).byType[type].metrics.visits.mean))])))
parts.push('Xác suất không gặp loại ô trong cả 4 vòng:\n')
parts.push(table(['Loại',...data.layouts.map(layout => layout.id)],Object.keys(a.byType).map(type =>
  [labels[type],...data.layouts.map(layout => pct(group(layout.id).byType[type].neverRate))])))
parts.push('Thời điểm cơ hội kinh doanh/khóa học; “không gặp sớm” là không gặp vòng 1–3, không suy ra đã mua được khi gặp:\n')
parts.push(table(['Bàn','Nhóm','V1','V2','V3','V4','Không gặp sớm'],data.layouts.flatMap(layout => ['business','course'].map(type => {
  const item=group(layout.id).byType[type]
  return [layout.id,labels[type],...item.byLap.map(lap => f(lap.mean)),pct(item.noEarlyVisitRate)]
}))))
parts.push('## Kết quả 4 vòng, cùng mục tiêu 90M\n\n“Mốc lựa chọn” chưa cộng funding; funding được báo riêng trong JSON. “GD tự chọn” tính các giao dịch qua form và khóa học, không tính trả sinh hoạt bắt buộc. Cột rolls là trung bình.\n')
parts.push(table(['Bàn','Policy','Thắng','p10 M','Median M','p90 M','Rolls','Mốc lựa chọn','GD tự chọn'],data.layouts.flatMap(layout => allPolicies.map(strategy => {
  const g=group(layout.id,strategy); const s=g.summary
  return [layout.id,names[strategy],pct(s.winRate),m(s.metrics.funds.p10),m(s.metrics.funds.median),m(s.metrics.funds.p90),
    f(s.metrics.rolls.mean),f(g.auditMetrics.meaningfulEncounters.mean),f(s.metrics.voluntaryActions.mean+s.courseUptake!)]
}))))
parts.push('### Cơ hội khả dụng, mua khóa học và khó khăn thanh khoản\n\n“Visit đầu tư” đếm cả 5 loại tài sản; “thiếu Cash” chỉ đếm tài sản policy muốn giao dịch. Rút gửi/bán ép buộc là ít nhất một lần/ván. Nợ là từng vay trong ván; nợ cuối và số lần/giá trị funding, lãi mất có đầy đủ trong JSON.\n')
parts.push(table(['Bàn','Policy','Visit đầu tư','Đủ ngân sách','Thiếu Cash','Mua học','Rút gửi','Bán ép','Từng vay','Insolvent'],data.layouts.flatMap(layout => allPolicies.map(strategy => {
  const g=group(layout.id,strategy)
  return [layout.id,names[strategy],f(g.auditMetrics.investmentOpportunities.mean),f(g.auditMetrics.fundedInvestmentOpportunities.mean),
    f(g.auditMetrics.unavailableInvestmentOpportunities.mean),pct(g.summary.courseUptake),pct(g.forcedWithdrawalRate),pct(g.forcedSaleRate),pct(g.summary.everBorrowedRate),pct(g.summary.insolvencyRate)]
}))))
parts.push('Có vay hiếm trong mẫu: D20/business-heavy, D20/business-exit-window, E20/business-heavy và E20/diversified mỗi nhóm 1/5.000 ván (0,02%); không phải bốn seed độc lập. Tất cả trả hết trước cuối màn. Cả 42 nhóm không có nợ cuối hoặc insolvency; đây là kết quả mẫu, không phải cam kết mọi policy đều an toàn.\n')
parts.push('### Ghép seed: khác biệt bố trí giữ nguyên policy\n\nChênh lệch tỷ lệ thắng tính điểm phần trăm; CI95% gần đúng từ cặp seed. 16/24 gồm thay đổi đường đi RNG, không phải cùng chuỗi die/scenario.\n')
parts.push(table(['Bàn so A','Policy','Δ thắng (pp)','CI95% (pp)','Δ huy động TB M'],data.layouts.filter(layout => layout.id!=='A20').flatMap(layout => strategies.map(strategy => {
  const effect=data.boardEffects[layout.id][strategy]
  return [layout.id,names[strategy],f(effect.meanWinRateDifference*100),effect.pairedWinDifferenceNormal95.map(n=>f(n*100)).join(' … '),m(effect.fundsDifference!.mean)]
}))))
parts.push('## Kinh doanh: tiếp cận, nâng cấp và thanh lý\n\nMua/nâng/bán là giao dịch thực tế. Tỷ lệ nâng, bán và khóa trong bảng này lấy **trên người đã mua**, còn tỷ lệ mua lấy toàn bộ ván. Policy kết hợp giữ bán vòng cuối.\n')
parts.push(table(['Bàn','Policy','Mua','Nâng/người mua','Số tầng TB/người mua','Bán/người mua','Khóa/người mua','Thu nhập TB M','Lãi median đã bán M','Thắng/người mua'],data.layouts.flatMap(layout => (['business-heavy','business-exit-window','diversified'] as Strategy[]).map(strategy => {
  const b=group(layout.id,strategy).summary.business
  return [layout.id,names[strategy],pct(b.buyRate),pct(b.upgradeRateGivenBought),f(b.upgradesGivenBought?.mean),pct(b.saleRateGivenBought),pct(b.lockedRateGivenBought),
    m(b.incomeGivenBought?.mean),m(b.realizedProfitGivenSold?.median),pct(b.buyerCohort.winRate)]
}))))
parts.push('Khả năng hành động tại ô kinh doanh theo trạng thái trước giao dịch (business-heavy, bán vòng 4). Những cột này là số encounter/ván; có thể chồng nhau, không được cộng thành số lượt độc lập. Mua hợp lệ chưa áp hạn chót policy; số “chặn muộn” gồm cả visit sau khi đã bán.\n')
parts.push(table(['Bàn','Visit','Mua hợp lệ','Mua đủ dự phòng','Nâng hợp lệ','Bán hợp lệ','Chặn thiếu Cash','Chặn muộn','Không gặp trước V4'],data.layouts.map(layout => {
  const g=group(layout.id,'business-heavy'); const b=g.byType.business.metrics
  return [layout.id,f(b.visits.mean),f(b.purchaseAvailable.mean),f(b.purchaseBudgetAvailable.mean),f(b.upgradeAvailable.mean),f(b.saleAvailable.mean),
    f(b.blockedCash.mean),f(b.blockedHorizon.mean),pct(g.summary.business.noEligibleTileRate)]
})))
parts.push('Ảnh hưởng policy tìm bán hai vòng cuối trong **cùng bàn**:\n')
parts.push(table(['Bàn','Δ thắng (pp)','CI95% (pp)','Δ huy động TB M','Khóa: V4 → V3–4'],data.layouts.map(layout => {
  const effect=data.policyEffects[layout.id]
  return [layout.id,f(effect.meanWinRateDifference*100),effect.pairedWinDifferenceNormal95.map(n=>f(n*100)).join(' … '),m(effect.fundsDifference!.mean),
    `${pct(group(layout.id,'business-heavy').summary.business.lockedRateGivenBought)} → ${pct(group(layout.id,'business-exit-window').summary.business.lockedRateGivenBought)}`]
})))
parts.push(`Tìm bán hai vòng cuối giảm khóa vốn nhưng không mặc nhiên tăng thắng: B20 là ${pct(group('B20','business-heavy').summary.winRate)} → ${pct(group('B20','business-exit-window').summary.winRate)}, còn C20 là ${pct(cc.summary.winRate)} → ${pct(group('C20','business-exit-window').summary.winRate)}. Bán sớm và ngừng nâng/mua sớm cũng mất kỳ thu nhập/cơ hội; dùng CI trong bảng, không coi mọi chênh lệch nhỏ là chắc chắn.\n`)
parts.push(`Trong heuristic này, mua và nâng diễn ra ở các visit khác nhau; **đó là hạn chế policy, không phải luật engine**. Người chơi có thể mua rồi nâng nhiều tầng ngay cùng event nếu đủ Cash. Sau khi giữ cơ sở qua START để thu nhập vận hành, việc bán vẫn cần quay lại đúng ô trước deadline; stock/bond/gold có thể thanh lý ở START/thiếu tiền và tính quote ròng cuối màn. Vì thế số ô bằng nhau chưa tạo khả năng sử dụng tương đương. A20 có ${pct(ac.summary.business.lockedRateGivenBought)} người mua còn vốn khóa; C20 còn ${pct(cc.summary.business.lockedRateGivenBought)}. Các tỷ lệ này đếm người mua, không phải phần trăm tiền vốn bị khóa. Đây là bằng chứng về thanh khoản/đường đi dưới policy, không đủ căn cứ để tự tăng thu nhập business. Cần tách P/L đã bán, giá trị sổ sách và huy động hợp lệ; JSON lưu riêng cả ba.\n`)
parts.push('## Khóa học: tiếp cận và visit lặp\n\nDùng business-heavy để so cùng policy học; khác biệt Cash do đầu tư kinh doanh cũng có thể đổi tỷ lệ mua. Tần suất visit và không gặp sớm lấy từ đường đi, không phụ thuộc việc đã mua.\n')
parts.push(table(['Bàn','Visit TB','Không gặp','Không gặp V1–3','Mua học','Visit sau đã học TB','Không có cơ hội đủ Cash sớm','Mua V1/V2/V3'],data.layouts.map(layout => {
  const g=group(layout.id,'business-heavy'); const h=g.coursePurchaseLapHistogram
  return [layout.id,f(g.byType.course.metrics.visits.mean),pct(g.byType.course.neverRate),pct(g.byType.course.noEarlyVisitRate),pct(g.summary.courseUptake),
    f(g.byType.course.metrics.redundant.mean),pct(g.courseUnavailableEarlyRate),[1,2,3].map(lap=>pct(h[lap]/data.countPerGroup)).join(' / ')]
})))
parts.push('Visit sau mua khóa học không còn cho thêm tăng lương, nên thừa về giao dịch. Tuy nhiên ô thứ hai cũng cứu cơ hội cho người bỏ lỡ hoặc chưa đủ Cash lần đầu. Không suy ra “thấy hai ô khóa học” tương đương mua hai lần. B/E một khóa học giảm dialog lặp nhưng tăng rủi ro không tiếp cận bài học về thu nhập.\n')
parts.push('## Sinh hoạt, shock cá nhân và thông tin forecast\n\nDùng cash-heavy để tách chi phí khỏi lãi/lỗ tài sản. Chi phí sinh hoạt cố định 7M mỗi lần dừng đúng ô; đi ngang không trả. Extra gồm cá nhân và phí Dòng tiền; Dòng tiền cũng có thể bốc bonus, không phải mọi lần đều là nghĩa vụ âm.\n')
parts.push(table(['Bàn','Sinh hoạt TB M','p10/med/p90 M','Extra TB M','Cá nhân/ván','Macro/ván','Không macro','Vòng có macro','Vòng ≥2 macro','corr(funds,living)'],data.layouts.map(layout => {
  const g=group(layout.id); const s=g.summary.metrics
  return [layout.id,m(s.livingPaid.mean),[s.livingPaid.p10,s.livingPaid.median,s.livingPaid.p90].map(m).join(' / '),m(s.extraordinaryPaid.mean),
    f(s.financialShocks.mean),f(s.macroShocks.mean),pct(g.byType.macro.neverRate),pct(g.exposure.fractionLapsWithShock),pct(g.exposure.fractionLapsWithMultipleShocks),f(g.covariance.fundsLivingCorrelation)]
})))
parts.push('Dấu hiệu macro ảnh hưởng giá: phần tổng |log-price change| do macro cho stock (trung bình 6 mã), bond, gold; “đảo dấu” là tỷ lệ 8 chuỗi giá ×4 vòng mà dấu nhân tố normal khác dấu normal+macro. Đây là mô tả price path, không phải kiểm định forecast đúng/sai hoặc thí nghiệm loại macro hoàn toàn.\n')
parts.push(table(['Bàn','Macro abs(log) stock','Bond','Gold','Đảo dấu normal','Visit đầu tư sau macro TB'],data.layouts.map(layout => {
  const g=group(layout.id); const share=g.exposure.shockShareAbsoluteLogMove
  return [layout.id,pct(share.slice(0,6).reduce((sum,n)=>sum+n,0)/6),pct(share[6]),pct(share[7]),pct(g.exposure.meanPriceDirectionFlipShare),f(g.auditMetrics.macroBeforeInvestment.mean)]
})))
parts.push(`Ở A20, sinh hoạt p10–p90 là ${m(a.summary.metrics.livingPaid.p10)}–${m(a.summary.metrics.livingPaid.p90)}M, khoảng rộng ${m(a.summary.metrics.livingPaid.p90-a.summary.metrics.livingPaid.p10)}M so với 40M cần tăng từ vốn ban đầu. Tương quan với huy động là ${f(a.covariance.fundsLivingCorrelation)} ở cash-heavy: biến thiên chi phí có ý nghĩa lớn. Đây là liên hệ quan sát có covariance với các encounter khác; chưa chứng minh một tỷ lệ variance nhân quả và chưa có ngưỡng người chơi cho “quá mức”. Không tự giảm 7M hoặc thay ô sinh hoạt.

A/B/C giữ nguyên living/personal/obligation và cùng paths: cash-heavy khớp, làm đối chứng tốt cho thay course/macro. C giảm macro TB ${f(a.summary.metrics.macroShocks.mean)} → ${f(c.summary.metrics.macroShocks.mean)}; forecast vẫn là trạng thái trend/normal của vòng, macro là cú sốc sau đó. Mức chi phối giá giảm có thể giúp người mới đọc forecast, nhưng chưa chứng minh hiểu biết người chơi tăng. Macro không ghi đè scenarioId; policy nâng business theo trend vẫn dùng forecast công khai.
`)
parts.push('## Kích thước, số lượt và thời lượng\n\nD6 có kỳ vọng 3,5 ô/lượt. Kỳ vọng số roll cho bốn circuit gần 4N/3,5 cộng sai số overshoot cuối; không làm tròn từng vòng thành N/3,5 rồi reset vị trí. Engine giữ vị trí dư ở vòng tiếp, chỉ bỏ đích dư ở vòng cuối. Renewal tính chính xác xác suất tới từng khoảng cách dọc đường và dừng ở ≥4N; không đổi RNG hoặc xúc xắc để khớp kỳ vọng.\n')
parts.push(table(['Bàn','Rolls lý thuyết','Rolls mô phỏng','Rolls/vòng','Visit đầu tư/ván','Event dialog/ván','Mốc lựa chọn: kết hợp','Mốc/vòng'],data.layouts.map(layout => {
  const g=group(layout.id); const d=group(layout.id,'diversified')
  return [layout.id,f(layout.theoreticalMovement.expectedRolls),f(g.summary.metrics.rolls.mean),f(g.summary.metrics.rolls.mean/4),
    f(g.auditMetrics.investmentOpportunities.mean),f(g.summary.metrics.eventDecisions.mean),f(d.auditMetrics.meaningfulEncounters.mean),f(d.auditMetrics.meaningfulEncounters.mean/4)]
})))
parts.push('**Ước tính, chưa đo người chơi:** 6–10 giây/roll và animation, 10–20 giây/mốc lựa chọn, 3–5 giây/dialog chỉ xác nhận, 8–15 giây/forecast, summary hoặc checkpoint (12 mốc/4 vòng). Phân tách dialog có lựa chọn và dialog xác nhận để tránh cộng thời gian đọc cùng event hai lần. Chưa tính setup/result, đọc luật, xem biểu đồ dài, funding phát sinh hoặc trao đổi nhiều người.\n')
parts.push(table(['Bàn','Phút thấp–cao: kết hợp','Chênh roll so A'],data.layouts.map(layout => {
  const g=group(layout.id,'diversified'); const rolls=g.summary.metrics.rolls.mean
  const choices=g.auditMetrics.meaningfulEncounters.mean; const ack=g.summary.metrics.eventDecisions.mean-choices
  const low=(rolls*6+choices*10+ack*3+12*8)/60; const high=(rolls*10+choices*20+ack*5+12*15)/60
  return [layout.id,`${f(low,1)}–${f(high,1)}`,f(rolls-a.summary.metrics.rolls.mean)]
})))
parts.push(`Giữ cùng hai ô business/living/personal/macro trong F16 không khiến mỗi nhóm được gặp ít hơn theo tỷ lệ 16/20; giảm số bank/stock/bond/gold mới là nguyên nhân cơ hội tài sản tài chính giảm. Tương tự G24 có thêm bank/bond/gold/business nên số cơ hội tăng do phân bổ, không tự động do mỗi ô được ghé thường hơn. Cùng tile count mỗi loại cho xác suất gặp dài hạn xấp xỉ không đổi mỗi circuit; vị trí hữu hạn tạo phần sai khác còn lại. Bàn 24 thêm khoảng ${f(group('G24').summary.metrics.rolls.mean-a.summary.metrics.rolls.mean)} lượt/ván nhưng vẫn chỉ bốn salary/settlement. Nhiều dialog hơn chưa tự chứng minh chiều sâu; trần nâng, khóa học một lần và policy không mua một số tài sản tạo visit lặp.\n`)
parts.push('## Đánh giá công bằng chiến lược và xếp hạng\n')
parts.push('Sáu trục được xét riêng: **(1)** tiếp cận lựa chọn, **(2)** giữ sự khác nhau giữa các nhóm đầu tư, **(3)** rủi ro và thanh khoản, **(4)** phụ thuộc die, **(5)** thời lượng/mệt mỏi, **(6)** khả năng học cho người mới. Bảng sau dùng proxy đo được cho 1/3/4/5/6 và mô tả cấu trúc cho 2; chúng không phải điểm chất lượng hoặc phép đo tâm lý. “Học” dùng cùng business-heavy, không đại diện mọi người mới.\n')
const distinction: Record<string,string> = { A20:'5 nhóm; business khó thoát',B20:'5 nhóm; 3 business, 1 học',
  C20:'5 nhóm; 3 business, 1 macro',D20:'5 nhóm; cặp cách đều',E20:'5 nhóm; business giãn',
  F16:'5 nhóm; 4 loại chỉ 1 ô',G24:'5 nhóm; nhiều bank/bond/gold' }
parts.push(table(['Bàn','1. Mốc lựa chọn kết hợp','2. Khác biệt chiến lược','3. Người mua khóa vốn','4. Không business V1–3','5. Rolls','6. Mua học; macro/ván'],data.layouts.map(layout=> {
  const g=group(layout.id,'business-heavy')
  return [layout.id,f(group(layout.id,'diversified').auditMetrics.meaningfulEncounters.mean),distinction[layout.id],
    pct(g.summary.business.lockedRateGivenBought),pct(g.summary.business.noEligibleTileRate),f(g.summary.metrics.rolls.mean),
    `${pct(g.summary.courseUptake)}; ${f(g.summary.metrics.macroShocks.mean)}`]
})))
parts.push(`Xếp hạng dưới đây là đánh giá thiết kế có căn cứ từ truy cập/thanh khoản/thời lượng, **không phải điểm số tối ưu khách quan**. Ưu tiên người mới hiểu thu nhập, lựa chọn tài sản và hạn chót; giữ đặc tính khác nhau của tài sản thay vì cân mọi tỷ lệ thắng.

| Hạng | Bàn | Căn cứ và đánh đổi theo sáu tiêu chí |
| --- | --- | --- |
| 1 | C20 | Thêm business cho nhiều bước mua/nâng/bán; giữ hai cơ hội học và các tài sản; ít macro hơn, không thêm lượt. Giảm rủi ro giá cũng làm các chiến lược đổi tương đối; một phần người chơi không gặp macro. |
| 2 | B20 | Thay tối thiểu khóa học lặp bằng business, tăng cơ hội thanh lý. Khóa vốn và tiếp cận business tốt hơn E trong mẫu dù hai business sát nhau; mất khóa học thứ hai làm giảm khả năng học sớm. |
| 3 | E20 | Ba business giãn 7/7/6, khóa học sớm, giữ hai macro. Giao dịch đa dạng trong 20 ô; một khóa học làm quyền tiếp cận thu nhập phụ thuộc die hơn. Spacing đều chưa chứng minh tốt hơn B về tiếp cận/thanh lý. |
| 4 | D20 | Dễ đọc nhịp bàn và giữ đủ hai khóa học; không tăng số lượng business, nên vẫn phụ thuộc cửa sổ bán một vòng. Spacing đều cải thiện vài loại nhưng không bảo đảm công bằng bằng nhau. |
| 5 | G24 | Nhiều lựa chọn tài sản, ba business; chi phí bắt buộc không được thêm. Dài hơn và thêm dialog; chưa đủ bằng chứng chiều sâu bù sự mệt mỏi cho người mới. |
| 6 | A20 | Đầy đủ loại bài học, kích thước hợp lý; business chỉ hai ô và bị khóa vốn nhiều. Có thể giữ làm baseline, chưa có lỗi luật buộc thay ngay. |
| 7 | F16 | Ngắn hơn nhưng bank/stock/bond/gold chỉ một ô; dễ bỏ lỡ cả loại tài sản. Business vẫn hai ô và nghĩa vụ/shock chiếm tỷ trọng bàn cao hơn; phù hợp nghiên cứu tutorial hơn làm bàn chính đa tài sản. |

Thứ tự giữa các ứng viên gần nhau là nhận định cần playtest. B thực tế có tỷ lệ người mua còn vốn khóa thấp hơn C một chút; C đứng đầu do giữ cơ hội khóa học và giảm cường độ macro trong cùng số lượt. E không đứng trên B chỉ vì khoảng cách nhìn đều hơn: B có số liệu tiếp cận/thanh lý tốt hơn trong mẫu. D “dễ đọc nhịp” và giả thuyết mệt mỏi G chưa được xác minh với người chơi.

1. **Loại tài sản có quá hiếm không?** A20 hai ô mỗi loại tài sản là nền tương đối hợp lý nhưng vẫn có xác suất không gặp trong bốn vòng; dùng bảng no-encounter, không suy từ số lượng. F16 một ô tăng rủi ro bỏ lỡ. Initial savings mở được ở setup nên không gặp bank không đồng nghĩa không thể có savings; stock/bond/gold phải tới đúng ô mới mua.
2. **Business cần nhiều cơ hội hơn?** Cần quay lại đúng ô nếu muốn bán sau thời gian nhận thu nhập, thanh lý không được cứu tại START. Mua/nâng có thể làm cùng visit trong engine; heuristic một giao dịch/visit khiến lợi ích thêm ô đối với nâng cấp phụ thuộc policy. Ba ô là ứng viên phù hợp hơn hai về tiếp cận/thanh lý; chưa tự tăng lợi suất. Ngay C20 vẫn có vốn khóa và người mua muộn, nên không coi là giải quyết hết thanh khoản.
3. **Khóa học có visit dư?** Có sau khi mua, nhưng hai ô bảo vệ cơ hội lần đầu. B/E đánh đổi redundancy lấy business; C giữ hai ô để tránh cắt bài học thu nhập của người mới. Không đề xuất thêm tác dụng mới cho visit lặp.
4. **Macro có lấn forecast?** Giá có thể đảo chiều sau shock và có vòng nhiều macro; một ô giảm cường độ, không xóa rủi ro. Chỉ số giá hỗ trợ đánh giá thiết kế, chưa đo khả năng dự báo/hiểu trend. Luôn phân biệt forecast công khai và ngẫu nhiên normal/sector/idiosyncratic.
5. **Sinh hoạt có tạo variance quá lớn?** Chênh chi phí có sức nặng so mục tiêu, đặc biệt tiền mặt; chưa kết luận “quá lớn” nếu chưa biết mức thử thách người chơi mong muốn. Vị trí có thể đổi số lần gặp dù số ô không đổi, vì đầu màn và deadline không đối xứng. Chi phí thường, shock, bonus và tài sản tương quan qua đường đi nên không phân rã variance bằng cách cộng tỷ lệ độc lập.
6. **Vị trí ưu ái lựa chọn nào?** Khóa học sớm tăng số kỳ hưởng lương; bank trước chi phí có thể làm phải rút sớm, business sớm tăng số kỳ nhận thu nhập, asset gần deadline thiếu thời gian coupon/normal. E đổi vị trí nhiều loại cùng lúc; chỉ có thể nói tổng hiệu ứng bố trí, không quy riêng mọi thay đổi cho business spacing. D cũng không phải tối ưu hoán vị toàn bộ bàn.
7. **Bàn dài thêm chiều sâu hay lượt?** G24 thêm cơ hội và lượt, nhưng chưa đo chất lượng quyết định người thật. F16 tiết kiệm lượt bằng việc cắt cơ hội tài sản. Giữ 20 ô là đánh đổi thực dụng cho người mới; chưa chứng minh 20 là kích thước tối ưu duy nhất.
`)
parts.push('## Xác minh, tái lập và giới hạn\n')
parts.push(`| Kiểm tra | Kết quả xác nhận |
| --- | --- |
| Tests sản phẩm | npm test: 81/81 pass, 0 fail/skipped |
| Tests chẩn đoán | 5 test board +10 test độ dài: 15/15 pass |
| Lint và build | npm run lint và npm run build exit 0; TypeScript/Vite build 46 modules, cùng JS/CSS hash tên trước |
| Typecheck chẩn đoán | Strict Node/TS exit 0 cho runner/model/statistics/test/verifier/report generator |
| Baseline | 25.000 ván 3 vòng khớp JSON gốc; A20/4 vòng khớp 6 nhóm JSON độ dài |
| Mô phỏng | 42 nhóm ×5.000 ván +25.000 baseline, exit 0 |
| Đối chiếu dòng seed | Verifier đọc lại toàn bộ JSONL gzip, tái tạo tất cả bảng summary và so JSON; kiểm tra path hashes, thứ tự seed và renewal |
| Engine invariants | Mỗi salary/normal/summary đúng một lần mỗi vòng hoàn tất; shock không lặp, maturity đúng, số dư hợp lệ, lawful funds đối chiếu sai số 0đ |
| Bảo vệ repository | ${data.verification.protectedFileCount} hash source/test/package/baseline và artifact nghiên cứu trước không đổi; runtime trở về 3 vòng/20 ô |

Không có browser playthrough cho các bàn thay thế; chưa thiết kế giao diện 16/24 ô. Đây là mô phỏng engine, không xác minh khả năng đọc bố trí trên màn hình, thời gian người thật, accessibility hoặc độ hiểu bài học. Vay đã xảy ra hiếm như bảng trên; không quan sát insolvency không đồng nghĩa bất khả thi, test tình huống hiện có kiểm tra nhánh này.

Giới hạn chính: heuristic không tối ưu, chỉ một giao dịch business/visit dù engine cho phép nhiều; cash-heavy cố ý không học; stock chọn mã theo turn nên đổi kích thước cũng đổi lựa chọn mã; không có bond-heavy/gold-heavy riêng; không chạy cửa sổ bán hai vòng cho diversified; không đảo mọi vị trí hoặc tối ưu allocation toàn cục; F/G thay nhiều yếu tố. Không có đối chứng loại bỏ riêng living/macro hoặc kiểm định giáo dục người chơi. Không suy fair/balanced từ một win rate, không suy mọi chiến lược an toàn từ mẫu không vỡ nợ.

Lệnh từ thư mục gốc repository:

${code.repeat(3)}sh
node --experimental-strip-types --test scripts/diagnostics/game-length.test.ts scripts/diagnostics/board-balance.test.ts
node --experimental-strip-types scripts/analyze-board-balance.ts 5000
node --experimental-strip-types scripts/diagnostics/verify-board-balance-results.ts
node --experimental-strip-types scripts/diagnostics/render-board-balance-report.ts
node node_modules/typescript/bin/tsc --ignoreConfig --noEmit --target es2023 --module nodenext --types node --allowImportingTsExtensions --skipLibCheck --strict scripts/analyze-board-balance.ts scripts/diagnostics/board-balance.test.ts scripts/diagnostics/verify-board-balance-results.ts scripts/diagnostics/render-board-balance-report.ts
npm test
npm run lint
npm run build
${code.repeat(3)}

Smoke không ghi artifact: ${code}node --experimental-strip-types scripts/analyze-board-balance.ts 30 --smoke${code}. Không chạy các bố trí đồng thời trong cùng process vì dùng shared object của engine; script luôn tuần tự. Guard bảo vệ baseline phải được lập lại có chủ đích khi repository được sửa hợp lệ trong tương lai, không bỏ guard để làm kết quả “pass”. Node22.14 phát cảnh báo TypeScript stripping experimental; không phải lỗi gameplay. Thư mục hiện tại không có metadata Git, nên dùng hash bảo vệ thay diff/commit; không tạo repository mới.

- [JSON tổng hợp](simulations/v2-board-balance-results.json): snapshot chính thức, exact allocation/sequence, lý thuyết movement, policy, seed ranges, phân phối, cohort business, transaction/availability, exposure và paired CI.
- [Audit category rộng](simulations/v2-board-category-audit.json): tổng hợp bốn category từ raw seed, kèm hash JSON nguồn; do verifier tạo sau khi đối chiếu thành công.
- [JSONL từng seed, gzip](simulations/v2-board-balance-runs.jsonl.gz): ${data.experimentGames.toLocaleString('vi-VN')} dòng, khoảng ${f(statSync('docs/simulations/v2-board-balance-runs.jsonl.gz').size/1_000_000,1)} MB nén; mỗi dòng có layout, run, audit và pathSha256. Gzip gồm các member nối theo từng nhóm, đọc được bằng standard gunzip. Null là chưa mua/chưa bán/chưa đạt ngưỡng, khác số 0; các đại lượng không áp dụng cho category không đầu tư có null ở summary.

**Chưa triển khai bất kỳ bàn khuyến nghị nào. Chờ phê duyệt rõ ràng trước khi sửa gameplay; phần chẩn đoán và báo cáo đã hoàn tất.**
`)
writeFileSync('docs/V2_BOARD_BALANCE_ANALYSIS.md',parts.join('\n'))
console.log('Wrote docs/V2_BOARD_BALANCE_ANALYSIS.md')
