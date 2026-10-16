export const mean=xs=>xs.length?xs.reduce((n,x)=>n+x,0)/xs.length:0
export function meanCI(xs){
  const m=mean(xs),se=xs.length>1?Math.sqrt(xs.reduce((n,x)=>n+(x-m)**2,0)/(xs.length-1)/xs.length):0
  return {n:xs.length,mean:m,ci95:[m-1.96*se,m+1.96*se]}
}
export function distribution(xs){
  const s=xs.filter(x=>x!==null&&Number.isFinite(x)).toSorted((a,b)=>a-b)
  const at=p=>s.length?s[Math.floor((s.length-1)*p)]:null
  return {...meanCI(s),median:at(.5),p10:at(.1),p90:at(.9),min:s[0]??null,max:s.at(-1)??null,worstDecile:mean(s.slice(0,Math.max(1,Math.floor(s.length*.1))))}
}
export function wilson(k,n){
  if(!n)return [0,1]
  const z=1.959963984540054,p=k/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d
  return [Math.max(0,c-h),Math.min(1,c+h)]
}
export const rate=xs=>({n:xs.length,count:xs.filter(Boolean).length,rate:mean(xs.map(Number)),ci95:wilson(xs.filter(Boolean).length,xs.length)})
export function paired(a,b,key){
  const aa=new Map(a.map(r=>[r.seed,r])),bb=new Map(b.map(r=>[r.seed,r]))
  if(aa.size!==a.length||bb.size!==b.length||aa.size!==bb.size||a.some(r=>!bb.has(r.seed)))throw Error('Paired comparison requires identical unique seeds')
  return {...meanCI(a.map(r=>Number(r[key])-Number(bb.get(r.seed)[key]))),
    sameDiceRate:mean(a.map(r=>Number(r.diceHash===bb.get(r.seed).diceHash))),sameEncounterRate:mean(a.map(r=>Number(r.encounterHash===bb.get(r.seed).encounterHash))),
    sameRngRate:mean(a.map(r=>Number(r.finalRng===bb.get(r.seed).finalRng))),sameMarketRate:mean(a.map(r=>Number(r.marketHash===bb.get(r.seed).marketHash)))}
}
export function clusterMean(rows,key){
  const clusters=new Map()
  for(const r of rows){if(!clusters.has(r.seed))clusters.set(r.seed,[]);clusters.get(r.seed).push(Number(r[key]))}
  return {...meanCI([...clusters.values()].map(mean)),nSeeds:clusters.size}
}
export function summarize(rows){
  const values=['proceeds','cash','debt','courseVisits','courseAvailable','courseAffordable','courseReserveAffordable','courseExhausted','courseProfitable','coursesBought','courseSpend','courseSalaryReceived','courseNet','cashAfterCourseMin','personalEncounters','personalCost','personalPremium','personalShortfalls','fundingCount','withdrawals','lostInterest','fundingSales','borrowAmount','fees','spread','assetBuys','assetSells','savingsDeposits','savingsSpend','investmentSpend','businessCapitalSpend','decisions','rolls','rawDrawdown','livingAdjustedDrawdown','creditLoss']
  const sum=k=>rows.reduce((n,r)=>n+r[k],0),visits=sum('courseVisits'),purchases=rows.flatMap(r=>r.coursePurchases)
  return {n:rows.length,won:rate(rows.map(r=>r.won)),funded:rate(rows.map(r=>r.funded)),borrowed:rate(rows.map(r=>r.borrowed)),insolvent:rate(rows.map(r=>r.insolvent)),
    noCourse:rate(rows.map(r=>r.coursesBought===0)),anyInvestment:rate(rows.map(r=>r.anyInvestment)),businessBought:rate(rows.map(r=>r.businessBought)),
    coursesDistribution:Object.fromEntries([0,1,2,3,4].map(n=>[n,mean(rows.map(r=>Number(r.coursesBought===n)))])),
    courseAvailableRate:visits?sum('courseAvailable')/visits:0,courseAffordableRate:visits?sum('courseAffordable')/visits:0,courseExhaustedRate:visits?sum('courseExhausted')/visits:0,courseProfitableRate:visits?sum('courseProfitable')/visits:0,
    realizedCourseRecovery:rate(purchases.map(p=>p.recovered)),
    ...Object.fromEntries(values.map(k=>[k,distribution(rows.map(r=>r[k]))])),
    courseByTiming:Object.fromEntries([1,2,3,4].map(lap=>{const ps=purchases.filter(p=>p.lap===lap);return [lap,{n:ps.length,cost:mean(ps.map(p=>p.cost)),salary:mean(ps.map(p=>p.revenue)),net:mean(ps.map(p=>p.net)),recovery:rate(ps.map(p=>p.recovered))}]})),
    courseByLevel:Object.fromEntries([...new Set(purchases.map(p=>p.id))].map(id=>{const ps=purchases.filter(p=>p.id===id);return [id,{n:ps.length,cost:mean(ps.map(p=>p.cost)),salary:mean(ps.map(p=>p.revenue)),net:mean(ps.map(p=>p.net)),recovery:rate(ps.map(p=>p.recovered))}]})),
    personalAdverse:summarizeAdverse(rows.filter(r=>r.personalEncounters>=3)),
    visitsByTile:Array.from({length:18},(_,i)=>mean(rows.map(r=>r.visitsByTile[i])))}
}
function summarizeAdverse(rows){return {n:rows.length,won:rate(rows.map(r=>r.won)),proceeds:distribution(rows.map(r=>r.proceeds)),funded:rate(rows.map(r=>r.funded)),personalShortfalls:mean(rows.map(r=>r.personalShortfalls)),courseNet:mean(rows.map(r=>r.courseNet))}}
export function bootstrapTail(xs,repetitions=400,seed=58291){
  let rng=seed>>>0
  const draw=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296}
  const samples=[]
  for(let i=0;i<repetitions;i++)samples.push(distribution(xs.map(()=>xs[Math.floor(draw()*xs.length)])))
  const ci=k=>{const s=samples.map(x=>x[k]).sort((a,b)=>a-b);return [s[Math.floor(repetitions*.025)],s[Math.floor(repetitions*.975)]]}
  return {repetitions,p10CI95:ci('p10'),worstDecileCI95:ci('worstDecile')}
}
