import test from 'node:test'
import assert from 'node:assert/strict'
import {createMultiCourseGame,createCoreMvpGame,createPlayerGame} from '../src/game/new-game.ts'
import {decide,transact,fundPayment} from '../src/game/engine.ts'
import {beginSettlement} from '../src/game/settlement.ts'
import {financialReview} from '../src/components/financial-review.ts'
import {tileInformation} from '../src/components/tile-information.ts'
import {boardFor} from '../src/data/board.ts'
import type {GameState} from '../src/game/types.ts'

const visit=(s:GameState,eventId:string,position=4):GameState=>({...s,turn:s.turn+1,phase:'event',eventId,position})
test('financial feedback uses actual paid fees and salary schedules, not projected course benefits',()=>{
  let s=decide(visit(createMultiCourseGame('REVIEW'),'course'),'course-advanced')
  assert.deepEqual(financialReview(s).find(f=>f.id==='courses')?.amounts,[10e6,0])
  s=beginSettlement(s)
  assert.deepEqual(financialReview(s).find(f=>f.id==='courses')?.amounts,[10e6,4e6])
  s=decide(visit({...s,lap:2},'course',7),'course-basic');s=beginSettlement(s)
  assert.deepEqual(financialReview(s).find(f=>f.id==='courses')?.amounts,[16e6,10e6])
  assert.equal(financialReview(s).some(f=>f.id==='trading'),false)
})
test('actual sale gross minus net includes gold spread and fees, voluntary and funding, without double counting',()=>{
  let s=transact(visit(createMultiCourseGame('FEES'),'gold',5),{kind:'buy',asset:'gold',amount:10e6})
  s=transact(visit(s,'gold',5),{kind:'sell',asset:'gold',amount:10e6})
  assert.deepEqual(financialReview(s).find(f=>f.id==='trading')?.amounts,[397000])
  let funded=transact(visit(createMultiCourseGame('FORCED'),'gold',5),{kind:'buy',asset:'gold',amount:50e6})
  funded=decide(visit(funded,'medical',3),'pay');funded=fundPayment(funded,'gold',10e6)
  assert.deepEqual(financialReview(funded).find(f=>f.id==='trading')?.amounts,[397000])
  assert.deepEqual(financialReview(funded).find(f=>f.id==='personal')?.amounts,[5e6])
})
test('feedback does not invent decisions; reports remaining debt and business capital only when present',()=>{
  const s=createMultiCourseGame('EMPTY'),before=structuredClone(s)
  assert.deepEqual(financialReview(s),[]);assert.deepEqual(s,before)
  const cash=beginSettlement(s)
  assert.deepEqual(financialReview(cash).map(f=>[f.id,...f.amounts]),[['salary',14e6],['living',5e6]])
  const biz=transact(visit(s,'business',8),{kind:'buy',asset:'business',amount:20e6})
  assert.deepEqual(financialReview(biz).find(f=>f.id==='business')?.amounts,[20e6])
  assert.deepEqual(financialReview({...s,portfolio:{...s.portfolio,debt:5e6}}).find(f=>f.id==='debt')?.amounts,[5e6])
})
test('historical single-course review uses actual cost/boost without migrating ownership',()=>{
  for(const initial of [createCoreMvpGame('OLD'),createPlayerGame('C20',0)]){
    const s=beginSettlement(decide(visit(initial,'course'),'upgrade'))
    assert.deepEqual(financialReview(s).find(f=>f.id==='courses')?.amounts,[initial.gameplayProfile?8e6:6e6,initial.gameplayProfile?4e6:3e6])
    assert.equal(s.ownedCourses,undefined)
  }
})
test('tile descriptions cover nine types and respect old/new course, trading, living and credit profiles; read-only',()=>{
  const s=createMultiCourseGame('TILES'),before=structuredClone(s)
  const types=[...new Set(boardFor(s).map(t=>t.type))]
  assert.equal(types.length,9);assert.equal(new Set(types.map(t=>tileInformation(t,s))).size,9)
  for(const t of types)assert.ok(tileInformation(t,s).length>30)
  assert.match(tileInformation('course',s),/6 triệu.*2 triệu.*10 triệu.*4 triệu/)
  assert.match(tileInformation('course',createCoreMvpGame('OLD')),/8 triệu.*4 triệu/)
  assert.match(tileInformation('course',createPlayerGame('C20',0)),/6 triệu.*3 triệu/)
  assert.match(tileInformation('bonds',s),/chậm trả|mất vốn/)
  assert.match(tileInformation('stocks',createPlayerGame('C20',0)),/Mua tại ô/)
  assert.match(tileInformation('start',s),/5 triệu/)
  assert.match(tileInformation('business',{...createPlayerGame('LEGACY',0),encounterRulesVersion:'legacy-multi-action'}),/Mua hoặc bán quán tại ô/)
  assert.deepEqual(s,before)
})
