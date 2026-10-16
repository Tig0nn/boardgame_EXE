import test from 'node:test'
import assert from 'node:assert/strict'
import { costDrawdowns, learningMetrics } from './metrics.mjs'
import { studyConfigs, reserveConfig } from './spec.mjs'

const snap=(cash,pendingCost=0)=>({portfolio:{cash,savings:0,stocks:0,bonds:0,gold:0,business:0,debt:0},obligations:0,pendingCost})
test('living-adjusted drawdown adds incurred cost once, including funding pause',()=>{
  const entries=[{kind:'setup',before:snap(10e6),after:snap(10e6)},
    {kind:'schedule',title:'Chi phí sinh hoạt',before:snap(10e6),after:snap(0,5e6)},
    {kind:'funding',title:'Chi phí sinh hoạt',before:snap(0,5e6),after:snap(0,0)}]
  const d=costDrawdowns(entries,10e6)
  assert.equal(d.livingIncurred,15e6);assert.equal(d.rawDrawdown,15e6);assert.equal(d.livingAdjustedDrawdown,0)
})
test('market loss remains after removing living, and course remains a cost',()=>{
  const entries=[{kind:'setup',before:snap(10e6),after:snap(10e6)},
    {kind:'schedule',title:'Chi phí sinh hoạt',before:snap(10e6),after:snap(8e6)},
    {kind:'market',before:snap(8e6),after:snap(5e6)},
    {kind:'decision',eventId:'course',before:snap(5e6),after:snap(4e6)}]
  const d=costDrawdowns(entries,10e6)
  assert.equal(d.rawDrawdown,6e6);assert.equal(d.livingAdjustedDrawdown,4e6)
})
test('variants preserve nine types, events, economics; common economy retains board/laps',()=>{
  const cs=studyConfigs({B:15,D:17}),B=cs.B,D=cs.D
  for(const name of ['B','D']){
    const v=cs[`${name}-personal`],base=cs[name]
    assert.deepEqual(v.economy,base.economy)
    assert.equal(v.board.tiles.filter((x,i)=>x!==base.board.tiles[i]).length,1)
    assert.equal(new Set(v.board.tiles).size,9)
  }
  const common=cs['D-common-B']
  assert.deepEqual(common.board,D.board);assert.equal(common.economy.rules.laps,5)
  assert.equal(common.economy.livingCost,B.economy.livingCost)
  assert.equal(common.economy.rules.courseCost,B.economy.rules.courseCost)
  const r=reserveConfig(B,0);assert.equal(r.policy.reserve,0);assert.deepEqual(r.economy,B.economy)
})
test('one log encounter counts as coverage; course after purchase is a dead visit',()=>{
  const c=studyConfigs().B
  const s={log:[{kind:'encounter',tileId:4,turn:2,sequence:1,before:{...snap(10e6),coursePurchased:true},after:snap(10e6)}]}
  const m=learningMetrics(s,c,[])
  assert.equal(m.courseRepeatVisits,1);assert.equal(m.personalEncounters,0)
  assert.equal(m.personal0,true);assert.equal(m.personal1,false)
})
