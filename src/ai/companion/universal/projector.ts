import {boardFor} from '../../../data/board.ts'
import {eventsForGame} from '../../../data/events.ts'
import {ECONOMY, MACRO_EVENTS} from '../../../data/config.ts'
import {BOND_ISSUERS} from '../../../data/bond-issuers.ts'
import {canChoose} from '../../../game/engine.ts'
import {totalWorth, liquidatableFunds, goalProgress, saleQuote, lostInterestOnWithdrawal, businessOverview} from '../../../game/selectors.ts'
import {businessUpgradeUnlocked} from '../../../game/business.ts'
import {hasBondCredit, creditBondLots} from '../../../game/bond-credit.ts'
import {courseChoices, validateCourseState} from '../../../game/courses.ts'
import {rulesForGame} from '../../../game/rules-profile.ts'
import {savingsProfileForGame} from '../../../game/savings.ts'
import {fundingSources, borrowingAvailable} from '../../../game/transactions.ts'
import {encounterActionUsed, investmentTradeUsed, tileTradingEnabled} from '../../../game/encounters.ts'
import {GAMEPLAY_CONTEXT} from './types.ts'
import type {GameplayContext, GameplayDomain, GameplayIdentity} from './types.ts'
import type {GameState, TradableAsset} from '../../../game/types.ts'
import {parseGameplayContext} from './contract.ts'

