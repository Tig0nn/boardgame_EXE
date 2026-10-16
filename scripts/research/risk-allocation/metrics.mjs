import { totalWorth } from '../../../src/game/selectors.ts'
import { EVENTS } from '../../../src/data/events.ts'
import { createHash } from 'node:crypto'

const PERSONAL=['medical','repair','family'],ASSETS=['stocks','bonds','gold']
export function costDrawdowns(entries,initial){
  let rawPeak=initial,adjustedPeak=initial,rawDrawdown=0,livingAdjustedDrawdown=0,livingIncurred=0
  for(const e of entries){
    // Liability recognition occurs at the schedule, not again when funded.
    if(e.kind==='schedule'&&e.title==='Chi phí sinh hoạt')livingIncurred+=totalWorth(e.before)-totalWorth(e.after)
    const raw=totalWorth(e.after),adjusted=raw+livingIncurred
    rawPeak=Math.max(rawPeak,raw);adjustedPeak=Math.max(adjustedPeak,adjusted)
    rawDrawdown=Math.max(rawDrawdown,rawPeak-raw);livingAdjustedDrawdown=Math.max(livingAdjustedDrawdown,adjustedPeak-adjusted)
  }
  return {rawDrawdown,livingAdjustedDrawdown,livingIncurred}
}
export function learningMetrics(s,c,observations){
  const entries=s.log,encounters=entries.filter(e=>e.kind==='encounter'),funding=entries.filter(e=>e.kind==='funding')
  const byType=t=>encounters.filter(e=>c.board.tiles[e.tileId]===t)
  const personal=byType('personal'),personalChoices=entries.filter(e=>e.kind==='decision'&&PERSONAL.includes(e.eventId))
  let personalCommittedCost=0,personalDeferralPremium=0,personalImmediateShortfalls=0,personalDeferred=0
  for(const e of personalChoices){
    const options=EVENTS.find(x=>x.id===e.eventId).options,choice=options.find(x=>x.id===e.decisionId)
    const cost=(choice.cost??0)+(choice.obligation??0),cheapest=options.toSorted((a,b)=>(a.cost??0)+(a.obligation??0)-(b.cost??0)-(b.obligation??0))[0]
    personalCommittedCost+=cost;personalDeferralPremium+=cost-(cheapest.cost??0)-(cheapest.obligation??0)
    personalImmediateShortfalls+=Number(e.before.portfolio.cash<(cheapest.cost??0));personalDeferred+=Number((choice.obligation??0)>0)
  }
  const financialAccess={},ownedSaleOpportunity={},accessThenSale={},macroOwned={}
  for(const asset of [...ASSETS,'business','bank']){
    const access=observations.find(o=>o.phase==='event'&&o.type===asset&&o.canBuy)
    financialAccess[asset]=!!access
    accessThenSale[asset]=!!access&&observations.some(o=>o.order>access.order&&(asset==='business'?o.phase==='event'&&o.type==='business':asset==='bank'?o.phase==='rebalancing':o.phase==='rebalancing'||o.phase==='event'&&o.type===asset))
    ownedSaleOpportunity[asset]=asset==='bank'?entries.some(e=>e.before.deposits?.some(l=>l.status==='active'&&e.after.deposits.some(a=>a.id===l.id&&['matured','withdrawn'].includes(a.status)))):observations.some(o=>o.canSell?.includes(asset))
    macroOwned[asset]=entries.filter(e=>e.kind==='market'&&e.eventId&&(asset==='bank'?e.before.deposits.some(l=>l.status==='active'):e.before.portfolio[asset]>0)).length
  }
  const meaningful=observations.filter(o=>o.choices>1),events=meaningful.filter(o=>o.phase==='event'),starts=meaningful.filter(o=>o.phase==='rebalancing'),funds=meaningful.filter(o=>o.phase==='funding')
  const businessAccess=observations.find(o=>o.phase==='event'&&o.type==='business'&&o.canBuy)
  const futureBusiness=businessAccess?byType('business').filter(e=>e.turn>businessAccess.turn):[]
  const rolls=observations.filter(o=>o.phase==='rolling'),locked=rolls.map(o=>o.locked)
  return {personalEncounters:personal.length,personal0:personal.length===0,personal1:personal.length===1,personal2plus:personal.length>=2,
    courseRepeatVisits:byType('course').filter(e=>e.before.coursePurchased).length,
    courseRepeatByPosition:Object.fromEntries(c.board.tiles.flatMap((t,i)=>t==='course'?[[i,byType('course').filter(e=>e.tileId===i&&e.before.coursePurchased).length]]:[])),
    financialAccess,accessThenSale,ownedSaleOpportunity,macroOwned,
    macroWhileInvested:entries.some(e=>e.kind==='market'&&e.eventId&&[...ASSETS,'business'].some(a=>e.before.portfolio[a]>0)),
    decisionSteps:meaningful.length,decisionEncounters:new Set(events.map(o=>o.turn)).size,
    startDecisionCheckpoints:new Set(starts.map(o=>o.lap)).size,fundingDecisionSteps:funds.length,
    businessOpenOpportunity:!!businessAccess,businessOpenUpgradeExitPath:futureBusiness.length>=2,
    businessUpgradeOpportunity:observations.some(o=>o.type==='business'&&o.canUpgrade),
    mandatoryCashShortfalls:entries.filter(e=>e.before.pendingCost===0&&e.after.pendingCost>0).length,
    earlySavingsWithdrawals:funding.filter(e=>e.forcedWithdrawalAmount>0).length,
    earlyWithdrawalPrincipal:funding.reduce((n,e)=>n+e.forcedWithdrawalAmount,0),
    lostSavingsInterest:funding.reduce((n,e)=>n+e.lostSavingsInterest,0),
    fundingSaleAmount:funding.reduce((n,e)=>n+e.forcedAssetSaleAmount,0),
    borrowedPrincipal:funding.filter(e=>e.decisionId==='fund-debt').reduce((n,e)=>n+e.cashProceeds,0),
    personalCommittedCost,personalDeferralPremium,personalImmediateShortfalls,personalDeferred,
    personalFundingSteps:funding.filter(e=>PERSONAL.includes(e.eventId)).length,
    lockedCapitalDuringRollMean:locked.length?locked.reduce((a,b)=>a+b,0)/locked.length:0,
    lockedSavingsFinal:(s.deposits??[]).filter(l=>l.status==='active').reduce((n,l)=>n+l.principal,0),
    rngPathHash:createHash('sha256').update(JSON.stringify(entries.filter(e=>['roll','market','encounter'].includes(e.kind)).map(e=>[e.kind,e.turn,e.before.rng,e.after.rng]))).digest('hex'),
    ...costDrawdowns(entries,c.economy.rules.startingCapital)}
}
