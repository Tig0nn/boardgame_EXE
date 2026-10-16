import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { load, out } from './research/risk-allocation/run.mjs'
import { summarize, compare } from './research/risk-allocation/stats.mjs'
import { raw, purposeful, csv, clusteredDelta } from './analyze-core-mvp-risk-allocation.mjs'
import { matchedWinInterval } from './trading-ab-inference.mjs'
import { rate } from './research/core-mvp/stats.mjs'

const audit=load('audit-analysis.json'),screen=load('screen-analysis.json'),hold=load('holdout-analysis.json'),freeze=load('holdout-freeze.json')
const M=x=>(x/1e6).toFixed(2),pct=x=>(x*100).toFixed(1)+'%',num=x=>x.toFixed(2),ciM=x=>x.map(M).join('…')
const table=(heads,rows)=>[heads.join(' | '),heads.map(()=>'---').join(' | '),...rows.map(r=>r.join(' | '))].map(x=>'| '+x+' |').join('\n')
const s=(id,phase='holdout')=>(phase==='holdout'?hold:screen).groups[id].purposeful
const l=(id,phase='holdout')=>s(id,phase).learning

const coverage=[],business=[],allocation=[],reserves=[],pairs=[]
for(const phase of ['audit','screen','holdout']){
  const manifest=load(`${phase}-manifest.json`)
  for(const j of manifest.jobs.filter(j=>phase!=='holdout'||freeze.candidates.includes(j.id))){
    const rows=raw(phase,j.id),path=summarize(rows.filter(r=>r.policy==='cash')),selected=rows.filter(r=>purposeful.includes(r.policy)),summary=summarize(selected)
    for(const type of Object.keys(path.coverage??path.learning.encounterCoverage)){
      const chance=path.learning.encounterCoverage[type]
      coverage.push({phase,candidate:j.id,type,independentSeeds:manifest.count,encounterRate:chance.rate,encounterCI95Low:chance.ci95[0],encounterCI95High:chance.ci95[1],
        affordableMenuRate:summary.learning.financialAccess[type]?.rate,accessThenExitCheckpointRate:summary.learning.accessThenSale[type]?.rate,
        ownedExecutableExitRate:summary.learning.ownedSaleOpportunity[type]?.rate,macroWhileHoldingRate:summary.learning.macroOwned[type]?.any.rate,
        definition:'path from cash; affordability/ownership equal-weight purposeful strategies; bank exit is maturity/funding, not discretionary sale'})
    }
    for(const p of ['business','diversified','risk-aware','novice'].filter(p=>j.strategies.includes(p))){const rs=rows.filter(r=>r.policy===p),x=summarize(rs),buys=rs.filter(r=>r.businessBought)
      business.push({phase,candidate:j.id,policy:p,n:rs.length,affordableOpen:x.learning.businessOpenOpportunity.rate,pathOpenUpgradeExit:x.learning.businessOpenUpgradeExitPath.rate,bought:x.businessBought.rate,upgradeOpportunity:x.learning.businessUpgradeOpportunity.rate,upgraded:x.businessUpgraded.rate,sold:x.businessSold.rate,allThree:rs.filter(r=>r.businessBought&&r.businessUpgraded&&r.businessSold).length/rs.length,soldGivenBought:buys.length?buys.filter(r=>r.businessSold).length/buys.length:null,lockedFinal:x.lockedBusiness.mean})}
    for(const p of j.strategies){const rs=rows.filter(r=>r.policy===p),x=summarize(rs);allocation.push({phase,candidate:j.id,policy:p,n:rs.length,mean:x.proceeds.mean,median:x.proceeds.median,p10:x.proceeds.p10,worstDecile:x.expectedShortfall10,win:x.won.rate,winLow:x.won.ci95[0],winHigh:x.won.ci95[1],rawDrawdown:x.drawdown.mean,livingAdjustedDrawdown:x.learning.livingAdjustedDrawdown.mean,living:x.learning.livingIncurred.mean,fees:x.trading.feesPaid.mean,spread:x.trading.spreadPaid.mean,lockedTimePrincipalProxy:x.learning.lockedCapitalDuringRollMean.mean,lockedBusinessFinal:x.lockedBusiness.mean,lockedBondFinal:x.lockedBond.mean,lockedSavingsFinal:x.learning.lockedSavingsFinal.mean,creditLoss:x.creditLoss.mean,
      actualBuys:x.trading.buys.mean,actualSells:x.trading.sells.mean,takeProfit:x.reasons['take-profit']?.count??0,stopLoss:x.reasons['stop-loss']?.count??0,fundingSales:x.trading.forcedSells.mean,
      savingsInterest:x.savingsInterest.mean,creditCoupon:x.creditCoupon.mean,incomeSalaryAndBusiness:x.incomeReceived.mean,personalCommitted:x.learning.personalCommittedCost.mean,personalPremium:x.learning.personalDeferralPremium.mean})}
  }
}
csv('learning-exposure.csv',coverage);csv('business-capabilities.csv',business);csv('allocation-details.csv',allocation)
function reserveRow(phase,id,board,reserve,p){const x=summarize(raw(phase,id).filter(r=>r.policy===p));return{phase,board,reserve,policy:p,n:x.n,shortfall:x.learning.shortfallGame.rate,earlyWithdrawal:x.learning.earlyWithdrawalGame.rate,withdrawalPrincipal:x.learning.earlyWithdrawalPrincipal.mean,lostInterest:x.learning.lostSavingsInterest.mean,forcedSale:x.learning.fundingSaleGame.rate,forcedSaleAmount:x.learning.fundingSaleAmount.mean,borrowed:x.borrowed.rate,borrowedPrincipal:x.learning.borrowedPrincipal.mean,insolvent:x.insolvent.rate,personalImmediateShortfalls:x.learning.personalImmediateShortfalls.mean,personalCommitted:x.learning.personalCommittedCost.mean,personalDeferralPremium:x.learning.personalDeferralPremium.mean,win:x.won.rate,mean:x.proceeds.mean,median:x.proceeds.median,p10:x.proceeds.p10,worstDecile:x.expectedShortfall10}}
for(const id of ['B','D','B-personal','D-personal'])for(const reserve of [0,5,10,15])for(const p of ['savings','stocks','diversified'])reserves.push(reserveRow(reserve===10?'screen':id.includes('personal')?'reserve-variant':'reserve',reserve===10?id:`${id}-r${reserve}`,id,reserve*1e6,p))
for(const reserve of [0,5,10])reserves.push(reserveRow('holdout',reserve===10?'D-personal':`D-personal-r${reserve}`,'D-personal',reserve*1e6,'savings'))
csv('reserve-all.csv',reserves)
for(const phase of ['screen','reserve','reserve-variant','holdout'])for(const p of load(`${phase}-analysis.json`).pairs){for(const [k,d]of Object.entries(p.clustered))pairs.push({phase,pair:p.name,metric:k,independentSeeds:d.nSeeds,meanDelta:d.mean,ci95Low:d.ci95[0],ci95High:d.ci95[1],interpretation:d.method})}
csv('paired-effects.csv',pairs)
const ar=raw('holdout','D-personal-r5'),br=raw('holdout','D-personal-r0'),direct=compare(ar,br)
const reserveDirect={direction:'reserve5 - reserve0, D-personal/savings, holdout',comparison:direct,win:matchedWinInterval(ar,br),shortfall:matchedWinInterval(ar.map(r=>({...r,won:r.mandatoryCashShortfalls>0})),br.map(r=>({...r,won:r.mandatoryCashShortfalls>0}))),
  zeroRiskReminder:'0 observed does not imply impossible; savings already absorbs funding; no debt/default insolvency stress test was added'}
