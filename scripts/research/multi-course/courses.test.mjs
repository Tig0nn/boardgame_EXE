import test from 'node:test'
import assert from 'node:assert/strict'
import {createCoreMvpGame} from '../../../src/game/new-game.ts'
import {beginSettlement} from '../../../src/game/settlement.ts'
import {config} from './spec.mjs'
import {availableCourses,buyCourse,purchases,courseMetrics} from './courses.mjs'
const event=(s,turn=1)=>({...s,turn,phase:'event',eventId:'course',position:4})
test('sequential prerequisites, independent order, one purchase per encounter, cash-only and no mutation',()=>{
  const c=config('S2-extension','L4-original'),initial=event(createCoreMvpGame('COURSE-TEST',0)),before=structuredClone(initial)
  assert.deepEqual(availableCourses(initial,c).map(x=>x.id),['c1'])
  assert.throws(()=>buyCourse(initial,c,'c2'))
  const first=buyCourse(initial,c,'c1')
  assert.deepEqual(initial,before);assert.equal(first.portfolio.cash,42e6);assert.equal(first.recurringIncome,18e6)
  assert.throws(()=>buyCourse(event(first),c,'c2'))
  assert.throws(()=>buyCourse(event(first,2),c,'c1'))
  assert.throws(()=>buyCourse({...event(first,2),portfolio:{...first.portfolio,cash:0}},c,'c2'))
  assert.throws(()=>buyCourse({...initial,eventId:'gold',position:5},c,'c1'))
  const second=buyCourse(event(first,2),c,'c2')
  assert.equal(second.recurringIncome,20e6);assert.equal(purchases(second,c).length,2)
  const independent=config('I2-choice','L4-original')
  assert.equal(buyCourse(initial,independent,'c2').recurringIncome,18e6)
})
test('cumulative boosts are paid only at subsequent START, no terminal fee refund',()=>{
  const c=config('S2-extension','L4-original'),s=event(createCoreMvpGame('START-SALARY',0))
  const first=buyCourse(s,c,'c1'),second=buyCourse(event(first,2),c,'c2')
  assert.equal(second.portfolio.cash,32e6)
  const settled=beginSettlement(second),metrics=courseMetrics(settled,c)
  assert.equal(settled.portfolio.cash,47e6)
  assert.equal(metrics.courseSalaryReceived,6e6);assert.equal(metrics.courseSpend,18e6);assert.equal(metrics.courseNet,-12e6)
  assert.deepEqual(metrics.coursePurchases.map(p=>p.startsReceived),[1,1])
})
test('baseline dispatches the actual production course action',()=>{
  const c=config('A-baseline','L4-original'),s=event(createCoreMvpGame('BASELINE',0))
  const next=buyCourse(s,c,'c1')
  assert.equal(next.log.at(-1).decisionId,'upgrade');assert.equal(next.log.at(-1).researchCourse,undefined)
})
