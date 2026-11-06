import {createMultiCourseGame} from '../../src/game/new-game.ts'
import {advance,roll,decide,transact} from '../../src/game/engine.ts'
import {eventsForGame} from '../../src/data/events.ts'
import {encounter,phaseState} from './universal.ts'
import type {FundingSource} from '../../src/game/types.ts'
/** Natural revealed encounter while both issuers still accept new purchases. */
export function liveBondEncounter(){
 for(let seed=0;seed<100;seed++){
  let s=advance(createMultiCourseGame('draft-bond-'+seed,0))
  for(let step=0;step<150&&s.phase!=='finished'&&s.phase!=='funding';step++){
   if(s.phase==='event'&&s.eventId==='bonds'&&s.bondCredit!.issuers.every(i=>i.status==='performing'))return s
   if(s.phase==='rolling')s=roll(s)
   else if(s.phase==='event'){const e=eventsForGame(s).find(e=>e.id===s.eventId)!;s=decide(s,e.options.find(o=>['skip','acknowledge','full','pay'].includes(o.id))?.id??e.options[0].id)}
   else s=advance(s)
  }
 }
 throw Error('No natural performing bond encounter')
}
export function ownedBusiness(){const s=encounter('business'),b=transact(s,{kind:'buy',asset:'business',amount:20_000_000});return {...s,turn:s.turn+1,portfolio:b.portfolio,business:b.business,businessPurchaseTurn:b.businessPurchaseTurn}}
/** Browser/selector fixture: explicit public holdings transplanted into a natural funding snapshot. */
export function fundingWith(source:FundingSource){
 let s=phaseState('funding')
 if(source==='gold'||source==='stocks'){const base=encounter(source),b=transact(base,{kind:'buy',asset:source,amount:3_000_000,symbolId:source==='stocks'?base.market.stocks[0].id:undefined});s={...s,portfolio:{...s.portfolio,[source]:b.portfolio[source]},stockHoldings:b.stockHoldings,goldUnits:b.goldUnits,goldCostBasis:b.goldCostBasis}}
 if(source==='bonds'){const b=transact(liveBondEncounter(),{kind:'buy',asset:'bonds',issuerId:'an-tam',amount:3_000_000});s={...s,bondLots:b.bondLots,bondCredit:b.bondCredit,portfolio:{...s.portfolio,bonds:b.portfolio.bonds}}}
 if(source==='savings'){const b=transact(encounter('bank'),{kind:'deposit',amount:1_000_000,term:2});s={...s,deposits:b.deposits,portfolio:{...s.portfolio,savings:b.portfolio.savings}}}
 return s
}
