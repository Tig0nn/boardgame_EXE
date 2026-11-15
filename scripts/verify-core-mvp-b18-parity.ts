import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync,writeFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createCoreMvpGame } from '../src/game/new-game.ts'
import { advance,decide,roll,transact,fundPayment,snapshot } from '../src/game/engine.ts'
import { rulesForGame } from '../src/game/rules-profile.ts'
import { ECONOMY,SCENARIOS,MACRO_EVENTS } from '../src/data/config.ts'
import { BOND_ISSUERS } from '../src/data/bond-issuers.ts'
import { boardFor } from '../src/data/board.ts'
import { liquidatableFunds,victory } from '../src/game/selectors.ts'
import { serializeLog } from '../src/game/log.ts'
import type { FundingSource,Term } from '../src/game/types.ts'
const show=(ref:string,path:string)=>execFileSync('git',['show',`${ref}:${path}`],{maxBuffer:20e6})
const config=JSON.parse(show('45b0c4d','docs/research/core-mvp/frozen-configs.json').toString('utf8')).configs.find((c:{id:string})=>c.id==='interaction-learning-liquidity')
assert.deepEqual(ECONOMY,config.economy.economy);assert.deepEqual(SCENARIOS,config.economy.scenarios);assert.deepEqual(MACRO_EVENTS,config.economy.macroEvents);assert.deepEqual(BOND_ISSUERS,config.economy.issuers)
const initial=createCoreMvpGame('PARITY',0),rules=rulesForGame(initial)
// The archived rules.tiles is historical20; its research adapter overrides it
// from board.tiles.length18. Compare effective board length separately below.
for(const [key,value]of Object.entries(config.economy.rules))if(!['goal','cashGoal','tiles','livingCost'].includes(key))assert.equal(rules[key as keyof typeof rules],value)
assert.equal(rules.livingCost,config.economy.livingCost)
assert.equal(rules.goal+rules.cashGoal,config.goal.amount+config.goal.reserve)
assert.deepEqual(boardFor(initial).map(t=>t.type),config.board.tiles)
const bytes=show('33de122','docs/research/trading-ab/main/interaction-learning-liquidity.new.examples.json.gz'),evidence=JSON.parse(gunzipSync(bytes).toString('utf8'))
const ignore=new Set(['gameplayProfile','goalRulesVersion','boardLayout','boardRevision','livingExpenseRulesVersion','encounterRulesVersion'])
const comparable=(v:unknown)=>JSON.parse(JSON.stringify(v,(key,value)=>ignore.has(key)?undefined:value))
const results=[]
mkdirSync('docs/playtests/core-mvp-b18',{recursive:true})
for(const example of evidence.examples){
  let s=createCoreMvpGame(example.state.seed,config.economy.initialSavings,config.economy.initialTerm as Term),actions=0
  for(const e of example.state.log){
    if(!['roll','decision','rebalancing','funding'].includes(e.kind))continue
    for(let i=0;i<5&&(s.phase!==e.before.phase||s.lap!==e.before.lap);i++)s=advance(s)
    assert.deepEqual(comparable(snapshot(s)),comparable(e.before),`Frozen B economic snapshot before ${e.sequence}/${example.row.policy}`)
    if(e.kind==='roll')s=roll(s)
    else if(e.kind==='decision')s=decide(s,e.decisionId)
    else if(e.kind==='rebalancing')s=transact(s,e.action)
    else {const source=e.decisionId.slice(5) as FundingSource,lot=e.before.deposits.find((l:{status:string;id:string})=>l.status==='active'&&e.after.deposits.find((a:{id:string;status:string})=>a.id===l.id)?.status==='withdrawn');const amount=source==='debt'?e.after.portfolio.debt-e.before.portfolio.debt:source==='savings'?lot.principal:e.forcedAssetSaleAmount;s=fundPayment(s,source,amount,source==='bonds'?e.fundingLotId:lot?.id)}
    actions++
  }
  for(let i=0;s.phase!=='finished'&&i<5;i++)s=advance(s)
  assert.deepEqual(comparable(snapshot(s)),comparable(snapshot(example.state)))
  assert.equal(liquidatableFunds(s),example.row.proceeds);assert.equal(victory(s).won,example.row.won)
  results.push({policy:example.row.policy,seed:s.seed,actions,proceeds:liquidatableFunds(s),won:victory(s).won,rng:s.rng})
  writeFileSync(`docs/playtests/core-mvp-b18/frozen-B-${example.row.policy}.json.gz`,gzipSync(serializeLog(s)))
}
writeFileSync('docs/playtests/core-mvp-b18/frozen-B-config.json',JSON.stringify(config,null,2)+'\n')
writeFileSync('docs/playtests/core-mvp-b18/research-parity.json',JSON.stringify({sourceRef:'33de122',sourcePath:'docs/research/trading-ab/main/interaction-learning-liquidity.new.examples.json.gz',sourceSha256:createHash('sha256').update(bytes).digest('hex'),games:results.length,compared:'Every economic snapshot, final market/credit/RNG/proceeds/win. Only intentional version/board identity metadata excluded.',goalChange:'90M single equals80M+10M; no formula/balance change',results},null,2)+'\n')
console.log(JSON.stringify({matchedFrozenBGames:results.length,allEconomicSnapshotsEqual:true}))