/** Allowlist projection. Never serializes a state, a market object, a log entry or a random generator. */
export function projectGameplayContext(s:GameState, identity:GameplayIdentity):GameplayContext {
 if(!['core-mvp-b18-v1','core-mvp-b18-multi-course-v1'].includes(s.gameplayProfile??'')||s.phase==='finished')throw Error('Unsupported B18 context')
 if(s.bondRulesVersion!=='v2.5-credit-risk'||s.businessRulesVersion!=='v2.4-customer-preferences'||s.encounterRulesVersion!=='b18-tile-trading-v1'||s.market.catalogVersion!=='vn-v1'||s.savingsProfile?.id!=='v2.2-c20'||s.savingsProfile.rates[1]!==.04||s.savingsProfile.rates[2]!==.05||s.savingsProfile.rates[3]!==.06)throw Error('Unsupported B18 rules')
 const board=boardFor(s);validateCourseState(s)
 if(board.length!==18||!board[s.position])throw Error('Invalid board')
 let domain:GameplayDomain
 if(s.phase==='event') {
  const tile=board[s.position].type,id=s.eventId
  if(['bank','stocks','bonds','gold','business','course'].includes(tile)&&id===tile)domain=tile as GameplayDomain
  else if(tile==='personal'&&['repair','medical','family'].includes(id??''))domain='personal'
  else if(tile==='macro'&&MACRO_EVENTS.some(e=>e.id===id))domain='macro'
  else throw Error('Event does not match revealed tile')
 }else domain=({rolling:'overview',forecast:'forecast',funding:'funding',summary:'summary',rebalancing:'rebalancing'} as const)[s.phase]
 const c:GameplayContext={version:GAMEPLAY_CONTEXT,profile:s.gameplayProfile!,...identity,domain,phase:s.phase,eventId:s.eventId,
  lap:s.lap,totalLaps:s.totalLaps,turn:s.turn,facts:[],actions:[],resources:[],entries:[]}
 const add=(code:string,value:number,subject='overall')=>{c.facts.push({code,subject,value})}
 add('cash',s.portfolio.cash);add('debt',s.portfolio.debt);add('obligations',s.obligations)
 add('worth',totalWorth(s));add('liquid',liquidatableFunds(s));add('target',goalProgress(s).target)
 add('salary',s.recurringIncome);add('living',rulesForGame(s).livingCost)
 const sell=(asset:TradableAsset)=>{
  if(asset==='bonds'&&hasBondCredit(s)) {
   creditBondLots(s).forEach(({lot,quote},i)=>{
    const subject=`lot-${i+1}`
    add('outstanding',lot.credit!.outstandingCoupon+lot.credit!.outstandingPrincipal,subject)
    add('loss',lot.credit!.principalLost+lot.credit!.couponLost,subject)
    if(quote.executable)for(const code of ['gross','fee','spread','net'] as const)add(code,quote[code],subject)
   })
  } else if(s.portfolio[asset]>0) {
   const quote=saleQuote(s,asset)
   for(const code of ['gross','fee','spread','net'] as const)add(code,quote[code],asset)
  }
 }
 if(domain==='bank') {
  const rates=savingsProfileForGame(s).rates
  for(const term of [1,2,3] as const)add('rate',Math.round(rates[term]*10000),`term-${term}`)
  s.deposits.filter(l=>l.status==='active').forEach((l,i)=>{
   const subject=`lot-${i+1}`;add('principal',l.principal,subject);add('maturity',l.maturityLap,subject)
   add('interest',Math.round(l.principal*l.rate*(l.maturityLap-l.startLap+1)),subject);add('lost',lostInterestOnWithdrawal(s,l.id),subject)
  })
  if(!encounterActionUsed(s,'deposit')&&s.portfolio.cash>0)c.actions.push('deposit')
 }
 if(['stocks','bonds','gold'].includes(domain)) {
  const asset=domain as TradableAsset
  add('holding',s.portfolio[asset],asset);sell(asset)
  if(asset==='stocks')for(const stock of s.market.stocks)add('price',stock.currentPrice,stock.id)
  if(asset==='gold')add('price',s.market.gold.currentPrice,'gold')
  if(asset==='bonds') {
   if(hasBondCredit(s))for(const issuer of BOND_ISSUERS) {
    const current=s.bondCredit!.issuers.find(x=>x.id===issuer.id)!
    add('creditState',['performing','delayed','defaulted','resolved'].indexOf(current.status),issuer.id);add('price',current.currentPrice,issuer.id);add('coupon',Math.round(issuer.coupon*10000),issuer.id)
   } else {add('price',s.market.bond.currentPrice,'bonds');add('coupon',Math.round(ECONOMY.bond.coupon*10000),'bonds')}
  }
  if(!investmentTradeUsed(s)) {
   if(s.portfolio.cash>0&&(asset!=='bonds'||!hasBondCredit(s)||s.bondCredit!.issuers.some(i=>i.status==='performing'&&i.currentPrice>0)))c.actions.push('buy')
   if(tileTradingEnabled(s)&&c.facts.some(f=>f.code==='net'&&f.value>0))c.actions.push('sell')
  }
 }
 if(domain==='business') {
  const b=businessOverview(s)
  add('businessIncome',b.income);add('capital',b.locked);add('recovery',b.sale);add('purchaseCost',ECONOMY.business.cost)
  add('upgradeCost',ECONOMY.business.upgradeCost);add('incremental',b.incrementalIncome)
  if(s.business.capital===0&&s.portfolio.cash>=ECONOMY.business.cost)c.actions.push('buy')
  if(businessUpgradeUnlocked(s)&&!encounterActionUsed(s,'upgrade')&&b.levels<ECONOMY.business.maxUpgrades&&s.portfolio.cash>=ECONOMY.business.upgradeCost)c.actions.push('upgrade')
  if(s.business.capital>0&&s.businessPurchaseTurn!==s.turn)c.actions.push('sell')
 }
 if(domain==='course') {
  if(s.gameplayProfile==='core-mvp-b18-multi-course-v1')for(const course of courseChoices(s)) {
   add('owned',course.owned?1:0,course.id);add('courseCost',course.cost,course.id);add('courseBoost',course.boost,course.id)
   add('courseNominal',course.nominalIncome,course.id);add('courseNet',course.netAfterFee,course.id)
   if(course.canBuy)c.actions.push(`course-${course.id}`)
  } else {add('owned',s.coursePurchased?1:0,'upgrade');const r=rulesForGame(s);add('courseCost',r.courseCost!,'upgrade');add('courseBoost',r.courseBoost!,'upgrade')}
 }
 if(domain==='personal') {
  for(const option of eventsForGame(s).find(e=>e.id===s.eventId)!.options) {
   const now=option.cost??0,later=option.obligation??0
   add('immediate',now,option.id);add('future',later,option.id);add('total',now+later,option.id)
   if(s.portfolio.cash>=now)add('after',s.portfolio.cash-now,option.id)
   else add('shortfall',now-s.portfolio.cash,option.id)
  }
 }
 if(domain==='macro') {
  const key=`${s.turn}:${s.eventId}`
  const entry=s.log.findLast(e=>e.kind==='market'&&e.eventId===s.eventId&&e.turn===s.turn&&e.lap===s.lap
   &&e.before?.position===s.position&&e.after?.position===s.position
   &&!e.before.market.appliedShocks.includes(key)&&e.after.market.appliedShocks.includes(key))
  add('observed',entry?1:0)
  if(entry) {
   const observe=(subject:string,before:number,after:number)=>{add('beforePrice',before,subject);add('price',after,subject);add('change',after-before,subject)}
   for(const stock of entry.after.market.stocks) {
    const old=entry.before.market.stocks.find(x=>x.id===stock.id)
    if(old)observe(stock.id,old.currentPrice,stock.currentPrice)
   }
   observe('gold',entry.before.market.gold.currentPrice,entry.after.market.gold.currentPrice)
   if(hasBondCredit(s))for(const issuer of entry.after.bondCredit!.issuers) {
    const old=entry.before.bondCredit!.issuers.find(x=>x.id===issuer.id)
    if(old)observe(issuer.id,old.currentPrice,issuer.currentPrice)
   }
  }
 }
 if(['personal','funding'].includes(domain)) {
  c.resources=fundingSources(s)
  add('headroom',borrowingAvailable(s))
  s.deposits.filter(l=>l.status==='active').forEach((lot,i)=>{add('principal',lot.principal,`lot-${i+1}`);add('lost',lostInterestOnWithdrawal(s,lot.id),`lot-${i+1}`)})
  for(const asset of ['stocks','bonds','gold'] as const)if(c.resources.includes(asset))sell(asset)
 }
 if(domain==='funding') {
  if(!s.pendingPayment||s.pendingPayment.remaining<=0)throw Error('Missing payment')
  add('paymentTotal',s.pendingPayment.total);add('remaining',s.pendingPayment.remaining)
  c.actions=c.resources.map(source=>`fund-${source}`)
  // Lines are obligations/receipts posted so far, not necessarily cash already paid while paused.
  c.entries=(s.settlement?.lines??[]).map(({label,amount})=>({label,amount}))
 }
 if(domain==='summary') {
  const summary=s.summaries.at(-1)
  if(!summary||summary.lap!==s.lap)throw Error('Missing completed START')
  add('received',summary.incomeTotal);add('debtPaid',summary.debtPrincipalPaid)
  c.entries=summary.lines.map(({label,amount})=>({label,amount}));c.actions=['continue']
 }
 if(domain==='rebalancing') {
  for(const asset of ['stocks','bonds','gold'] as const)sell(asset)
  c.actions=['continue'];if(c.facts.some(f=>f.code==='net'&&f.value>0))c.actions.push('sell')
  const rate=s.lap===s.totalLaps?0:rulesForGame(s).debtRate
  if(s.portfolio.debt>0&&Math.floor(s.portfolio.cash/(1+rate))>0)c.actions.push('repay')
 }
 if(domain==='forecast')c.actions=['continue']
 if(s.phase==='event')for(const option of eventsForGame(s).find(e=>e.id===s.eventId)!.options)if(canChoose(s,option.id)&&!c.actions.includes(option.id))c.actions.push(option.id)
 return parseGameplayContext(c)
}
export function gameplayContextReady(context:GameplayContext):boolean {
 return context.domain!=='macro'||context.facts.some(f=>f.code==='observed'&&f.value===1)
}
export function gameplayEligible(s:GameState):boolean {try{return gameplayContextReady(projectGameplayContext(s,{sessionEpoch:'eligibility',revision:0}))}catch{return false}}
// No transition or action dispatcher is exposed through this projection.
