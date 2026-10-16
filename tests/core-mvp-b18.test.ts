import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { advance, decide, roll, transact, fundPayment } from '../src/game/engine.ts'
import { beginSettlement } from '../src/game/settlement.ts'
import { saleQuote } from '../src/game/selectors.ts'
import { createCoreMvpGame } from '../src/game/new-game.ts'
import { boardFor } from '../src/data/board.ts'
import { rulesForGame } from '../src/game/rules-profile.ts'
import { eventsForGame } from '../src/data/events.ts'
import { victory, liquidatableFunds } from '../src/game/selectors.ts'
import { serializeLog } from '../src/game/log.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'
import type { GameState, TradableAsset } from '../src/game/types.ts'

const TYPES=['start','macro','bonds','personal','course','gold','bank','course','business','bonds','stocks','business','course','stocks','business','course','gold','bank']
const event=(s:GameState,type:string):GameState=>({...s,phase:'event',eventId:type,position:boardFor(s).findIndex(t=>t.type===type)})
function finish(seed='B18-COMPLETE'){
  let s=createCoreMvpGame(seed,0)
  for(let i=0;s.phase!=='finished'&&i<400;i++){
    s=s.phase==='rolling'?roll(s):s.phase==='event'?decide(s,eventsForGame(s).find(e=>e.id===s.eventId)!.options.find(o=>['skip','acknowledge'].includes(o.id))?.id??eventsForGame(s).find(e=>e.id===s.eventId)!.options[0].id):advance(s)
  }
  assert.equal(s.phase,'finished');return s
}
test('B18 exact order, 9 types, versions and free initial allocation',()=>{
  const s=createCoreMvpGame('B18',0),r=rulesForGame(s)
  assert.equal(s.boardLayout,'B18');assert.equal(s.totalLaps,4)
  assert.equal(s.gameplayProfile,'core-mvp-b18-v1');assert.equal(s.goalRulesVersion,'single-90m-v1')
  assert.deepEqual(boardFor(s).map(t=>t.type),TYPES);assert.equal(new Set(TYPES).size,9)
  assert.equal(r.courseCost,8e6);assert.equal(r.courseBoost,4e6);assert.equal(r.livingCost,5e6)
  assert.equal(s.portfolio.cash,50e6);assert.equal(s.portfolio.savings,0)
  assert.equal(createCoreMvpGame('B18',50e6,3).portfolio.cash,0)
})
test('four START, 14M salary, 5M living, one course8M/+4M, deterministic replay',()=>{
  let s=event(createCoreMvpGame('COURSE',0),'course');s=decide(s,'upgrade')
  assert.equal(s.portfolio.cash,42e6);assert.equal(s.recurringIncome,18e6)
  assert.throws(()=>decide(event({...s,turn:s.turn+1},'course'),'upgrade'))
  const done=finish()
  assert.equal(done.summaries.length,4);assert.equal(done.lap,4)
  assert.equal(done.log.filter(e=>e.title==='Nhận lương').length,4)
  assert.equal(done.summaries.every(x=>x.lines.some(l=>l.label==='Chi phí sinh hoạt'&&l.amount===-5e6)),true)
  assert.deepEqual(replayGameLog(JSON.parse(serializeLog(done))),done)
})
test('90M boundary only after completed four START; cash need not be90M',()=>{
  const s=finish();s.portfolio.cash=89_999_999
  assert.equal(victory(s).won,false);s.portfolio.cash=90_000_000;assert.equal(victory(s).won,true)
  assert.equal(victory({...s,phase:'rolling',termination:null}).won,false)
  assert.equal(victory({...s,termination:'insolvent'}).won,false)
  assert.equal(victory({...s,summaries:s.summaries.slice(0,3)}).won,false)
  const savings=createCoreMvpGame('PRINCIPAL',20e6,3)
  const funded={...s,portfolio:{...s.portfolio,cash:70e6,savings:20e6},deposits:savings.deposits}
  assert.equal(liquidatableFunds(funded),90e6);assert.equal(victory(funded).won,true)
  assert.equal(liquidatableFunds({...funded,portfolio:{...funded.portfolio,business:100e6}}),90e6)
  assert.equal(liquidatableFunds({...funded,portfolio:{...funded.portfolio,cash:80e6,debt:10e6}}),90e6)
})
for(const asset of ['stocks','bonds','gold'] as TradableAsset[])test(`${asset}: tile buy/sell consume one encounter, failed sale does not, next turn can trade`,()=>{
  let s=event(createCoreMvpGame('TRADE',0),asset)
  s=transact(s,{kind:'buy',asset,amount:10e6,issuerId:asset==='bonds'?'an-tam':undefined})
  assert.equal(s.phase,'rolling')
  assert.throws(()=>transact(event(s,asset),{kind:'sell',asset,amount:1e6,lotId:s.bondLots[0]?.id}))
  s=event({...s,turn:s.turn+1},asset);const original=structuredClone(s),lotId=s.bondLots[0]?.id
  assert.throws(()=>transact(s,{kind:'sell',asset,amount:s.portfolio[asset]+1,lotId}));assert.deepEqual(s,original)
  const market=structuredClone(s.market),sold=transact(s,{kind:'sell',asset,amount:s.portfolio[asset],lotId})
  assert.equal(sold.phase,'rolling');assert.deepEqual(sold.market,market)
  assert.throws(()=>transact(event(sold,asset),{kind:'buy',asset,amount:1e6,issuerId:'an-tam'}))
})
test('D6 wraps the actual18-tile board and START, not20',()=>{
  const s={...createCoreMvpGame('WRAP',0),phase:'rolling' as const,position:17},after=roll(s)
  assert.equal(after.position,(17+after.dice)%18);assert.equal(after.summaries.length,1)
})
test('archived C20 and older logs retain complete state and RNG',()=>{
  for(const p of ['docs/playtests/atomic-investments-v24/historical-multi-purchase.json.gz','docs/playtests/business-v2_3/browser-game-log.json.gz','docs/playtests/bond-credit-v25/simulation-victory.json.gz']){
    const d=JSON.parse(gunzipSync(readFileSync(p)).toString('utf8')),s=replayGameLog(d)
    assert.equal(s.boardLayout,'C20');assert.equal(s.gameplayProfile,undefined)
  }
})
test('course pays4M at the next START and gold net fee/spread is exact',()=>{
  const learned=decide(event(createCoreMvpGame('COURSE-START',0),'course'),'upgrade')
  const settled=beginSettlement(learned)
  assert.equal(settled.summaries[0].incomeTotal,18e6)
  assert.ok(settled.summaries[0].lines.some(l=>l.label==='Tăng lương từ khóa học'&&l.amount===4e6))
  let gold=transact(event(createCoreMvpGame('GOLD-FEE',0),'gold'),{kind:'buy',asset:'gold',amount:10e6})
  gold=event({...gold,turn:2},'gold')
  assert.deepEqual(saleQuote(gold,'gold'),{gross:10e6,spread:300000,fee:97000,net:9603000})
  const sold=transact(gold,{kind:'sell',asset:'gold',amount:10e6})
  assert.equal(sold.portfolio.cash,49603000)
})
test('B18 retains START financial sales, Business tile-only exits and mandatory funding',()=>{
  let s=transact(event(createCoreMvpGame('BIZ-FUND',0),'business'),{kind:'buy',asset:'business',amount:20e6})
  assert.throws(()=>transact({...s,phase:'rebalancing'},{kind:'sell',asset:'business',amount:s.portfolio.business}))
  s=decide({...s,phase:'event',eventId:'medical',position:3,portfolio:{...s.portfolio,cash:0}},'pay')
  assert.equal(s.phase,'funding');assert.throws(()=>fundPayment(s,'business' as never,5e6))
  const borrowed=fundPayment(s,'debt',5e6);assert.equal(borrowed.portfolio.debt,5e6)
  let gold=transact(event(createCoreMvpGame('START-FIN',0),'gold'),{kind:'buy',asset:'gold',amount:10e6})
  gold=transact({...gold,phase:'rebalancing'},{kind:'sell',asset:'gold',amount:5e6})
  assert.equal(gold.phase,'rebalancing');assert.ok(gold.portfolio.gold>0)
})
test('Business, unrealized credit claims and new borrowing cannot create a fake90M win',()=>{
  const s=finish();s.portfolio.cash=89_999_999;s.portfolio.business=100e6
  assert.equal(victory(s).won,false)
  assert.equal(victory({...s,portfolio:{...s.portfolio,cash:s.portfolio.cash+10e6,debt:10e6}}).won,false)
  const credit=transact(event(createCoreMvpGame('CLAIM',0),'bonds'),{kind:'buy',asset:'bonds',issuerId:'an-tam',amount:10e6})
  credit.bondCredit!.issuers[0].status='defaulted';credit.bondCredit!.issuers[0].currentPrice=0
  credit.bondLots[0].credit!.outstandingCoupon=100e6;credit.bondLots[0].credit!.outstandingPrincipal=100e6
  const claim={...s,bondCredit:credit.bondCredit,bondLots:credit.bondLots,portfolio:{...s.portfolio,bonds:10e6}}
  assert.equal(liquidatableFunds(claim),89_999_999);assert.equal(victory(claim).won,false)
})
for(const id of ['medical','repair','family'])test(`B18 personal ${id} retains both payment options`,()=>{
  const base=createCoreMvpGame('PERSONAL',0),eventData=eventsForGame(base).find(e=>e.id===id)!
  assert.equal(eventData.options.length,2)
  for(const option of eventData.options){const next=decide({...base,phase:'event',position:3,eventId:id},option.id);assert.equal(next.portfolio.cash,50e6-(option.cost??0));assert.equal(next.obligations,option.obligation??0);assert.equal(next.rng,base.rng)}
})
