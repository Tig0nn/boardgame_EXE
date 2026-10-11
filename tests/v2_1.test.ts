import test from 'node:test'
import assert from 'node:assert/strict'
import { advance, roll, decide, canChoose, transact, fundPayment } from '../src/game/engine.ts'
import { createV23Game as createGame } from './helpers/v2_3.ts'
import { fundingSources, borrowingAvailable } from '../src/game/transactions.ts'
import { serializeLog } from '../src/game/log.ts'
import { boardFor } from '../src/data/board.ts'
import { GAME_MODES } from '../src/data/modes.ts'
import { RULES, ECONOMY } from '../src/data/config.ts'
import type { GameState, GameModeId } from '../src/game/types.ts'
import { beginSettlement } from '../src/game/settlement.ts'

function finish(initial: GameState) {
  let s = initial
  for (let i = 0; i < 700 && s.phase !== 'finished'; i++) {
    if (s.phase === 'rolling') s = roll(s)
    else if (s.phase === 'event') s = decide(s, canChoose(s,'skip') ? 'skip' : canChoose(s,'pay') ? 'pay' : s.eventId === 'repair' ? 'full' : s.eventId === 'bonus' ? 'receive' : 'acknowledge')
    else if (s.phase === 'funding') {
      const source = fundingSources(s)[0]; const lot = s.deposits.find(lot => lot.status === 'active')
      s = fundPayment(s,source,source === 'savings' ? lot!.principal : source === 'debt' ? Math.min(s.pendingPayment!.remaining,borrowingAvailable(s)) : s.portfolio[source],lot?.id)
    } else s = advance(s)
  }
  assert.equal(s.phase,'finished')
  return s
}
function businessEncounter(state: GameState, turn = state.turn): GameState {
  return { ...state, turn, phase:'event',eventId:'business',position:boardFor(state).find(tile=>tile.type==='business')!.index }
}
test('V2.1 default original mode matches explicit original and leaves finances untouched', () => {
  const before=JSON.stringify({RULES,ECONOMY})
  assert.deepEqual(createGame('SAIGON-2026',20_000_000,1),createGame('SAIGON-2026',20_000_000,1,'original'))
  for (const mode of GAME_MODES) finish(createGame('XVTL-V2-42',20_000_000,1,mode.id))
  assert.equal(JSON.stringify({RULES,ECONOMY}),before)
  assert.equal(RULES.laps,3); assert.equal(RULES.tiles,20)
})
test('V2.1 C20 differs from A20 only at tile14 with original coordinates preserved', () => {
  const a=boardFor(createGame('board',0,1,'experimental-a'))
  const c=boardFor(createGame('board',0,1,'experimental-b'))
  assert.equal(a.length,20);assert.equal(c.length,20)
  const diff=a.flatMap((tile,i)=>JSON.stringify(tile)===JSON.stringify(c[i])?[]:[i])
  assert.deepEqual(diff,[13]);assert.equal(a[13].type,'macro');assert.equal(c[13].type,'business')
  assert.equal(a[13].row,c[13].row);assert.equal(a[13].col,c[13].col)
})
for (const mode of ['original','experimental-a','experimental-b'] as GameModeId[]) {
  test(`V2.1 ${mode} completes once per lap and survives JSON continuation`, () => {
    const initial=advance(createGame('XVTL-V2-42',20_000_000,3,mode))
    const state=finish(initial); const replay=finish(JSON.parse(JSON.stringify(initial)))
    assert.deepEqual(replay,state)
    const laps=mode==='original'?3:4
    assert.equal(state.totalLaps,laps);assert.equal(state.summaries.length,laps)
    assert.equal(state.log.filter(e=>e.title==='Nhận lương').length,laps)
    assert.equal(state.log.filter(e=>e.kind==='settlement').length,laps)
    assert.equal(state.market.normalLaps.length,laps)
    assert.equal(state.pendingLanding,false);assert.equal(state.position,0)
    const exported=JSON.parse(serializeLog(state))
    assert.equal(exported.mode.id,mode);assert.equal(exported.mode.totalLaps,laps)
    assert.equal(exported.mode.boardLayout,mode==='experimental-b'?'C20':'A20')
    assert.equal(exported.playtest.diceRolls,state.turn)
    assert.equal(exported.finalResult.lawfulProceeds,state.portfolio.cash+state.portfolio.savings)
  })
}
test('V2.1 business initial purchase blocks immediate upgrade without state mutation', () => {
  const opened=transact(businessEncounter(createGame('business',0,1,'experimental-b'),3),{kind:'buy',asset:'business',amount:20_000_000})
  assert.equal(opened.portfolio.cash,30_000_000);assert.equal(opened.businessPurchaseTurn,3)
  const before=JSON.stringify(opened)
  assert.throws(()=>transact(opened,{kind:'upgrade',asset:'business',amount:5_000_000,trend:opened.scenarioId}),/lần gặp.*tiếp theo/)
  assert.equal(JSON.stringify(opened),before)
  assert.throws(()=>transact(JSON.parse(before),{kind:'upgrade',asset:'business',amount:5_000_000,trend:opened.scenarioId}))
})
test('V2.1 subsequent encounter permits upgrades; sale clears state and repurchase locks again', () => {
  const opened=transact(businessEncounter(createGame('business',0),3),{kind:'buy',asset:'business',amount:20_000_000})
  const upgraded=transact(businessEncounter(opened,4),{kind:'upgrade',asset:'business',amount:5_000_000,trend:'growth'})
  assert.equal(upgraded.business.upgrades.growth,1)
  assert.throws(()=>transact({...upgraded,phase:'rebalancing'},{kind:'sell',asset:'business',amount:upgraded.portfolio.business}))
  const sold=transact(upgraded,{kind:'sell',asset:'business',amount:upgraded.portfolio.business})
  assert.equal(sold.business.capital,0);assert.equal(sold.business.recoverableCapital,0)
  assert.deepEqual(sold.business.upgrades,{});assert.equal(sold.businessPurchaseTurn,null)
  const rebought=transact(sold,{kind:'buy',asset:'business',amount:20_000_000})
  assert.throws(()=>transact(rebought,{kind:'upgrade',asset:'business',amount:5_000_000,trend:'growth'}))
})

