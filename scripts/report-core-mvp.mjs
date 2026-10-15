import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { mean } from './research/core-mvp/stats.mjs'
import { hash } from './research/core-mvp/adapter.mjs'
const out=resolve('docs/research/core-mvp'),load=p=>JSON.parse(readFileSync(join(out,p),'utf8'))
const data=load('final-comparison.json'),frozen=load('frozen-configs.json'),broad=load('broad-results.json'),short=load('shortlist-results.json'),holdout=load('holdout-results.json'),dice=load('dice-screen.json'),baseline=load('baseline-audit.json')
const money=n=>(n/1e6).toFixed(2),pct=n=>(100*n).toFixed(1)+'%',f=n=>n.toFixed(1)
const types=['start','bank','stocks','course','macro','bonds','personal','business','gold'],labels={start:'START',bank:'Ngân hàng',stocks:'Cổ phiếu',course:'Bản thân',macro:'Sự kiện',bonds:'Trái phiếu',personal:'Cá nhân',business:'Kinh doanh',gold:'Vàng'}
const title=c=>`${len(c)} ô / ${c.config.economy.rules.laps} START`
const len=c=>c.config.board.tiles.length
const tradeoff=c=>c.config.economy.rules.laps===3?'Biên ngắn/khó: đa số policy gần như không đạt đích; chưa phù hợp MVP với economy/goal này'
  :c.id==='interaction-learning-liquidity'?'Sinh hoạt 5M, course 8M/+4M: tích lũy tốt hơn; cần test cảm nhận chi phí học'
  :c.id==='interaction-business-access'?'Business 15M/4M, nhiều lần ghé: dễ mở/nâng hơn; vẫn cần thoát vốn đúng ô'
  :'Nhiều cơ hội và START để tích lũy; dài hơn, Savings có lợi thế rõ'
