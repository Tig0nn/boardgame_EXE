import test from 'node:test'
import assert from 'node:assert/strict'
import { dominates } from './analyze-core-mvp.mjs'
import { distribution, wilson, paired } from './research/core-mvp/stats.mjs'
import { hashSeed, random } from '../src/game/random.ts'

test('Pareto retains tradeoffs and rejects strictly dominated points',()=>{
  const a={rolls:20,opportunities:10,financialGain:5,lowerTail:60,coverage:.9},b={...a,rolls:24,lowerTail:55},c={...a,rolls:18,financialGain:3}
  assert.equal(dominates(a,b),true);assert.equal(dominates(a,c),false);assert.equal(dominates(c,a),false);assert.equal(dominates(a,a),false)
})
test('Wilson zero events has nonzero upper bound; quantiles use documented lower order statistic',()=>{
  assert.equal(wilson(0,5000)[0],0);assert.ok(wilson(0,5000)[1]>.0007)
  const s=distribution([4,1,3,2]);assert.equal(s.median,2);assert.equal(s.p10,1);assert.equal(s.p90,3)
})
test('paired inference rejects missing seeds and exposes path divergence',()=>{
  const a=[{seed:'x',proceeds:3,diceHash:'a',encounterHash:'e'}],b=[{seed:'x',proceeds:1,diceHash:'b',encounterHash:'e'}]
  const r=paired(a,b,'proceeds');assert.equal(r.mean,2);assert.equal(r.sameDiceRate,0);assert.equal(r.sameEncounterRate,1)
  assert.throws(()=>paired(a,[{...b[0],seed:'other'}],'proceeds'),/Unmatched/)
})
test('D6 conversion is uniform on an unconditioned deterministic PRNG sample',()=>{
  const counts=Array(6).fill(0);let state=hashSeed('CORE-MVP-UNCONDITIONED-D6')
  for(let i=0;i<1e6;i++){const [u,next]=random(state);state=next;assert.ok(u>=0&&u<1);counts[Math.floor(u*6)]++}
  const expected=1e6/6,chiSquare=counts.reduce((n,x)=>n+(x-expected)**2/expected,0)
  assert.ok(chiSquare<30,`Unexpected uniformity diagnostic ${chiSquare}`)
})
