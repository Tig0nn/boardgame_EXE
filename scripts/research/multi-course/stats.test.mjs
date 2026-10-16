import test from 'node:test'
import assert from 'node:assert/strict'
import {distribution,wilson,paired,clusterMean} from './stats.mjs'
test('tail uses the worst10%, Wilson captures zero observations uncertainty',()=>{
  const d=distribution(Array.from({length:20},(_,i)=>i+1))
  assert.equal(d.mean,10.5);assert.equal(d.median,10);assert.equal(d.p10,2);assert.equal(d.worstDecile,1.5)
  assert.ok(wilson(0,100)[1]>0);assert.ok(wilson(100,100)[0]<1)
})
test('paired comparisons reject missing/duplicate seeds and preserve path divergence diagnostics',()=>{
  const a=[{seed:'a',proceeds:4,diceHash:'x',encounterHash:'a',finalRng:1},{seed:'b',proceeds:6,diceHash:'y',encounterHash:'b',finalRng:2}],b=a.map(r=>({...r,proceeds:r.proceeds-2,encounterHash:'changed'}))
  assert.equal(paired(a,b,'proceeds').mean,2);assert.equal(paired(a,b,'proceeds').sameDiceRate,1);assert.equal(paired(a,b,'proceeds').sameEncounterRate,0)
  assert.throws(()=>paired(a,b.slice(1),'proceeds'));assert.throws(()=>paired([a[0],a[0]],b,'proceeds'))
})
test('pooled strategy inference clusters by seed instead of multiplying sample size by policy count',()=>{
  const r=clusterMean([{seed:'a',value:1},{seed:'a',value:3},{seed:'b',value:5},{seed:'b',value:7}],'value')
  assert.equal(r.nSeeds,2);assert.equal(r.mean,4);assert.ok(r.ci95[1]-r.ci95[0]>3)
})
