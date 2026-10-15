import { advance, canChoose, createGame, decide, fundPayment, roll, transact } from '../../../src/game/engine.ts'
import { creditBondLots, creditIssuer } from '../../../src/game/bond-credit.ts'
import { borrowingAvailable, fundingSources } from '../../../src/game/transactions.ts'
import { EVENTS } from '../../../src/data/events.ts'
import { ECONOMY, RULES } from '../../../src/data/config.ts'
import { boardFor } from '../../../src/data/board.ts'
import { hashSeed, random } from '../../../src/game/random.ts'
import { gameMetrics, auditGame } from './metrics.mjs'

export const POLICIES=['cash','savings','stocks','gold','bond-a','bond-b','business','diversified','liquidity','novice']
export const BROAD_POLICIES=['cash','savings','stocks','gold','bond-a','bond-b','business','diversified']
export function policyRng(seed){let state=hashSeed(`synthetic-policy:${seed}`);return()=>{const [v,next]=random(state);state=next;return v}}
export function choiceSet(s,c){
  if(s.phase!=='event')return []
  const t=boardFor(s)[s.position].type,budget=s.portfolio.cash
  if(t==='personal')return EVENTS.find(e=>e.id===s.eventId).options.map(o=>({kind:'choice',id:o.id}))
  const options=[{kind:'skip'}]
  if(t==='course'&&canChoose(s,'upgrade'))options.push({kind:'choice',id:'upgrade'})
  if(t==='bank'&&budget>=1e6)for(const term of [1,2,3])options.push({kind:'deposit',amount:Math.floor(budget*.7),term})
  if(['stocks','gold','bonds'].includes(t)&&budget>=1e6){
    const amount=Math.floor(Math.min(budget,c.policy.ticket))
    if(t==='bonds'){
      for(const issuerId of ['an-tam','but-pha'])if(creditIssuer(s,issuerId).status==='performing')options.push({kind:'buy',asset:t,amount,issuerId})
    }
    if(t!=='bonds')options.push({kind:'buy',asset:t,amount,symbolId:t==='stocks'?s.market.stocks[s.turn%s.market.stocks.length].id:undefined})
  }
  if(t==='business'){
    if(!s.business.capital&&budget>=ECONOMY.business.cost)options.push({kind:'buy',asset:t,amount:ECONOMY.business.cost})
    if(s.business.capital>0&&s.businessPurchaseTurn!==s.turn){
      options.push({kind:'sell',asset:t,amount:s.portfolio.business})
      if(budget>=ECONOMY.business.upgradeCost&&Object.values(s.business.upgrades).reduce((a,b)=>a+b,0)<ECONOMY.business.maxUpgrades&&!s.log.some(e=>e.turn===s.turn&&e.decisionId==='upgrade-business'))options.push({kind:'upgrade',asset:t,amount:ECONOMY.business.upgradeCost,customerPreferenceId:s.customerPreferenceId})
    }
  }
  return options
}
const skip=s=>decide(s,EVENTS.find(e=>e.id===s.eventId).options.find(o=>o.id==='skip')?.id??'acknowledge')
export function step(s,policy,c,sample){
  if(s.phase==='rolling')return roll(s)
  if(s.phase==='funding'){
    const source=fundingSources(s)[0];if(!source)throw Error('No legal funding')
    const deposit=s.deposits.find(l=>l.status==='active'),bond=source==='bonds'?creditBondLots(s).find(x=>x.quote.executable):null
    const amount=source==='savings'?deposit.principal:source==='bonds'?bond.quote.gross:source==='debt'?Math.min(s.pendingPayment.remaining,borrowingAvailable(s)):s.portfolio[source]
    return fundPayment(s,source,amount,source==='savings'?deposit.id:bond?.lot.id)
  }
  if(s.phase==='rebalancing'&&policy==='liquidity'){
    // Liquidate once at every START, paying the actual spread/fee.
    for(const asset of ['stocks','gold','bonds']){
      const bond=asset==='bonds'?creditBondLots(s).find(x=>x.quote.executable):null
      const amount=asset==='bonds'?bond?.quote.gross??0:s.portfolio[asset]
      if(amount>0)return transact(s,{kind:'sell',asset,amount,lotId:bond?.lot.id})
    }
  }
  if(s.phase!=='event')return advance(s)
  const id=s.eventId,t=boardFor(s)[s.position].type,remaining=s.totalLaps-s.lap+1
  if(policy==='novice'){
    const choices=choiceSet(s,c)
    if(!choices.length)return skip(s)
    const action=choices[Math.floor(sample()*choices.length)]
    if(action.kind==='skip')return skip(s)
    if(action.kind==='choice')return decide(s,action.id)
    return transact(s,action)
  }
  if(t==='personal'){
    const options=EVENTS.find(e=>e.id===id).options
    if(options.length===1)return decide(s,options[0].id)
    // Pay cheapest total cost if cash covers it, otherwise defer to next START.
    const immediate=options.toSorted((a,b)=>(a.cost??0)+(a.obligation??0)-(b.cost??0)-(b.obligation??0))[0]
    return decide(s,s.portfolio.cash>=(immediate.cost??0)?immediate.id:options.find(o=>o.obligation)?.id??immediate.id)
  }
  if(t==='course')return policy!=='cash'&&RULES.courseBoost*remaining>=RULES.courseCost&&canChoose(s,'upgrade')?decide(s,'upgrade'):skip(s)
  const reserve=policy==='liquidity'?c.policy.liquidityReserve:c.policy.reserve,budget=Math.max(0,s.portfolio.cash-reserve)
  if(t==='bank'&&['savings','diversified'].includes(policy)&&budget>=1e6)return transact(s,{kind:'deposit',amount:Math.floor(budget*(policy==='savings'?.85:.25)),term:policy==='savings'?Math.min(3,remaining):1})
  if(['stocks','gold','bonds'].includes(t)&&budget>=1e6){
    const target=t==='bonds'?(policy==='bond-b'?'but-pha':'an-tam'):null
    const eligible=policy===t||(t==='bonds'&&['bond-a','bond-b'].includes(policy))||['diversified','liquidity'].includes(policy)
    if(eligible&&(t!=='bonds'||creditIssuer(s,target).status==='performing')){
      const stocks=s.market.stocks.toSorted((a,b)=>s.scenarioId==='uncertain'?a.volatility-b.volatility:b.volatility-a.volatility)
      return transact(s,{kind:'buy',asset:t,amount:Math.floor(Math.min(budget,['diversified','liquidity'].includes(policy)?c.policy.diversifiedTicket:c.policy.ticket)),issuerId:target??undefined,symbolId:t==='stocks'?stocks[0].id:undefined})
    }
  }
  if(t==='business'&&['business','diversified'].includes(policy)){
    if(s.business.capital>0&&remaining<=2&&s.businessPurchaseTurn!==s.turn)return transact(s,{kind:'sell',asset:'business',amount:s.portfolio.business})
    if(!s.business.capital&&remaining>=3&&budget>=ECONOMY.business.cost)return transact(s,{kind:'buy',asset:'business',amount:ECONOMY.business.cost})
    const upgrade=choiceSet(s,c).find(x=>x.kind==='upgrade')
    if(upgrade&&remaining>=3&&budget>=ECONOMY.business.upgradeCost)return transact(s,upgrade)
  }
  return skip(s)
}
export function play(seed,policy,c,{audit=true,trace=false}={}){
  let s=createGame(seed,c.economy.initialSavings,c.economy.initialTerm,'experimental-b',undefined,'v2.4-customer-preferences','v2.4-atomic-investments','vn-v1','v2.5-credit-risk','v2.6-periodic-start')
  const sample=policyRng(seed),seen=new Set();let meaningfulOpportunities=0,meaningfulDecisions=0
  for(let i=0;s.phase!=='finished'&&i<1200;i++){
    const choices=choiceSet(s,c),key=`${s.turn}:${s.eventId}`
    if(s.phase==='event'&&!seen.has(key)){seen.add(key);if(choices.length>1)meaningfulOpportunities++}
    const before=s;s=step(s,policy,c,sample)
    if(before===s)throw Error(`Stalled ${seed}/${policy}/${s.phase}`)
    if((before.phase==='event'&&choices.length>1)||(before.phase==='funding'&&fundingSources(before).length>1))meaningfulDecisions++
  }
  if(s.phase!=='finished')throw Error(`Deadlock ${seed}/${policy}`)
  if(audit)auditGame(s,c)
  const row=gameMetrics(s,policy,c,{meaningfulOpportunities,meaningfulDecisions})
  return trace?{row,state:s}:row
}
