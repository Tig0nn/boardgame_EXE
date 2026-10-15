import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { mean, paired, distribution } from './research/core-mvp/stats.mjs'
import { rng } from './research/core-mvp/spec.mjs'
import { matchedWinInterval } from './trading-ab-inference.mjs'
const out=resolve(process.env.TRADING_AB_OUT??'docs/research/trading-ab'),load=p=>JSON.parse(readFileSync(join(out,p),'utf8'))
const IDS={ 'interaction-learning-liquidity':'B','interaction-business-access':'C','n20-h5-learning-p1':'D' }
const ACTIVE=['savings','stocks','gold','bond-a','bond-b','business','diversified','liquidity']
const save=(p,v)=>writeFileSync(join(out,p),JSON.stringify(v,null,2)+'\n')
const raw=(phase,id,arm)=>JSON.parse(gunzipSync(readFileSync(join(out,phase,`${id}.${arm}.rows.json.gz`))))
function clusters(rows){
  const seeds=[...new Set(rows.map(r=>r.seed))]
  return seeds.map(seed=>{const g=rows.filter(r=>r.seed===seed&&ACTIVE.includes(r.policy));return {seed,won:mean(g.map(r=>Number(r.won))),proceeds:mean(g.map(r=>r.proceeds)),costs:mean(g.map(r=>r.transactionCosts)),tileSells:mean(g.map(r=>r.tileSells)),sells:mean(g.map(r=>r.sells)),buys:mean(g.map(r=>r.buys)),funded:mean(g.map(r=>Number(r.funded))),cash:mean(g.map(r=>r.cash)),diceHash:g.map(r=>r.diceHash).join(':'),encounterHash:g.map(r=>r.encounterHash).join(':')}})
}
function bootstrapTail(newRows,oldRows){
  const sample=rng('AB-TAIL-BOOTSTRAP'),n=newRows.length,delta=[]
  for(let i=0;i<400;i++){
    const ix=Array.from({length:n},()=>Math.floor(sample()*n)),tail=rows=>mean(ix.map(k=>rows[k].proceeds).sort((a,b)=>a-b).slice(0,Math.max(1,Math.floor(n*.1))))
    delta.push(tail(newRows)-tail(oldRows))
  }
  delta.sort((a,b)=>a-b);return {delta95:[delta[10],delta[390]],repeats:400,pairedIndices:true}
}
const study=load('main-results.json'),manifest=load('main-manifest.json'),control=load('control-results.json'),candidates=[],csv=[],assetCsv=[],clusterRows={}
csv.push('candidate,strategy,n,old_win,new_win,delta_win,delta_win_ci_lo,delta_win_ci_hi,old_proceeds_mean,new_proceeds_mean,delta_proceeds,delta_proceeds_ci_lo,delta_proceeds_ci_hi,old_buys,new_buys,old_sells,new_sells,new_tile_sells,old_fees,new_fees,old_spread,new_spread,old_tail10,new_tail10,old_funding,new_funding,old_cash,new_cash')
assetCsv.push('candidate,arm,strategy,asset,buys,sells,tile_sells,start_sells,forced_sells,fees,spread,bought,sold_gross,sold_net,realized_capital_pnl')
for(const config of manifest.configs){
  const id=config.id,oldRows=raw('main',id,'old'),newRows=raw('main',id,'new'),oldClusters=clusters(oldRows),newClusters=clusters(newRows)
  clusterRows[IDS[id]]={old:oldClusters,new:newClusters}
  const oldSummary=study.summaries.find(s=>s.id===id&&s.arm==='old'),newSummary=study.summaries.find(s=>s.id===id&&s.arm==='new'),pair=study.pairs.find(p=>p.id===id),strategies={}
  for(const p of manifest.strategies){
    const old=oldSummary.policies[p],fresh=newSummary.policies[p],d=pair.strategies[p]
    const binary=matchedWinInterval(newRows.filter(r=>r.policy===p),oldRows.filter(r=>r.policy===p))
    d.delta.won={...d.delta.won,asymptoticCI95:d.delta.won.ci95,ci95:binary.ci95,discordance:binary}
    strategies[p]={old,new:fresh,...d,tailSampling:bootstrapTail(newRows.filter(r=>r.policy===p),oldRows.filter(r=>r.policy===p))}
    csv.push([IDS[id],p,manifest.count,old.won.rate,fresh.won.rate,d.delta.won.mean,...d.delta.won.ci95,old.proceeds.mean,fresh.proceeds.mean,d.delta.proceeds.mean,...d.delta.proceeds.ci95,old.trading.buys.mean,fresh.trading.buys.mean,old.trading.sells.mean,fresh.trading.sells.mean,fresh.trading.tileSells.mean,old.trading.feesPaid.mean,fresh.trading.feesPaid.mean,old.trading.spreadPaid.mean,fresh.trading.spreadPaid.mean,old.expectedShortfall10,fresh.expectedShortfall10,old.funded.rate,fresh.funded.rate,old.cash.mean,fresh.cash.mean].join(','))
    for(const [arm,s]of [['old',old],['new',fresh]])for(const [asset,v]of Object.entries(s.assets))assetCsv.push([IDS[id],arm,p,asset,v.buys,v.sells,v.tileSells,v.startSells,v.forcedSells,v.fees,v.spread,v.bought,v.soldGross,v.soldNet,v.realizedCapitalPnl].join(','))
  }
  const clusterDelta=Object.fromEntries(['won','proceeds','costs','tileSells','sells','buys','funded','cash'].map(k=>[k,paired(newClusters,oldClusters,k)]))
  const oldPool={win:mean(oldClusters.map(r=>r.won)),proceeds:mean(oldClusters.map(r=>r.proceeds)),costs:mean(oldClusters.map(r=>r.costs)),buys:mean(oldClusters.map(r=>r.buys)),sells:mean(oldClusters.map(r=>r.sells))},newPool={win:mean(newClusters.map(r=>r.won)),proceeds:mean(newClusters.map(r=>r.proceeds)),costs:mean(newClusters.map(r=>r.costs)),buys:mean(newClusters.map(r=>r.buys)),sells:mean(newClusters.map(r=>r.sells))}
  candidates.push({id,label:IDS[id],config,strategies,clusterDelta,oldPool,newPool,
    rankOld:ACTIVE.toSorted((a,b)=>oldSummary.policies[b].proceeds.mean-oldSummary.policies[a].proceeds.mean),rankNew:ACTIVE.toSorted((a,b)=>newSummary.policies[b].proceeds.mean-newSummary.policies[a].proceeds.mean)})
}
const order=(arm,key)=>candidates.toSorted((a,b)=>b[`${arm}Pool`][key]-a[`${arm}Pool`][key]).map(c=>c.label)
const mainRanks={winOld:order('old','win'),winNew:order('new','win'),proceedsOld:order('old','proceeds'),proceedsNew:order('new','proceeds')}
const rankContrasts=[]
for(const [a,b]of [['D','B'],['B','C'],['D','C']]){
  const make=arm=>clusterRows[a][arm].map((r,i)=>({seed:r.seed,won:r.won-clusterRows[b][arm][i].won,proceeds:r.proceeds-clusterRows[b][arm][i].proceeds,diceHash:r.diceHash,encounterHash:r.encounterHash}))
  const old=make('old'),fresh=make('new')
  rankContrasts.push({a,b,oldWinGap:mean(old.map(r=>r.won)),newWinGap:mean(fresh.map(r=>r.won)),oldProceedsGap:mean(old.map(r=>r.proceeds)),newProceedsGap:mean(fresh.map(r=>r.proceeds)),policyEffectOnWinGap:paired(fresh,old,'won'),policyEffectOnProceedsGap:paired(fresh,old,'proceeds')})
}
const material=candidates.flatMap(c=>Object.entries(c.strategies).filter(([,s])=>Math.abs(s.delta.won.mean)>.03||Math.abs(s.delta.proceeds.mean)>1e6).map(([p,s])=>({candidate:c.label,strategy:p,winDelta:s.delta.won.mean,winCI:s.delta.won.ci95,proceedsDelta:s.delta.proceeds.mean,proceedsCI:s.delta.proceeds.ci95})))
save('comparison.json',{version:'trading-ab-v1',source:'new matched seeds only; old 400800 games preserved and not resimulated',generatedAt:new Date().toISOString(),games:study.games,controlGames:control.games,candidates,mainRanks,rankContrasts,materialEffects:material,
  uncertainty:'Per-strategy win delta uses conservative nominal 95% Bonferroni-Wilson discordance intervals, retaining original Wald CI; scalar deltas use paired normal intervals. Overall uses seed-cluster paired means across eight fixed synthetic strategies. Tail delta uses paired seed bootstrap 400 repeats. Exploratory intervals are not adjusted across all strategies. No human playtest or shared economic trajectory claim between B/C/D.',
  expansionGate:manifest.expansionGate})