writeFileSync(join(out,'reserve-holdout-direct.json'),JSON.stringify(reserveDirect,null,2)+'\n')
const educationRows=[]
for(const [label,fn]of [
  ['Số ô / START',id=>`${load('screen-freeze.json').configs[id].board.tiles.length} / ${load('screen-freeze.json').configs[id].economy.rules.laps}`],
  ['Gặp personal ≥1',id=>pct(1-l(id,'screen').personal0.rate)],['Personal 0 / 1 / 2+',id=>['personal0','personal1','personal2plus'].map(k=>pct(l(id,'screen')[k].rate)).join(' / ')],
  ['Personal trung bình',id=>num(l(id,'screen').personalEncounters.mean)],['Gặp Sự kiện ≥1',id=>pct(l(id,'screen').encounterCoverage.macro.rate)],
  ['Course sau mua (lượt/ván)',id=>num(l(id,'screen').courseRepeatVisits.mean)],['Bước quyết định / encounter có quyết định',id=>`${num(l(id,'screen').decisionSteps.mean)} / ${num(l(id,'screen').decisionEncounters.mean)}`],
  ['Shock khi giữ tài sản (≥1)',id=>pct(l(id,'screen').macroWhileInvested.rate)],['Business mua / nâng cấp / bán (*)',id=>['businessBought','businessUpgraded','businessSold'].map(k=>pct(screen.groups[id].policies.business[k].rate)).join(' / ')],
  ['Proceeds mean / P10 / worst10 (M)',id=>[s(id,'screen').proceeds.mean,s(id,'screen').proceeds.p10,s(id,'screen').expectedShortfall10].map(M).join(' / ')],['Thắng, tham khảo',id=>pct(s(id,'screen').won.rate)]])educationRows.push([label,fn('B'),fn('D')])
