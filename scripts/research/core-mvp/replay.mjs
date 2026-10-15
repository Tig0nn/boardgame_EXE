import assert from 'node:assert/strict'
import { advance, createGame, decide, fundPayment, roll, transact, snapshot } from '../../../src/game/engine.ts'
const normalized=x=>JSON.parse(JSON.stringify(x))
// Replays recorded actions, independently of the policy heuristics. This is a
// private research replay against the same isolated config/source, not schema5.
export function replayResearch(state,c){
  let s=createGame(state.seed,c.economy.initialSavings,c.economy.initialTerm,'experimental-b',undefined,'v2.4-customer-preferences','v2.4-atomic-investments','vn-v1','v2.5-credit-risk','v2.6-periodic-start')
  for(const entry of state.log){
    if(!['roll','decision','rebalancing','funding'].includes(entry.kind))continue
    for(let i=0;i<5&&(s.phase!==entry.before.phase||s.lap!==entry.before.lap);i++)s=advance(s)
    assert.deepEqual(normalized(snapshot(s)),normalized(entry.before),`Before recorded action ${entry.sequence}`)
    if(entry.kind==='roll')s=roll(s)
    else if(entry.kind==='decision')s=decide(s,entry.decisionId)
    else if(entry.kind==='rebalancing'){assert.ok(entry.action);s=transact(s,entry.action)}
    else{
      const source=entry.decisionId.slice(5)
      const lot=entry.before.deposits.find(l=>l.status==='active'&&entry.after.deposits.find(a=>a.id===l.id)?.status==='withdrawn')
      const amount=source==='debt'?entry.after.portfolio.debt-entry.before.portfolio.debt:source==='savings'?lot.principal:entry.forcedAssetSaleAmount
      s=fundPayment(s,source,amount,source==='bonds'?entry.fundingLotId:lot?.id)
    }
  }
  for(let i=0;s.phase!=='finished'&&i<5;i++)s=advance(s)
  assert.deepEqual(normalized(snapshot(s)),normalized(snapshot(state)),'Final research replay state')
  assert.deepEqual(normalized(s.log),normalized(state.log),'Complete research replay log')
  return s
}
