import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {gunzipSync} from 'node:zlib'
import {mean,paired,bootstrapTail} from './stats.mjs'
const phase=process.argv[2],root='docs/research/multi-course',dir=join(root,phase)
const names=readdirSync(dir).filter(n=>n.endsWith('.summary.json'))
const cells=[],arms=[]
for(const name of names){
  const summary=JSON.parse(readFileSync(join(dir,name))),c=JSON.parse(readFileSync(join(dir,name.replace('.summary.json','.config.json'))))
  for(const [policy,s]of Object.entries(summary.policies))cells.push({config:c.id,system:c.course.id,unlock:c.course.unlock,courses:c.course.courses.length,layout:c.board.id,courseTiles:c.board.tiles.filter(t=>t==='course').length,policy,n:s.n,
    win:s.won.rate,winLow:s.won.ci95[0],winHigh:s.won.ci95[1],mean:s.proceeds.mean,meanLow:s.proceeds.ci95[0],meanHigh:s.proceeds.ci95[1],median:s.proceeds.median,p10:s.proceeds.p10,worstDecile:s.proceeds.worstDecile,
    visits:s.courseVisits.mean,available:s.courseAvailableRate,affordable:s.courseAffordableRate,exhausted:s.courseExhaustedRate,profitable:s.courseProfitableRate,
    bought:s.coursesBought.mean,courseSpend:s.courseSpend.mean,courseSalary:s.courseSalaryReceived.mean,courseNet:s.courseNet.mean,recovery:s.realizedCourseRecovery.n?s.realizedCourseRecovery.rate:null,
    cashAfterCourse:s.cashAfterCourseMin.n?s.cashAfterCourseMin.mean:null,funding:s.funded.rate,withdrawals:s.withdrawals.mean,borrow:s.borrowed.rate,insolvent:s.insolvent.rate,personalShortfall:s.personalShortfalls.mean,
    investmentSpend:s.investmentSpend.mean,fees:s.fees.mean,spread:s.spread.mean,rolls:s.rolls.mean,decisions:s.decisions.mean,
    bought0:s.coursesDistribution[0],bought1:s.coursesDistribution[1],bought2:s.coursesDistribution[2],bought3:s.coursesDistribution[3],bought4:s.coursesDistribution[4]})
  const core=['cash-roi','savings-roi','diversified-roi','risk-aware-roi','novice'].map(p=>summary.policies[p]).filter(Boolean)
  arms.push({config:c.id,system:c.course.id,layout:c.board.id,courses:c.course.courses.length,courseTiles:c.board.tiles.filter(t=>t==='course').length,
    mean:mean(core.map(s=>s.proceeds.mean)),win:mean(core.map(s=>s.won.rate)),p10:mean(core.map(s=>s.proceeds.p10)),worstDecile:mean(core.map(s=>s.proceeds.worstDecile)),
    exhausted:mean(core.map(s=>s.courseExhaustedRate)),available:mean(core.map(s=>s.courseAvailableRate)),affordable:mean(core.map(s=>s.courseAffordableRate)),profitable:mean(core.map(s=>s.courseProfitableRate)),
    bought:mean(core.map(s=>s.coursesBought.mean)),courseNet:mean(core.map(s=>s.courseNet.mean)),cashRoiWin:summary.policies['cash-roi'].won.rate,savingsRoiWin:summary.policies['savings-roi'].won.rate,cashAllWin:summary.policies['cash-all'].won.rate,savingsAllWin:summary.policies['savings-all'].won.rate,
    cashAllNet:summary.policies['cash-all'].courseNet.mean,noviceWin:summary.policies.novice.won.rate,noviceFunding:summary.policies.novice.funded.rate})
}
function csv(path,rows){const keys=Object.keys(rows[0]??{}),escape=x=>`"${String(x??'').replaceAll('"','""')}"`;writeFileSync(path,keys.join(',')+'\n'+rows.map(r=>keys.map(k=>escape(r[k])).join(',')).join('\n')+'\n')}
csv(join(root,`${phase}-policy-results.csv`),cells);csv(join(root,`${phase}-arm-overview.csv`),arms)
writeFileSync(join(root,`${phase}-analysis.json`),JSON.stringify({phase,overviewIsEqualWeightedFiveHeuristicSuiteNotHumanPopulation:true,cells,arms},null,2)+'\n')
if(phase==='holdout'){
  const comparisons=[],tails=[],roi=[]
  const maps=new Map(names.map(name=>{const id=name.replace('.summary.json','');return [id,JSON.parse(gunzipSync(readFileSync(join(dir,`${id}.rows.json.gz`))))]}))
  for(const [id,rows]of maps){
    for(const policy of [...new Set(rows.map(r=>r.policy))]){
      const selected=rows.filter(r=>r.policy===policy)
      tails.push({config:id,policy,...bootstrapTail(selected.map(r=>r.proceeds))})
      const control={'cash-roi':'cash-none','cash-all':'cash-none','cash-reserve5':'cash-none','cash-reserve10':'cash-none','cash-reserve15':'cash-none','savings-roi':'savings-none','savings-all':'savings-none','stocks-roi':'stocks-none','business-roi':'business-none','diversified-roi':'diversified-none','savings-course-reserve0':'savings-none','savings-course-reserve5':'savings-none','savings-course-reserve15':'savings-none'}[policy]
      if(control){const other=rows.filter(r=>r.policy===control);comparisons.push({config:id,policy,control,metric:'proceeds',...paired(selected,other,'proceeds')});comparisons.push({config:id,policy,control,metric:'won',...paired(selected,other,'won')})}
    }
    for(const p of ['savings-course-reserve0','savings-course-reserve5','savings-course-reserve15'])if(rows.some(r=>r.policy===p)){
      for(const metric of ['proceeds','won','courseNet','investmentSpend','personalShortfalls','withdrawals','borrowAmount'])comparisons.push({config:id,policy:p,control:'savings-roi-course-reserve10',metric,...paired(rows.filter(r=>r.policy===p),rows.filter(r=>r.policy==='savings-roi'),metric)})
    }
    for(const r of rows)for(const p of r.coursePurchases)roi.push({config:id,policy:r.policy,...p})
  }
  // Same policy/config controls separate curriculum from layout. Changed
  // encounter hashes are reported even when dice/main RNG stay synchronized.
  const lock=JSON.parse(readFileSync(join(root,'holdout-lock.json')))
  for(const c of lock.configs.filter(x=>(x.system??x.course?.id)!=='A-baseline')){
    const system=c.system??c.course.id,layout=c.layout??c.board.id,id=`${system}__${layout}`,base=`A-baseline__${layout}`
    if(!maps.has(base))continue
    for(const p of lock.policies){const a=maps.get(id).filter(r=>r.policy===p),b=maps.get(base).filter(r=>r.policy===p);comparisons.push({config:id,policy:p,control:base,metric:'proceeds',...paired(a,b,'proceeds')});comparisons.push({config:id,policy:p,control:base,metric:'won',...paired(a,b,'won')})}
  }
  csv(join(root,'holdout-paired.csv'),comparisons);csv(join(root,'holdout-course-roi.csv'),roi)
  writeFileSync(join(root,'holdout-tail-intervals.json'),JSON.stringify(tails,null,2)+'\n')
  writeFileSync(join(root,'holdout-comparisons.json'),JSON.stringify(comparisons,null,2)+'\n')
}
if(existsSync(join(root,`${phase}-manifest.json`)))console.log(JSON.stringify({phase,arms:arms.length,cells:cells.length}))
console.table(arms.filter(a=>a.layout==='L4-original').map(a=>({system:a.system,mean:(a.mean/1e6).toFixed(2),win:(a.win*100).toFixed(1),exhausted:(a.exhausted*100).toFixed(1),profitable:(a.profitable*100).toFixed(1),bought:a.bought.toFixed(2),cashWin:(a.cashRoiWin*100).toFixed(1),savingsAll:(a.savingsAllWin*100).toFixed(1)})))
