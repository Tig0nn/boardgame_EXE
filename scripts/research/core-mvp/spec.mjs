import { RULES, ECONOMY, SCENARIOS, MACRO_EVENTS } from '../../../src/data/config.ts'
import { BOND_ISSUERS } from '../../../src/data/bond-issuers.ts'
import { hashSeed, random } from '../../../src/game/random.ts'

export const VERSION = 'core-mvp-lab-v1'
export const TYPES = ['start','bank','stocks','course','macro','bonds','personal','business','gold']
export const LABELS = {start:'Xuất phát',bank:'Ngân hàng',stocks:'Cổ phiếu',course:'Đầu tư bản thân',macro:'Sự kiện',bonds:'Trái phiếu',personal:'Biến cố cá nhân',business:'Kinh doanh',gold:'Vàng'}
export function rng(seed) {
  let state = hashSeed(String(seed))
  return () => { const [v, next] = random(state); state = next; return v }
}
export function baselineConfig() {
  return structuredClone({
    version: VERSION, id: 'nine-type-baseline', researchOnly: true,
    board: { countProfile:'reference', permutation:0, tiles:['start','bank','stocks','bank','course','macro','bonds','personal','business','gold','course','stocks','bank','business','gold','business','course','personal','gold','bonds'] },
    economy: { rules:{...RULES,laps:4}, economy:ECONOMY, scenarios:SCENARIOS, macroEvents:MACRO_EVENTS, issuers:BOND_ISSUERS,
      livingCost:7e6, initialSavings:20e6, initialTerm:3, savingsRates:{1:.04,2:.05,3:.06},
      personalWeights:[1,1,1], macroWeights:[1,1,1], personalActivation:1 },
    goal:{amount:80e6,reserve:10e6,deadline:'completed-start',earlyVictory:false},
    policy:{version:'visible-v1',reserve:10e6,liquidityReserve:20e6,ticket:15e6,diversifiedTicket:5e6,
      course:'cost-recouped-by-remaining-starts',business:'buy-with-three-starts-upgrade-with-two-sell-in-last-two-laps',
      signal:'current-forecast-sector-tendency-only',funding:'savings-then-stocks-bonds-gold-then-debt',novice:'synthetic-uniform-actions-zero-reserve'},
    assumptions:{settlement:'market,salary,business,maturity/coupon,living,debt,obligations',
      trading:'engine-enforced-encounters; financial-sales-at-START-or-mandatory-funding; business-sale-at-business-only',
      clock:'one economic period per START, not month/year',mobileDuration:'unmeasured',
      macro:'economic-events-only',credit:'v2.5-credit-risk-educational-candidate',
      business:'v2.4-customer-preferences',encounters:'v2.4-atomic-investments'}
  })
}
export function validateConfig(c) {
  const tiles=c.board.tiles
  if (tiles[0] !== 'start' || tiles.filter(t=>t==='start').length !== 1 || tiles.some(t=>!TYPES.includes(t)) || TYPES.some(t=>!tiles.includes(t))) throw Error('Invalid tile types/START')
  if (!Number.isInteger(c.economy.rules.laps) || c.economy.rules.laps<1 || c.economy.initialSavings<0 || c.economy.initialSavings>c.economy.rules.startingCapital) throw Error('Invalid allocation/laps')
  const check=v=>{ if(typeof v==='number'&&!Number.isFinite(v)) throw Error('Non-finite parameter'); if(v&&typeof v==='object')Object.values(v).forEach(check) }; check(c)
  if(c.economy.personalActivation<0||c.economy.personalActivation>1)throw Error('Invalid activation')
  return c
}
export function makeLayouts() {
  const out=[]
  for(const n of [16,18,20,22,24])for(const laps of [3,4,5,6])for(const profile of ['balanced','business','learning']) {
    const weights=profile==='business'?[2,2,2,1,2,1,5,2]:profile==='learning'?[2,2,4,1,2,1,3,2]:[3,3,2,1,2,2,3,3]
    const counts=Array(8).fill(1)
    // Allocate counts before any positional permutation; stable largest deficit.
    for(let j=9;j<n;j++) {
      const target=weights.map((w,i)=>w/weights.reduce((a,b)=>a+b,0)*(n-1)-counts[i])
      counts[target.indexOf(Math.max(...target))]++
    }
    for(let permutation=0;permutation<4;permutation++) {
      const sample=rng(`layout:${n}:${profile}:${permutation}`)
      let tail=[]
      for(let attempt=0;attempt<10000;attempt++) {
        tail=TYPES.slice(1).flatMap((t,i)=>Array(counts[i]).fill(t))
        for(let i=tail.length-1;i>0;i--){const j=Math.floor(sample()*(i+1));[tail[i],tail[j]]=[tail[j],tail[i]]}
        if(tail.every((t,i)=>i===0||t!==tail[i-1])&&tail.indexOf('course')<6&&tail.indexOf('business')<n/2)break
        if(attempt===9999)throw Error('Layout constraints unsatisfied')
      }
      const c=baselineConfig();c.id=`n${n}-h${laps}-${profile}-p${permutation}`
      c.board={tiles:['start',...tail],countProfile:profile,permutation};c.economy.rules.laps=laps
      out.push(validateConfig(c))
    }
  }
  return out
}
export function dicePath(n, laps, d6) {
  let position=0,completedStarts=0,rolls=0
  const landings=[]
  while(completedStarts<laps){
    rolls++;const move=d6();if(!Number.isInteger(move)||move<1||move>6)throw Error('Invalid D6')
    const crossed=position+move>=n;position=(position+move)%n
    const lap=completedStarts+1
    if(crossed)completedStarts++
    if(completedStarts<laps)landings.push({position,turn:rolls,lap:crossed?lap+1:lap})
  }
  return {rolls,landings,completedStarts}
}
export function opportunityMetrics(tiles,path) {
  const encounters=Object.fromEntries(TYPES.slice(1).map(t=>[t,0])),first=Object.fromEntries(TYPES.slice(1).map(t=>[t,null])),businessGaps=[]
  let lastBusiness=null,decisions=0,earlyCourse=false
  for(const x of path.landings){const type=tiles[x.position];if(type==='start')continue
    encounters[type]++;decisions++;if(first[type]===null)first[type]=x.turn
    if(type==='course'&&x.lap<=2)earlyCourse=true
    if(type==='business'){if(lastBusiness!==null)businessGaps.push(x.turn-lastBusiness);lastBusiness=x.turn}
  }
  return {rolls:path.rolls,decisions,encounters,first,businessGaps,earlyCourse,businessRevisit:encounters.business>=2}
}
