// Bounded scenario discovery for a missing UI branch, not a balance study.
// Every transition uses legal engine commands. The selected seed must then be
// played independently through Preview UI; this output is never a browser save.
import {createMultiCourseGame} from '../../src/game/new-game.ts'
import {advance,roll,decide,transact,fundPayment,fundingSources} from '../../src/game/engine.ts'
import {eventsForGame} from '../../src/data/events.ts'
import {creditBondLots} from '../../src/game/bond-credit.ts'
import {writeFileSync} from 'node:fs'
for(let n=0;n<12;n++){
 let s=createMultiCourseGame(`RELEASE-ASSET-FUND-${n}`,0,3),found=false
 for(let step=0;step<200&&s.phase!=='finished';step++){
  if(s.phase==='rolling')s=roll(s)
  else if(s.phase==='forecast'||s.phase==='summary'||s.phase==='rebalancing')s=advance(s)
  else if(s.phase==='funding'){
   const source=fundingSources(s).find(a=>['stocks','gold','bonds'].includes(a))??fundingSources(s)[0]
   if(source==='stocks'||source==='gold'){s=fundPayment(s,source,s.portfolio[source]);found=true}
   else if(source==='bonds'){const item=creditBondLots(s).find(x=>x.quote.executable)!;s=fundPayment(s,source,item.quote.gross,item.lot.id);found=true}
   else if(source==='debt')s=fundPayment(s,source,s.pendingPayment!.remaining)
   else s=fundPayment(s,source,s.deposits.find(l=>l.status==='active')!.principal)
  }else{
   const event=eventsForGame(s).find(e=>e.id===s.eventId)!
   if(['stocks','bonds','gold'].includes(s.eventId!)&&s.portfolio.cash>=1e6)s=transact(s,{kind:'buy',asset:s.eventId as 'stocks'|'bonds'|'gold',amount:s.portfolio.cash,symbolId:s.market.stocks[0].id,issuerId:'an-tam',completeEncounter:true})
   else s=decide(s,(['medical','repair','family'].includes(event.id)?event.options.find(o=>(o.cost??0)>0)?.id:undefined)??event.options.find(o=>o.id==='skip')?.id??event.options[0].id)
  }
 }
 if(found){const result={seed:s.seed,candidatesChecked:n+1,legalEngineOnly:true,notUiEvidence:true,policy:'Skip courses/business/bank; buy each available financial asset using all cash; pay personal immediately; use available assets in funding.',funding:s.log.filter(e=>e.kind==='funding').map(e=>({turn:e.turn,decision:e.decisionId}))};writeFileSync('docs/playtests/b18-release-qa/funding-scenario-plan.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));break}
}
