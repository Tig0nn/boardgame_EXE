export const BASE_SHA='00e77a19691c109e8cb7079b83591463c3eb6136'
export const UPSTREAM_SHA='d04b8adf8f5173a3a0c21fa0106afba7f6bd3f53'
const M=1e6
const system=(id,unlock,tuples,rationale)=>({id,unlock,courses:tuples.map(([cost,boost],i)=>({id:`c${i+1}`,cost:cost*M,boost:boost*M})),rationale})
export const systems=[
  system('A-baseline','sequential',[[8,4]],'Production B18 comparator, unchanged.'),
  system('S2-rich','sequential',[[6,4],[6,3]],'Low fees/high return stress control for dominance.'),
  system('S2-extension','sequential',[[8,4],[10,2]],'Retain baseline first course; weaker second course.'),
  system('S2-even','sequential',[[8,3],[10,3]],'Similar salary benefit, higher second fee.'),
  system('S2-costly','sequential',[[10,3],[12,2]],'Conservative ROI stress control.'),
  system('I2-choice','independent',[[6,2],[10,4]],'Cheap slow payback versus expensive efficient course.'),
  system('I2-moderate','independent',[[6,2],[10,3]],'Independent choice with less generous total boost.'),
  system('S3-rich','sequential',[[6,4],[8,3],[10,2]],'Declining marginal boosts, initially generous.'),
  system('S3-decay','sequential',[[6,3],[8,2],[10,1]],'Declining boosts and increasingly long payback.'),
  system('S3-flat','sequential',[[8,3],[8,3],[8,3]],'Simple equal courses, tests salary stacking.'),
  system('I3-choice','independent',[[6,1],[8,2],[12,4]],'Three transparent cost/boost trade-offs.'),
  system('I3-moderate','independent',[[6,2],[8,3],[10,3]],'Three independently chosen courses with bounded benefits.'),
  system('S4-decay','sequential',[[6,4],[8,3],[10,2],[12,1]],'Four-course stress control; final level often unrecoverable.'),
  system('I4-even','independent',[[8,2],[8,2],[8,2],[8,2]],'Four interchangeable choices; complexity/opportunity control.'),
]
const original=['start','macro','bonds','personal','course','gold','bank','course','business','bonds','stocks','business','course','stocks','business','course','gold','bank']
const layout=(id,changes,rationale)=>({id,tiles:original.map((t,i)=>changes[i]??t),changes,rationale})
export const layouts=[
  layout('L4-original',{},'Original B18: course indices4/7/12/15.'),
  layout('L3-bank',{15:'bank'},'Replace late repeat at tile16 with access to savings.'),
  layout('L3-personal',{15:'personal'},'Prior studied tile16 replacement; reserve exposure control.'),
  layout('L3-bonds',{15:'bonds'},'Same replaced position; additional investment/exit access.'),
  layout('L2-bond-bank',{12:'bonds',15:'bank'},'Retain early course tiles5/8; reuse late encounters for liquidity.'),
  layout('L2-stock-bank',{12:'stocks',15:'bank'},'Same course positions/count as preceding arm, different investment access.'),
  layout('L2-spaced',{7:'bonds',15:'bank'},'Same tile counts as L2-bond-bank; courses at5/13 isolate spacing.'),
]
const policy=(id,allocation,course,reserve=10*M)=>({id,allocation,course,reserve})
export const policies=[
  policy('cash-none','cash','none',0),policy('cash-early','cash','early',0),
  policy('cash-roi','cash','roi',0),policy('cash-all','cash','all',0),
  policy('cash-reserve5','cash','roi',5*M),policy('cash-reserve10','cash','roi',10*M),policy('cash-reserve15','cash','roi',15*M),
  policy('savings-none','savings','none'),policy('savings-roi','savings','roi'),policy('savings-all','savings','all'),
  policy('stocks-none','stocks','none'),policy('stocks-roi','stocks','roi'),policy('gold-roi','gold','roi'),
  policy('bond-a-roi','bond-a','roi'),policy('bond-b-roi','bond-b','roi'),
  policy('business-none','business','none'),policy('business-roi','business','roi'),
  policy('diversified-none','diversified','none'),policy('diversified-roi','diversified','roi'),
  policy('risk-aware-roi','risk-aware','roi'),policy('novice','novice','synthetic',0),
  ...[0,5,15].map(amount=>({...policy(`savings-course-reserve${amount}`,'savings','roi'),courseReserve:amount*M})),
]
export const screenPolicies=policies.filter(p=>!p.id.startsWith('savings-course-reserve')&&!['cash-reserve5','cash-reserve15','savings-none','stocks-none','business-none','diversified-none','bond-b-roi'].includes(p.id))
export function config(systemId,layoutId){
  const course=systems.find(s=>s.id===systemId),board=layouts.find(l=>l.id===layoutId)
  if(!course||!board)throw Error('Unknown curriculum/layout')
  return {format:'b18-multi-course-v1',id:`${systemId}__${layoutId}`,course,board,
    economy:{initialSavings:0,initialTerm:3,rules:{laps:4,startingCapital:50*M}},
    goal:{amount:90*M,reserve:0},policy:{reserve:10*M,liquidityReserve:15*M,ticket:10*M,diversifiedTicket:5*M}}
}
export const seeds=(phase,n)=>Array.from({length:n},(_,i)=>`B18-MULTICOURSE-${phase.toUpperCase()}-${i}`)
