import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import { createTradingAdapter } from './research/trading-ab/adapter.mjs'
import { cleanupAdapter } from './research/core-mvp/adapter.mjs'

test('gold quote independently reconciles fees, spread and realized capital loss without charging a buy fee',async()=>{
  const c=JSON.parse(readFileSync('docs/research/core-mvp/frozen-configs.json','utf8')).configs[1],dir=createTradingAdapter(c,'new')
  try{
    const e=await import(pathToFileURL(join(dir,'src/game/engine.ts'))),{boardFor}=await import(pathToFileURL(join(dir,'src/data/board.ts'))),{tradingMetrics}=await import(pathToFileURL(join(dir,'scripts/research/trading-ab/metrics.mjs')))
    let s=e.createGame('GOLD-COST-LEDGER',0,3,'experimental-b',undefined,'v2.4-customer-preferences','v2.4-atomic-investments','vn-v1','v2.5-credit-risk','v2.6-periodic-start')
    const tile=boardFor(s).findIndex(t=>t.type==='gold'),event=s=>({...s,phase:'event',eventId:'gold',position:tile})
    s=e.transact(event(s),{kind:'buy',asset:'gold',amount:10e6})
    assert.equal(s.portfolio.cash,40e6)
    s=e.transact(event({...s,turn:1}),{kind:'sell',asset:'gold',amount:10e6,researchReason:'synthetic'})
    const r=tradingMetrics(s,c)
    assert.equal(r.buys,1);assert.equal(r.sells,1);assert.equal(r.tileSells,1)
    assert.equal(r.spreadPaid,300000);assert.equal(r.feesPaid,97000);assert.equal(r.transactionCosts,397000)
    assert.equal(r.realizedLoss,397000);assert.equal(r.netRealizedCapitalPnl,-397000)
    assert.equal(s.portfolio.cash,49603000)
  }finally{cleanupAdapter(dir)}
})
