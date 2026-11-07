import {readFileSync,writeFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
import {createMultiCourseGame} from '../../src/game/new-game.ts'
import {advance,roll,decide,transact,fundPayment,snapshot} from '../../src/game/engine.ts'
import {serializeLog} from '../../src/game/log.ts'
import {replayGameLog} from './replay-game-log.ts'
import type {FundingSource} from '../../src/game/types.ts'
const source='docs/playtests/core-mvp-b18-multi-course/frozen-shortlist-diversified-roi.json.gz'
const d=JSON.parse(gunzipSync(readFileSync(source)).toString('utf8'))
replayGameLog(d)
const initial=d.entries[0].after,deposit=initial.deposits[0]
let s=createMultiCourseGame(d.seed,initial.portfolio.savings,deposit?deposit.maturityLap-deposit.startLap+1:3)
let found=false
for(const e of d.entries){
 if(!['roll','decision','rebalancing','funding'].includes(e.kind))continue
 for(let i=0;i<4&&(s.phase!==e.before.phase||s.lap!==e.before.lap);i++)s=advance(s)
 assert.deepEqual(snapshot(s),e.before)
 if(s.phase==='event'&&s.eventId==='stocks'&&s.portfolio.stocks>0){
  const path='docs/playtests/b18-release-qa/stock-resale-checkpoint.json';writeFileSync(path,serializeLog(s));replayGameLog(JSON.parse(readFileSync(path,'utf8')))
  found=true;console.log(JSON.stringify({path,source,method:'Exact legal replay prefix from a frozen natural parity game. No injected fields. Browser import is a fixture check, not a full UI game.',turn:s.turn,stockValue:s.portfolio.stocks}));break
 }
 if(e.kind==='roll')s=roll(s)
 else if(e.kind==='decision')s=decide(s,e.decisionId)
 else if(e.kind==='rebalancing')s=transact(s,e.action)
 else{const a=e.decisionId.slice(5) as FundingSource;const lot=e.before.deposits.find((l:{id:string;status:string})=>l.status==='active'&&e.after.deposits.find((x:{id:string})=>x.id===l.id)?.status==='withdrawn');s=fundPayment(s,a,a==='debt'?e.debtDelta:a==='savings'?lot.principal:e.forcedAssetSaleAmount,a==='bonds'?e.fundingLotId:lot?.id)}
}
assert.ok(found,'Source must contain a stock revisit with holdings')
