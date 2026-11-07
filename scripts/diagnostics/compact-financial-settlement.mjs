import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {gunzipSync,gzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
import {advance,decide,roll,transact} from '../../src/game/engine.ts'
import {eventsForGame} from '../../src/data/events.ts'
import {depositPreview,saleQuote} from '../../src/game/selectors.ts'
import {BOND_ISSUERS} from '../../src/data/bond-issuers.ts'
import {serializeLog} from '../../src/game/log.ts'
import {replayGameLog} from './replay-game-log.ts'
const root='docs/playtests/b18-compact-financial-ui',out=`${root}/settlement`
mkdirSync(out,{recursive:true})
const load=id=>JSON.parse(gunzipSync(readFileSync(`${root}/checkpoints/${id}.json.gz`))).state
const results=[]
function until(s,lap){
 for(let i=0;i<200;i++){
  if(s.phase==='summary'&&s.lap===lap)return s
  if(s.phase==='rolling')s=roll(s)
  else if(['forecast','summary','rebalancing'].includes(s.phase))s=advance(s)
  else if(s.phase==='event'){
   const event=eventsForGame(s).find(e=>e.id===s.eventId)
   const option=event.options.find(o=>o.id==='skip')??event.options.find(o=>!o.obligation)??event.options[0]
   s=decide(s,option.id)
  }else throw new Error(`Unexpected ${s.phase} in ${s.seed}`)
 }
 throw new Error('No settlement reached')
}
function record(id,s,result){
 const exported=serializeLog(s);replayGameLog(JSON.parse(exported));writeFileSync(`${out}/${id}.json.gz`,gzipSync(exported+'\n'))
 results.push({id,seed:s.seed,lap:s.lap,replayMatched:true,...result})
}
for(const id of ['family','repair']){
 const base=load(id),event=eventsForGame(base).find(e=>e.id===id),o=event.options.find(o=>o.obligation>0)
 let s=decide(base,o.id)
 assert.equal(s.portfolio.cash,base.portfolio.cash-(o.cost??0))
 assert.equal(s.obligations,base.obligations+o.obligation)
 s=until(s,base.lap)
 const line=s.summaries.at(-1).lines.find(l=>l.label==='Nghĩa vụ đã hẹn')
 assert.equal(line.amount,-(base.obligations+o.obligation));assert.equal(s.obligations,0)
 record(id,s,{paidNow:o.cost??0,paidAtEndOfCurrentLoop:-line.amount,notChargedTwice:true})
}
for(const term of [1,2,3]){
 const base=load('bank'),amount=10000000,quote=depositPreview(base,amount,term)
 let s=transact(base,{kind:'deposit',amount,term,symbolId:base.market.stocks[0].id}),lot=s.deposits.at(-1)
 assert.equal(lot.maturityLap,quote.maturityLap)
 for(let lap=base.lap;lap<=quote.maturityLap;lap++){
  s=until(s,lap);assert.equal(s.deposits.at(-1).status,lap<quote.maturityLap?'active':'matured')
 }
 const line=s.summaries.at(-1).lines.find(l=>l.label.includes(lot.id))
 assert.equal(line.amount,amount+quote.interest)
 record('savings-'+term,s,{term,maturityLap:quote.maturityLap,principal:amount,interest:quote.interest,received:line.amount})
}
for(const config of BOND_ISSUERS){
 const base=load('bonds'),amount=8000000
 let s=transact(base,{kind:'buy',asset:'bonds',issuerId:config.id,amount,completeEncounter:true})
 const lot=s.bondLots.at(-1),expected=base.lap+config.term-1
 assert.equal(lot.maturityLap,expected)
 s=until(s,base.lap);s=until(advance(s),expected)
 const actual=s.bondLots.find(l=>l.id===lot.id)
 assert.equal(actual.credit.history.length,config.term)
 assert.equal(actual.credit.history[0].couponDue,Math.round(lot.principal*config.coupon))
 record('bonds-'+config.id,s,{maturityLap:expected,principalContract:lot.principal,history:actual.credit.history,principalPaid:actual.credit.principalPaid,paymentStatus:actual.credit.paymentStatus})
}
const base=load('gold-owned'),quote=saleQuote(base,'gold',base.portfolio.gold)
const sold=transact(base,{kind:'sell',asset:'gold',amount:base.portfolio.gold})
assert.equal(sold.portfolio.cash,base.portfolio.cash+quote.net)
assert.notEqual(quote.fee,Math.round(quote.gross*.01),'Fee is charged after spread, not added to it')
record('gold-sale',sold,{quote,cashIncrease:sold.portfolio.cash-base.portfolio.cash})
writeFileSync(`${out}/results.json`,JSON.stringify({method:'Legal engine continuation from archived UI checkpoints. No injected state, no economy changes.',results},null,2)+'\n')
console.log(JSON.stringify({cases:results.length,passed:true}))
