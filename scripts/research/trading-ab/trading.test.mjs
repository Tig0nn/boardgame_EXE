import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import { cleanupAdapter } from '../core-mvp/adapter.mjs'
import { createTradingAdapter } from './adapter.mjs'

const config=JSON.parse(readFileSync('docs/research/core-mvp/frozen-configs.json','utf8')).configs.find(c=>c.id==='interaction-learning-liquidity')
async function fixture(arm,run){
  const dir=createTradingAdapter(config,arm)
  try{
    const engine=await import(pathToFileURL(join(dir,'src/game/engine.ts')))
    const {boardFor}=await import(pathToFileURL(join(dir,'src/data/board.ts')))
    const {replayResearch}=await import(pathToFileURL(join(dir,'scripts/research/core-mvp/replay.mjs')))
    const {playTrading}=await import(pathToFileURL(join(dir,'scripts/research/trading-ab/policy.mjs')))
    const event=(s,type)=>({...s,phase:'event',position:boardFor(s).findIndex(t=>t.type===type),eventId:type})
    await run({engine,event,replayResearch,playTrading})
  }finally{cleanupAdapter(dir)}
}
for(const asset of ['stocks','gold','bonds']){
  test(`${asset}: new arm can sell at its own tile, consumes visit, rejects reopened second trade`,()=>fixture('new',({engine:e,event})=>{
    let s=event(e.createGame('SELL-FIXTURE',0,3,'experimental-b',undefined,'v2.4-customer-preferences','v2.4-atomic-investments','vn-v1','v2.5-credit-risk','v2.6-periodic-start'),asset)
    s=e.transact(s,{kind:'buy',asset,amount:10e6,issuerId:asset==='bonds'?'an-tam':undefined})
    s=event({...s,turn:s.turn+1},asset)
    const before=s,lotId=s.bondLots[0]?.id
    const sold=e.transact(s,{kind:'sell',asset,amount:s.portfolio[asset],lotId})
    assert.equal(sold.phase,'rolling');assert.equal(sold.eventId,null);assert.ok(sold.portfolio.cash>before.portfolio.cash)
    assert.throws(()=>e.transact(event(sold,asset),{kind:'buy',asset,amount:1e6,issuerId:'an-tam'}),/giao dịch|lần|quyền/i)
    assert.deepEqual(s,before)
  }))
}
test('failed trade leaves the visit and state intact; wrong-asset sales remain forbidden',()=>fixture('new',({engine:e,event})=>{
  let s=event(e.createGame('FAIL-FIXTURE',0,3,'experimental-b',undefined,'v2.4-customer-preferences','v2.4-atomic-investments','vn-v1','v2.5-credit-risk','v2.6-periodic-start'),'gold')
  s=e.transact(s,{kind:'buy',asset:'gold',amount:10e6});s=event({...s,turn:s.turn+1},'gold')
  const before=structuredClone(s)
  assert.throws(()=>e.transact(s,{kind:'sell',asset:'gold',amount:s.portfolio.gold+1}))
  assert.deepEqual(s,before)
  assert.throws(()=>e.transact(event(s,'stocks'),{kind:'sell',asset:'gold',amount:s.portfolio.gold}))
  assert.equal(e.transact(s,{kind:'sell',asset:'gold',amount:s.portfolio.gold}).phase,'rolling')
}))
test('old arm rejects tile sale; both arms retain financial selling at START',async()=>{
  for(const arm of ['old','new'])await fixture(arm,({engine:e,event})=>{
    let s=event(e.createGame('START-FIXTURE',0,3,'experimental-b',undefined,'v2.4-customer-preferences','v2.4-atomic-investments','vn-v1','v2.5-credit-risk','v2.6-periodic-start'),'gold')
    s=e.transact(s,{kind:'buy',asset:'gold',amount:10e6})
    if(arm==='old')assert.throws(()=>e.transact(event({...s,turn:s.turn+1},'gold'),{kind:'sell',asset:'gold',amount:s.portfolio.gold}))
    assert.ok(e.transact({...s,phase:'rebalancing'},{kind:'sell',asset:'gold',amount:s.portfolio.gold}).portfolio.cash>s.portfolio.cash)
  })
})
test('new rules never allow buy after a successful buy, even after tile/symbol reopening',()=>fixture('new',({engine:e,event})=>{
  let s=event(e.createGame('BUY-FIXTURE',0,3,'experimental-b',undefined,'v2.4-customer-preferences','v2.4-atomic-investments','vn-v1','v2.5-credit-risk','v2.6-periodic-start'),'stocks')
  s=e.transact(s,{kind:'buy',asset:'stocks',amount:1e6})
  assert.throws(()=>e.transact(event(s,'gold'),{kind:'buy',asset:'gold',amount:1e6}))
}))
test('partial sale consumes visit; failed bond lot sale does not; defaulted bonds cannot be sold',()=>fixture('new',({engine:e,event})=>{
  let s=event(e.createGame('PARTIAL-FIXTURE',0,3,'experimental-b',undefined,'v2.4-customer-preferences','v2.4-atomic-investments','vn-v1','v2.5-credit-risk','v2.6-periodic-start'),'bonds')
  s=e.transact(s,{kind:'buy',asset:'bonds',amount:10e6,issuerId:'an-tam'});s=event({...s,turn:s.turn+1},'bonds')
  assert.throws(()=>e.transact(s,{kind:'sell',asset:'bonds',amount:1e6,lotId:'wrong-lot'}))
  const sold=e.transact(s,{kind:'sell',asset:'bonds',amount:5e6,lotId:s.bondLots[0].id})
  assert.ok(sold.portfolio.bonds>0)
  assert.throws(()=>e.transact(event(sold,'bonds'),{kind:'sell',asset:'bonds',amount:1e6,lotId:s.bondLots[0].id}))
  const defaulted=structuredClone(s);defaulted.bondCredit.issuers[0].status='defaulted';defaulted.bondCredit.issuers[0].currentPrice=0
  const before=structuredClone(defaulted)
  assert.throws(()=>e.transact(defaulted,{kind:'sell',asset:'bonds',amount:1e6,lotId:s.bondLots[0].id}))
  assert.deepEqual(defaulted,before)
}))
test('new/old policies produce replayable complete research games',async()=>{
  for(const arm of ['old','new'])await fixture(arm,({playTrading,replayResearch})=>{
    for(const p of ['cash','savings','stocks','gold','bond-a','bond-b','business','diversified','liquidity','novice']){
      const x=playTrading('AB-REPLAY-0',p,config,arm,'disciplined',{trace:true})
      replayResearch(x.state,config)
      assert.equal(x.row.buys+x.row.sells,x.row.successfulFinancialTrades)
    }
  })
})
