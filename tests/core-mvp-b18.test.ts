import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { advance, decide, roll, transact } from '../src/game/engine.ts'
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
