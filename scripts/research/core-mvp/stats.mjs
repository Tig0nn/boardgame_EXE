export const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0
export function quantile(xs,p){const s=xs.toSorted((a,b)=>a-b);return s.length?s[Math.min(s.length-1,Math.floor((s.length-1)*p))]:null}
export const distribution=xs=>{
  const sorted=xs.toSorted((a,b)=>a-b),at=p=>sorted.length?sorted[Math.floor((sorted.length-1)*p)]:null
  return {mean:mean(xs),median:at(.5),p10:at(.1),p90:at(.9),p01:at(.01),p99:at(.99),min:sorted[0]??null,max:sorted.at(-1)??null}
}
export function wilson(k,n){if(!n)return [0,1];const z=1.959963984540054,d=1+z*z/n,p=k/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,c-h),Math.min(1,c+h)]}
export function rate(xs){const k=xs.filter(Boolean).length;return {count:k,n:xs.length,rate:k/xs.length,ci95:wilson(k,xs.length)}}
export function aggregate(rows){
  const rates=['won','insolvent','funded','borrowed','locked','capitalLoss','courseBought','businessBought','businessUpgraded','businessSold','anyInvestment']
  const values=['proceeds','cash','debt','shortfall','maxFundingShortfall','rolls','encounters','meaningfulOpportunities','meaningfulDecisions','modalsProxy','incomeReceived','creditLoss','creditCoupon','drawdown','lockedBusiness','lockedBond','missedBusinessExit']
  for(const k of ['savingsInterest','totalIncome'])if(rows.every(r=>r[k]!==undefined))values.push(k)
  return {n:rows.length,...Object.fromEntries(rates.map(k=>[k,rate(rows.map(r=>r[k]))])),...Object.fromEntries(values.map(k=>[k,distribution(rows.map(r=>r[k]))])),
    expectedShortfall10:mean(rows.map(r=>r.proceeds).sort((a,b)=>a-b).slice(0,Math.max(1,Math.floor(rows.length*.1)))),
    opportunities:Object.fromEntries(['bank','stocks','course','macro','bonds','personal','business','gold'].map(t=>[t,{mean:mean(rows.map(r=>r.coverage[t])),never:rate(rows.map(r=>r.coverage[t]===0))}]))}
}
export function paired(a,b,key){const bm=new Map(b.map(r=>[r.seed,r]));const ds=a.map(r=>{const other=bm.get(r.seed);if(!other)throw Error('Unmatched seed');return Number(r[key])-Number(other[key])});const m=mean(ds),se=ds.length>1?Math.sqrt(ds.reduce((s,x)=>s+(x-m)**2,0)/(ds.length-1)/ds.length):0;return {n:ds.length,mean:m,ci95:[m-1.96*se,m+1.96*se],sameDiceRate:mean(a.map(r=>r.diceHash===bm.get(r.seed).diceHash)),sameEncounterRate:mean(a.map(r=>r.encounterHash===bm.get(r.seed).encounterHash))}}
