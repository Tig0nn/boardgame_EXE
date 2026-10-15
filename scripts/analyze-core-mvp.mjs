import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { rng } from './research/core-mvp/spec.mjs'
import { mean, distribution, paired, aggregate } from './research/core-mvp/stats.mjs'
import { hash } from './research/core-mvp/adapter.mjs'
const out=resolve('docs/research/core-mvp')
const load=p=>JSON.parse(readFileSync(join(out,p),'utf8'))
const save=(p,v)=>writeFileSync(join(out,p),JSON.stringify(v,null,2)+'\n')
const raw=(phase,id)=>JSON.parse(gunzipSync(readFileSync(join(out,phase,`${id}.rows.json.gz`))))
const rate=s=>s.won.rate

export function axes(s){
  const p=Object.entries(s.policies).filter(([k])=>!['cash','novice'].includes(k)).map(([,v])=>v)
  const rates=p.map(rate),cash=s.policies.cash
  return {rolls:mean(p.map(v=>v.rolls.mean)),opportunities:mean(p.map(v=>v.meaningfulOpportunities.mean)),
    financialGain:mean(p.map(v=>v.proceeds.median))-cash.proceeds.median,
    lowerTail:mean(p.map(v=>v.expectedShortfall10)),
    coverage:mean(Object.values(cash.opportunities).map(v=>1-v.never.rate)),
    policySpread:Math.max(...rates)-Math.min(...rates),cashWin:rate(cash),funding:mean(p.map(v=>v.funded.rate)),locked:mean(p.map(v=>v.locked.rate)),
    winsByPolicy:Object.fromEntries(Object.entries(s.policies).map(([k,v])=>[k,rate(v)]))}
}
// Transparent five-axis Pareto test. Win rate is reported, never maximized as an
// objective or fitted to a target. Scores are descriptive synthetic-model axes.
export function dominates(a,b){const av=[-a.rolls,a.opportunities,a.financialGain,a.lowerTail,a.coverage],bv=[-b.rolls,b.opportunities,b.financialGain,b.lowerTail,b.coverage];return av.every((x,i)=>x>=bv[i])&&av.some((x,i)=>x>bv[i])}
export function selectShortlist(){
  const broad=load('broad-results.json'),configs=load('broad-configs.json').configs,dice=load('dice-screen.json'),layouts=load('layout-configs.json')
  const selected=[],take=c=>{if(!selected.some(x=>x.id===c.id))selected.push(structuredClone(c))}
  // Preserve the short/hard, middle, and longer architectures even if a single
  // synthetic policy likes one stratum. N22 is retained in broad evidence.
  for(const [n,h]of [[16,3],[16,4],[18,4],[20,4],[24,4],[20,5]])take(configs.find(c=>c.factor==='board-only'&&c.board.tiles.length===n&&c.economy.rules.laps===h))
  take(configs.find(c=>c.id==='nine-type-reference-cash-allocation'))
  const best=dice.rows.filter(r=>r.n===20&&r.h===4&&r.countProfile==='business'&&!r.rejected).sort((a,b)=>b.experienceScore-a.experienceScore)[0]
  const business=structuredClone(layouts.find(c=>c.id===best.id));business.economy.initialSavings=0;business.factor='business-count-position-matched-control';take(business)
  const access=structuredClone(business);access.id='interaction-business-access';access.factor='business cost15/baseIncome4/upgradeCost3 at business-focused board';Object.assign(access.economy.economy.business,{cost:15e6,baseIncome:4e6,upgradeCost:3e6});take(access)
  const learning=structuredClone(configs.find(c=>c.factor==='board-only'&&c.board.tiles.length===18&&c.economy.rules.laps===4));learning.id='interaction-learning-liquidity';learning.factor='living5/courseCost8/courseBoost4, matched N18H4';learning.economy.livingCost=5e6;Object.assign(learning.economy.rules,{courseCost:8e6,courseBoost:4e6});take(learning)
  const anchor=load('broad-configs.json').anchor,reference=broad.summaries.find(s=>s.id===anchor),anchorRows=raw('broad',anchor)
  const sensitivity=broad.summaries.filter(s=>s.id.startsWith(`${anchor}--`)).map(s=>{const c=configs.find(c=>c.id===s.id),rows=raw('broad',s.id);return {id:s.id,factor:c.factor,axes:axes(s),againstAnchor:Object.fromEntries(Object.keys(s.policies).map(p=>[p,{proceeds:paired(rows.filter(r=>r.policy===p),anchorRows.filter(r=>r.policy===p),'proceeds'),won:paired(rows.filter(r=>r.policy===p),anchorRows.filter(r=>r.policy===p),'won')}]))}})
  save('sensitivity.json',{anchor,anchorAxes:axes(reference),variants:sensitivity,interpretation:'OFAT at one N20/H4 layout only. Goal changes shift labels without changing proceeds. Stock/gold ranges scale drift AND dispersion, not pure volatility. Activation changes RNG draw counts and invalidates same-path pairing.'})
  save('shortlist-configs.json',{selectedBeforeShortlist:new Date().toISOString(),configs:selected,criteria:'Stratified architecture coverage plus two hypothesis-driven interactions; no win-rate target; no holdout inspected',broadAxes:broad.summaries.map(s=>({id:s.id,...axes(s)}))})
  console.log(JSON.stringify({shortlisted:selected.map(c=>c.id)}))
}
export function freeze(){
  if(existsSync(join(out,'holdout-manifest.json')))throw Error('Holdout already started; cannot refreeze')
  const study=load('shortlist-results.json'),configs=load('shortlist-configs.json').configs
  const rows=study.summaries.map(s=>({id:s.id,...axes(s)}))
  const frontier=rows.filter(b=>!rows.some(a=>a.id!==b.id&&dominates(a,b)))
  // Spread selections along roll count. A candidate's percentile ranking in
  // financial gain breaks ties within length strata, not win rate.
  const ordered=frontier.sort((a,b)=>a.rolls-b.rolls),chosen=[]
  const add=r=>{if(r&&!chosen.some(x=>x.id===r.id))chosen.push(r)}
  for(const n of [0,.33,.67,1])add(ordered[Math.round(n*(ordered.length-1))])
  for(const r of ordered.toSorted((a,b)=>b.financialGain-a.financialGain))if(chosen.length<Math.min(4,ordered.length))add(r)
  if(chosen.length<3)throw Error('Fewer than three nondominated candidates; report evidence and revise shortlist before holdout')
  save('frozen-configs.json',{frozenAt:new Date().toISOString(),selectionData:'shortlist only; holdout unseen',paretoObjectives:['min rolls','max meaningful opportunities','max median gain over matched cash','max average worst-decile proceeds','max mean tile accessibility'],allShortlistAxes:rows,paretoFront:frontier,configs:chosen.map(r=>configs.find(c=>c.id===r.id)),configHashes:Object.fromEntries(chosen.map(r=>[r.id,hash(JSON.stringify(configs.find(c=>c.id===r.id)))]))})
  console.log(JSON.stringify({frozen:chosen.map(c=>c.id),paretoCount:frontier.length}))
}
function bootstrap(rows,key,sample,repeats=400){
  const values=[]
  for(let b=0;b<repeats;b++){const xs=Array.from({length:rows.length},()=>rows[Math.floor(sample()*rows.length)][key]);values.push(key==='won'?mean(xs.map(Number)):xs.sort((a,b)=>a-b)[Math.floor((xs.length-1)*.5)])}
  values.sort((a,b)=>a-b)
  return {repeats,ci95:[values[Math.floor(repeats*.025)],values[Math.floor(repeats*.975)]],lowerQuantile:.025,upperQuantile:.975}
}
export function finalize(){
  const frozen=load('frozen-configs.json'),study=load('holdout-results.json'),short=load('shortlist-results.json'),sample=rng('CORE-MVP-BOOTSTRAP-FINAL')
  const comparison=[]
  for(const c of frozen.configs){
    const s=study.summaries.find(s=>s.id===c.id),rows=raw('holdout',c.id),selection=short.summaries.find(s=>s.id===c.id),byPolicy={}
    for(const p of Object.keys(s.policies)){
      const group=rows.filter(r=>r.policy===p)
      // Recompute every saved aggregate from raw data.
      if(JSON.stringify(aggregate(group))!==JSON.stringify(s.policies[p]))throw Error(`Aggregate mismatch: ${c.id}/${p}`)
      byPolicy[p]={...s.policies[p],selectionWin:selection.policies[p].won.rate,holdoutMinusSelection:s.policies[p].won.rate-selection.policies[p].won.rate,medianBootstrap:bootstrap(group,'proceeds',sample)}
    }
    const seedClusters=new Map();for(const r of rows){const group=seedClusters.get(r.seed)??[];group.push(r);seedClusters.set(r.seed,group)}
    const seedMeans=[...seedClusters.values()].map(g=>({won:mean(g.map(r=>Number(r.won))),proceeds:mean(g.map(r=>r.proceeds))}))
    const clusterWin=[];for(let b=0;b<400;b++)clusterWin.push(mean(Array.from({length:seedMeans.length},()=>seedMeans[Math.floor(sample()*seedMeans.length)].won)))
    clusterWin.sort((a,b)=>a-b)
    comparison.push({id:c.id,config:c,axes:axes(s),policies:byPolicy,pairedAgainstCash:s.pairedAgainstCash,clusterWin95:[clusterWin[10],clusterWin[390]],
      note:c.economy.initialSavings===0?'cash policy is pure cash; all policies start with zero savings':'cash policy is a passive matched-allocation control with inherited setup savings'})
  }
  save('final-comparison.json',{version:'core-mvp-lab-v1',generatedAt:new Date().toISOString(),shortlistParetoFrozen:frozen.configs.map(c=>c.id),holdoutUsedForSelection:false,
    holdoutPareto:comparison.filter(b=>!comparison.some(a=>a.id!==b.id&&dominates(a.axes,b.axes))).map(c=>c.id),comparison})
  // All strategy rows, not only winners, remain accessible as compact CSV.
  const headers=['candidate','policy','n','win','win_ci_lo','win_ci_hi','insolvency','funding','borrowing','median','p10','p90','tail10','credit_loss_p99','rolls','opportunities','decisions','locked','selection_win']
  const csv=[headers.join(',')]
  for(const c of comparison)for(const [p,v]of Object.entries(c.policies))csv.push([c.id,p,v.n,v.won.rate,...v.won.ci95,v.insolvent.rate,v.funded.rate,v.borrowed.rate,v.proceeds.median,v.proceeds.p10,v.proceeds.p90,v.expectedShortfall10,v.creditLoss.p99,v.rolls.mean,v.meaningfulOpportunities.mean,v.meaningfulDecisions.mean,v.locked.rate,v.selectionWin].join(','))
  writeFileSync(join(out,'strategy-results.csv'),csv.join('\n')+'\n')
  console.log(JSON.stringify({finalCandidates:comparison.map(c=>c.id),holdoutGames:study.games}))
}
const command=process.argv[2]
if(command==='shortlist')selectShortlist()
else if(command==='freeze')freeze()
else if(command==='finalize')finalize()
