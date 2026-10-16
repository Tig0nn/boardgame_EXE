import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { cleanupAdapter } from '../core-mvp/adapter.mjs'
import { createStudyAdapter } from './adapter.mjs'
import { studyConfigs, reserveConfig, STRATEGIES } from './spec.mjs'

async function fixture(c,fn){const dir=createStudyAdapter(c);try{await fn({
  ...await import(pathToFileURL(join(dir,'scripts/research/risk-allocation/policy.mjs'))),
  ...await import(pathToFileURL(join(dir,'scripts/research/trading-ab/policy.mjs'))),
  ...await import(pathToFileURL(join(dir,'scripts/research/core-mvp/replay.mjs'))),
  ...await import(pathToFileURL(join(dir,'src/game/engine.ts'))),
  ...await import(pathToFileURL(join(dir,'src/data/board.ts'))),
})}finally{cleanupAdapter(dir)}}
test('instrumentation preserves every existing trading action and outcome',()=>{
  const c=studyConfigs().B
  return fixture(c,({playStudy,playTrading,replayResearch})=>{
    for(const p of STRATEGIES.filter(p=>p!=='risk-aware')){
      const measured=playStudy('RISK-AUDIT-CONTROL',p,c,'audit',{trace:true}),prior=playTrading('RISK-AUDIT-CONTROL',p,c,'new','disciplined',{trace:true})
      assert.deepEqual(measured.state,prior.state);assert.equal(measured.row.proceeds,prior.row.proceeds)
      replayResearch(measured.state,c)
    }
  })
})
test('reserve applies to voluntary course and investments, never blocks mandatory funding',()=>{
  const c=reserveConfig(studyConfigs().B,15e6)
  return fixture(c,({createGame,boardFor,allocationStep})=>{
    const s=createGame('RESERVE-FIXTURE',0,1,'experimental-b',undefined,'v2.4-customer-preferences','v2.4-atomic-investments','vn-v1','v2.5-credit-risk','v2.6-periodic-start')
    s.portfolio.cash=20e6;s.phase='event';s.eventId='course';s.position=boardFor(s).findIndex(t=>t.type==='course')
    assert.equal(allocationStep(s,'diversified',c).coursePurchased,false)
    s.position=boardFor(s).findIndex(t=>t.type==='stocks');s.eventId='stocks'
    assert.equal(allocationStep(s,'stocks',c).portfolio.cash,15e6)
    s.position=boardFor(s).findIndex(t=>t.type==='personal');s.eventId='medical';s.portfolio.cash=5e6
    assert.equal(allocationStep(s,'diversified',c).portfolio.cash,0)
  })
})
test('all allocation policies replay and preserve economic periods on paired reserves',async()=>{
  for(const name of ['B','D']){
    const c=studyConfigs()[name]
    await fixture(c,({playStudy,replayResearch})=>{
      for(const p of STRATEGIES){const x=playStudy('RISK-POLICY-0',p,c,'allocation',{trace:true});replayResearch(x.state,c);assert.ok(x.row.decisionSteps>=x.row.decisionEncounters);assert.ok(x.row.livingAdjustedDrawdown<=x.row.rawDrawdown)}
      const low=playStudy('RISK-RESERVE-PATH','diversified',reserveConfig(c,0)),high=playStudy('RISK-RESERVE-PATH','diversified',reserveConfig(c,15e6))
      assert.equal(low.diceHash,high.diceHash);assert.equal(low.marketHash,high.marketHash)
    })
  }
})