writeFileSync(join(out,'direct-comparison.csv'),csv.join('\n')+'\n');writeFileSync(join(out,'asset-trades.csv'),assetCsv.join('\n')+'\n')
console.log(JSON.stringify({games:study.games,mainRanks,materialEffects:material}))

const M=x=>(x/1e6).toFixed(3),P=x=>(100*x).toFixed(2)+'%',PP=x=>(100*x).toFixed(2),ci=(v,fmt)=>v.ci95.map(fmt).join('; '),num=x=>x.toFixed(3)
const lines=[
  '# Trading Policy A/B — bổ sung nghiên cứu MVP', '',
  '**Research only — 16/10/2026. Nhánh gốc đã push; không merge, deploy, đổi production hoặc chạy Final QA.**', '',
  'Quyền Mua/Bán/Bỏ qua tại Stocks, Bonds, Gold đã được thử trong bản sao engine nghiên cứu: một giao dịch thành công/encounter; lỗi không mất quyền; vẫn bán tại START và khi funding bắt buộc. B/C/D giữ nguyên economy, goal, layout và initial allocation từ Pareto. Personal giữ ba sự kiện/lựa chọn; Kinh tế hiển thị Sự kiện, cú sốc không đổi. A không chạy lại.', '',
  `Đợt chính: **${study.games.toLocaleString('en-US')} ván mới** = B/C/D × 2 quyền × 10 strategy × ${manifest.count} seed. Đối chứng ${control.games.toLocaleString('en-US')} ván dùng heuristic v1 cũ cho kết quả cũ/mới giống hệt ngoài nhãn arm. Toàn bộ 400.800 ván, cấu hình, source lab và báo cáo cũ được giữ nguyên; không mô phỏng lại tập đó.`, '',
  '## Kết quả trực tiếp', '',
  'Bảng này cân bằng tám strategy có chủ đích (loại cash/novice), không phải phân bố người chơi thật. CI ghép cặp theo seed cluster; không coi tám strategy cùng seed là tám mẫu độc lập. Đơn vị tiền: triệu VND giả lập.', '',
  '| PA | Win cũ → mới | Δ win điểm % [95% CI] | Proceeds TB cũ → mới | Δ proceeds [95% CI] | Mua / bán TB cũ → mới | Phí+spread TB cũ → mới |',
  '|---|---|---|---|---|---|---|'
]
for(const c of candidates)lines.push(`| ${c.label} | ${P(c.oldPool.win)} → ${P(c.newPool.win)} | ${PP(c.clusterDelta.won.mean)} [${ci(c.clusterDelta.won,PP)}] | ${M(c.oldPool.proceeds)} → ${M(c.newPool.proceeds)} | ${M(c.clusterDelta.proceeds.mean)} [${ci(c.clusterDelta.proceeds,M)}] | ${num(c.oldPool.buys)}/${num(c.oldPool.sells)} → ${num(c.newPool.buys)}/${num(c.newPool.sells)} | ${M(c.oldPool.costs)} → ${M(c.newPool.costs)} |`)
lines.push('', 'Quyền bán mới không tạo cải thiện thắng/nguồn tiền đáng kể trong mẫu này. B/C giảm proceeds bình quân khoảng 20–31 nghìn, D khoảng 14 nghìn (CI D gồm 0). Thứ hạng điểm theo cả win và proceeds vẫn **D → B → C**. Đây là xếp hạng có điều kiện theo heuristic/trọng số trên mẫu, không phải kết luận D tốt hơn B về trải nghiệm hay mọi seed.', '',
  '| Strategy | Δ win B / C / D (điểm %) | Δ proceeds B / C / D (triệu) | Bán tại ô TB B / C / D |', '|---|---|---|---|')
