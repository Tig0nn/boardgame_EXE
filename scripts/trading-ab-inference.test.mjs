import test from 'node:test'
import assert from 'node:assert/strict'
import { matchedWinInterval } from './trading-ab-inference.mjs'
test('no observed win flips is not a zero-width uncertainty interval',()=>{
  const a=Array.from({length:500},(_,i)=>({seed:String(i),won:i%2===0})),r=matchedWinInterval(a,a)
  assert.equal(r.gains,0);assert.equal(r.losses,0);assert.ok(r.ci95[0]<0);assert.ok(r.ci95[1]>0)
})
test('matched binary interval is symmetric when swapping arms and rejects missing seeds',()=>{
  const a=[{seed:'a',won:true},{seed:'b',won:true},{seed:'c',won:false}],b=[{seed:'a',won:false},{seed:'b',won:true},{seed:'c',won:false}]
  const x=matchedWinInterval(a,b),y=matchedWinInterval(b,a)
  assert.equal(x.gains,1);assert.equal(x.losses,0);assert.equal(x.mean,1/3);assert.equal(x.ci95[0],-y.ci95[1]);assert.equal(x.ci95[1],-y.ci95[0])
  assert.throws(()=>matchedWinInterval(a,b.slice(1)),/Unmatched/)
})
