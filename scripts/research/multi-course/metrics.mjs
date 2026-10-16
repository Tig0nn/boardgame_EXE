import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {auditGame,gameMetrics} from '../core-mvp/metrics.mjs'
import {auditTrading,tradingMetrics} from '../trading-ab/metrics.mjs'
import {costDrawdowns} from '../risk-allocation/metrics.mjs'
import {courseMetrics} from './courses.mjs'
import {eventsForGame} from '../../../src/data/events.ts'
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,20)
export function audit(s,c){
  auditGame(s,c);auditTrading(s,'new')
  const purchases=courseMetrics(s,c).coursePurchases,turns=new Set(),ids=new Set()
  for(const p of purchases){assert.ok(!turns.has(p.turn));turns.add(p.turn);assert.ok(!ids.has(p.id));ids.add(p.id);assert.ok(p.cashAfter>=0)}
  assert.equal(s.recurringIncome,14e6+purchases.reduce((n,p)=>n+p.boost,0))
  const salary=s.log.filter(e=>e.kind==='schedule'&&e.title==='Nhận lương').reduce((n,e)=>n+e.cashDelta,0)
  assert.equal(salary,s.log.filter(e=>e.kind==='schedule'&&e.title==='Nhận lương').length*14e6+purchases.reduce((n,p)=>n+p.revenue,0),'Course salary reconciliation')
}
export function metrics(s,c){
  const base=gameMetrics(s,'unused',c,{}),trading=tradingMetrics(s,c),course=courseMetrics(s,c)
  const personal=s.log.filter(e=>e.kind==='decision'&&['medical','repair','family'].includes(e.eventId))
  let personalCost=0,personalPremium=0,personalShortfalls=0
  for(const e of personal){
    const options=eventsForGame(s).find(x=>x.id===e.eventId).options,chosen=options.find(x=>x.id===e.decisionId)
    const cost=(chosen.cost??0)+(chosen.obligation??0),cheapest=Math.min(...options.map(x=>(x.cost??0)+(x.obligation??0)))
    personalCost+=cost;personalPremium+=cost-cheapest;personalShortfalls+=Number(e.before.portfolio.cash<(options[0].cost??0))
  }
  const funding=s.log.filter(e=>e.kind==='funding'),actions=s.log.filter(e=>e.action),salary=s.log.filter(e=>e.kind==='schedule'&&e.title==='Nhận lương')
  return {...base,...course,...costDrawdowns(s.log,50e6),personalEncounters:personal.length,personalCost,personalPremium,personalShortfalls,
    fundingCount:funding.length,withdrawals:funding.filter(e=>e.forcedWithdrawalAmount>0).length,lostInterest:funding.reduce((n,e)=>n+e.lostSavingsInterest,0),
    fundingSales:funding.filter(e=>e.forcedAssetSaleAmount>0).length,borrowAmount:funding.reduce((n,e)=>n+Math.max(0,e.debtDelta),0),
    fees:trading.feesPaid,spread:trading.spreadPaid,assetBuys:trading.buys,assetSells:trading.sells,tileSells:trading.tileSells,
    assets:trading.assets,investmentSpend:actions.filter(e=>['buy','deposit','upgrade'].includes(e.action.kind)).reduce((n,e)=>n+e.action.amount,0),
    savingsDeposits:actions.filter(e=>e.action.kind==='deposit').length,savingsSpend:actions.filter(e=>e.action.kind==='deposit').reduce((n,e)=>n+e.action.amount,0),
    businessCapitalSpend:actions.filter(e=>e.action.asset==='business'&&['buy','upgrade'].includes(e.action.kind)).reduce((n,e)=>n+e.action.amount,0),
    salaryReceived:salary.reduce((n,e)=>n+e.cashDelta,0),finalRng:s.rng,marketHash:digest(s.market),creditHash:digest(s.bondCredit)}
}
