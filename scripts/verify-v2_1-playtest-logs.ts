import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createGame, advance, decide, roll, transact, fundPayment, snapshot } from '../src/game/engine.ts'
import { liquidatableFunds, victory } from '../src/game/selectors.ts'
import type { Asset, FundingSource, GameState, LogEntry, RebalanceAction, Term } from '../src/game/types.ts'

const verified=[]
for (const file of ['original-log.json','a-log.json','b-log.json']) {
  const data=JSON.parse(readFileSync(`docs/playtests/${file}`,'utf8'))
  const expected=data.state as GameState
  const initial=(data.entries as LogEntry[])[0].after
  let s=createGame(data.seed,initial.portfolio.savings,(initial.deposits[0]?.maturityLap??1) as Term,expected.gameMode)
  for(const entry of data.entries as LogEntry[]) {
    if(!['roll','decision','rebalancing','funding'].includes(entry.kind)) continue
    for(let i=0;i<4&&(s.phase!==entry.before.phase||s.lap!==entry.before.lap);i++) s=advance(s)
    assert.deepEqual(snapshot(s),entry.before,`${file}: before action ${entry.sequence}`)
    if(entry.kind==='roll') s=roll(s)
    else if(entry.kind==='decision') s=decide(s,entry.decisionId!)
    else if(entry.kind==='funding') {
      const source=entry.decisionId!.slice(5) as FundingSource
      const lot=entry.before.deposits.find(lot=>lot.status==='active'&&entry.after.deposits.find(after=>after.id===lot.id)?.status==='withdrawn')
      s=fundPayment(s,source,source==='debt'?entry.after.portfolio.debt-entry.before.portfolio.debt:source==='savings'?lot!.principal:entry.forcedAssetSaleAmount,lot?.id)
    } else {
      const [kind,asset]=entry.decisionId!.split('-')
      const after=entry.after;const before=entry.before
      const action:RebalanceAction={kind:kind as RebalanceAction['kind'],asset:asset==='bank'?undefined:asset as Asset,
        amount:kind==='sell'?before.portfolio[asset as Asset]:before.portfolio.cash-after.portfolio.cash}
      if(kind==='deposit') action.term=(after.deposits.at(-1)!.maturityLap-after.lap+1) as Term
      if(kind==='buy'&&asset==='stocks') action.symbolId=Object.keys(after.stockHoldings).find(id=>after.stockHoldings[id].units>(before.stockHoldings[id]?.units??0))
      if(kind==='upgrade') action.trend=Object.keys(after.business.upgrades).find(id=>after.business.upgrades[id]>(before.business.upgrades[id]??0))
      if(kind==='sell'&&asset!=='business') action.amount=entry.assetSaleAmounts[asset as 'stocks'|'gold'|'bonds']
      if(kind==='repay') action.amount=before.portfolio.debt-after.portfolio.debt
      s=transact(s,action)
    }
  }
  for(let i=0;i<4&&s.phase!=='finished';i++) s=advance(s)
  assert.deepEqual(JSON.parse(JSON.stringify(s)),expected,`${file}: complete deterministic replay`)
  assert.equal(liquidatableFunds(s),data.finalResult.lawfulProceeds)
  assert.equal(victory(s).won,data.finalResult.won)
  assert.equal(s.summaries.length,s.totalLaps)
  assert.equal(data.playtest.salaryPayments,s.totalLaps)
  assert.equal(data.playtest.diceRolls,s.turn)
  const row={file,mode:data.mode,seed:data.seed,...data.playtest,finalResult:data.finalResult,deterministicReplay:true}
  verified.push(row)
  console.log(`PASS downloaded ${file}: ${s.turn} rolls, ${s.totalLaps} salaries, lawful proceeds ${liquidatableFunds(s)}`)
}
writeFileSync('docs/playtests/verified-browser-logs.json',JSON.stringify(verified,null,2)+'\n')
