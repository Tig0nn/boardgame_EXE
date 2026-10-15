import { createGame, decide, transact } from '../../../src/game/engine.ts'
import { boardFor } from '../../../src/data/board.ts'
import { creditBondLots, creditIssuer } from '../../../src/game/bond-credit.ts'
import { saleQuote } from '../../../src/game/selectors.ts'
import { fundingSources } from '../../../src/game/transactions.ts'
import { hashSeed, random } from '../../../src/game/random.ts'
import { step as baseStep, choiceSet as baseChoices, play as legacyPlay } from '../core-mvp/policy.mjs'
import { auditGame, gameMetrics } from '../core-mvp/metrics.mjs'
import { auditTrading, tradingMetrics } from './metrics.mjs'

export const STRATEGIES=['cash','savings','stocks','gold','bond-a','bond-b','business','diversified','liquidity','novice']
export const HEURISTICS={
  disciplined:{stockProfit:.15,stockLoss:-.12,goldProfit:.10,goldLoss:-.08,creditStress:1},
  wide:{stockProfit:.25,stockLoss:-.20,goldProfit:.18,goldLoss:-.15,creditStress:2},
}
export function holdings(s,asset){
  if(asset==='bonds')return creditBondLots(s).filter(x=>x.quote.executable).map(({lot,quote})=>({asset,lotId:lot.id,amount:quote.gross,basis:lot.credit.costBasis,net:quote.net,issuer:creditIssuer(s,lot.credit.issuerId)}))
  if(asset==='gold')return s.portfolio.gold>0?[{asset,amount:s.portfolio.gold,basis:s.goldCostBasis,net:saleQuote(s,asset).net}]:[]
  return s.market.stocks.flatMap(stock=>{
    const h=s.stockHoldings[stock.id],amount=h?Math.min(s.portfolio.stocks,Math.round(stock.currentPrice*h.units)):0
    return amount>0?[{asset,amount,symbolId:stock.id,basis:h.costBasis,net:saleQuote(s,asset,amount).net}]:[]
  })
}
export function sellIntent(s,asset,strategy,c,heuristic){
  const h=HEURISTICS[heuristic],reserve=strategy==='novice'?0:strategy==='liquidity'?c.policy.liquidityReserve:c.policy.reserve
  for(const x of holdings(s,asset)){
    const ratio=x.basis>0?x.net/x.basis-1:0
    const reason=s.phase==='rebalancing'&&s.lap===s.totalLaps?'terminal'
      :s.portfolio.cash<reserve?'reserve'
      :asset==='bonds'&&(x.issuer.status==='delayed'||x.issuer.stress>=h.creditStress)?'credit-distress'
      :asset!=='bonds'&&ratio>=(asset==='stocks'?h.stockProfit:h.goldProfit)?'take-profit'
      :asset!=='bonds'&&ratio<=(asset==='stocks'?h.stockLoss:h.goldLoss)?'stop-loss':null
    if(reason){const {basis,net,issuer,...action}=x;return {kind:'sell',...action,researchReason:reason}}
  }
  return null
}
export function tradingStep(s,strategy,c,arm,heuristic){
  const t=boardFor(s)[s.position].type
  const sample=()=>random(hashSeed(`AB-INTENT:${s.seed}:${s.lap}:${s.turn}:${s.phase}:${s.eventId}`))[0]
  if(s.phase==='rebalancing'){
    // Both arms use exactly the same START exit rule. No future price lookup.
    for(const asset of ['stocks','gold','bonds']){const intent=sellIntent(s,asset,strategy,c,heuristic);if(intent)return transact(s,intent)}
    return baseStep(s,strategy,c,sample)
  }
  if(s.phase==='event'&&['stocks','gold','bonds'].includes(t)){
    if(strategy==='novice'){
      // Same hypothetical intent set in both arms; an illegal old-arm sell
      // becomes skip. Does not use an arm-dependent sequential random stream.
      const hypothetical=holdings(s,t).map(x=>({kind:'sell',asset:t,amount:x.amount,lotId:x.lotId,symbolId:x.symbolId,researchReason:'synthetic'}))
      const choices=[...baseChoices(s,c),...hypothetical],intent=choices[Math.floor(sample()*choices.length)]
      if(intent.kind==='skip'||intent.kind==='sell'&&arm==='old')return decide(s,'skip')
      return transact(s,intent)
    }
    const intent=sellIntent(s,t,strategy,c,heuristic)
    if(intent)return arm==='new'?transact(s,intent):decide(s,'skip')
  }
  return baseStep(s,strategy,c,sample)
}
export function playTrading(seed,strategy,c,arm,heuristic,{trace=false}={}){
  let s,base
  if(heuristic==='legacy'){
    const original=legacyPlay(seed,strategy,c,{trace:true});s=original.state;base=original.row
  }else{
    if(!HEURISTICS[heuristic])throw Error('Unknown heuristic')
    s=createGame(seed,c.economy.initialSavings,c.economy.initialTerm,'experimental-b',undefined,'v2.4-customer-preferences','v2.4-atomic-investments','vn-v1','v2.5-credit-risk','v2.6-periodic-start')
    let opportunities=0,decisions=0;const seen=new Set()
    for(let i=0;s.phase!=='finished'&&i<1600;i++){
      const financial=s.phase==='event'&&['stocks','bonds','gold'].includes(s.eventId),choices=baseChoices(s,c).length+(financial&&arm==='new'?holdings(s,s.eventId).length:0),key=`${s.turn}:${s.eventId}`
      if(s.phase==='event'&&!seen.has(key)){seen.add(key);if(choices>1)opportunities++}
      const before=s;s=tradingStep(s,strategy,c,arm,heuristic)
      if(before===s)throw Error('Stalled trading simulation')
      if(before.phase==='event'&&choices>1||before.phase==='funding'&&fundingSources(before).length>1)decisions++
    }
    if(s.phase!=='finished')throw Error(`Deadlock ${seed}/${strategy}/${arm}`)
    auditGame(s,c);base=gameMetrics(s,strategy,c,{meaningfulOpportunities:opportunities,meaningfulDecisions:decisions})
  }
  auditTrading(s,arm)
  const row={...base,arm,heuristic,...tradingMetrics(s,c)}
  return trace?{row,state:s}:row
}