test('V2.1 a real seeded return to business permits upgrading in the same lap or later', () => {
  let s=advance(createGame('XVTL-V2-0',0,1,'experimental-a'))
  for(let i=0;i<100;i++) {
    if(s.phase==='rolling') s=roll(s)
    else if(s.phase==='event') {
      if(s.eventId==='business') {
        if(s.business.capital===0) {
          s=transact(s,{kind:'buy',asset:'business',amount:20_000_000})
          assert.equal(s.turn,3)
          assert.throws(()=>transact(s,{kind:'upgrade',asset:'business',amount:5_000_000,trend:s.scenarioId}))
        } else {
          assert.equal(s.turn,7)
          s=transact(JSON.parse(JSON.stringify(s)),{kind:'upgrade',asset:'business',amount:5_000_000,trend:s.scenarioId})
          assert.equal(Object.values(s.business.upgrades).reduce((a,b)=>a+b,0),1)
          return
        }
      }
      s=decide(s,canChoose(s,'skip')?'skip':s.eventId==='bonus'?'receive':'pay')
    } else s=advance(s)
  }
  assert.fail('No subsequent business encounter')
})

test('V2.1 final START funding resumes once in every mode without shared horizon mutation', () => {
  const configuration=JSON.stringify({RULES,ECONOMY})
  for(const mode of GAME_MODES) {
    const initial=createGame('final-funding',0,1,mode.id)
    let s=beginSettlement({...initial,phase:'rolling',position:0,lap:mode.totalLaps,
      portfolio:{...initial.portfolio,cash:0},obligations:20_000_000})
    assert.equal(s.phase,'funding')
    assert.equal(s.log.filter(entry=>entry.title==='Nhận lương').length,1)
    s=fundPayment(JSON.parse(JSON.stringify(s)),'debt',6_000_000)
    assert.equal(s.portfolio.debt,6_600_000)
    assert.equal(s.phase,'summary');assert.equal(s.summaries.length,1)
    assert.equal(s.log.filter(entry=>entry.title==='Nhận lương').length,1)
    assert.equal(beginSettlement(s),s)
    const finished=advance(advance(s))
    assert.equal(finished.phase,'finished')
    assert.equal(finished.totalLaps,mode.totalLaps)
  }
  assert.equal(JSON.stringify({RULES,ECONOMY}),configuration)
})
