import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { liquidatableFunds, totalWorth, victory } from '../../../src/game/selectors.ts'
import { boardFor } from '../../../src/data/board.ts'

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,20)
export function auditGame(s,c){
  const board=boardFor(s),counts=new Map()
  let cash=s.log[0].before.portfolio.cash
  for(const e of s.log){
    assert.ok(e.before.portfolio.cash>=0&&e.after.portfolio.cash>=0,'Negative cash')
    assert.equal(e.cashDelta,e.after.portfolio.cash-e.before.portfolio.cash,'Cash delta')
    cash+=e.cashDelta
    const action=e.action
    if(action&&['buy','upgrade','deposit'].includes(action.kind)){
      assert.equal(e.before.phase,'event','Encounter-only purchase')
      assert.equal(board[e.before.position].type,action.kind==='deposit'?'bank':action.asset,'Wrong tile')
      const key=`${e.turn}:${action.kind}`;assert.ok(!counts.has(key),'Repeated encounter action');counts.set(key,true)
    }
    if(action?.asset==='business'&&action.kind==='sell')assert.equal(board[e.before.position].type,'business','Business sold away from tile')
  }
  assert.equal(cash,s.portfolio.cash,'Cash log reconciliation')
  assert.equal(new Set(s.market.normalLaps).size,s.market.normalLaps.length,'Repeated market settlement')
  assert.equal(new Set(s.summaries.map(x=>x.lap)).size,s.summaries.length,'Repeated START')
  if(s.termination==='completed')assert.equal(s.summaries.length,c.economy.rules.laps,'Missing START')
  for(const lot of s.bondLots){const x=lot.credit;if(!x)continue
    assert.ok(Math.abs(x.originalFace-x.principalPaid-x.principalLost-x.soldPrincipal-lot.principal)<=2,'Bond principal conservation')
    assert.equal(new Set(x.history.map(h=>h.lap)).size,x.history.length,'Duplicate coupon')
    assert.ok(x.outstandingCoupon>=0&&x.outstandingPrincipal>=0&&lot.principal>=0,'Negative credit claim')
  }
}
export function gameMetrics(s,policy,c,decisions){
  const entries=s.log,encounters=entries.filter(e=>e.kind==='encounter'),rolls=entries.filter(e=>e.kind==='roll'),funding=entries.filter(e=>e.kind==='funding')
  const board=boardFor(s),coverage=Object.fromEntries(['bank','stocks','course','macro','bonds','personal','business','gold'].map(t=>[t,encounters.filter(e=>board[e.tileId].type===t).length]))
  const creditLoss=s.bondLots.reduce((n,l)=>n+(l.credit?.principalLost??0)+(l.credit?.couponLost??0),0)
  const creditCoupon=s.bondLots.reduce((n,l)=>n+(l.credit?.history.reduce((a,h)=>a+h.couponPaid,0)??0),0)
  const savingsInterest=s.deposits.reduce((n,l)=>n+l.earnedInterest,0)
  const incomeReceived=entries.filter(e=>e.kind==='schedule'&&['Nhận lương','Dòng tiền kinh doanh'].includes(e.title)).reduce((n,e)=>n+Math.max(0,e.cashDelta),0)
  const lockedBond=s.bondLots.filter(l=>l.status==='active'&&l.credit?.paymentStatus==='defaulted').reduce((n,l)=>n+l.principal,0)
  const lockedBusiness=s.business.capital>0?s.portfolio.business:0
  const proceeds=liquidatableFunds(s),goal=c.goal.amount+c.goal.reserve
  let peak=c.economy.rules.startingCapital,drawdown=0
  for(const e of entries){const worth=totalWorth(e.after);peak=Math.max(peak,worth);drawdown=Math.max(drawdown,peak-worth)}
  const actions=entries.filter(e=>e.action),businessBuy=actions.find(e=>e.action.kind==='buy'&&e.action.asset==='business')
  const afterBuy=businessBuy?encounters.filter(e=>board[e.tileId].type==='business'&&e.turn>businessBuy.turn):[]
  return {seed:s.seed,policy,won:victory(s).won,insolvent:s.termination==='insolvent',proceeds,cash:s.portfolio.cash,debt:s.portfolio.debt,shortfall:Math.max(0,goal-proceeds),
    funded:funding.length>0,borrowed:funding.some(e=>e.decisionId==='fund-debt'),maxFundingShortfall:Math.max(0,...entries.map(e=>e.after.pendingCost)),
    locked:lockedBusiness+lockedBond>0,lockedBusiness,lockedBond,capitalLoss:proceeds<c.economy.rules.startingCapital,drawdown,
    rolls:rolls.length,encounters:encounters.length,...decisions,
    modalsProxy:encounters.length+s.summaries.length*2+s.totalLaps+funding.length,
    incomeReceived,savingsInterest,totalIncome:incomeReceived+savingsInterest+creditCoupon,
    courseBought:s.coursePurchased,businessBought:!!businessBuy,businessUpgraded:actions.some(e=>e.action.kind==='upgrade'),businessSold:actions.some(e=>e.action.kind==='sell'&&e.action.asset==='business'),
    anyInvestment:actions.some(e=>['buy','deposit'].includes(e.action.kind)),missedBusinessExit:businessBuy&&afterBuy.length===0?1:0,
    creditLoss,creditCoupon,coverage,diceHash:digest(rolls.map(e=>e.after.dice)),encounterHash:digest(encounters.map(e=>[e.turn,e.tileId,e.eventId]))}
}
