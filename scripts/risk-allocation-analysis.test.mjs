import test from 'node:test'
import assert from 'node:assert/strict'
import { learningMetrics } from './research/risk-allocation/metrics.mjs'
import { studyConfigs } from './research/risk-allocation/spec.mjs'
import { load } from './research/risk-allocation/run.mjs'
import { raw } from './analyze-core-mvp-risk-allocation.mjs'

const snap=(cash,obligations=0,pendingCost=0)=>({portfolio:{cash,savings:0,stocks:0,gold:0,bonds:0,business:0,debt:0},obligations,pendingCost,deposits:[],coursePurchased:false})
test('deferred personal expense is recognized once, distinct from mandatory funding',()=>{
  const c=studyConfigs().B,s={log:[
    {kind:'encounter',tileId:3,before:snap(2e6),after:snap(2e6)},
    {kind:'decision',eventId:'medical',decisionId:'defer',before:snap(2e6),after:snap(2e6,6e6)},
    {kind:'schedule',title:'Nghĩa vụ đến hạn',before:snap(2e6,6e6),after:snap(0,0,4e6)},
  ]}
  const m=learningMetrics(s,c,[])
  assert.equal(m.personalCommittedCost,6e6);assert.equal(m.personalDeferralPremium,1e6)
  assert.equal(m.personalImmediateShortfalls,1);assert.equal(m.mandatoryCashShortfalls,1)
  assert.equal(m.personalDeferred,1);assert.equal(m.personalEncounters,1)
})
test('an affordable investment followed by START does not imply actual ownership/sale',()=>{
  const c=studyConfigs().B,s={log:[]},observations=[
    {order:0,phase:'event',turn:1,type:'stocks',canBuy:true,choices:2,canSell:[]},
    {order:1,phase:'rebalancing',turn:3,lap:1,choices:1,canSell:[]},
  ]
  const m=learningMetrics(s,c,observations)
  assert.equal(m.financialAccess.stocks,true);assert.equal(m.accessThenSale.stocks,true)
  assert.equal(m.ownedSaleOpportunity.stocks,false);assert.equal(m.decisionSteps,1)
})
test('holdout inference keeps auxiliary reserve arms within their strategy',()=>{
  const a=load('holdout-analysis.json'),pairs=a.pairs
  assert.equal(pairs.length,5)
  for(const p of pairs.filter(p=>p.name.includes('-r'))){assert.deepEqual(Object.keys(p.policies),['savings']);assert.equal(p.clustered.proceeds.nSeeds,400)}
  for(const p of pairs.filter(p=>!p.name.includes('-r')))assert.equal(Object.keys(p.policies).length,11)
})
test('reported reserve risk comes from observed cash shortfalls, not a win-rate proxy',()=>{
  const a=raw('holdout','D-personal-r0'),b=raw('holdout','D-personal-r5'),d=load('reserve-holdout-direct.json')
  assert.equal(a.filter(r=>r.mandatoryCashShortfalls>0).length,17)
  assert.equal(b.filter(r=>r.mandatoryCashShortfalls>0).length,1)
  assert.equal(d.win.mean,0)
  assert.equal(d.shortfall.mean,(1-17)/400)
  assert.ok(d.win.ci95[0]<0&&d.win.ci95[1]>0)
})
