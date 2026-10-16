import test from 'node:test'
import assert from 'node:assert/strict'
import { clusteredDelta } from '../../analyze-core-mvp-risk-allocation.mjs'
import { compare } from './stats.mjs'

test('repeated policies do not inflate independent seed count',()=>{
  const rows=[{seed:'s1',policy:'stocks',proceeds:10},{seed:'s1',policy:'gold',proceeds:20},{seed:'s2',policy:'stocks',proceeds:30},{seed:'s2',policy:'gold',proceeds:40}]
  const fresh=rows.map(r=>({...r,proceeds:r.proceeds+5}))
  const d=clusteredDelta(fresh,rows,'proceeds',['stocks','gold'])
  assert.equal(d.nSeeds,2);assert.equal(d.mean,5);assert.deepEqual(d.ci95,[5,5])
})
test('paired analysis rejects duplicate or missing seeds',()=>{
  assert.throws(()=>compare([{seed:'s1'},{seed:'s1'}],[{seed:'s1'},{seed:'s2'}]),/unique/)
  assert.throws(()=>compare([{seed:'s1'}],[{seed:'s2'}]),/Unmatched/)
})