for(const p of manifest.strategies){const ss=candidates.map(c=>c.strategies[p]);lines.push(`| ${p} | ${ss.map(s=>PP(s.delta.won.mean)).join(' / ')} | ${ss.map(s=>M(s.delta.proceeds.mean)).join(' / ')} | ${ss.map(s=>num(s.new.trading.tileSells.mean)).join(' / ')} |`)}
lines.push('', 'CI riêng từng strategy, số mua/bán, phí và spread tách riêng, cash/funding, tail P10/worst-decile, drawdown, credit losses và realized P&L được giao trong [CSV trực tiếp](research/trading-ab/direct-comparison.csv), [CSV giao dịch theo asset](research/trading-ab/asset-trades.csv) và [JSON đầy đủ](research/trading-ab/comparison.json). Phí mua hiện bằng 0 theo engine; chỉ ghi phí/spread bán thực trả, không cộng lại phí giả định vào proceeds.', '',
  '## Chốt lời, cắt lỗ và thanh khoản', '',
  'Giá chỉ đổi tại START hoặc Sự kiện. Vì cả hai quyền đều bán được sau settlement START, lợi ích mới chủ yếu nằm ở cửa phản ứng sau cú sốc giữa vòng. B có Sự kiện ô 2; C có Sự kiện ô 17 sau Stocks ô 2/9, nên Stocks-focused C không phát sinh bán tại ô; D có Sự kiện ô 6, còn nhiều ô tài chính phía sau. Không đổi vị trí ô để làm đẹp kết quả.', '',
  'Chốt lời/cắt lỗ dùng báo giá ròng sau phí, so với cost basis đang giữ: Stocks +15%/−12%, Gold +10%/−8%; Bond bán khi delayed hoặc stress≥1; ưu tiên bổ sung reserve, và tất toán tài chính có quote tại START cuối. Đây là heuristic chung của hai arm, không nhìn tương lai. Khi muốn bán tại ô, arm cũ bỏ qua và chờ START; arm mới bán rồi đóng encounter. Base buy/course/business/funding giữ cùng thuật toán. Novice là synthetic, dùng cùng nhiễu ý định theo seed/turn, không giả làm dữ liệu user.', '',
  'Do đó arm cũ trong A/B chính cũng sử dụng heuristic bán tại START này; không được so nó trực tiếp với policy buy-and-hold của báo cáo 400.800 ván để suy riêng tác động quyền giao dịch. Đối chứng legacy được lưu riêng để kiểm tra đúng khác biệt đó.', '',
  '| PA | Take-profit cũ → mới (lần/ván)* | Stop-loss cũ → mới | Funding cũ → mới** | Credit loss TB cũ → mới** |', '|---|---|---|---|---|')