csv('B-vs-D-education.csv',educationRows.map(([metric,B,D])=>({metric,B,D,phase:'screen',independentSeeds:120,weight:'equal9purposeful; Business row uses focused Business only'})))
const candidates=freeze.candidates,holdRows=candidates.map(id=>[id,pct(1-l(id).personal0.rate),pct(l(id).personal2plus.rate),num(l(id).courseRepeatVisits.mean),num(l(id).decisionSteps.mean),num(s(id).rolls.mean),M(s(id).proceeds.mean),M(s(id).expectedShortfall10),pct(s(id).won.rate)])
const reserveRows=reserves.filter(r=>r.phase==='holdout').map(r=>[String(r.reserve/1e6),pct(r.shortfall),M(r.personalDeferralPremium),M(r.lostInterest),M(r.mean),M(r.p10),M(r.worstDecile),pct(r.win)])
const costD=screen.pairs.find(p=>p.name==='D-economy-control').clustered.proceeds
const dPair=hold.pairs.find(p=>p.name==='D-vs-D-personal').clustered.proceeds
const bd=hold.pairs.find(p=>p.name==='B-personal-vs-D-personal').clustered.proceeds
const report=`# CORE MVP — Phân bổ tài chính và quản lý rủi ro

**Research only — chưa chọn winner, chưa Final QA.** Tiếp nối **45b0c4d** và **33de122**, trên nhánh **codex/core-mvp-risk-allocation**. Bảo toàn cả hai đợt cũ; không sửa production, merge hoặc deploy. M = triệu VND.

## Dữ liệu thực nghiệm

**27.800 ván mới:** audit 2.400; screening 6.600; reserve gốc 2.160; reserve biến thể 2.160; cash+course control 480; holdout 14.000. Không chạy lại 400.800 ván balance hoặc 31.800 ván trading cũ. Audit dùng 120 seed riêng/bàn; screening/control dùng 120 seed chung/strategy; holdout dùng 400 seed riêng, shortlist/policy đóng băng trước khi chạy. Thống kê có mục đích là trung bình đều 9 heuristic, tách cash và novice; **400 seed, không phải 3.600 quan sát độc lập**. Proxy tiếp xúc/menu không chứng minh việc học.

### B vs D gốc theo mục tiêu giáo dục

${table(['Proxy — screening, 120 seed/strategy','B gốc','D gốc'],educationRows)}

(*) Hành động thực tế của strategy Business, không phải tỷ lệ chuỗi đủ cả ba bước. Audit độc lập trước thí nghiệm thấy personal vắng ở 28,3% B và 20,0% D; khác screening là biến thiên mẫu. Coverage từng loại ô, affordability→exit, shock theo tài sản và chuỗi Business có ở [learning-exposure.csv](research/risk-allocation/learning-exposure.csv), [business-capabilities.csv](research/risk-allocation/business-capabilities.csv), [audit](research/risk-allocation/PHASE1_AUDIT.md). Gặp ô không bảo đảm đủ tiền hoặc chọn đầu tư.

### Biến thể và holdout

Chỉ đổi course **ô 13 B / ô 18 D** thành personal, theo vị trí nhiều lượt ghé sau mua nhất trong audit; không đổi tiền hay ba tình huống. Screening giảm tỷ lệ không gặp personal 16,7 / 15,8 điểm % ở B/D, đủ ngưỡng mở rộng. Holdout:

${table(['Ứng viên','Personal ≥1','Personal 2+','Course chết','Bước quyết định','Roll/ván','Mean M','Worst10 M','Thắng'],holdRows)}

D biến thể so với D gốc tăng personal và giảm khoảng 1,49 course chết/ván, nhưng mean proceeds thấp hơn **${M(dPair.mean)}M** (CI95 theo cụm seed: ${ciM(dPair.ci95)}M cho D gốc trừ biến thể). B biến thể ngắn hơn D biến thể khoảng 8 lượt gieo; mean thấp hơn ${M(-bd.mean)}M, nhưng worst10 tốt hơn khoảng ${M(s('B-personal').expectedShortfall10-s('D-personal').expectedShortfall10)}M. Đây là trade-off, không phải bảng xếp hạng giáo dục.

Trong cặp course→personal, **100% chuỗi xúc xắc/RNG/thị trường/credit khớp** ở các arms có mục đích; encounter identity chỉ khớp ở seed không ghé ô bị thay (D holdout 15%). Hai loại ô đều tiêu thụ cùng số draw ở phiên bản này. B vs D có đường đi/RNG khác hoàn toàn dù seed giống; không gọi là common-random path hay causal effect thuần số ô. Có hashes/pair flags trong JSON.

### Reserve 0 / 5 / 10 / 15M

Giữ ticket, ROI khóa học, exit, funding order và seed chung; chỉ chi đầu tư/course từ cash vượt reserve. Mục tiêu cuối ván vẫn 80M + 10M, không đổi theo reserve policy. Đây là **gói phân bổ–dự phòng**, không giữ tổng vốn đầu tư bất biến. Personal chọn chi phí tổng thấp nhất nếu cash đủ, nếu thiếu thì dùng lựa chọn hoãn có sẵn; vì vậy thiếu cash tại biến cố có thể thành premium/nghĩa vụ sau START, chưa thành funding ngay.

Trên B gốc, cả ba strategy thử không funding ở 120 seed/mức. D gốc savings-first reserve0 funding/rút savings 4,2%, reserve≥5 quan sát 0%; đa dạng hóa reserve0 0,8%. D biến thể savings-first screening có 9,2% so với 0% ở reserve5, đủ ngưỡng mở rộng chọn lọc. Holdout cùng 400 seed:

${table(['Reserve M','Funding/rút sớm','Premium personal M','Mất lãi M','Mean M','P10 M','Worst10 M','Thắng'],reserveRows)}

Reserve5 so với 0: mean delta **${M(direct.delta.proceeds.mean)}M** (CI95 ${ciM(direct.delta.proceeds.ci95)}M), worst10 +${M(reserves.find(r=>r.phase==='holdout'&&r.reserve===5e6).worstDecile-reserves.find(r=>r.phase==='holdout'&&r.reserve===0).worstDecile)}M; win rate bằng nhau. Không kết luận 5M tối ưu. Reserve15 chỉ ở screening, không mở rộng mọi mức. Bán funding, vay và phá sản bằng 0 ở các reserve arms; **0 quan sát không có nghĩa không thể xảy ra**. [Toàn bộ 0/5/10/15M, ba strategy, bốn bàn](research/risk-allocation/reserve-all.csv).

### Phân bổ và rủi ro

Holdout D biến thể: savings-first mean/median/P10/worst10 = **89,54 / 90,22 / 79,04 / 74,93M**, thắng 52,3%; diversified = **92,31 / 91,93 / 76,43 / 71,46M**, thắng 57,0%; risk-aware = **92,26 / 92,11 / 76,69 / 71,36M**, thắng 57,8%. Đa dạng hóa/Business có mean cao hơn nhưng savings có tail tốt hơn; không chiến lược nào thắng mọi tiêu chí.

Gold trả phí+spread trung bình 1,78M/ván ở D biến thể, stocks 0,44M; bond B mất credit trung bình 0,93M, worst10 63,13M so với bond A 67,76M. Đây là kết quả heuristic thoát lệnh/ticket hiện tại, không phải kết luận tài sản ngoài đời. Risk-aware có phí thấp hơn diversified nhưng không cải thiện rõ tail. Cash thuần không mua course; control cash+course ở screening B/D gốc tăng win từ 0% lên 42,5% và proceeds +6,67/+8,35M. Vì vậy không quy toàn bộ chênh với cash cho đầu tư tài chính.

Drawdown thô / đã loại sinh hoạt (mean): B biến thể **${M(s('B-personal').drawdown.mean)} / ${M(l('B-personal').livingAdjustedDrawdown.mean)}M**; D biến thể **${M(s('D-personal').drawdown.mean)} / ${M(l('D-personal').livingAdjustedDrawdown.mean)}M**. Bản điều chỉnh vẫn chứa course, personal, phí, credit và giảm giá trị thu hồi Business. Locked capital tách savings, Business chưa bán và bond không bán được; không cộng Business chưa bán vào proceeds. Bảng đủ 11 strategy, mean/median/P10/worst10, costs, drawdown, vốn khóa, actual trades và sources: [allocation-details.csv](research/risk-allocation/allocation-details.csv), [phụ lục](research/risk-allocation/ALLOCATION_APPENDIX.md).

### Economy chung

D dùng bộ economy B (giữ 20 ô/5 START) có mean ${M(s('D-common-B','screen').proceeds.mean)}M, so với B gốc ${M(s('B','screen').proceeds.mean)}M. Riêng đổi economy trên cùng bàn D tăng ${M(costD.mean)}M (CI95 ${ciM(costD.ci95)}M). Lương, coupon, drift, spread, goal không được tinh chỉnh; đây là đối chiếu sao chép economy đã có, gồm living và course. Khác số START/đường đi vẫn còn; không quy chênh còn lại cho số ô. Bộ economy chung chỉ là control, không đưa thành ứng viên mới.

## Giả thuyết cần người thật kiểm tra

Nhiều personal hơn có thể giúp giải thích reserve, nhưng ở reserve10 tất cả heuristic có mục đích holdout vẫn không funding/vay/phá sản. Người chơi có thể học “trả hóa đơn” mà chưa hiểu thiếu thanh khoản. Salary trước living, ticket giới hạn và quyền hoãn trả giảm áp lực tiền mặt. Savings hấp dẫn và course tăng lương có thể lấn át bài học phân bổ. Business tạo nhiều cơ hội ở D nhưng kéo dài ván và khóa vốn. Novice synthetic có funding 8,3% B biến thể / 28,5% D biến thể, bán funding 1,0% / 4,5%, không vay/phá sản; đây là noise tổng hợp, chưa đại diện người mới.

## Khuyến nghị để Owner duyệt playtest

- **B biến thể:** ứng viên ngắn hơn, ít course chết, tail tốt hơn D biến thể trong holdout; ít cơ hội Business/market hơn và còn 7,5% không personal.
- **D biến thể:** tiếp xúc personal/Business/market nhiều hơn, cần xem tải đọc và mức mất tiền có giải thích được; tail kém hơn B biến thể.
- **D gốc:** đối chứng ít áp lực chi phí, thuận tiện kiểm tra liệu thêm personal thật sự cải thiện hiểu biết; còn 16,5% không personal và nhiều course chết.

Chưa chọn winner. Không thay economy để làm kết quả đẹp. [Protocol playtest](research/risk-allocation/HUMAN_PLAYTEST.md) đo phút thật, giải thích phân bổ/reserve/price/spread/fee/credit/liquidity và hậu quả thắng/thua, có pre/post/vignette; không dùng win rate làm điểm kiến thức. C không cần dùng thêm vì các control B/D đã trả lời câu hỏi; A ngoài phạm vi.

Phương pháp, giới hạn, nguồn tái lập: [README](research/risk-allocation/README.md), manifests/source bundles/raw/replays trong thư mục nghiên cứu. CI là nominal/exploratory, không hiệu chỉnh toàn bộ phép thử; seed là cụm khi gộp heuristic. Các định nghĩa menu và locked-time proxy có giới hạn; chưa đo hành vi/học tập hay phút chơi. Chỉ sửa một lỗi ghép cặp của **phân tích** trước khi đọc holdout (reserve jobs chỉ có savings); simulator/config/policy frozen không đổi. Kiểm chứng cuối được ghi trong verification.json và artifact-manifest.json; đây là kiểm thử nghiên cứu, không Final QA.
`
const normalized=report
if(!process.env.RISK_STUDY_OUT)writeFileSync('docs/CORE_MVP_RISK_ALLOCATION_RESEARCH.md',normalized)
writeFileSync(join(out,'REPORT.md'),normalized.replaceAll('(research/risk-allocation/','('))
const appendix=['# Phụ lục allocation — holdout','', 'M = triệu VND. 400 seed/strategy; quantile và worst10 tính riêng strategy, không gộp độc lập. Locked-time là proxy principal định nghĩa trong README; Business cuối là marked value không thuộc proceeds. Fees/spread là giao dịch thực trả.','']
for(const id of candidates){appendix.push(`## ${id}`,'',table(['Strategy','Mean','Median','P10','Worst10','Win','DD thô','DD trừ living','Fees','Spread','Locked time','Biz khóa cuối'],allocation.filter(r=>r.phase==='holdout'&&r.candidate===id).map(r=>[r.policy,M(r.mean),M(r.median),M(r.p10),M(r.worstDecile),pct(r.win),M(r.rawDrawdown),M(r.livingAdjustedDrawdown),M(r.fees),M(r.spread),M(r.lockedTimePrincipalProxy),M(r.lockedBusinessFinal)])),'')}
appendix.push('## Policy và giới hạn','', 'Focused asset: ticket15M; diversified/liquidity/risk-aware ticket5M. Reserve mặc định10M, liquidity20M, novice0. Course chỉ mua khi cash sau mua không dưới reserve và còn START đủ hoàn vốn; cash thuần không course. Savings-first gửi85% budget với kỳ hạn min(3, START còn lại). Liquidity gửi30% budget kỳ hạn1, bán financial mỗi START. Diversified gửi25% budget kỳ hạn1, thêm financial và Business theo encounter. Risk-aware thêm cap25% marked wealth mỗi tài sản tài chính, stock ít volatility nhất, nửa ticket khi uncertain, không mua bond stressed hoặc còn<2 START. Business còn≥3 START mới mở/nâng cấp, bán tại Business khi còn≤2 START. Không biết trước D6/giá/sự kiện.','', 'Exit financial chung: thiếu reserve, ngưỡng take-profit/stop-loss net/basis, credit distress, hoặc START cuối; một giao dịch tile thành công. Funding chung savings→stocks→bonds→gold→debt, rút cả lot. Vì thứ tự ưu tiên này, savings thường hấp thụ thiếu hụt trước khi phải bán/vay. Novice dùng noise counter-based và menu giả định; không được coi là khảo sát người mới.','', 'Trade-off với savings không giữ giống kỳ hạn, số lệnh hay exposure; chính đó là nội dung policy cần so sánh, chưa phải return attribution thuần. Không ép diversified thắng hoặc đổi coupon/living để tạo bài học. Course control, economy control, reserve full và exposure xem CSV/JSON riêng.','')
writeFileSync(join(out,'ALLOCATION_APPENDIX.md'),appendix.join('\n'))
console.log(JSON.stringify({coverage:coverage.length,business:business.length,allocation:allocation.length,reserves:reserves.length,pairs:pairs.length,report:'docs/CORE_MVP_RISK_ALLOCATION_RESEARCH.md'}))