const cs=data.comparison
const csvCell=v=>'"'+String(v??'').replaceAll('"','""')+'"'
function flatten(value,prefix='',out={}){
  if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))flatten(v,prefix?`${prefix}.${k}`:k,out)
  else out[prefix]=value
  return out
}
const parameters=cs.map(c=>flatten({economy:c.config.economy,goal:c.config.goal,policy:c.config.policy,assumptions:c.config.assumptions}))
const parameterKeys=[...new Set(parameters.flatMap(p=>Object.keys(p)))].sort()
writeFileSync(join(out,'economy-parameters.csv'),[['parameter',...cs.map(c=>c.id)].map(csvCell).join(','),...parameterKeys.map(k=>[k,...parameters.map(p=>p[k])].map(csvCell).join(','))].join('\n')+'\n')
writeFileSync(join(out,'board-orders.csv'),[['candidate','index0','display_position','type','label'].join(','),...cs.flatMap(c=>c.config.board.tiles.map((t,i)=>[c.id,i,i+1,t,labels[t]].map(csvCell).join(',')))].join('\n')+'\n')
writeFileSync(join(out,'dice-screen.csv'),[['id','tiles','starts','count_profile','permutation','rolls_mean','rolls_p10','rolls_p90','decisions_mean','course_never','business_revisit','rejected'].join(','),...dice.rows.map(r=>[r.id,r.n,r.h,r.countProfile,r.permutation,r.rolls.mean,r.rolls.p10,r.rolls.p90,r.decisions.mean,r.coverage.course.never,r.businessRevisit,r.rejected].map(csvCell).join(','))].join('\n')+'\n')
const lines=[
  '# Core Game MVP — nghiên cứu cấu hình và cân bằng',
  '',
  '**Research only — 16/10/2026 (Asia/Bangkok). Chưa phê duyệt cấu hình, chưa sửa production, merge, push hay deploy.**',
  '',
  `Có ${cs.length} phương án đã được khóa từ dữ liệu shortlist trước holdout. Đây là tập lựa chọn Pareto của model synthetic, không phải kết luận tối ưu tuyệt đối. Holdout có ${holdout.games.toLocaleString('en-US')} ván mới; kết quả không được dùng để sửa thông số hay thay ứng viên. Thời lượng thực, mức hấp dẫn, khả năng học và độ khó phù hợp vẫn cần owner và playtest người thật.`,
  '',
  '## Bảng quyết định nhanh',
  '',
  '| PA | Bàn / START | Rolls TB [P10–P90] | Quyết định TB* | Median proceeds dải policy (M) | Thắng dải policy** | Funding / khóa vốn dải | Đánh đổi để owner chọn |',
  '|---|---|---|---|---|---|---|---|'
]
for(let i=0;i<cs.length;i++){
  const c=cs[i],ps=Object.values(c.policies),active=Object.entries(c.policies).filter(([p])=>!['cash','novice'].includes(p)).map(([,v])=>v),r=c.policies.cash.rolls
  const range=(vs,format)=>`${format(Math.min(...vs))}–${format(Math.max(...vs))}`
  lines.push(`| ${String.fromCharCode(65+i)} | ${title(c)} | ${f(r.mean)} [${r.p10}–${r.p90}] | ${range(ps.map(v=>v.meaningfulDecisions.mean),f)} | ${range(active.map(v=>v.proceeds.median),money)} | ${range(active.map(v=>v.won.rate),pct)} | ${range(ps.map(v=>v.funded.rate),pct)} / ${range(ps.map(v=>v.locked.rate),pct)} | ${tradeoff(c)} |`)
}
lines.push('', 'Ghi chú: (*) proxy encounter có >1 lựa chọn khả thi và funding có >1 nguồn hợp lệ; không coi mọi modal/acknowledge là quyết định có ý nghĩa. (**) Dải tám policy có chủ đích, loại cash và novice; dải quyết định/funding/khóa vốn gồm cả mười policy. Chi tiết nằm trong báo cáo kỹ thuật và CSV. Tiền là M VND giả lập, không quy đổi thành lợi nhuận năm/tháng.', '',
  '## Phương pháp và giới hạn', '',
  `- A: ${baseline.oldRowsReproduced} dòng cũ tái lập chính xác trên cùng source và ${baseline.historicalReplay.length} log lịch sử replay đầy đủ. Baseline lịch sử periodic C20 vẫn có ô Dòng tiền; nguồn V2 board/length/Bond dùng luật hoặc phân bổ khác, chỉ làm tham chiếu. Không gọi chênh lệch giữa các nghiên cứu cũ là A/B cho MVP mới. Reference 9 loại ô là đối chứng do lab dựng: đổi Dòng tiền thành Course và ô thứ tư Stocks thành Bank; đây chưa phải một layout owner đã chốt.`,
  `- B: ${dice.rows.length} layout = 5 số ô × 4 số START × 3 count profile × 4 permutation. ${dice.countPerNH.toLocaleString('en-US')} chuỗi D6/cặp N/H, tổng 200.000 chuỗi riêng; dùng lại cùng path giữa layout cùng N/H. ${dice.rows.filter(r=>r.rejected).length} layout bị loại theo ngưỡng lab công khai. Count/permutation được tách; có một START, đủ tám loại còn lại, không hai loại giống nhau liên tiếp, course trong sáu ô đầu và business trong nửa đầu. Đây là khám phá có ràng buộc, chưa vét cạn không gian layout.`,
  `- C: ${broad.summaries.length} cấu hình × 8 policy × 200 seed = ${broad.games.toLocaleString('en-US')} ván. Một đại diện qua screening ở mỗi N/H, OFAT tại một N20/H4, hai đối chứng 9 loại ô. Không mở full factorial. Biến giữ nguyên vẫn có effective snapshot trong config JSON.`,
  `- D: ${short.summaries.length} shortlist × 10 policy × 1.000 seed = ${short.games.toLocaleString('en-US')} ván; sau đó ${cs.length} frozen candidate × 10 policy × 5.000 seed mới. Tổng tài chính chính: ${(broad.games+short.games+holdout.games).toLocaleString('en-US')} ván; benchmark/trace/replay được ghi riêng, không cộng vào mẫu ước lượng.`,
  '- CI thắng/thua/phá sản/funding dùng Wilson 95% theo từng policy. Median có seed bootstrap 400 lần. Chỉ pooled win dùng seed-cluster bootstrap, không coi mười policy cùng seed là độc lập. CI chỉ đo sai số seed của model cố định, không gồm sai số heuristic, selection bias trước holdout hay người thật.',
  '- Tất cả policy cùng candidate bắt đầu cùng vốn, cùng phân bổ và cùng kỳ hạn; cash thuần không học hoặc đầu tư. Trong broad allocation20/30 và reference20, cash là passive matched-allocation control có khoản gửi từ setup, không phải cash thuần. Dữ liệu các biến phân bổ được báo riêng trong sensitivity.',
  '- Policy chỉ xem trạng thái hiện tại. Course học khi lợi ích các START còn lại bù học phí. Business mua khi còn ≥3 START, nâng khi còn ≥3, bán trong hai vòng cuối nếu gặp lại đúng ô. Stocks chọn độ biến động theo forecast hiện tại, không biết giá tương lai. Liquidity giữ 20M và bán tài chính tại START; novice chọn ngẫu nhiên từ lựa chọn khả thi, reserve 0, **synthetic — không đại diện người mới thật**.',
  '- Mua/nâng/gửi chỉ đúng ô và quyền encounter; bán tài chính ở START hoặc funding, Business không bán tại START/funding. Savings rút toàn lot và mất lãi khi funding. Lãi/coupon là mỗi START, không phải tháng/năm. Settlement giữ market → salary → business → maturity/coupon → living → debt → obligations; credit giữ RNG riêng.',
  '- Cùng seed trong một candidate ghép policy được; raw có hash dice/encounter và paired CI. Kích thước bàn, số START, activation và thứ tự sự kiện có thể làm RNG/path khác. Giữa các kiến trúc không được suy diễn là đã giữ cùng chuỗi cú sốc kinh tế. Dice-only stream là riêng, không dự báo đúng path engine theo seed.',
  '- Scope screening: timing settlement, rút toàn lot, hạn mức/kỳ hạn và tín hiệu cơ bản được audit rồi giữ baseline; chưa khảo sát mọi cơ chế thay thế. Stock/gold range sensitivity đổi cả drift và dispersion, không phải thí nghiệm pure volatility. Chưa hiệu chỉnh xác suất credit theo dữ liệu thật. Không có UI, AI provider, Vercel hay thiết bị thật trong vòng nghiên cứu này.',
  '- Trong hai biến thể broad vốn 40M/60M, câu mô tả setup kế thừa từ engine vẫn viết 50M; snapshot, delta ledger và config ghi đúng vốn đã thay và được dùng để tính toàn bộ số liệu. Không dùng prose setup để suy vốn. Bốn candidate cuối đều 50M nên không có sai lệch mô tả này; UI/narrative cho biến thể vốn chưa được làm trong nghiên cứu.',
  '', '## Pareto và độ bền', '',
  'Đã chọn từ frontier shortlist theo năm trục: giảm rolls; tăng cơ hội quyết định có thể thực hiện; tăng median gain so cash cùng điều kiện; tăng proceeds bình quân worst-decile; tăng accessibility trung bình. Win rate được báo, không tối ưu theo một tỷ lệ đích. Lấy các điểm trải dọc trục độ dài trong frontier; đây là quy tắc lab công khai, owner vẫn có thể chọn lại trước implementation.',
  '',
  `Frontier còn lại khi đánh giá riêng holdout: ${data.holdoutPareto.join(', ')}. Không thay danh sách đã freeze nếu một điểm bị dominated sau holdout; đó là thông tin độ bền cần owner cân nhắc.`,
  '', '| PA | Policy | Win (Wilson 95%) | Median [P10–P90] M | Worst 10% M | Credit loss P99 M | Funding / vay | Phá sản (CI) | Khóa vốn |',
  '|---|---|---|---|---|---|---|---|---|'
)
for(let i=0;i<cs.length;i++)for(const [p,v]of Object.entries(cs[i].policies))lines.push(`| ${String.fromCharCode(65+i)} | ${p} | ${pct(v.won.rate)} [${v.won.ci95.map(pct).join('–')}] | ${money(v.proceeds.median)} [${money(v.proceeds.p10)}–${money(v.proceeds.p90)}] | ${money(v.expectedShortfall10)} | ${money(v.creditLoss.p99)} | ${pct(v.funded.rate)} / ${pct(v.borrowed.rate)} | ${pct(v.insolvent.rate)} [${v.insolvent.ci95.map(pct).join('–')}] | ${pct(v.locked.rate)} |`)
lines.push('', 'Loss rate = 1 − win rate, có thể chồng với insolvency. Lock ở bảng là Business còn giữ hoặc bond default chưa có quote; không coi savings principal hoặc financial assets bán hợp lệ là vốn khóa hoàn toàn. Drawdown là từ đỉnh net worth trong log, có cả tiêu dùng/chi phí, không phải pure investment drawdown. Credit loss đã phản ánh trong trạng thái, không trừ hai lần. Zero insolvency trong mẫu không chứng minh bất khả thi.', '', '## Điều tốt hơn baseline và khác biệt strategy', '')
const reference=short.summaries.find(s=>s.id==='nine-type-reference-cash-allocation')
for(let i=0;i<cs.length;i++){
  const c=cs[i],s=short.summaries.find(s=>s.id===c.id),ps=Object.entries(c.policies).filter(([p])=>!['cash','novice'].includes(p)),best=ps.toSorted((a,b)=>b[1].proceeds.median-a[1].proceeds.median)[0],tail=ps.toSorted((a,b)=>a[1].expectedShortfall10-b[1].expectedShortfall10)[0]
  const baselineDelta=mean(Object.entries(s.policies).filter(([p])=>!['cash','novice'].includes(p)).map(([p,v])=>v.proceeds.median-reference.policies[p].proceeds.median))
  const referenceRolls=reference.policies.cash.rolls.mean
  lines.push(`- **${String.fromCharCode(65+i)} (${c.id})**: ở tập shortlist, chênh median bình quân tám policy với reference 9 loại ô/cash allocation là ${money(baselineDelta)}M; rolls ${f(s.policies.cash.rolls.mean-referenceRolls)} so reference. Holdout: median cao nhất là ${best[0]} (${money(best[1].proceeds.median)}M), worst-decile thấp nhất là ${tail[0]} (${money(tail[1].expectedShortfall10)}M). Đây là đánh đổi độ dài/kinh tế/layout, không có bằng chứng tốt hơn trên mọi trục hoặc mọi seed. Tỷ lệ seed dẫn đầu proceeds (chia đều khi hòa): ${Object.entries(c.bestProceedsSeedShare).map(([p,v])=>`${p} ${pct(v)}`).join(', ')}.`)
}
lines.push('', 'Các layout learning/business có thể giảm mật độ Personal so reference; giảm thuế biến cố và tăng cơ hội ghé ô là một phần chênh lệch, không được gán toàn bộ cải thiện cho course hay Business economics. Vì lương luôn nhận trước sinh hoạt và lớn hơn sinh hoạt trong các candidate cuối, funding riêng bước sinh hoạt có thể bằng 0 do cấu trúc; các thiếu hụt vẫn xuất hiện giữa vòng và qua novice. Zero borrowing/insolvency cần được đọc cùng reserve và thứ tự funding, không chứng minh các cơ chế ấy không cần thiết.', '', 'Savings nhận lợi ích tái gửi khi gặp Bank và tránh biến động giá, nhưng rút sớm toàn lot mất lãi; Stocks có upside và tail risk theo market; Gold chịu spread; Bond B coupon cao nhưng default/tail loss lớn hơn A. Business cần ghé lại đúng ô để nâng và thoát, thu nhập không khiến vốn còn giữ thành tiền hợp lệ tại đích. Diversified vẫn có phí và khóa vốn; Liquidity trả phí bán để giữ tiền; cash bỏ upside và course. Độ xếp hạng này phụ thuộc heuristic, cần đọc raw và thử policy khác trước khi coi là thuộc tính tuyệt đối của tài sản.', '',
  '## Thứ tự ô và thông số kinh tế', '', '![Thứ tự bàn nghiên cứu](research/core-mvp/charts/board-orders.png)', '')
