import {readFileSync,writeFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
import {createGame,advance,decide,roll,transact,fundPayment,snapshot} from '../../src/game/engine.ts'
import {serializeLog} from '../../src/game/log.ts'
import {restoreSavedGame} from '../../src/game/saved-game.ts'
import type {GameState,FundingSource,Term} from '../../src/game/types.ts'
for(const [status,file]of [['delayed','browser-delayed'],['defaulted','browser-default-recovery']] as const){
 const data=JSON.parse(gunzipSync(readFileSync(`docs/playtests/bond-credit-v25/${file}.json.gz`)).toString())
 const initial=data.entries[0].after,deposit=initial.deposits[0]
 let s=createGame(data.seed,initial.portfolio.savings,(deposit?deposit.maturityLap-deposit.startLap+1:1) as Term,data.state.gameMode,data.savingsProfile.id,data.businessRulesVersion,data.encounterRulesVersion,initial.market.catalogVersion,data.bondRulesVersion,data.livingExpenseRulesVersion,data.gameplayProfile)
 let checkpoint:GameState|undefined
 const inspect=()=>{if(s.phase==='summary'&&s.bondCredit?.issuers.some(i=>i.status===status)&&s.bondLots.some(l=>l.credit&&l.status==='active'))checkpoint??=s}
 for(const e of data.entries){
  if(!['roll','decision','rebalancing','funding'].includes(e.kind))continue
  for(let i=0;i<4&&(s.phase!==e.before.phase||s.lap!==e.before.lap);i++){s=advance(s);inspect()}
  if(checkpoint)break
  assert.deepEqual(snapshot(s),e.before)
  if(e.kind==='roll')s=roll(s)
  else if(e.kind==='decision')s=decide(s,e.decisionId)
  else if(e.kind==='rebalancing')s=transact(s,e.action)
  else{
   const source=e.decisionId.slice(5) as FundingSource,lot=e.before.deposits.find((l:{status:string;id:string})=>l.status==='active'&&e.after.deposits.find((a:{id:string})=>a.id===l.id)?.status==='withdrawn')
   s=fundPayment(s,source,source==='debt'?e.after.portfolio.debt-e.before.portfolio.debt:source==='savings'?lot.principal:e.forcedAssetSaleAmount,source==='bonds'?e.fundingLotId:lot?.id)
  }
  inspect();if(checkpoint)break
 }
 assert.ok(checkpoint,`Missing natural ${status} summary`)
 const text=serializeLog(checkpoint);assert.deepEqual(restoreSavedGame(text),JSON.parse(JSON.stringify(checkpoint)))
 writeFileSync(`docs/playtests/b18-terminology/${status}-checkpoint.json`,text+'\n')
 console.log(JSON.stringify({status,source:`docs/playtests/bond-credit-v25/${file}.json.gz`,seed:checkpoint.seed,lap:checkpoint.lap,turn:checkpoint.turn,entries:checkpoint.log.length,method:'Exact replay to first qualifying START summary'}))
}
