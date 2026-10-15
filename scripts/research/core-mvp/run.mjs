import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn, execFileSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { createAdapter, hash, sourceManifest } from './adapter.mjs'
import { baselineConfig, makeLayouts, dicePath, opportunityMetrics, rng, TYPES } from './spec.mjs'
import { mean, distribution } from './stats.mjs'
import { POLICIES, BROAD_POLICIES } from './policy.mjs'

export const out=resolve('docs/research/core-mvp')
mkdirSync(out,{recursive:true})
export const save=(name,value)=>writeFileSync(join(out,name),JSON.stringify(value,null,2)+'\n')
export const load=name=>JSON.parse(readFileSync(join(out,name),'utf8'))
export function screen(count=10000){
  const started=performance.now(),configs=makeLayouts(),paths={},rows=[]
  for(const c of configs){const n=c.board.tiles.length,h=c.economy.rules.laps,key=`${n}/${h}`
    if(!paths[key]){
      paths[key]=Array.from({length:count},(_,i)=>{const sample=rng(`20261015:dice:${n}:${h}:${i}`);return dicePath(n,h,()=>Math.floor(sample()*6)+1)})
      writeFileSync(join(out,`dice-n${n}-h${h}.json.gz`),gzipSync(JSON.stringify(paths[key])))
    }
    const ms=paths[key].map(p=>opportunityMetrics(c.board.tiles,p)),coverage=Object.fromEntries(TYPES.slice(1).map(t=>[t,{mean:mean(ms.map(m=>m.encounters[t])),never:mean(ms.map(m=>m.encounters[t]===0)),firstConditional:distribution(ms.map(m=>m.first[t]).filter(x=>x!==null))}]))
    const r={id:c.id,n,h,countProfile:c.board.countProfile,permutation:c.board.permutation,rolls:distribution(ms.map(m=>m.rolls)),decisions:distribution(ms.map(m=>m.decisions)),coverage,
      earlyCourse:mean(ms.map(m=>m.earlyCourse)),businessRevisit:mean(ms.map(m=>m.businessRevisit)),businessGaps:distribution(ms.flatMap(m=>m.businessGaps))}
    // Experience constraints, not a win-rate target. Thresholds are lab filters,
    // exposed in the manifest and can be revisited by the owner.
    r.rejected=r.rolls.p90>44||r.coverage.course.never>.24||r.businessRevisit<.5||Math.max(...Object.values(coverage).map(x=>x.never))>.48
    r.experienceScore=r.earlyCourse+r.businessRevisit+mean(Object.values(coverage).map(x=>1-x.never))-.008*r.rolls.mean
    rows.push(r)
  }
  save('dice-screen.json',{countPerNH:count,seedScheme:'20261015:dice:N:H:i; independent dice-only stream; not financial-engine RNG',filters:{p90RollsMax:44,courseNeverMax:.24,businessRevisitMin:.5,anyTypeNeverMax:.48},elapsedSeconds:(performance.now()-started)/1000,rows})
  save('layout-configs.json',configs)
  console.log(JSON.stringify({phase:'dice',layouts:rows.length,rejected:rows.filter(r=>r.rejected).length,elapsedSeconds:(performance.now()-started)/1000}))
}
export function broadCandidates(){
  const rows=load('dice-screen.json').rows,configs=load('layout-configs.json'),selected=[]
  for(const n of [16,18,20,22,24])for(const h of [3,4,5,6]){
    const best=rows.filter(r=>r.n===n&&r.h===h&&!r.rejected).sort((a,b)=>b.experienceScore-a.experienceScore)[0]
    if(best){const c=structuredClone(configs.find(c=>c.id===best.id));c.economy.initialSavings=0;c.factor='board-only';selected.push(c)}
  }
  const anchor=selected.find(c=>c.board.tiles.length===20&&c.economy.rules.laps===4)??selected[0]
  if(!anchor)throw Error('No architecture survived')
  const variants=[
    ['capital40',c=>c.economy.rules.startingCapital=40e6],['capital60',c=>c.economy.rules.startingCapital=60e6],
    ['allocation20',c=>c.economy.initialSavings=20e6],['allocation30',c=>c.economy.initialSavings=30e6],
    ['salary12',c=>c.economy.rules.recurringIncome=12e6],['salary16',c=>c.economy.rules.recurringIncome=16e6],
    ['living5',c=>c.economy.livingCost=5e6],['living9',c=>c.economy.livingCost=9e6],
    ['goal70',c=>c.goal.amount=70e6],['goal90',c=>c.goal.amount=90e6],['goal-reserve5',c=>c.goal.reserve=5e6],['goal-reserve15',c=>c.goal.reserve=15e6],
    ['course-cost4',c=>c.economy.rules.courseCost=4e6],['course-cost8',c=>c.economy.rules.courseCost=8e6],['course-boost2',c=>c.economy.rules.courseBoost=2e6],['course-boost4',c=>c.economy.rules.courseBoost=4e6],
    ['savings-low',c=>Object.keys(c.economy.savingsRates).forEach(k=>c.economy.savingsRates[k]*=.75)],['savings-high',c=>Object.keys(c.economy.savingsRates).forEach(k=>c.economy.savingsRates[k]*=1.25)],
    ['stock-low',c=>c.economy.scenarios.forEach(s=>s.ranges.stocks=s.ranges.stocks.map(x=>x*.7))],['stock-high',c=>c.economy.scenarios.forEach(s=>s.ranges.stocks=s.ranges.stocks.map(x=>x*1.3))],
    ['gold-low',c=>c.economy.scenarios.forEach(s=>s.ranges.gold=s.ranges.gold.map(x=>x*.7))],['gold-high',c=>c.economy.scenarios.forEach(s=>s.ranges.gold=s.ranges.gold.map(x=>x*1.3))],
    ['fees-low',c=>Object.keys(c.economy.economy.tradeFees).forEach(k=>c.economy.economy.tradeFees[k]*=.5)],['fees-high',c=>Object.keys(c.economy.economy.tradeFees).forEach(k=>c.economy.economy.tradeFees[k]*=2)],
    ['spread1',c=>c.economy.economy.goldSpread=.01],['spread5',c=>c.economy.economy.goldSpread=.05],
    ['coupon-low',c=>{c.economy.issuers[0].coupon=.03;c.economy.issuers[1].coupon=.08}],['coupon-high',c=>{c.economy.issuers[0].coupon=.06;c.economy.issuers[1].coupon=.12}],
    ['credit-low',c=>c.economy.issuers.forEach(i=>{i.default*=.5;i.delay*=.5;i.stressPenalty*=.5;i.uncertainPenalty*=.5})],['credit-high',c=>c.economy.issuers.forEach(i=>{i.default*=1.5;i.delay*=1.5;i.stressPenalty*=1.5;i.uncertainPenalty*=1.5})],
    ['recovery-low',c=>c.economy.issuers.forEach(i=>i.recovery-=.2)],['recovery-high',c=>c.economy.issuers.forEach(i=>i.recovery+=.1)],
    ['business-cost15',c=>c.economy.economy.business.cost=15e6],['business-cost25',c=>c.economy.economy.business.cost=25e6],
    ['business-income2',c=>c.economy.economy.business.baseIncome=2e6],['business-income4',c=>c.economy.economy.business.baseIncome=4e6],
    ['upgrade-cost3',c=>c.economy.economy.business.upgradeCost=3e6],['upgrade-cost7',c=>c.economy.economy.business.upgradeCost=7e6],
    ['macro-stress',c=>c.economy.macroWeights=[3,1,1]],['macro-growth',c=>c.economy.macroWeights=[1,3,1]],
    ['personal70',c=>c.economy.personalActivation=.7],['personal-high',c=>Object.keys(c.economy.economy.personal).forEach(k=>c.economy.economy.personal[k]=c.economy.economy.personal[k].map(x=>Math.round(x*1.5)))],
  ]
  for(const [factor,mutate]of variants){const c=structuredClone(anchor);c.id=`${anchor.id}--${factor}`;c.factor=factor;mutate(c);selected.push(c)}
  const reference=baselineConfig();reference.factor='nine-type-reference-20M-savings';selected.push(reference)
  const matched=baselineConfig();matched.id='nine-type-reference-cash-allocation';matched.economy.initialSavings=0;matched.factor='nine-type-reference-zero-savings';selected.push(matched)
  save('broad-configs.json',{anchor:anchor.id,configs:selected,design:'20 architectural strata + OFAT at N20/H4, full parameter snapshots; initial savings matched within config; cash with nonzero setup savings is passive allocation control, not pure cash'})
  return selected
}
export async function financial(phase,configs,count,policies,concurrency=4){
  const started=new Date().toISOString(),source=sourceManifest(),sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
  const phaseDir=join(out,phase);mkdirSync(phaseDir,{recursive:true})
  const seeds=Array.from({length:count},(_,i)=>`CORE-MVP-${phase.toUpperCase()}-${i}`)
  const job={phase,policies,seeds,count,seedCoupling:'Common seed, shared engine RNG; same path verified per-policy. Different board sizes/scenario counts are not common exogenous trajectories.'}
  save(`${phase}-manifest.json`,{phase,started,sourceSha,sourceHashes:source,engineVersion:'core-mvp-lab-v1',node:process.version,job,configIds:configs.map(c=>c.id),concurrency})
  let next=0,completed=0
  async function worker(){while(next<configs.length){const c=configs[next++],target=join(phaseDir,c.id),dir=createAdapter(c)
    writeFileSync(join(dir,'job.json'),JSON.stringify(job));writeFileSync(`${target}.config.json`,JSON.stringify(c,null,2)+'\n')
    try{
      await new Promise((ok,fail)=>{const child=spawn(process.execPath,['--experimental-strip-types',join(dir,'scripts/research/core-mvp/worker.mjs'),join(dir,'config.json'),join(dir,'job.json'),target],{stdio:['ignore','pipe','pipe'],windowsHide:true});let errors='';child.stdout.on('data',x=>process.stdout.write(x));child.stderr.on('data',x=>errors+=x);child.on('error',fail);child.on('exit',code=>code===0?ok():fail(Error(errors)))})
      completed++;console.log(`${phase}: ${completed}/${configs.length}`)
    }finally{rmSync(dir,{recursive:true,force:true})}
  }}
  await Promise.all(Array.from({length:Math.min(concurrency,configs.length)},worker))
  if(JSON.stringify(source)!==JSON.stringify(sourceManifest()))throw Error('Source changed during study')
  const summaries=configs.map(c=>load(`${phase}/${c.id}.summary.json`))
  save(`${phase}-results.json`,{phase,started,finished:new Date().toISOString(),elapsedSeconds:(Date.now()-Date.parse(started))/1000,games:summaries.reduce((n,s)=>n+s.games,0),summaries})
  return summaries
}
if(process.argv[1]===new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1').replaceAll('/','\\')||resolve(process.argv[1]??'')===new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1').replaceAll('/','\\')){
  const phase=process.argv[2]
  if(phase==='dice')screen(Number(process.argv[3]??10000))
  else if(phase==='benchmark'){const c=baselineConfig();c.economy.initialSavings=0;await financial('benchmark',[c],Number(process.argv[3]??30),POLICIES,1)}
  else if(phase==='broad')await financial('broad',broadCandidates(),Number(process.argv[3]??200),BROAD_POLICIES)
  else if(phase==='shortlist')await financial('shortlist',load('shortlist-configs.json').configs,Number(process.argv[3]??1000),POLICIES)
  else if(phase==='holdout'){
    if(existsSync(join(out,'holdout-results.json')))throw Error('Holdout already exists; never tune and overwrite it')
    await financial('holdout',load('frozen-configs.json').configs,Number(process.argv[3]??5000),POLICIES)
  }else throw Error('Use dice|benchmark|broad|shortlist|holdout')
}