const economyRows=[['Vốn ban đầu',c=>money(c.economy.rules.startingCapital)],['Savings đầu / kỳ',c=>`${money(c.economy.initialSavings)} / ${c.economy.initialTerm}`],['Lương / sinh hoạt mỗi START',c=>`${money(c.economy.rules.recurringIncome)} / ${money(c.economy.livingCost)}`],['Goal + reserve',c=>`${money(c.goal.amount)} + ${money(c.goal.reserve)}`],['Course cost / boost',c=>`${money(c.economy.rules.courseCost)} / ${money(c.economy.rules.courseBoost)}`],['Savings kỳ 1 / 2 / 3',c=>Object.values(c.economy.savingsRates).map(pct).join(' / ')],['Business mở / income / nâng',c=>[c.economy.economy.business.cost,c.economy.economy.business.baseIncome,c.economy.economy.business.upgradeCost].map(money).join(' / ')],['Business recovery vốn/nâng / uplift/matching',c=>`${pct(c.economy.economy.business.capitalRecovery)}/${pct(c.economy.economy.business.upgradeRecovery)}; ${money(c.economy.economy.business.baseUplift)}/${money(c.economy.economy.business.matchingBonus)}`],['Phí stocks / bonds / gold, spread gold',c=>`${Object.values(c.economy.economy.tradeFees).map(pct).join(' / ')}; ${pct(c.economy.economy.goldSpread)}`],['Coupon A/B; kỳ',c=>`${c.economy.issuers.map(i=>pct(i.coupon)).join(' / ')}; ${c.economy.issuers.map(i=>i.term).join('/')}`],['Credit A/B default, delay, recovery',c=>c.economy.issuers.map(i=>[i.default,i.delay,i.recovery].map(pct).join('/')).join('; ')],['Personal activation / medical / repair / family',c=>`${pct(c.economy.personalActivation)}; ${Object.values(c.economy.economy.personal).map(xs=>xs.map(money).join('/')).join('; ')}`],['Macro weights',c=>c.economy.macroWeights.join('/')],['Hạn mức nợ / lãi START',c=>`${money(c.economy.rules.borrowingLimit)} / ${pct(c.economy.rules.debtRate)}`]]
lines.push('| Tham số (tiền M VND) | '+cs.map((_,i)=>String.fromCharCode(65+i)).join(' | ')+' |','|---|'+cs.map(()=>'---|').join(''))
for(const [label,get]of economyRows)lines.push('| '+label+' | '+cs.map(c=>get(c.config)).join(' | ')+' |')
for(let i=0;i<cs.length;i++){
  const c=cs[i],tiles=c.config.board.tiles
  lines.push('',`**${String.fromCharCode(65+i)} — ${c.id}**`, '',tiles.map((t,j)=>`${j+1}.${labels[t]}`).join(' → ')+' → START', '',`Số lượng: ${types.map(t=>`${labels[t]}=${tiles.filter(x=>x===t).length}`).join(', ')}.`)
}
lines.push('', 'Bảng trên là phần đọc nhanh; **toàn bộ** effective EconomySpec (market ranges, macro magnitudes, credit penalties/cure/volatility, business depreciation/recovery, options chi/hoãn, policy rules và giả định) nằm trong [frozen-configs.json](research/core-mvp/frozen-configs.json). Các hằng legacy không được engine version hiện tại sử dụng vẫn được snapshot để audit, không phải tham số đang hoạt động.', '',
  '## Charts', '',
  '![Win rate và tail risk](research/core-mvp/charts/win-tail-risk.png)', '',
  '![Median và P10–P90 proceeds](research/core-mvp/charts/proceeds.png)', '',
  '![Accessibility theo ô](research/core-mvp/charts/accessibility.png)', '',
  '![Rolls và quyết định](research/core-mvp/charts/rolls-decisions.png)', '',
  '![Sensitivity OFAT](research/core-mvp/charts/sensitivity.png)', '',
  '## Owner cần chốt', '',
  '| Quyết định | Bằng chứng hiện có | Phần chưa xác nhận |',
  '|---|---|---|',
  '| Chọn bàn, thứ tự và số START | Bảng Pareto + dice/engine coverage + locked Business | Hứng thú và nhịp ván trên điện thoại |',
  '| Chọn vốn, allocation, lương, sinh hoạt, goal/reserve | OFAT + interactions; full snapshots | Mức khó mong muốn; không có win-rate đích đã duyệt |',
  '| Giữ hoặc đổi course/savings/market/fees/credit/Business | Strategy matched conditions + tails/CI | Policy khác, hiểu hệ quả và người chơi mới thật |',
  '| Phê duyệt cấu hình có version trước implementation | Nguồn/seed/raw có thể tái lập, historical replay giữ nguyên | UI/replay version migration, AI provider, thiết bị thật và Vercel chỉ QA sau owner chọn |',
  '', 'Không có winner tự động. Các lựa chọn còn lại là quyết định sản phẩm của owner; chưa có thay đổi gameplay/board UI/artwork production trong nhánh này.', '',
  '## Tái lập và dữ liệu', '',
  'Chạy từ repo root với Node 22 hỗ trợ `--experimental-strip-types`. Không cần dependency mới trong package.json.', '',
  '```powershell',
  'node --experimental-strip-types --test scripts/research/core-mvp/lab.test.mjs',
  'node --experimental-strip-types --test scripts/core-mvp-analysis.test.mjs',
  '# Validate existing evidence without regenerating the study:',
  'node --experimental-strip-types scripts/verify-core-mvp.mjs',
  '# To rerun all simulations, use a new output folder first:',
  '$env:CORE_MVP_LAB_OUT = "docs/research/core-mvp-reproduction"',
  'node --experimental-strip-types scripts/research/core-mvp/baseline.mjs',
  'node --experimental-strip-types scripts/research/core-mvp/run.mjs dice 10000',
  'node --experimental-strip-types scripts/research/core-mvp/run.mjs broad 200',
  'node --experimental-strip-types scripts/analyze-core-mvp.mjs shortlist',
  'node --experimental-strip-types scripts/research/core-mvp/run.mjs shortlist 1000',
  'node --experimental-strip-types scripts/analyze-core-mvp.mjs freeze',
  '# Holdout runner refuses to overwrite an existing final holdout.',
  'node --experimental-strip-types scripts/research/core-mvp/run.mjs holdout 5000',
  'node --experimental-strip-types scripts/analyze-core-mvp.mjs finalize',
  'Remove-Item Env:CORE_MVP_LAB_OUT',
  '# Render the original saved results:',
  'node --experimental-strip-types scripts/report-core-mvp.mjs',
  '```', '',
  '[CSV strategy](research/core-mvp/strategy-results.csv), [JSON so sánh](research/core-mvp/final-comparison.json), [sensitivity](research/core-mvp/sensitivity.json), [dice](research/core-mvp/dice-screen.json), [baseline audit](research/core-mvp/baseline-audit.json), [artifact hashes](research/core-mvp/artifact-manifest.json). Từng phase có seed list, source SHA/hash, version, thời gian UTC và config hash; đổi múi giờ báo cáo sang Asia/Bangkok. Raw từng candidate là `phase/id.rows.json.gz`; full-state examples có wrapper research riêng. Không import log candidate thành schema5 production hoặc sửa log lịch sử.', '',
  `Elapsed thực: dice ${f(dice.elapsedSeconds)}s; broad ${f(broad.elapsedSeconds)}s; shortlist ${f(short.elapsedSeconds)}s; holdout ${f(holdout.elapsedSeconds)}s. Các phase tài chính chạy tối đa bốn process nghiên cứu đồng thời, không phải agent/task mới.`, '',
  'Biểu đồ xuất PNG + SVG bằng matplotlib (phiên bản và dependency trong plot-manifest). Script vẽ: `scripts/plot-core-mvp.py`; thư viện chỉ được cài trong thư mục tạm, không đổi dependency dự án. Báo cáo là nghiên cứu game với tham số giáo dục, chưa human-test hoặc xác nhận production readiness.', ''
)
writeFileSync(join(out,'technical-report.md'),lines.join('\n').replaceAll('research/core-mvp/',''))
const brief=[...lines.slice(0,lines.indexOf('## Phương pháp và giới hạn')),
  '## Kết luận để chọn cấu hình','',
  `Đã chạy ${dice.rows.length} layout dice-only, ${broad.games.toLocaleString('en-US')} ván broad, ${short.games.toLocaleString('en-US')} ván shortlist và ${holdout.games.toLocaleString('en-US')} ván holdout. Mỗi phương án cuối có 5.000 seed mới cho từng policy. Không sửa ứng viên sau khi xem holdout.`, '',
  'Lương, sinh hoạt và course là các biến nhạy trong mẫu. Thêm START tăng cơ hội học/đầu tư và thời gian tích lũy, đồng thời tăng rolls. Savings thường ổn định; Stocks có upside và rủi ro giá; Bond B đổi coupon cao lấy tail loss/default; Business cần gặp lại đúng ô để thoát vốn. Không strategy nào được chứng minh thống trị mọi seed hoặc mọi cách chơi.', '',
  'A được giữ làm biên ngắn/khó của frontier, **chưa phải đề xuất MVP khả dụng với economy/goal đang thử**. B/C/D thể hiện ba hướng chọn sản phẩm khác nhau. Pareto theo năm trục không tự bảo đảm mức khó hoặc trải nghiệm đạt yêu cầu; không đổi cấu hình A sau khi xem holdout.', '',
  'Cash control thuần không học/đầu tư; các phương án cuối cùng bắt đầu với cùng allocation giữa các policy. Novice là synthetic, không phải dữ liệu người dùng. Meaningful decisions và modal chỉ là proxy engine, không chứng minh học được hay chơi hấp dẫn.', '',
  `Đã đối chiếu ${baseline.oldRowsReproduced} dòng baseline cũ và replay ${baseline.historicalReplay.length} log lịch sử. Baseline cũ còn ô Dòng tiền và/hoặc khác luật, nên không ghép trực tiếp thành A/B cho bàn MVP mới. So sánh baseline 9 loại ô với allocation khớp, paired policy/CI và sự khác biệt RNG nằm trong báo cáo chi tiết.`, '',
  '## Bàn cờ và kết quả','',
  '![Thứ tự các bàn shortlisted](research/core-mvp/charts/board-orders.png)', '',
  '![Win rate và tail risk](research/core-mvp/charts/win-tail-risk.png)', '',
  'Toàn bộ thứ tự/số lượng ô và thông số economy từng phương án: [frozen configs](research/core-mvp/frozen-configs.json). Các biểu đồ median/P10/P90, accessibility, rolls/decisions và sensitivity nằm trong [báo cáo chi tiết](research/core-mvp/technical-report.md).', '',
  '## Owner cần quyết định','',
  '| Cần chốt | Căn cứ |', '|---|---|',
  '| Chọn một bàn, thứ tự ô và số START | Pareto: độ dài, coverage, khả năng nâng/bán Business, tail risk |',
  '| Chọn vốn/allocation, lương/sinh hoạt, goal/reserve và course | OFAT và tương tác; không có win-rate đích đã phê duyệt |',
  '| Giữ hoặc sửa thông số savings/market/fees/credit/Business | Strategy matched conditions và CI, chưa human-test |',
  '| Sau khi duyệt mới implementation và full QA | Cần version/replay, UI, thiết bị thật, AI provider và Vercel |', '',
  'Không tự chọn winner. Thời lượng tính bằng phút, trải nghiệm trên điện thoại và mức hiểu bài học tài chính cần playtest người thật. Nhánh local `codex/core-mvp-balance-lab`; production/gameplay/artwork và deployment giữ nguyên.', '',
  'Kiểm tra: 12 research tests pass; 400.800 raw rows được đối chiếu lại aggregates; 40 log mẫu nghiên cứu replay đầy đủ; 30 dòng baseline cũ tái lập chính xác và 3 historical logs replay. Seed các phase không trùng, freeze trước holdout và hash artifact đều được xác nhận. Xem [verification](research/core-mvp/verification.json).', '',
  '## Dữ liệu tái lập','',
  '[CSV kết quả 10 policy](research/core-mvp/strategy-results.csv) · [CSV toàn bộ economy](research/core-mvp/economy-parameters.csv) · [CSV thứ tự ô](research/core-mvp/board-orders.csv) · [JSON so sánh + CI](research/core-mvp/final-comparison.json) · [sensitivity](research/core-mvp/sensitivity.json) · [baseline audit](research/core-mvp/baseline-audit.json) · [cách chạy, scope và toàn bộ tham số](research/core-mvp/technical-report.md). Raw gzip, seed manifest, source SHA/hash, version và elapsed theo từng phase nằm cùng thư mục.', '',
  `Elapsed thực: dice ${f(dice.elapsedSeconds)}s; broad ${f(broad.elapsedSeconds)}s; shortlist ${f(short.elapsedSeconds)}s; holdout ${f(holdout.elapsedSeconds)}s.`, '']
writeFileSync(resolve('docs/CORE_MVP_BALANCE_RESEARCH.md'),brief.join('\n'))
const files=[]
function walk(dir){for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())walk(p);else if(!['artifact-manifest.json','verification.json'].includes(name)){
  const bytes=readFileSync(p),text=/\.(json|md|csv|svg|txt)$/.test(name)
  files.push({path:p.slice(out.length+1).replaceAll('\\','/'),sha256:hash(text?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes),hashNormalization:text?'UTF-8 LF':'binary',bytes:statSync(p).size})
}}}
walk(out);writeFileSync(join(out,'artifact-manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),files},null,2)+'\n')
console.log(JSON.stringify({report:'docs/CORE_MVP_BALANCE_RESEARCH.md',files:files.length}))
