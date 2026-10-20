import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {replayGameLog} from './replay-game-log.ts'
import {liquidatableFunds,saleQuote,victory} from '../../src/game/selectors.ts'
import type {GameState} from '../../src/game/types.ts'
const root='docs/playtests/b18-release-qa'
const walk=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`])
const results=[]
for(const path of walk(root).filter(p=>p.endsWith('.json.gz'))){
 const bytes=readFileSync(path),data=JSON.parse(gunzipSync(bytes).toString('utf8')),s:GameState=data.state
 replayGameLog(data)
 const expected=s.portfolio.cash+s.deposits.filter(d=>d.status==='active').reduce((n,d)=>n+d.principal,0)+saleQuote(s,'stocks').net+saleQuote(s,'bonds').net+saleQuote(s,'gold').net-s.portfolio.debt-s.obligations-(s.pendingPayment?.remaining??0)
 assert.equal(liquidatableFunds(s),expected);assert.equal(data.finalResult.lawfulProceeds,expected)
 if(s.phase==='finished'){assert.equal(data.finalResult.won,victory(s).won);assert.equal(s.summaries.length,4)}
 const rolls=s.log.filter(e=>e.kind==='roll')
 for(const e of rolls){assert.equal(e.after.position,(e.before.position+e.after.dice)%18);assert.ok(e.after.dice>=1&&e.after.dice<=6)}
 const count=(part:string)=>s.log.filter(e=>e.decisionId===part||e.decisionId===`${part}-complete`).length
 const terms=s.deposits.map(d=>d.maturityLap-d.startLap+1)
 const course=s.log.filter(e=>e.decisionId?.startsWith('course-')).map(e=>({id:e.decisionId,cost:e.expensePaid,boost:e.recurringIncomeDelta,lap:e.lap}))
 const finance=s.log.reduce((n,e)=>{
  for(const asset of ['stocks','bonds','gold'] as const){
   const gross=e.assetSaleAmounts?.[asset]??0
   if(gross>0){const q=saleQuote(e.before as GameState,asset,gross,e.action?.lotId??e.fundingLotId);n.fees+=q.fee;n.spread+=q.spread;assert.equal(q.net,e.cashProceeds)}
  }
  return n
 },{fees:0,spread:0})
 if(s.phase==='finished'){
  const visible=readFileSync(path.replace('.json.gz','-result.txt'),'utf8')
  assert.ok(visible.includes(expected.toLocaleString('vi-VN')),'Result UI must show exported lawful proceeds')
  if(finance.fees+finance.spread>0)assert.ok(visible.includes((finance.fees+finance.spread).toLocaleString('vi-VN')),'Visible transaction-cost feedback must match actual quotes')
  const tuition=course.reduce((n,c)=>n+(c.cost??0),0)
  if(tuition>0)assert.ok(visible.includes(tuition.toLocaleString('vi-VN')),'Visible tuition must match recorded choices')
 }
 results.push({path,sha256:createHash('sha256').update(bytes).digest('hex'),seed:s.seed,schema:data.schemaVersion,phase:s.phase,replayed:true,rolls:rolls.length,board:18,summaries:s.summaries.length,result:data.finalResult,course,terms,counts:Object.fromEntries(['buy-stocks','sell-stocks','buy-bonds','sell-bonds','buy-gold','sell-gold','buy-business','upgrade-business','sell-business','fund-debt','fund-savings','fund-bonds','fund-stocks','fund-gold'].map(id=>[id,count(id)])),portfolio:s.portfolio,unpaidObligations:s.obligations,activeSavingsPrincipal:s.deposits.filter(d=>d.status==='active').reduce((n,d)=>n+d.principal,0),assetNet:Object.fromEntries(['stocks','bonds','gold'].map(a=>[a,saleQuote(s,a as 'stocks'|'bonds'|'gold').net])),finance,excludedBusiness:s.portfolio.business,goalAccountingExact:true})
}
const complete=results.filter(r=>r.phase==='finished')
assert.ok(complete.some(r=>r.result.won));assert.ok(complete.some(r=>!r.result.won))
const report={results,completeNaturalGames:complete.length,allReplayed:true,allFinancialOutcomesExact:true,method:'Logs downloaded through UI. No state construction. Explicit cash + active principal + executable net asset quotes - debts - obligations; locked business/unpaid claims are not added.'}
writeFileSync(`${root}/new-game-verification.json`,JSON.stringify(report,null,2)+'\n')
const columns=['browser','scenario','seed','won','proceeds','cash','activeSavingsPrincipal','stocksNet','bondsNet','goldNet','debt','obligations','excludedBusiness','fees','spread']
const rows=complete.map(r=>[r.path.includes('/firefox/')?'firefox':r.path.includes('/webkit/')?'webkit':'chromium',r.path.split('/').at(-1)!.replace('.json.gz',''),r.seed,r.result.won,r.result.lawfulProceeds,r.portfolio.cash,r.activeSavingsPrincipal,r.assetNet.stocks,r.assetNet.bonds,r.assetNet.gold,r.portfolio.debt,r.unpaidObligations,r.excludedBusiness,r.finance.fees,r.finance.spread])
writeFileSync(`${root}/natural-game-results.csv`,[columns,...rows].map(row=>row.join(',')).join('\n')+'\n')
console.log(JSON.stringify({logs:results.length,completeGames:complete.length,replayed:true}))