for(const c of candidates){const sum=(arm,reason)=>mean(ACTIVE.map(p=>c.strategies[p][arm].reasons[reason]?.count??0)),value=(arm,key)=>mean(ACTIVE.map(p=>c.strategies[p][arm][key].rate)),credit=arm=>mean(ACTIVE.map(p=>c.strategies[p][arm].creditLoss.mean));lines.push(`| ${c.label} | ${num(sum('old','take-profit'))} → ${num(sum('new','take-profit'))} | ${num(sum('old','stop-loss'))} → ${num(sum('new','stop-loss'))} | ${P(value('old','funded'))} → ${P(value('new','funded'))} | ${M(credit('old'))} → ${M(credit('new'))} |`)}
lines.push('', '(*) Tính cả START và tại ô. Realized capital P&L = tiền bán ròng − cost basis đã xóa; coupon nằm riêng trong thu nhập, không cộng hai lần. Cắt lỗ là hành động đã xảy ra, không chứng minh đã tránh được thua lỗ tương lai. (**) Bình quân tám strategy có chủ đích.', '',
  'Stocks/Gold: cơ hội thoát sau shock có thể giảm một số tail loss nhưng cũng mất upside và tăng churn; không tăng sức hấp dẫn lợi nhuận một cách nhất quán. Bond B có vài trường hợp tail/proceeds tốt hơn (C/D), nhưng spread/quote discount, phí, coupon bỏ lỡ và default vẫn hiện hữu; quyền bán không cứu được claim đã default và mất quote. Savings và Business trực tiếp không đổi ở cả hai arm; Savings vẫn mạnh ở B, Diversified/Business nổi bật hơn ở C/D trong heuristic này. Bảng rank từng strategy nằm trong JSON.', '',
  'Novice có bán tại ô nhiều hơn (khoảng 0,48–0,67 lần/ván), tiền mặt bình quân trước roll tăng 0,66–1,12M nhưng proceeds giảm 0,42–0,93M. Có cả phí tăng (~42–48 nghìn/ván) và thay đổi thời điểm/mức nắm giữ; không gán toàn bộ hao hụt cho phí. Mức này không phải dự báo người mới thật. Mean tiền mặt, tỷ lệ roll dưới reserve, forced sales và chi phí được giữ để phân biệt thanh khoản với giàu hơn. Các CI/tail chỉ phản ánh seed và heuristic cố định; chưa human-test mức hấp dẫn hay hiểu hậu quả.', '',
  '## Ứng viên cuối và dừng ngân sách', '',
  '| PA | Đề xuất cho owner | Đánh đổi còn lại |', '|---|---|---|',
  '| **B — 18 ô/4 START** | Giữ finalist chính cho trải nghiệm gọn hơn (~21 roll) | Sinh hoạt 5M, course 8M/+4M; cần playtest sức nặng học phí và ưu thế Savings |',
  '| **D — 20 ô/5 START** | Giữ finalist chính khi ưu tiên thêm vòng tích lũy (~29 roll) | Proceeds/win cao hơn theo weighting đang dùng, nhưng dài hơn; chưa quy đổi thành phút |',
  '| **C — 20 ô/4 START** | Giữ finalist có điều kiện nếu owner ưu tiên vòng đời Kinh doanh (~23 roll) | Gặp Business nhiều, economy khó hơn; quyền bán tại ô không khép được khoảng cách với B/D |', '',
  'Không chọn winner. Quyền mới là quyết định Owner, còn cấu hình B/C/D vẫn cần chọn riêng. Không thấy effect vượt ngưỡng có khả năng đổi lựa chọn (>3 điểm % thắng hoặc >1M proceeds) ở bất kỳ cặp strategy chính nào; rank không đổi. Vì vậy **dừng ở mẫu vừa phải**, không tăng seed hay tối ưu thresholds theo kết quả. Chưa chứng minh quyền mới vô tác dụng với mọi heuristic; nếu owner muốn giao dịch thường xuyên hơn, cần một giả thuyết riêng về tín hiệu/nhịp thị trường, không tự thêm trong task này.', '',
  '## Tái lập và kiểm tra', '',
  'Nguồn chính xác, config hash, seed list, source SHA, Node version, raw rows và full-state examples nằm trong [manifest](research/trading-ab/main-manifest.json) và thư mục `docs/research/trading-ab`. Hai arm có 100% hash dice/encounter/market/credit khớp trên cùng config/strategy/seed. Cùng seed giữa B/C/D không bảo đảm cùng chuỗi kinh tế vì khác số ô/START.', '',
  '```powershell',
  'node --experimental-strip-types --test scripts/research/trading-ab/trading.test.mjs scripts/trading-ab-metrics.test.mjs scripts/trading-ab-inference.test.mjs',
  'node --experimental-strip-types scripts/verify-core-mvp-trading-ab.mjs',
  '# Reproduce new experiments without overwriting saved evidence:',
  '$env:TRADING_AB_OUT = "docs/research/trading-ab-reproduction"',
  'node --experimental-strip-types scripts/research/trading-ab/run.mjs control 30',
  'node --experimental-strip-types scripts/research/trading-ab/run.mjs main 500',
  'node --experimental-strip-types scripts/report-core-mvp-trading-ab.mjs',
  'Remove-Item Env:TRADING_AB_OUT',
  '```', '',
  `Elapsed: control ${control.elapsedSeconds.toFixed(1)}s; main ${study.elapsedSeconds.toFixed(1)}s. Các run mới không sửa source/data/report cũ. Nhánh gốc codex/core-mvp-balance-lab đã push tại 45b0c4d; nhánh bổ sung codex/core-mvp-trading-ab. Không merge/deploy/Final QA.`, ''
)
writeFileSync(join(out,'technical-report.md'),lines.join('\n').replaceAll('research/trading-ab/',''))
const resultsEnd=lines.indexOf('## Chốt lời, cắt lỗ và thanh khoản')
const decisionStart=lines.indexOf('## Ứng viên cuối và dừng ngân sách'),decisionEnd=lines.indexOf('## Tái lập và kiểm tra')
const brief=[...lines.slice(0,resultsEnd),
  '## Ý nghĩa cho MVP', '',
  '- Giá chỉ đổi tại START hoặc Sự kiện: thêm quyền bán chủ yếu mở cửa phản ứng sau shock giữa vòng. C đặt Sự kiện sau cả hai ô Stocks, nên Stocks-focused C không có giao dịch bán tại ô mới; giữ layout để so đúng quyền.',
  '- Chốt lời/cắt lỗ theo thông tin hiện tại không tạo lợi ích return nhất quán. Stocks/Gold có thể mất upside hoặc tăng churn; Bond B có vài tail/proceeds tốt hơn ở C/D nhưng chưa thay vị trí tương đối với Savings/Business. Rank strategy theo mean proceeds không đổi trong cả B/C/D.',
  '- Novice synthetic bán tại ô ~0,48–0,67 lần/ván, cash trong lượt tăng 0,66–1,12M nhưng proceeds giảm 0,42–0,93M; có cả phí và timing/exposure, không phải toàn bộ do phí. Đây không phải hành vi người dùng thật.',
  '- Hai arm dùng cùng ngưỡng chốt/cắt, reserve và START exit. Heuristic A/B chính có khác heuristic buy-and-hold của nghiên cứu cũ; chỉ so trực tiếp trong từng cặp mới. Đối chứng legacy xác nhận quyền mới không tự tạo tiền nếu chưa dùng.', '',
  ...lines.slice(decisionStart,decisionEnd),
  '## Kiểm chứng và dữ liệu', '',
  'Cùng config/strategy/seed: 100% dice, encounter, market và credit hash khớp giữa hai arm. Source/seed/config/raw/examples được lưu riêng; các file cũ giữ nguyên. Quy tắc một giao dịch, lỗi giữ quyền, fee/spread và action replay có kiểm thử riêng.', '',
  '[Chi tiết, CI/tail, P&L theo lý do và cách tái lập](research/trading-ab/technical-report.md) · [CSV trực tiếp](research/trading-ab/direct-comparison.csv) · [CSV giao dịch từng asset](research/trading-ab/asset-trades.csv) · [JSON](research/trading-ab/comparison.json).', '',
  `Elapsed: control ${control.elapsedSeconds.toFixed(1)}s, main ${study.elapsedSeconds.toFixed(1)}s. Nhánh gốc codex/core-mvp-balance-lab đã push tại 45b0c4d. Bổ sung trên codex/core-mvp-trading-ab; không merge/deploy/Final QA.`, '']
writeFileSync(resolve(process.env.TRADING_AB_OUT?join(out,'report.md'):'docs/CORE_MVP_TRADING_AB_RESEARCH.md'),brief.join('\n'))
