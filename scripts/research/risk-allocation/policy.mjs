import { createGame, decide, transact } from '../../../src/game/engine.ts'
import { boardFor } from '../../../src/data/board.ts'
import { EVENTS } from '../../../src/data/events.ts'
import { RULES, ECONOMY } from '../../../src/data/config.ts'
import { fundingSources } from '../../../src/game/transactions.ts'
import { creditIssuer } from '../../../src/game/bond-credit.ts'
import { totalWorth } from '../../../src/game/selectors.ts'
import { step as baseStep, choiceSet } from '../core-mvp/policy.mjs'
import { tradingStep, holdings, sellIntent } from '../trading-ab/policy.mjs'
import { auditGame, gameMetrics } from '../core-mvp/metrics.mjs'
import { auditTrading, tradingMetrics } from '../trading-ab/metrics.mjs'
import { learningMetrics } from './metrics.mjs'

const ASSETS=['stocks','gold','bonds']
const skip=s=>decide(s,EVENTS.find(e=>e.id===s.eventId).options.find(o=>o.id==='skip')?.id??'acknowledge')
export const reserveFor=(p,c)=>p==='novice'?0:p==='liquidity'?c.policy.liquidityReserve:c.policy.reserve
export function observe(s,c,order){
  const type=boardFor(s)[s.position].type,choices=choiceSet(s,c),canSell=[]
  if(s.phase==='rebalancing')for(const a of ASSETS)if(holdings(s,a).length)canSell.push(a)
  if(s.phase==='event'&&ASSETS.includes(type)&&holdings(s,type).length)canSell.push(type)
  if(s.phase==='event'&&choices.some(a=>a.kind==='sell'&&a.asset==='business'))canSell.push('business')
  const n=s.phase==='event'?choices.length+(ASSETS.includes(type)?holdings(s,type).length:0):s.phase==='rebalancing'?1+canSell.length:s.phase==='funding'?fundingSources(s).length:0
  return {order,phase:s.phase,type,turn:s.turn,lap:s.lap,choices:n,canSell,
    canBuy:choices.some(a=>a.kind==='buy'||a.kind==='deposit'),canUpgrade:choices.some(a=>a.kind==='upgrade'),
    locked:s.deposits.filter(l=>l.status==='active').reduce((n,l)=>n+l.principal,0)+s.business.capital+
      s.bondLots.filter(l=>l.status==='active'&&l.credit?.paymentStatus==='defaulted').reduce((n,l)=>n+l.principal,0)}
}
export function allocationStep(s,p,c){
  if(p==='novice')return tradingStep(s,p,c,'new','disciplined')
  const mapped=p==='risk-aware'?'diversified':p,type=boardFor(s)[s.position].type,reserve=reserveFor(p,c),budget=Math.max(0,s.portfolio.cash-reserve)
  if(s.phase==='rebalancing'||s.phase==='event'&&ASSETS.includes(type)){
    for(const asset of s.phase==='rebalancing'?ASSETS:[type]){
      const intent=sellIntent(s,asset,mapped,c,'disciplined');if(intent)return transact(s,intent)
    }
  }
  if(s.phase!=='event')return baseStep(s,mapped,c,()=>0)
  if(type==='personal')return baseStep(s,mapped,c,()=>0)
  const remaining=s.totalLaps-s.lap+1
  if(type==='course')return p!=='cash'&&!s.coursePurchased&&budget>=RULES.courseCost&&remaining*RULES.courseBoost>=RULES.courseCost?decide(s,'upgrade'):skip(s)
  if(type==='bank'&&['savings','diversified','risk-aware','liquidity'].includes(p)&&budget>=1e6){
    const amount=Math.floor(budget*(p==='savings'?.85:p==='liquidity'?.3:.25))
    return transact(s,{kind:'deposit',amount,term:p==='savings'?Math.min(3,remaining):1})
  }
  if(ASSETS.includes(type)&&budget>=1e6){
    const eligible=p===type||type==='bonds'&&['bond-a','bond-b'].includes(p)||['diversified','liquidity','risk-aware'].includes(p)
    const issuerId=p==='bond-b'?'but-pha':'an-tam',issuer=type==='bonds'?creditIssuer(s,issuerId):null
    if(eligible&&(!issuer||issuer.status==='performing')){
      if(p==='risk-aware'&&issuer&&(issuer.stress>0||remaining<2))return skip(s)
      const diversified=['diversified','liquidity','risk-aware'].includes(p),ticket=diversified?c.policy.diversifiedTicket:c.policy.ticket
      const cap=p==='risk-aware'?Math.max(0,totalWorth(s)*.25-s.portfolio[type]):Infinity
      const amount=Math.floor(Math.min(budget,ticket,cap)*(p==='risk-aware'&&type==='stocks'&&s.scenarioId==='uncertain'?.5:1))
      if(amount<1e6)return skip(s)
      const stocks=s.market.stocks.toSorted((a,b)=>p==='risk-aware'||s.scenarioId==='uncertain'?a.volatility-b.volatility:b.volatility-a.volatility)
      return transact(s,{kind:'buy',asset:type,amount,issuerId:issuer?.id,symbolId:type==='stocks'?stocks[0].id:undefined})
    }
  }
  if(type==='business'&&['business','diversified','risk-aware'].includes(p)){
    if(s.business.capital>0&&remaining<=2&&s.businessPurchaseTurn!==s.turn)return transact(s,{kind:'sell',asset:'business',amount:s.portfolio.business})
    if(!s.business.capital&&remaining>=3&&budget>=ECONOMY.business.cost)return transact(s,{kind:'buy',asset:'business',amount:ECONOMY.business.cost})
    const upgrade=choiceSet(s,c).find(a=>a.kind==='upgrade')
    if(upgrade&&remaining>=3&&budget>=ECONOMY.business.upgradeCost)return transact(s,upgrade)
  }
  return skip(s)
}
export function playStudy(seed,p,c,mode='allocation',{trace=false}={}){
  if(!['cash','cash-course','savings','stocks','gold','bond-a','bond-b','business','diversified','liquidity','risk-aware','novice'].includes(p))throw Error('Unknown allocation policy')
  let s=createGame(seed,c.economy.initialSavings,c.economy.initialTerm,'experimental-b',undefined,'v2.4-customer-preferences','v2.4-atomic-investments','vn-v1','v2.5-credit-risk','v2.6-periodic-start')
  const observations=[]
  for(let i=0;s.phase!=='finished'&&i<1600;i++){
    observations.push(observe(s,c,i));const before=s
    s=mode==='audit'?tradingStep(s,p,c,'new','disciplined'):allocationStep(s,p,c)
    if(s===before)throw Error('Study stalled')
  }
  if(s.phase!=='finished')throw Error('Study deadlock')
  auditGame(s,c);auditTrading(s,'new')
  const learning=learningMetrics(s,c,observations),base=gameMetrics(s,p,c,{meaningfulOpportunities:learning.decisionEncounters,meaningfulDecisions:learning.decisionSteps})
  const row={...base,...tradingMetrics(s,c),...learning,mode,reserveTarget:reserveFor(p,c)}
  return trace?{row,state:s}:row
}
