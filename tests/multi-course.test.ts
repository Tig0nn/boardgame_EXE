import test from 'node:test'
import assert from 'node:assert/strict'
import { createMultiCourseGame, createCoreMvpGame, createPlayerGame } from '../src/game/new-game.ts'
import { advance, canChoose, decide, roll } from '../src/game/engine.ts'
import { boardFor } from '../src/data/board.ts'
import { beginSettlement } from '../src/game/settlement.ts'
import { courseChoices } from '../src/game/courses.ts'
import { serializeLog } from '../src/game/log.ts'
import { restoreSavedGame, saveGameLocally, loadGameLocally } from '../src/game/saved-game.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'
import { eventsForGame } from '../src/data/events.ts'
import { liquidatableFunds, victory } from '../src/game/selectors.ts'
import type { GameState } from '../src/game/types.ts'
import { buildCoachFacts } from '../src/ai/facts.ts'

const visit=(s:GameState,position=4):GameState=>({...s,phase:'event',eventId:'course',position,turn:s.turn+1})
test('new explicit versions and only tile16 changes; old B18/C20 retain laws',()=>{
  const s=createMultiCourseGame('MULTI')
  assert.equal(s.gameplayProfile,'core-mvp-b18-multi-course-v1')
  assert.equal(s.courseRulesVersion,'b18-i2-choice-v1');assert.equal(s.boardRevision,'b18-l3-bonds-v1')
  assert.deepEqual(s.ownedCourses,[])
  const board=boardFor(s),old=boardFor(createCoreMvpGame('OLD'))
  assert.equal(board.length,18);assert.equal(new Set(board.map(t=>t.type)).size,9)
  assert.deepEqual(board.filter(t=>t.type==='course').map(t=>t.index+1),[5,8,13])
  assert.deepEqual(board.filter(t=>t.type==='bonds').map(t=>t.index+1),[3,10,16])
  assert.deepEqual(board.filter(t=>t.index!==15),old.filter(t=>t.index!==15))
  assert.equal(old[15].type,'course');assert.equal(createCoreMvpGame('OLD').ownedCourses,undefined)
  assert.equal(createPlayerGame('C20',0).boardLayout,'C20')
})
test('new B18 D6 wraps at18 and pays exactly one START on crossing',()=>{
  const s={...createMultiCourseGame('NEW-WRAP'),phase:'rolling' as const,position:17}
  const next=roll(s)
  assert.ok(next.dice>=1&&next.dice<=6);assert.equal(next.position,(17+next.dice)%18)
  assert.equal(next.summaries.length,1);assert.equal(next.summaries[0].incomeTotal,14e6)
  assert.ok(next.summaries[0].lines.some(l=>l.label==='Chi phí sinh hoạt'&&l.amount===-5e6))
})
for(const ids of [['basic'],['advanced'],['basic','advanced'],['advanced','basic']])test(`independent course order ${ids.join(' → ')}, one success per visit and immutable ownership`,()=>{
  let s=createMultiCourseGame('ORDER'),cash=50e6,wage=14e6
  for(const id of ids){
    s=visit(s);const before=structuredClone(s),cost=id==='basic'?6e6:10e6,boost=id==='basic'?2e6:4e6
    assert.equal(canChoose(s,`course-${id}`),true)
    const next=decide(s,`course-${id}`)
    assert.deepEqual(s,before);cash-=cost;wage+=boost
    assert.equal(next.portfolio.cash,cash);assert.equal(next.recurringIncome,wage)
    assert.equal(next.phase,'rolling');assert.equal(next.log.at(-1)!.expensePaid,cost)
    assert.equal(next.log.at(-1)!.recurringIncomeDelta,boost)
    const reenter={...next,phase:'event' as const,eventId:'course'}
    assert.equal(canChoose(reenter,'course-basic'),false);assert.equal(canChoose(reenter,'course-advanced'),false)
    assert.throws(()=>decide(reenter,'course-basic'))
    s=next
  }
  assert.equal(s.summaries.length,0);assert.equal(s.lap,1)
  const settled=beginSettlement(s)
  assert.equal(settled.summaries[0].incomeTotal,wage)
  for(const id of ids)assert.equal(canChoose(visit(s),`course-${id}`),false)
})
test('failed purchase preserves right, cash-only, no START or forged location purchase',()=>{
  const s=visit(createMultiCourseGame('POOR',45e6,3)),before=structuredClone(s)
  assert.equal(canChoose(s,'course-basic'),false);assert.throws(()=>decide(s,'course-basic'));assert.deepEqual(s,before)
  assert.equal(s.pendingPayment,null);assert.equal(s.portfolio.debt,0)
  const retried=decide({...s,portfolio:{...s.portfolio,cash:6e6}},'course-basic')
  assert.deepEqual(retried.ownedCourses,['basic'])
  for(const bad of [{...s,position:0},{...s,position:15},{...s,phase:'rebalancing' as const}])assert.equal(canChoose(bad,'course-basic'),false)
  assert.equal(canChoose(s,'skip'),true);assert.equal(decide(s,'skip').recurringIncome,14e6)
})
test('remaining START arithmetic at first and last lap; no retroactive income',()=>{
  let s=visit(createMultiCourseGame('TIMING'))
  assert.deepEqual(courseChoices(s).map(c=>[c.remainingStarts,c.nominalIncome,c.netAfterFee]),[[4,8e6,2e6],[4,16e6,6e6]])
  s=decide(s,'course-basic');s=beginSettlement(s)
  const first=structuredClone(s.summaries[0]);s=visit({...s,lap:4})
  assert.deepEqual(courseChoices(s).map(c=>[c.remainingStarts,c.nominalIncome,c.netAfterFee]),[[1,2e6,-4e6],[1,4e6,-6e6]])
  s=decide(s,'course-advanced');assert.deepEqual(s.summaries[0],first)
  s=beginSettlement(s);assert.equal(s.summaries.at(-1)!.incomeTotal,20e6)
})
function natural(){
  let s=createMultiCourseGame('TRADING-AB-MAIN-0')
  for(let i=0;s.phase!=='finished'&&i<400;i++){
    if(s.phase==='rolling')s=roll(s)
    else if(s.phase==='event'){
      const options=eventsForGame(s).find(e=>e.id===s.eventId)!.options
      const option=s.eventId==='course'?options.find(o=>o.id!=='skip'&&canChoose(s,o.id)):undefined
      s=decide(s,option?.id??options.find(o=>['skip','acknowledge'].includes(o.id))?.id??options[0].id)
    }else s=advance(s)
  }
  return s
}
test('natural same-lap purchases, four paid START, save between courses, schema7 and complete replay',()=>{
  const s=natural(),p=s.log.filter(e=>e.decisionId?.startsWith('course-'))
  assert.equal(p.length,2);assert.equal(p[0].lap,p[1].lap);assert.notEqual(p[0].turn,p[1].turn)
  assert.equal(s.summaries.length,4);assert.equal(s.phase,'finished');assert.equal(s.recurringIncome,20e6)
  assert.equal(s.log.filter(e=>e.title==='Nhận lương').length,4)
  assert.equal(liquidatableFunds({...s,portfolio:{...s.portfolio,cash:90e6}}),90e6)
  assert.equal(victory({...s,portfolio:{...s.portfolio,cash:90e6}}).won,true)
  assert.equal(victory({...s,portfolio:{...s.portfolio,cash:89_999_999}}).won,false)
  const data=JSON.parse(serializeLog(s));assert.equal(data.schemaVersion,7)
  assert.equal(data.playtest.courseInvestment,16e6);assert.deepEqual(replayGameLog(data),s)
  const first=p[0],partial={...s,...first.after,eventId:null,log:s.log.slice(0,first.sequence),summaries:[],pendingPayment:null,settlement:null}
  const exported=serializeLog(partial);assert.deepEqual(restoreSavedGame(exported),partial)
  let saved='';assert.equal(saveGameLocally(partial,{setItem(_k,v){saved=v}}),true)
  assert.deepEqual(loadGameLocally({getItem(){return saved}}),partial)
  assert.deepEqual(decide(visit(restoreSavedGame(exported)),'course-advanced').ownedCourses,['basic','advanced'])
  const evidence=buildCoachFacts(s).evidence.filter(e=>e.kind==='course')
  assert.equal(evidence.length,2);assert.match(evidence[0].fact,/6\.000\.000 VND/)
  assert.match(evidence[1].fact,/10\.000\.000 VND/);assert.match(evidence[1].fact,/4 START, tổng 16\.000\.000 VND/)
})
test('late natural purchase pays exactly one START and does not rewrite three previous salaries',()=>{
  let s=createMultiCourseGame('TRADING-AB-MAIN-0'),purchased=false
  for(let i=0;s.phase!=='finished'&&i<400;i++){
    if(s.phase==='rolling')s=roll(s)
    else if(s.phase==='event'){
      const options=eventsForGame(s).find(e=>e.id===s.eventId)!.options
      if(s.eventId==='course'&&s.lap===4&&!purchased){s=decide(s,'course-advanced');purchased=true}
      else s=decide(s,options.find(o=>['skip','acknowledge'].includes(o.id))?.id??options[0].id)
    }else s=advance(s)
  }
  assert.ok(purchased);assert.equal(s.phase,'finished')
  assert.deepEqual(s.summaries.map(x=>x.incomeTotal),[14e6,14e6,14e6,18e6])
  const entry=s.log.find(e=>e.decisionId==='course-advanced')!
  assert.equal(s.log.filter(e=>e.title==='Nhận lương'&&e.sequence>entry.sequence).length,1)
  assert.equal(JSON.parse(serializeLog(s)).playtest.courseInvestment,10e6)
  replayGameLog(JSON.parse(serializeLog(s)))
})
test('reject mismatched profile/schema/curriculum/ownership without migrating historical games',()=>{
  const good=JSON.parse(serializeLog(createMultiCourseGame('VERSION')))
  for(const mutate of [(d:typeof good)=>d.schemaVersion=6,(d:typeof good)=>delete d.state.courseRulesVersion,(d:typeof good)=>d.state.ownedCourses=['basic','basic'],(d:typeof good)=>d.state.ownedCourses=['unknown'],(d:typeof good)=>d.state.recurringIncome=20e6,(d:typeof good)=>d.state.boardRevision='b18-core-v1']){
    const d=structuredClone(good);mutate(d);assert.throws(()=>restoreSavedGame(JSON.stringify(d)))
  }
  const old=JSON.parse(serializeLog(createCoreMvpGame('HISTORICAL')))
  assert.equal(restoreSavedGame(JSON.stringify(old)).ownedCourses,undefined)
  old.state.ownedCourses=[];assert.throws(()=>restoreSavedGame(JSON.stringify(old)))
})
