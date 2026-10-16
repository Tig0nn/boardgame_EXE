import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
import { out, load, save, sources } from './research/risk-allocation/run.mjs'
import { summarize, compare, mean } from './research/risk-allocation/stats.mjs'
import { studyConfigs, STRATEGIES } from './research/risk-allocation/spec.mjs'
import { hash } from './research/core-mvp/adapter.mjs'
import { matchedWinInterval } from './trading-ab-inference.mjs'

export const raw=(phase,id)=>JSON.parse(gunzipSync(readFileSync(join(out,phase,`${id}.rows.json.gz`))))
export const purposeful=STRATEGIES.filter(p=>!['cash','novice'].includes(p))
export function clusterRows(rows,policies=purposeful){
  const groups=new Map()
  for(const r of rows.filter(r=>policies.includes(r.policy))){if(!groups.has(r.seed))groups.set(r.seed,[]);groups.get(r.seed).push(r)}
  return [...groups].map(([seed,rs])=>{
    const x={seed}
    for(const k of Object.keys(rs[0]))if(['number','boolean'].includes(typeof rs[0][k]))x[k]=mean(rs.map(r=>Number(r[k])))
    return x
  })
}
export function clusteredDelta(fresh,old,key,policies=purposeful){
  const a=clusterRows(fresh,policies),prior=new Map(clusterRows(old,policies).map(r=>[r.seed,r])),ds=a.map(r=>r[key]-prior.get(r.seed)[key]),m=mean(ds)
  const se=Math.sqrt(ds.reduce((n,x)=>n+(x-m)**2,0)/(ds.length-1)/ds.length)
  return {nSeeds:ds.length,mean:m,ci95:[m-1.96*se,m+1.96*se],method:'paired seed-cluster mean, nominal normal 95%; strategies equal-weighted; exploratory multiple comparisons'}
}
const pct=x=>(100*x).toFixed(1)+'%',M=x=>(x/1e6).toFixed(2)
export function csv(name,rows){
  const keys=Object.keys(rows[0]),q=v=>typeof v==='string'&&/[",\n]/.test(v)?'"'+v.replaceAll('"','""')+'"':String(v??'')
  writeFileSync(join(out,name),keys.join(',')+'\n'+rows.map(r=>keys.map(k=>q(r[k])).join(',')).join('\n')+'\n')
}
function audit(){
  const findings={},replacements={}
  for(const id of ['B','D']){
    const rows=raw('audit',id),cash=summarize(rows.filter(r=>r.policy==='cash')),ps=purposeful.filter(p=>p!=='risk-aware'),pooled=summarize(rows.filter(r=>ps.includes(r.policy)))
    const positions=pooled.learning.courseRepeatByPosition,index=Number(Object.keys(positions).toSorted((a,b)=>positions[b]-positions[a]||Number(a)-Number(b))[0])
    replacements[id]=index
    findings[id]={pathAudit:cash,heuristicMenuAudit:pooled,replacement:{index0:index,index1:index+1,deadVisitsPerGame:positions[index]},strategies:ps,independentSeeds:120}
  }
  save('audit-analysis.json',{findings,interpretation:'Menu/path exposure proxies only; financial access is affordability at observed states; cash policy path coverage uses one row per independent seed; pooled heuristic metrics share seeds.'})
  save('screen-freeze.json',{frozenAt:new Date().toISOString(),basedOnlyOn:'audit 120 seeds; no variant outcomes observed',replacements,configs:studyConfigs(replacements),strategies:STRATEGIES,sourceHashes:sources(),screenSeedPrefix:'RISK-ALLOCATION-SCREEN-',count:120,
    policies:'course reserve-constrained; unchanged fixed ticket sizes and visible exits; liquidity bank term1 and 20M reserve; risk-aware max25% per financial asset, lowest volatility stock, half stock ticket in uncertain, no stressed/late credit; novice unchanged synthetic uniform noise',
    reserveControls:'0/5/10/15M; same savings/stocks/diversified, tickets, course ROI, exits, funding order and seeds; discretionary investments/course limited by cash-reserve, mandatory costs unrestricted. Portfolio exposure changes intentionally; not an isolated cash effect.',
    expansionGate:'Expand max3 candidates if personal exposure changes >=10pp, mandatory shortage changes >=5pp, or worst-decile trade-off >=2M and could alter educational choice. Separate 400-seed holdout; freeze before running; no tuning after holdout.',
    primaryEndpoints:['personal zero/2plus','course dead visits','substantive decision encounters','shortfall/withdrawal/funding/debt','P10/worst-decile proceeds','living-adjusted drawdown','locked capital','Business exit','macro while holding'],
    economyControl:'D adopts B economy, retains 20-tile D layout/5 START. Compare to unchanged B; not pure causal tile-count effect.'})
  const lines=['# Phase 1 — Audit trước thí nghiệm','', '120 seed mới/bàn × 10 heuristic; luật và policy trading hiện có không đổi. Đo tiếp xúc ≠ đo học tập.','', '| Proxy | B | D |','|---|---:|---:|']
  const f=id=>findings[id],a=id=>f(id).pathAudit.learning,h=id=>f(id).heuristicMenuAudit.learning
  for(const [label,fn]of [['Gặp personal ≥1',id=>pct(1-a(id).personal0.rate)],['Personal 0 / 1 / 2+',id=>['personal0','personal1','personal2plus'].map(k=>pct(a(id)[k].rate)).join(' / ')],['Personal trung bình',id=>a(id).personalEncounters.mean.toFixed(2)],['Gặp Sự kiện ≥1',id=>pct(a(id).encounterCoverage.macro.rate)],['Ghé course sau mua',id=>h(id).courseRepeatVisits.mean.toFixed(2)],['Bước quyết định có ≥2 lựa chọn',id=>h(id).decisionSteps.mean.toFixed(2)],['Mở→còn ≥2 encounter Business (cơ hội đường đi)',id=>pct(h(id).businessOpenUpgradeExitPath.rate)]])lines.push(`| ${label} | ${fn('B')} | ${fn('D')} |`)
  lines.push('','Khoảng trống: personal và Sự kiện không bảo đảm xuất hiện; nhiều course sau mua chỉ là xác nhận. Business cần phân biệt đường đi đủ lượt và chuỗi mua/nâng cấp/bán thực tế. Reserve 10M ở heuristic có thể làm funding hiếm; thí nghiệm reserve thấp kiểm tra thêm.','',`Thay đúng một course: B ô ${f('B').replacement.index1}, D ô ${f('D').replacement.index1}, là vị trí có nhiều lượt ghé sau mua nhất trong audit (trung bình heuristic có mục đích). Chỉ thay loại ô; giữ ba tình huống, amount, payment và funding.`,'','Dữ liệu chi tiết: audit-analysis.json và audit/*.summary.json. Việc đổi course→personal có thể đổi số draw RNG; các thí nghiệm sẽ công bố mức khớp đường đi.','')
  writeFileSync(join(out,'PHASE1_AUDIT.md'),lines.join('\n'))
  console.log(JSON.stringify({replacements,personalCoverage:Object.fromEntries(['B','D'].map(id=>[id,1-a(id).personal0.rate]))}))
}
function analyze(phase){
  const manifest=load(`${phase}-manifest.json`),groups={},tables=[]
  for(const job of manifest.jobs){const rows=raw(phase,job.id);groups[job.id]={policies:Object.fromEntries(job.strategies.map(p=>[p,summarize(rows.filter(r=>r.policy===p))])),purposeful:summarize(rows.filter(r=>purposeful.includes(r.policy)))}
    for(const p of job.strategies){const s=groups[job.id].policies[p],l=s.learning;tables.push({phase,candidate:job.id,policy:p,seeds:s.n,win:s.won.rate,mean:s.proceeds.mean,median:s.proceeds.median,p10:s.proceeds.p10,worstDecile:s.expectedShortfall10,rawDrawdown:s.drawdown.mean,livingAdjustedDrawdown:l.livingAdjustedDrawdown.mean,living:l.livingIncurred.mean,fees:s.trading.feesPaid.mean,spread:s.trading.spreadPaid.mean,lockedTime:l.lockedCapitalDuringRollMean.mean,lockedBusiness:s.lockedBusiness.mean,lockedBond:s.lockedBond.mean,lockedSavings:l.lockedSavingsFinal.mean,personal0:l.personal0.rate,personal2plus:l.personal2plus.rate,personalMean:l.personalEncounters.mean,courseDead:l.courseRepeatVisits.mean,decisionSteps:l.decisionSteps.mean,shortfall:l.shortfallGame.rate,earlyWithdrawal:l.earlyWithdrawalGame.rate,forcedSales:l.fundingSaleGame.rate,borrowed:s.borrowed.rate,insolvent:s.insolvent.rate,personalCost:l.personalCommittedCost.mean,personalPremium:l.personalDeferralPremium.mean,personalCashShortfalls:l.personalImmediateShortfalls.mean})}
  }
  const pairs=[]
  const addPair=(name,a,b,oldPhase=phase)=>{
    const fresh=raw(phase,a),old=raw(oldPhase,b),policies=manifest.jobs.find(j=>j.id===a).strategies
    pairs.push({name,a,b,oldPhase,policies:Object.fromEntries(policies.map(p=>{const ar=fresh.filter(r=>r.policy===p),br=old.filter(r=>r.policy===p);return[p,{...compare(ar,br),winInterval:matchedWinInterval(ar,br)}]})),clustered:Object.fromEntries(['won','proceeds','personal0','personal2plus','decisionSteps','courseRepeatVisits','personalCommittedCost','mandatoryCashShortfalls','livingAdjustedDrawdown'].map(k=>[k,clusteredDelta(fresh,old,k,policies.filter(p=>purposeful.includes(p)))]))})
  }
  if(phase==='screen')for(const [name,a,b]of [['B-variant','B-personal','B'],['D-variant','D-personal','D'],['B-vs-D','B','D'],['common-economy-B-vs-D','B','D-common-B'],['D-economy-control','D-common-B','D']])addPair(name,a,b)
  if(phase==='reserve')for(const j of manifest.jobs)addPair(j.id,j.id,j.id.slice(0,1),'screen')
  if(phase==='holdout')for(const a of manifest.jobs)for(const b of manifest.jobs)if(a.id<b.id)addPair(`${a.id}-vs-${b.id}`,a.id,b.id)
  const result={phase,groups,pairs,units:'VND; rates 0..1; pooled descriptive distributions equal weights, not independent strategy samples; paired inference uses seed clusters',generatedAt:new Date().toISOString()}
  save(`${phase}-analysis.json`,result);csv(`${phase}-strategies.csv`,tables)
  console.log(JSON.stringify({phase,groups:Object.fromEntries(Object.entries(groups).map(([id,g])=>[id,{win:g.purposeful.won.rate,mean:g.purposeful.proceeds.mean,tail:g.purposeful.expectedShortfall10,personal0:g.purposeful.learning.personal0.rate,personal2plus:g.purposeful.learning.personal2plus.rate,dead:g.purposeful.learning.courseRepeatVisits.mean,decisions:g.purposeful.learning.decisionSteps.mean}]))}))
}
const phase=process.argv[2]
if(phase==='audit')audit();else if(['screen','reserve','holdout'].includes(phase))analyze(phase)
